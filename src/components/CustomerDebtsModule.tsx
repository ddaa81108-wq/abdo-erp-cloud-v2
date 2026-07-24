import React, { useState, useEffect, useMemo } from "react";
import {
  UserPlus,
  Trash2,
  CircleCheck as CheckCircle,
  Clock,
  CircleAlert as AlertCircle,
  SquareCheck as CheckSquare,
  Send,
  CircleCheck as CheckCircle2,
  Copy,
  Calculator,
  Plus,
  X,
  Landmark,
  Pencil,
  Check,
} from "lucide-react";
import {
  ERPState,
  Customer,
  CustomerCycle,
  DebtTransaction,
} from "../types";
import { copySettledImage, openSmartCardStudio } from "../utils/imageExporterUtils";
import { VoiceInputButton } from "./VoiceInputButton";

// ============================================================
// تعريفات CSS للرسوم المتحركة
// ============================================================
const animationStyles = `
  @keyframes fade-in-out {
    0% { opacity: 0; transform: translateY(-10px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
  .animate-fade-in-out {
    animation: fade-in-out 5s ease-in-out infinite;
  }

  @keyframes disintegrate-particle {
    0% { opacity: 1; transform: translate(0, 0) scale(1); }
    100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0); }
  }
  .vaporizing {
    animation: vaporize 0.7s forwards;
    pointer-events: none;
  }
  @keyframes vaporize {
    0% { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(0.5) rotate(10deg); }
  }
`;

// ============================================================
// Helper Function لألوان الكروت (خارج المكون)
// ============================================================
interface CardColorClasses {
  borderT: string;
  text: string;
  bgBadge: string;
}

const DEFAULT_COLORS: CardColorClasses[] = [
  { borderT: "border-t-indigo-500", text: "text-indigo-600", bgBadge: "bg-indigo-50" },
  { borderT: "border-t-purple-500", text: "text-purple-600", bgBadge: "bg-purple-50" },
  { borderT: "border-t-cyan-500", text: "text-cyan-600", bgBadge: "bg-cyan-50" },
  { borderT: "border-t-blue-500", text: "text-blue-600", bgBadge: "bg-blue-50" },
  { borderT: "border-t-teal-500", text: "text-teal-600", bgBadge: "bg-teal-50" },
  { borderT: "border-t-sky-500", text: "text-sky-600", bgBadge: "bg-sky-50" },
];

const getCardColorClasses = (
  daysSinceCreation: number,
  debtBalance: number,
  index: number
): CardColorClasses => {
  if (debtBalance === 0) {
    return { borderT: "border-t-emerald-400", text: "text-emerald-600", bgBadge: "bg-emerald-50" };
  }
  if (debtBalance < 0) {
    return { borderT: "border-t-emerald-400", text: "text-emerald-600", bgBadge: "bg-emerald-50" };
  }
  if (daysSinceCreation > 2) {
    if (daysSinceCreation <= 5) {
      return { borderT: "border-t-amber-500", text: "text-amber-600", bgBadge: "bg-amber-50" };
    } else if (daysSinceCreation <= 10) {
      return { borderT: "border-t-orange-500", text: "text-orange-600", bgBadge: "bg-orange-50" };
    } else if (daysSinceCreation <= 15) {
      return { borderT: "border-t-rose-500", text: "text-rose-600", bgBadge: "bg-rose-50" };
    } else {
      return { borderT: "border-t-red-600", text: "text-red-600", bgBadge: "bg-red-50" };
    }
  }
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length];
};

// ============================================================
// مكون شريط الديون المتأخرة (قابل للضغط)
// ============================================================
const OverdueDebtTicker = ({
  customers,
  onCustomerClick,
}: {
  customers: any[];
  onCustomerClick: (customerId: string) => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const getDaysSinceLastDebt = (historicalTxs: any[]) => {
    const debtTxs = historicalTxs.filter((t: any) => t.type === "debt");
    if (debtTxs.length === 0) return 0;
    const lastDebtDate = new Date(Math.max(...debtTxs.map((t: any) => new Date(t.date).getTime())));
    return Math.floor((Date.now() - lastDebtDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const overdueCustomers = useMemo(() => {
    return customers.filter((acc) => {
      if (acc.debtBalance <= 0) return false;
      const daysSinceLastDebt = getDaysSinceLastDebt(acc.historicalTxs);
      return daysSinceLastDebt > 2;
    });
  }, [customers]);

  useEffect(() => {
    if (overdueCustomers.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % overdueCustomers.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [overdueCustomers.length]);

  if (overdueCustomers.length === 0) {
    return <span className="text-white/80 font-bold text-xs">لا توجد ديون متأخرة</span>;
  }

  const currentCustomer = overdueCustomers[currentIndex];
  const daysSinceLastDebt = getDaysSinceLastDebt(currentCustomer.historicalTxs);

  return (
    <div
      className="flex items-center gap-2 animate-fade-in-out cursor-pointer hover:bg-white/20 p-1 rounded transition-colors w-full justify-center"
      onClick={() => onCustomerClick(currentCustomer.cust.id)}
      title="اضغط لفتح بطاقة العميل"
    >
      <span className="text-white font-bold text-xs">{currentCustomer.cust.name}</span>
      <span className="text-white/80 font-mono text-xs">
        {Math.round(currentCustomer.debtBalance).toLocaleString("en-US")} د.ل
      </span>
      <span className="text-white/60 font-bold text-xs">({daysSinceLastDebt} يوم)</span>
    </div>
  );
};

// ============================================================
// مكون الجزيئات المتطايرة
// ============================================================
const DisintegrationParticles = () => {
  const particles = Array.from({ length: 120 }).map((_, i) => {
    const tx = (Math.random() - 0.5) * 300;
    const ty = (Math.random() - 1) * 300;
    const duration = 0.3 + Math.random() * 0.4;
    const delay = Math.random() * 0.1;
    const rgb = ["148, 163, 184", "203, 213, 225", "15, 23, 42", "226, 232, 240"][Math.floor(Math.random() * 4)];
    const size = Math.random() * 5 + 1;

    const style = {
      "--tx": `${tx}px`,
      "--ty": `${ty}px`,
      backgroundColor: `rgb(${rgb})`,
      width: `${size}px`,
      height: `${size}px`,
      left: `${(Math.random() * 100).toFixed(2)}%`,
      top: `${(Math.random() * 100).toFixed(2)}%`,
      animation: `disintegrate-particle ${duration}s cubic-bezier(0.25, 1, 0.5, 1) ${delay}s forwards`,
    } as React.CSSProperties;

    return (
      <div
        key={i}
        className="absolute rounded-full opacity-100 pointer-events-none shadow-sm"
        style={style}
      />
    );
  });
  return <div className="absolute inset-0 z-50 pointer-events-none overflow-visible">{particles}</div>;
};

// ============================================================
// واجهة Props
// ============================================================
interface CustomerDebtsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: any,
    headers: string[],
    rows: any[][],
    imageType?: "full" | "table" | "card",
    footerMetrics?: any[]
  ) => void;
  searchQuery?: string;
  pendingDeletions?: string[];
  onScheduleDeletion?: (
    type: "customer" | "company" | "merchant" | "deposit" | "transaction",
    itemId: string,
    displayName: string,
    executeDeletion: () => void
  ) => void;
  onCancelDeletion?: (itemId: string) => void;
}

// ============================================================
// المكون الرئيسي
// ============================================================
export default function CustomerDebtsModule({
  state,
  onUpdateState,
  onOpenExporter,
  searchQuery = "",
  pendingDeletions = [],
  onScheduleDeletion,
  onCancelDeletion,
}: CustomerDebtsModuleProps) {
  React.useEffect(() => {
    if (!document.getElementById("customer-debts-styles")) {
      const styleTag = document.createElement("style");
      styleTag.id = "customer-debts-styles";
      styleTag.innerHTML = animationStyles;
      document.head.appendChild(styleTag);
    }
  }, []);

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcRows, setCalcRows] = useState<
    { id: string; value: string; price: string; operator: "multiply" | "divide" | "add" | "subtract" }[]
  >([{ id: "1", value: "", price: "", operator: "multiply" }]);
  const [calcCopied, setCalcCopied] = useState(false);

  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustDebt, setNewCustDebt] = useState("");
  const [newCustCollector, setNewCustCollector] = useState<"abdullah" | "ali">("abdullah");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForRep, setSelectedForRep] = useState<string[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restorableCustomer, setRestorableCustomer] = useState<Customer | null>(null);

  const [vaporizingCustomers, setVaporizingCustomers] = useState<string[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const [showAddDebtInnerModal, setShowAddDebtInnerModal] = useState(false);
  const [innerDebtAmount, setInnerDebtAmount] = useState("");
  const [innerDebtNote, setInnerDebtNote] = useState("");

  // ====== حالات جديدة: تعديل بيانات العميل ======
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [editCustName, setEditCustName] = useState("");
  const [editCustPhone, setEditCustPhone] = useState("");
  const [editCustCollector, setEditCustCollector] = useState<"abdullah" | "ali">("abdullah");

  // ====== حالات جديدة: تعديل معاملة ======
  const [showEditTxModal, setShowEditTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<DebtTransaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState("");
  const [editTxNote, setEditTxNote] = useState("");

  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // توليد رقم مستند فريد
  const generateDocNumber = () => {
    return `مستند-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  // ============================================================
  // تحسين الأداء: حساب القوائم المشتقة باستخدام useMemo
  // ============================================================
  const allActiveAndSettledCustomers = useMemo(() => {
    return state.customers
      .map((cust) => {
        if (cust.isDeleted) return null;
        const activeCycle = state.cycles.find((cy) => cy.customerId === cust.id && cy.status === "active");
        const debtBalance = activeCycle ? activeCycle.currentBalance : 0;
        const historicalTxs = state.debtTransactions.filter((t) => t.customerId === cust.id);
        return { cust, activeCycle, debtBalance, historicalTxs };
      })
      .filter(Boolean) as Array<{
      cust: Customer;
      activeCycle: CustomerCycle | undefined;
      debtBalance: number;
      historicalTxs: DebtTransaction[];
    }>;
  }, [state.customers, state.cycles, state.debtTransactions]);

  const activeCustomersList = useMemo(() => {
    return allActiveAndSettledCustomers.filter((item) =>
      item.cust.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allActiveAndSettledCustomers, searchQuery]);

  const totalOutstandingDebt = useMemo(() => {
    return activeCustomersList.reduce((sum, item) => sum + item.debtBalance, 0);
  }, [activeCustomersList]);

  // ============================================================
  // دوال الحاسبة العائمة
  // ============================================================
  const handleAddCalcRow = () => {
    setCalcRows([...calcRows, { id: Math.random().toString(), value: "", price: "", operator: "multiply" }]);
  };
  const handleUpdateCalcRow = (id: string, field: string, val: string) => {
    setCalcRows(calcRows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };
  const handleRemoveCalcRow = (id: string) => {
    setCalcRows(calcRows.filter((r) => r.id !== id));
  };
  const calculateRowResult = (row: (typeof calcRows)[0]) => {
    const v = parseFloat(row.value) || 0;
    const p = parseFloat(row.price) || 0;
    if (v === 0 && p === 0) return 0;
    let result = 0;
    switch (row.operator) {
      case "multiply": result = v * p; break;
      case "divide": result = p !== 0 ? v / p : 0; break;
      case "add": result = v + p; break;
      case "subtract": result = v - p; break;
    }
    return Math.round(result);
  };
  const totalCalcResult = calcRows.reduce((acc, row) => acc + calculateRowResult(row), 0);
  const handleCopyCalcResult = () => {
    navigator.clipboard.writeText(totalCalcResult.toString());
    setCalcCopied(true);
    setTimeout(() => setCalcCopied(false), 2000);
  };

  React.useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const handleCopyDebtImage = (customerName: string, debtBalance: number) => {
    const type = debtBalance < 0 ? "trust" : "debt";
    openSmartCardStudio({ type, name: customerName, amount: Math.abs(debtBalance), currency: "د.ل" });
    setShowSuccessToast("تم فتح منظومة الكروت الذكية 👑");
  };

  // ============================================================
  // دالة مساعدة: إعادة حساب رصيد الدورة من المعاملات
  // ============================================================
  const recalcCycleBalance = (cycleId: string, transactions: DebtTransaction[]) => {
    const cycle = state.cycles.find((cy) => cy.id === cycleId);
    if (!cycle) return 0;
    const cycleTxs = transactions.filter((t) => t.cycleId === cycleId);
    const initial = cycle.initialBalance || 0;
    const debts = cycleTxs.filter((t) => t.type === "debt").reduce((s, t) => s + t.amount, 0);
    const payments = cycleTxs.filter((t) => t.type === "payment").reduce((s, t) => s + t.amount, 0);
    return initial + debts - payments;
  };

  // ============================================================
  // إضافة عميل جديد
  // ============================================================
  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const initialDebt = Math.round(parseFloat(newCustDebt) || 0);

    if (state.companies.find((c) => c.name.trim().toLowerCase() === newCustName.trim().toLowerCase()) ||
        state.merchants.find((m) => m.name.trim().toLowerCase() === newCustName.trim().toLowerCase())) {
      alert("عذراً، يمنع تكرار الأسماء! هذا الاسم مستخدم مسبقاً في قسم (الشركات أو الموردين). الرجاء تغييره.");
      return;
    }

    const existingActive = state.customers.find((c) => !c.isDeleted && c.name.trim().toLowerCase() === newCustName.trim().toLowerCase());
    if (existingActive) {
      alert(`العميل "${existingActive.name}" مسجل مسبقاً! سيتم فتح بطاقته لإضافة الدين الجديد.`);
      setSelectedCustomerId(existingActive.id);
      setShowAddCustomerModal(false);
      setNewCustName("");
      setNewCustDebt("");
      return;
    }

    const existingDeleted = state.customers.find((c) => c.isDeleted && c.name.trim().toLowerCase() === newCustName.trim().toLowerCase());
    if (existingDeleted) {
      setRestorableCustomer(existingDeleted);
      setShowRestorePrompt(true);
      return;
    }

    createNewCustomer(newCustName.trim(), newCustPhone.trim(), initialDebt, newCustCollector);
  };

  const createNewCustomer = (name: string, phone: string, debtAmount: number, collector: "abdullah" | "ali") => {
    try {
      const id = `cust_${Date.now()}`;
      const newCust: Customer = { id, name, phone, collector, createdAt: new Date().toISOString(), isDeleted: false, type: "customer" };
      const newCycle: CustomerCycle = {
        id: `cycle_${id}_${Date.now()}`,
        customerId: id,
        startDate: new Date().toISOString(),
        status: "active",
        initialBalance: debtAmount,
        currentBalance: debtAmount,
      };

      const updatedTransactions = [...state.debtTransactions];
      if (debtAmount > 0) {
        updatedTransactions.push({
          id: `tx_${Date.now()}`,
          customerId: id,
          cycleId: newCycle.id,
          type: "debt",
          amount: debtAmount,
          currency: "د.ل",
          conversionRate: 1.0,
          date: new Date().toISOString(),
          referenceNo: generateDocNumber(),
          note: "الدين المالي الأول المسجل عند التسجيل",
          postedToTreasury: false,
          createdAt: new Date().toISOString(),
        });
      }

      onUpdateState({ ...state, customers: [...state.customers, newCust], cycles: [...state.cycles, newCycle], debtTransactions: updatedTransactions });
      setNewCustName(""); setNewCustPhone(""); setNewCustDebt("");
      setShowAddCustomerModal(false); setShowRestorePrompt(false); setRestorableCustomer(null);
    } catch (error) {
      alert("حدث خطأ أثناء حفظ بيانات الزبون. الرجاء المحاولة مرة أخرى.");
      console.error("Error creating customer:", error);
    }
  };

  const handleRestoreOldCustomer = () => {
    try {
      if (!restorableCustomer) return;
      const debtAmount = parseFloat(newCustDebt) || 0;

      const updatedCustomers = state.customers.map((c) => {
        if (c.id === restorableCustomer.id) {
          return {
            ...c,
            isDeleted: false,
            phone: newCustPhone.trim() || c.phone,
            collector: newCustCollector || c.collector,
          };
        }
        return c;
      });

      const newCycleId = `cycle_${restorableCustomer.id}_${Date.now()}`;
      const newCycle: CustomerCycle = {
        id: newCycleId,
        customerId: restorableCustomer.id,
        startDate: new Date().toISOString(),
        status: "active",
        initialBalance: debtAmount,
        currentBalance: debtAmount,
      };

      const updatedTransactions = [...state.debtTransactions];
      if (debtAmount > 0) {
        updatedTransactions.push({
          id: `tx_rest_${Date.now()}`,
          customerId: restorableCustomer.id,
          cycleId: newCycleId,
          type: "debt",
          amount: debtAmount,
          currency: "د.ل",
          conversionRate: 1.0,
          date: new Date().toISOString(),
          referenceNo: generateDocNumber(),
          note: "دين جديد مضاف لزبون سابق مسترجع من الأرشيف",
          postedToTreasury: false,
          createdAt: new Date().toISOString(),
        });
      }

      onUpdateState({ ...state, customers: updatedCustomers, cycles: [...state.cycles, newCycle], debtTransactions: updatedTransactions });
      setShowRestorePrompt(false); setShowAddCustomerModal(false);
      setSelectedCustomerId(restorableCustomer.id); setRestorableCustomer(null);
      setNewCustName(""); setNewCustPhone(""); setNewCustDebt("");
    } catch (error) {
      alert("حدث خطأ أثناء استرجاع الزبون. الرجاء المحاولة مرة أخرى.");
      console.error("Error restoring customer:", error);
    }
  };

  // ============================================================
  // إضافة دين داخلي
  // ============================================================
  const handleProcessInnerDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    const currentAcc = allActiveAndSettledCustomers.find((a) => a.cust.id === selectedCustomerId);
    if (!currentAcc) return;

    let targetCycleId = currentAcc.activeCycle?.id;
    let updatedCycles = [...state.cycles];
    const timestamp = new Date().toISOString();
    const amountToAdd = Math.round(parseFloat(innerDebtAmount) || 0);

    if (amountToAdd <= 0) { alert("الرجاء كتابة مبلغ أكبر من الصفر."); return; }

    if (!targetCycleId) {
      targetCycleId = `cycle_${Date.now()}`;
      updatedCycles.push({ id: targetCycleId, customerId: currentAcc.cust.id, startDate: timestamp, status: "active", currentBalance: amountToAdd, initialBalance: amountToAdd });
    } else {
      updatedCycles = updatedCycles.map((cy) => cy.id === targetCycleId ? { ...cy, currentBalance: cy.currentBalance + amountToAdd } : cy);
    }

    const newTx = {
      id: `tx_debt_${Date.now()}`, customerId: currentAcc.cust.id, cycleId: targetCycleId, type: "debt" as const,
      amount: amountToAdd, currency: "د.ل", conversionRate: 1.0, date: timestamp, referenceNo: generateDocNumber(),
      note: innerDebtNote || "إضافة دين جديد من داخل البطاقة", postedToTreasury: false, createdAt: timestamp,
    };

    try {
      onUpdateState({ ...state, cycles: updatedCycles, debtTransactions: [...state.debtTransactions, newTx] });
      setShowAddDebtInnerModal(false); setInnerDebtAmount(""); setInnerDebtNote("");
    } catch (error) {
      alert("حدث خطأ أثناء إضافة الدين. الرجاء المحاولة مرة أخرى.");
      console.error("Error adding debt:", error);
    }
  };

  // ============================================================
  // معالجة السداد
  // ============================================================
  const handleProcessPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    const currentAcc = allActiveAndSettledCustomers.find((a) => a.cust.id === selectedCustomerId);
    if (!currentAcc || !currentAcc.activeCycle) { alert("⚠️ هذا الزبون ليس لديه حساب ديون نشط حالياً."); return; }

    const amountToPay = Math.round(parseFloat(paymentAmount));
    if (isNaN(amountToPay) || amountToPay === 0) { alert("⚠️ الرجاء كتابة مبلغ مالي صحيح."); return; }

    if (paymentType === "full") {
      if (currentAcc.debtBalance <= 0) {
        alert("⚠️ لا يمكن سداد دين كامل لأن العميل ليس عليه دين (الرصيد صفر أو أمانة).");
        return;
      }
      if (amountToPay !== currentAcc.debtBalance) {
        alert(`⚠️ للسداد الكامل، يجب أن تكون القيمة مساوية للرصيد المتبقي وهو: ${currentAcc.debtBalance} د.ل`);
        return;
      }
    } else {
      if (currentAcc.debtBalance > 0 && amountToPay > currentAcc.debtBalance) {
        const excess = amountToPay - currentAcc.debtBalance;
        if (!window.confirm(`⚠️ المبلغ المدخل (${amountToPay} د.ل) يتجاوز الرصيد المتبقي (${currentAcc.debtBalance} د.ل).\nالمبلغ الزائد (${excess} د.ل) سيتم تسجيله كأمانة.\nهل تريد المتابعة؟`)) return;
      } else if (currentAcc.debtBalance < 0) {
        if (!window.confirm(`⚠️ العميل لديه أمانة حالياً (${Math.abs(currentAcc.debtBalance)} د.ل).\nهذه العملية ستقلل من قيمة الأمانة.\nهل تريد المتابعة؟`)) return;
      }
    }

    const txId = `tx_pay_${Date.now()}`;
    const timestamp = new Date().toISOString();
    const paymentTx = {
      id: txId, customerId: selectedCustomerId, cycleId: currentAcc.activeCycle.id, type: "payment" as const,
      amount: amountToPay, currency: "د.ل", conversionRate: 1.0, date: timestamp, referenceNo: generateDocNumber(),
      note: `تم استلام الدفعة | ${paymentNote || "بدون بيان إضافي"}`, postedToTreasury: false, createdAt: timestamp,
    };

    const updatedCycles = state.cycles.map((cy) => {
      if (cy.id === currentAcc.activeCycle?.id) {
        const remaining = cy.currentBalance - amountToPay;
        const cyUpdate: any = { ...cy, currentBalance: remaining, status: remaining === 0 ? ("closed" as const) : ("active" as const) };
        if (remaining === 0) cyUpdate.endDate = timestamp; else delete cyUpdate.endDate;
        return cyUpdate;
      }
      return cy;
    });

    try {
      onUpdateState({ ...state, cycles: updatedCycles, debtTransactions: [...state.debtTransactions, paymentTx] });
      setPaymentAmount(""); setPaymentNote(""); setShowPaymentModal(false);

      if (paymentType === "full") {
        setSelectedCustomerId(null);
        setShowSuccessToast("🎉 تم تسديد الدين بالكامل وإغلاق الدورة المالية بنجاح.");
      } else {
        setShowSuccessToast("🎉 تم خصم الدفعة الجزئية من دين الزبون.");
      }
    } catch (error) {
      alert("حدث خطأ أثناء تسجيل السداد. الرجاء المحاولة مرة أخرى.");
      console.error("Error processing payment:", error);
    }
  };

  // ============================================================
  // 🆕 تعديل بيانات العميل
  // ============================================================
  const openEditCustomerModal = () => {
    const currentAcc = allActiveAndSettledCustomers.find((a) => a.cust.id === selectedCustomerId);
    if (!currentAcc) return;
    setEditCustName(currentAcc.cust.name || "");
    setEditCustPhone(currentAcc.cust.phone || "");
    setEditCustCollector(currentAcc.cust.collector || "abdullah");
    setShowEditCustomerModal(true);
  };

  const handleSaveCustomerEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !editCustName.trim()) return;
    try {
      const updatedCustomers = state.customers.map((c) => {
        if (c.id === selectedCustomerId) {
          return {
            ...c,
            name: editCustName.trim(),
            phone: editCustPhone.trim(),
            collector: editCustCollector,
          };
        }
        return c;
      });
      onUpdateState({ ...state, customers: updatedCustomers });
      setShowEditCustomerModal(false);
      setShowSuccessToast("✅ تم تحديث بيانات العميل بنجاح.");
    } catch (error) {
      alert("حدث خطأ أثناء تحديث بيانات العميل. الرجاء المحاولة مرة أخرى.");
      console.error("Error editing customer:", error);
    }
  };

  // ============================================================
  // 🆕 تعديل معاملة (فتح النافذة)
  // ============================================================
  const openEditTxModal = (tx: DebtTransaction) => {
    setEditingTx(tx);
    setEditTxAmount(String(tx.amount));
    setEditTxNote(tx.note || "");
    setShowEditTxModal(true);
  };

  const handleSaveEditTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const newAmount = Math.round(parseFloat(editTxAmount) || 0);
    if (newAmount <= 0) { alert("الرجاء كتابة مبلغ أكبر من الصفر."); return; }
    try {
      const updatedTransactions = state.debtTransactions.map((t) =>
        t.id === editingTx.id ? { ...t, amount: newAmount, note: editTxNote } : t
      );
      const newBalance = recalcCycleBalance(editingTx.cycleId, updatedTransactions);
      const updatedCycles = state.cycles.map((cy) => {
        if (cy.id === editingTx.cycleId) {
          return {
            ...cy,
            currentBalance: newBalance,
            status: newBalance === 0 ? ("closed" as const) : ("active" as const),
          };
        }
        return cy;
      });
      onUpdateState({ ...state, debtTransactions: updatedTransactions, cycles: updatedCycles });
      setShowEditTxModal(false);
      setEditingTx(null);
      setEditTxAmount("");
      setEditTxNote("");
      setShowSuccessToast("✅ تم تعديل المعاملة وتحديث الرصيد بنجاح.");
    } catch (error) {
      alert("حدث خطأ أثناء تعديل المعاملة. الرجاء المحاولة مرة أخرى.");
      console.error("Error editing transaction:", error);
    }
  };

  // ============================================================
  // 🆕 حذف معاملة (مع إعادة حساب الرصيد)
  // ============================================================
  const handleDeleteTx = (tx: DebtTransaction) => {
    if (!window.confirm("⚠️ هل أنت متأكد من حذف هذه المعاملة؟ سيتم إعادة حساب الرصيد تلقائياً.")) return;
    try {
      const updatedTransactions = state.debtTransactions.filter((t) => t.id !== tx.id);
      const newBalance = recalcCycleBalance(tx.cycleId, updatedTransactions);
      const updatedCycles = state.cycles.map((cy) => {
        if (cy.id === tx.cycleId) {
          return {
            ...cy,
            currentBalance: newBalance,
            status: newBalance === 0 ? ("closed" as const) : ("active" as const),
          };
        }
        return cy;
      });
      onUpdateState({ ...state, debtTransactions: updatedTransactions, cycles: updatedCycles });
      setShowSuccessToast("🗑️ تم حذف المعاملة وتحديث الرصيد بنجاح.");
    } catch (error) {
      alert("حدث خطأ أثناء حذف المعاملة. الرجاء المحاولة مرة أخرى.");
      console.error("Error deleting transaction:", error);
    }
  };

  // ============================================================
  // حذف الزبون
  // ============================================================
  const executeCustomerDeletion = (custId: string) => {
    try {
      const currentState = stateRef.current;
      const custToDel = currentState.customers.find((c) => c.id === custId);
      if (!custToDel || custToDel.isDeleted) {
        setVaporizingCustomers((prev) => prev.filter((id) => id !== custId));
        return;
      }

      const activeCycle = currentState.cycles.find((cy) => cy.customerId === custId && cy.status === "active");
      const transactions = currentState.debtTransactions.filter((t) => t.cycleId === activeCycle?.id);

      const totalDebts = transactions.filter((t) => t.type === "debt").reduce((sum, t) => sum + t.amount, 0);
      const totalPayments = transactions.filter((t) => t.type === "payment").reduce((sum, t) => sum + t.amount, 0);
      const outstanding = (activeCycle?.initialBalance || 0) + totalDebts - totalPayments;
      const timestamp = new Date().toISOString();

      const updatedCycles = currentState.cycles.map((cy) => {
        if (cy.customerId === custId && cy.status === "active") {
          return { ...cy, status: "closed" as const, currentBalance: 0, endDate: timestamp };
        }
        return cy;
      });

      let updatedDebtTransactions = [...currentState.debtTransactions];
      if (outstanding > 0) {
        updatedDebtTransactions.push({
          id: `tx_wipe_${Date.now()}`, customerId: custId, cycleId: activeCycle?.id || "", type: "payment",
          amount: outstanding, currency: "د.ل", conversionRate: 1.0, date: timestamp, referenceNo: generateDocNumber(),
          note: `مسح الحساب وإلغاء الدين بالكامل`, postedToTreasury: false, createdAt: timestamp,
        });
      }

      const updatedCustomers = currentState.customers.map((c) => c.id === custId ? { ...c, isDeleted: true } : c);

      onUpdateState({ ...currentState, customers: updatedCustomers, cycles: updatedCycles, debtTransactions: updatedDebtTransactions });
      setVaporizingCustomers((prev) => prev.filter((id) => id !== custId));
    } catch (error) {
      alert("حدث خطأ أثناء حذف الزبون. الرجاء المحاولة مرة أخرى.");
      console.error("Error deleting customer:", error);
    }
  };

  const handleQuickDelete = (targetCustId?: string) => {
    const custId = targetCustId || selectedCustomerId;
    if (!custId) return;
    if (!targetCustId) setSelectedCustomerId(null);

    const custToDel = state.customers.find((c) => c.id === custId);
    const displayName = custToDel?.name || "زبون";

    if (onScheduleDeletion) {
      setVaporizingCustomers((prev) => [...prev, custId]);
      onScheduleDeletion("customer", custId, displayName, () => executeCustomerDeletion(custId));
    } else {
      setVaporizingCustomers((prev) => [...prev, custId]);
      setTimeout(() => executeCustomerDeletion(custId), 500);
    }
  };

  // ============================================================
  // التصدير
  // ============================================================
  const handleExportSelectedToRep = () => {
    if (selectedForRep.length === 0) { alert("⚠️ الرجاء تحديد زبون واحد على الأقل."); return; }
    const selectedCustomers = activeCustomersList.filter((acc) => selectedForRep.includes(acc.cust.id));
    const headers = ["اسم الزبون", "الرصيد المتبقي (الديون/الأمانات)"];
    const rows = selectedCustomers.map(({ cust, debtBalance }) => {
      let balanceStr = `${Math.round(debtBalance).toLocaleString("en-US")} د.ل`;
      if (debtBalance < 0) balanceStr += " (أمانة)";
      return [cust.name, balanceStr];
    });

    onOpenExporter("كشف الديون للمندوب", { label1: "", value1: "", label2: "", value2: "", label3: "", value3: "" }, headers, rows);
    setSelectionMode(false); setSelectedForRep([]);
  };

  const handleExportSingleCustomerImage = (acc: any) => {
    const sortedTxs = [...acc.historicalTxs].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let runningBalance = 0;
    const rows = sortedTxs.map((t: any) => {
      let debit = 0, credit = 0;
      if (t.type === "debt") { runningBalance += t.amount; credit = t.amount; }
      else if (t.type === "payment") { runningBalance -= t.amount; debit = t.amount; }
      return [
        new Date(t.date).toLocaleDateString("ar-LY") + " " + new Date(t.date).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" }),
        t.note || (credit > 0 ? "تسجيل دين" : "تسجيل دفعة سداد"),
        credit > 0 ? `+${Math.round(credit).toLocaleString("en-US")} ` : "-",
        debit > 0 ? `-${Math.round(debit).toLocaleString("en-US")} ` : "-",
        `${Math.round(runningBalance).toLocaleString("en-US")} د.ل`,
      ];
    });

    const headers = ["تاريخ الحركة", "البيان", "دين جديد (+)", "تسديد (-)", "الرصيد التراكمي"];
    const totalDebts = sortedTxs.filter((t: any) => t.type === "debt").reduce((acc: number, t: any) => acc + t.amount, 0);
    const totalPayments = sortedTxs.filter((t: any) => t.type === "payment").reduce((acc: number, t: any) => acc + t.amount, 0);
    const footerMetrics = [
      { label: "شغل جديد", value: `+${Math.round(totalDebts).toLocaleString("en-US")} د.ل`, colorClass: "text-amber-700" },
      { label: "الدفع اليوم", value: `-${Math.round(totalPayments).toLocaleString("en-US")} د.ل`, colorClass: "text-emerald-700" },
      { label: "الرصيد الحالي", value: `${Math.round(runningBalance).toLocaleString("en-US")} د.ل`, colorClass: "text-rose-700" },
    ];

    onOpenExporter(`كشف حساب الزبون: ${acc.cust.name}`, {
      label1: "الاسم الحالي", value1: acc.cust.name,
      label2: "الرصيد المتبقي", value2: `${Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل${acc.debtBalance < 0 ? " (أمانة)" : ""}`,
      label3: "إجمالي الحركات", value3: `${acc.historicalTxs.length} حركة`,
    }, headers, rows, "table", footerMetrics);
  };

  const selectedAccDetails = allActiveAndSettledCustomers.find((a) => a.cust.id === selectedCustomerId);

  // ============================================================
  // 🆕 ترتيب المعاملات تصاعدياً + تحديد نوع كل معاملة + الرصيد التراكمي
  // ============================================================
  const ledgerRows = useMemo(() => {
    if (!selectedAccDetails) return [];
    const sorted = [...selectedAccDetails.historicalTxs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let running = 0;
    return sorted.map((tx, idx) => {
      if (tx.type === "debt") running += tx.amount;
      else running -= tx.amount;
      // تحديد نوع الصف: إضافة دين / دفع جزء / سداد كامل
      let rowKind: "debt" | "partial" | "full" = "debt";
      if (tx.type === "debt") {
        rowKind = "debt";
      } else {
        // payment: لو الرصيد التراكمي بعد المعاملة = 0 → سداد كامل، وإلا دفع جزء
        rowKind = running === 0 ? "full" : "partial";
      }
      return { tx, running, rowKind, seq: idx + 1 };
    });
  }, [selectedAccDetails]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-4 text-right" dir="rtl">
      {showSuccessToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-10 fade-in duration-300">
          <CheckCircle className="w-5 h-5" />
          <span className="font-bold">{showSuccessToast}</span>
        </div>
      )}

      {!selectionMode ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-600 border border-emerald-500 rounded-xl p-3 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><Landmark className="w-16 h-16 text-white" /></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-extrabold text-xs tracking-wide">إجمالي الديون</span>
                <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-md"><Landmark className="w-4 h-4 text-white" /></div>
              </div>
              <div className="mt-auto">
                <div className="font-mono text-xl font-black text-white tracking-widest drop-shadow-md block mb-1">
                  {Math.round(totalOutstandingDebt).toLocaleString("en-US")} <span className="text-sm font-bold text-white/80">د.ل</span>
                </div>
                <div className="text-[9px] text-white/70 font-semibold bg-white/10 px-2 py-0.5 rounded-md inline-block">{activeCustomersList.length} حساب</div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 rounded-xl p-3 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity"><UserPlus className="w-16 h-16 text-white" /></div>
            <div className="relative z-10 flex flex-col gap-2">
              <button onClick={() => setShowAddCustomerModal(true)} className="flex items-center gap-2 text-right w-full bg-white/20 hover:bg-white/30 p-2 rounded-lg backdrop-blur-md transition-all">
                <div className="bg-white p-1.5 rounded-lg"><UserPlus className="w-4 h-4 text-emerald-600" /></div>
                <span className="text-white font-extrabold text-sm tracking-wide">إضافة عميل</span>
              </button>
              <button onClick={() => setSelectionMode(true)} className="flex items-center gap-2 text-right w-full bg-white/20 hover:bg-white/30 p-2 rounded-lg backdrop-blur-md transition-all">
                <div className="bg-white p-1.5 rounded-lg"><CheckSquare className="w-4 h-4 text-emerald-600" /></div>
                <span className="text-white font-extrabold text-sm tracking-wide">وضع الإرسال</span>
              </button>
            </div>
          </div>

          <div className="bg-emerald-600 border border-emerald-500 rounded-xl p-3 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10"><AlertCircle className="w-16 h-16 text-white" /></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-md"><AlertCircle className="w-4 h-4 text-white" /></div>
                <span className="text-white font-extrabold text-xs tracking-wide">تنبيه الديون المتأخرة</span>
              </div>
              <div className="bg-white/10 rounded-lg p-2 overflow-hidden h-12 flex items-center justify-center">
                <OverdueDebtTicker
                  customers={activeCustomersList}
                  onCustomerClick={(customerId) => setSelectedCustomerId(customerId)}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center shadow-xs">
          <div>
            <h3 className="text-emerald-800 font-black text-sm mb-1 flex items-center gap-2"><CheckSquare className="w-4 h-4" />وضع الإرسال السريع</h3>
            <p className="text-emerald-600 text-[10px] md:text-xs">قم بالضغط على كروت الزبائن بالأسفل (تم تحديد {selectedForRep.length})</p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2">
            <button onClick={() => { setSelectionMode(false); setSelectedForRep([]); }} className="w-full md:w-auto bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer transition-colors">إلغاء</button>
            <button onClick={handleExportSelectedToRep} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] lg:text-xs py-2 px-3 rounded-lg cursor-pointer flex justify-center items-center gap-1 shadow-sm transition-colors">
              <Send className="w-4 h-4" /><span>تصدير التقرير ({selectedForRep.length})</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 content-start">
          {[...activeCustomersList].reverse().map((acc, i) => {
            const isSelected = selectedForRep.includes(acc.cust.id);
            const daysSinceCreation = Math.floor((Date.now() - new Date(acc.cust.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            const clr = getCardColorClasses(daysSinceCreation, acc.debtBalance, i);

            return (
              <div key={acc.cust.id} onClick={(e) => { if ((e.target as Element).closest("button")) return; if (selectionMode) { setSelectedForRep((prev) => prev.includes(acc.cust.id) ? prev.filter((id) => id !== acc.cust.id) : [...prev, acc.cust.id]); } else { setSelectedCustomerId(acc.cust.id); } }}
                className={`bg-white border-x border-b border-t-4 border-slate-200 ${clr.borderT} text-center ${selectionMode && isSelected ? "ring-2 ring-emerald-500 ring-offset-1 scale-105" : "hover:scale-105 hover:shadow-md"} p-2.5 rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center shadow-xs group min-h-[70px] relative ${vaporizingCustomers.includes(acc.cust.id) ? "vaporizing" : ""}`}>
                {vaporizingCustomers.includes(acc.cust.id) && <DisintegrationParticles />}
                {selectionMode && isSelected && <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow-md z-10 scale-90"><CheckCircle2 className="w-4 h-4" /></div>}
                {!selectionMode && (
                  <>
                    <button type="button" onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleQuickDelete(acc.cust.id); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-rose-50 hover:bg-rose-100 text-rose-600 p-1 rounded transition-all cursor-pointer z-10 border border-slate-100 shadow-xs" title="أرشفة ❌"><X className="w-3 h-3" /></button>
                    <button type="button" onClick={async (e) => { e.stopPropagation(); e.preventDefault(); if (Number(acc.debtBalance) === 0) { const success = await copySettledImage(acc.cust.name); if (success) { setShowSuccessToast("تم مشاركة كارت المخالصة بنجاح 📋"); setTimeout(() => setShowSuccessToast(null), 3000); } } else { handleCopyDebtImage(acc.cust.name, acc.debtBalance); } }} className={`absolute top-1 left-7 opacity-0 group-hover:opacity-100 p-1 rounded transition-all cursor-pointer z-10 border shadow-xs ${Number(acc.debtBalance) === 0 ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-slate-100'}`} title={Number(acc.debtBalance) === 0 ? "نسخ كارت المخالصة" : "نسخ كارت الصورة"}><Copy className="w-3 h-3" /></button>
                  </>
                )}
                <h4 className={`font-bold ${clr.text} text-[11px] w-full px-3 truncate mb-1.5`}>{acc.cust.name}</h4>
                {acc.debtBalance > 0 ? (
                  <span className={`font-mono font-black text-rose-600 text-xs ${clr.bgBadge} px-2 py-0.5 rounded border border-rose-100 shadow-xs`}>{Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل</span>
                ) : acc.debtBalance < 0 ? (
                  <span className={`font-mono font-black text-emerald-700 text-xs ${clr.bgBadge} px-2 py-0.5 rounded border border-emerald-200 shadow-xs ring-1 ring-emerald-500`} title="رصيد دائن لصالحه (أمانة)">{Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل</span>
                ) : (
                  <span className={`font-sans font-black text-emerald-600 text-[10px] ${clr.bgBadge} px-2 py-0.5 rounded border border-emerald-100 shadow-xs`}>مسدد ✓</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 🆕 بطاقة كشف الزبون - التصميم الجديد (Top Bar + Ledger + Footer) */}
      {/* ============================================================ */}
      {selectedCustomerId && selectedAccDetails && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-5xl w-full border border-slate-200 flex flex-col max-h-[92vh] text-right">

            {/* الشريط العلوي الموحد (Top Bar) */}
            <div className="flex flex-wrap items-center justify-end gap-2 pb-3 mb-4 border-b border-slate-200">
              {/* اسم العميل (أقصى اليمين) */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl mr-auto">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                <span className="font-black text-sm text-slate-900">{selectedAccDetails.cust.name}</span>
              </div>

              {/* إضافة الدين */}
              <button
                type="button"
                onClick={() => { setInnerDebtAmount(""); setInnerDebtNote(""); setShowAddDebtInnerModal(true); }}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-extrabold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة الدين</span>
              </button>

              {/* دفع جزء من الدين */}
              <button
                type="button"
                onClick={() => { setPaymentType("partial"); setPaymentAmount(""); setShowPaymentModal(true); }}
                className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-extrabold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <CircleCheck className="w-4 h-4" />
                <span>دفع جزء من الدين</span>
              </button>

              {/* السداد الكامل */}
              <button
                type="button"
                onClick={() => { setPaymentType("full"); setPaymentAmount(selectedAccDetails.debtBalance.toString()); setShowPaymentModal(true); }}
                disabled={selectedAccDetails.debtBalance <= 0}
                className={`flex items-center gap-1.5 font-extrabold text-xs px-3 py-2 rounded-xl transition cursor-pointer border ${selectedAccDetails.debtBalance <= 0 ? "bg-slate-100 text-slate-400 border-slate-200 opacity-50 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500"}`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>السداد الكامل</span>
              </button>

              {/* تعديل بيانات */}
              <button
                type="button"
                onClick={openEditCustomerModal}
                className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-extrabold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <Pencil className="w-4 h-4" />
                <span>تعديل بيانات</span>
              </button>

              {/* إغلاق النافذة */}
              <button
                type="button"
                onClick={() => setSelectedCustomerId(null)}
                className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs px-3 py-2 rounded-xl transition cursor-pointer"
              >
                <span>إغلاق النافذة</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* عنوان الجدول */}
            <h4 className="text-center font-black text-base text-slate-800 mb-3 pb-2 border-b-2 border-indigo-400">
              سجل المعاملات والأرشفة
            </h4>

            {/* الجدول الرئيسي (Ledger) */}
            <div className="flex-1 overflow-auto border border-slate-200 rounded-xl bg-white mb-4">
              <table className="w-full text-[11px] border-collapse min-w-[820px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300 sticky top-0 z-10">
                  <tr>
                    <th className="p-2.5 text-center border-l border-slate-200 w-[8%]">التسلسل</th>
                    <th className="p-2.5 text-center border-l border-slate-200 w-[16%]">التاريخ</th>
                    <th className="p-2.5 text-center border-l border-slate-200 w-[12%]">إضافة الدين</th>
                    <th className="p-2.5 text-center border-l border-slate-200 w-[14%]">دفع جزء من الدين</th>
                    <th className="p-2.5 text-center border-l border-slate-200 w-[12%]">السداد الكامل</th>
                    <th className="p-2.5 text-center border-l border-slate-200 w-[14%]">إجمالي الديون</th>
                    <th className="p-2.5 text-center border-l border-slate-200 w-[12%]">تعديل</th>
                    <th className="p-2.5 text-center w-[12%]">مسح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400 text-xs italic">
                        لا توجد أي معاملات مسجلة لهذا العميل بعد.
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map((row) => (
                      <tr key={row.tx.id} className="hover:bg-slate-50 transition-colors">
                        {/* التسلسل */}
                        <td className="p-2 text-center font-bold text-slate-500 border-l border-slate-100">{row.seq}</td>
                        {/* التاريخ */}
                        <td className="p-2 text-center font-mono text-slate-700 border-l border-slate-100">
                          {new Date(row.tx.date).toLocaleDateString("ar-LY")}
                          <br />
                          <span className="text-[10px] text-slate-400">
                            {new Date(row.tx.date).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        {/* إضافة الدين */}
                        <td className="p-2 text-center border-l border-slate-100">
                          {row.rowKind === "debt" ? <Check className="w-5 h-5 mx-auto text-emerald-600" /> : null}
                        </td>
                        {/* دفع جزء */}
                        <td className="p-2 text-center border-l border-slate-100">
                          {row.rowKind === "partial" ? <Check className="w-5 h-5 mx-auto text-emerald-600" /> : null}
                        </td>
                        {/* سداد كامل */}
                        <td className="p-2 text-center border-l border-slate-100">
                          {row.rowKind === "full" ? <Check className="w-5 h-5 mx-auto text-emerald-600" /> : null}
                        </td>
                        {/* إجمالي الديون التراكمي */}
                        <td className="p-2 text-center font-mono font-black text-slate-900 border-l border-slate-100">
                          {Math.round(row.running).toLocaleString("en-US")} د.ل
                        </td>
                        {/* تعديل */}
                        <td className="p-2 text-center border-l border-slate-100">
                          <button
                            type="button"
                            onClick={() => openEditTxModal(row.tx)}
                            className="text-sky-600 hover:text-sky-800 hover:bg-sky-50 p-1 rounded transition mx-auto block"
                            title="تعديل المعاملة"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </td>
                        {/* مسح */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteTx(row.tx)}
                            className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 p-1 rounded transition mx-auto block"
                            title="حذف المعاملة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* القسم السفلي (Footer) - إجمالي الديون المستحقة الآن */}
            <div className="border-2 border-slate-300 rounded-xl p-3 flex items-center justify-between bg-slate-50">
              <span className="font-black text-sm text-slate-800">إجمالي الديون المستحقة الآن</span>
              <span className={`font-mono font-black text-lg ${selectedAccDetails.debtBalance > 0 ? "text-rose-600" : selectedAccDetails.debtBalance < 0 ? "text-emerald-700" : "text-emerald-600"}`}>
                {Math.round(selectedAccDetails.debtBalance).toLocaleString("en-US")} د.ل
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* نافذة إضافة زبون جديد */}
      {/* ============================================================ */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right">
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-indigo-600" /><span>تسجيل زبون ودين مالي جديد</span></h3>
            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الزبون بالكامل *</label>
                <div className="relative">
                  <input type="text" required value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="مثال: صالح الفرجاني" className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50" />
                  <div className="absolute right-1.5 top-1.5"><VoiceInputButton onResult={(text) => setNewCustName((prev) => (prev ? prev + " " + text : text))} /></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (اختياري)</label>
                  <input type="text" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="091-XXXXXXX" className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ الدين المديون به *</label>
                  <div className="relative">
                    <input type="number" required value={newCustDebt} onChange={(e) => setNewCustDebt(e.target.value)} placeholder="0" className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">د.ل</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 mt-3">مُحصّل الدين *</label>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <label className="flex-1 cursor-pointer">
                    <div className={`p-3 rounded-lg text-center transition-all ${newCustCollector === "abdullah" ? "bg-indigo-100 border-2 border-indigo-500 text-indigo-900 font-bold" : "bg-white border border-slate-200 text-slate-600"}`}>
                      <input type="radio" name="collector" className="hidden" checked={newCustCollector === "abdullah"} onChange={() => setNewCustCollector("abdullah")} />ديون عبد الله
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <div className={`p-3 rounded-lg text-center transition-all ${newCustCollector === "ali" ? "bg-emerald-100 border-2 border-emerald-500 text-emerald-900 font-bold" : "bg-white border border-slate-200 text-slate-600"}`}>
                      <input type="radio" name="collector" className="hidden" checked={newCustCollector === "ali"} onChange={() => setNewCustCollector("ali")} />ديون علي
                    </div>
                  </label>
                </div>
              </div>
              {showRestorePrompt && restorableCustomer && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2.5 text-xs text-amber-900 leading-relaxed">
                  <div className="flex items-center gap-1 font-bold text-amber-900"><AlertCircle className="w-4 h-4 text-amber-600" /><span>⚠️ هذا العميل كان مسجلاً سابقاً وسدد ديونه!</span></div>
                  <p className="text-[11px]">المنظومة تفيد بأن الزبون "{restorableCustomer.name}" لديه ملف قديم بالأرشيف. هل تريد استرجاع ملفه القديم ليتصل أرشيفه السابق بالدين الجديد؟</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleRestoreOldCustomer} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 rounded-lg text-[10.5px] transition-colors">نعم، استرجع الحساب واربطه بـ أرشيفه القديم</button>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => { setShowAddCustomerModal(false); setShowRestorePrompt(false); setRestorableCustomer(null); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs">تراجع</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2 rounded-lg">حفظ وتسجيل الزبون</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🆕 نافذة تعديل بيانات العميل */}
      {/* ============================================================ */}
      {showEditCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right">
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-4 flex items-center gap-2"><Pencil className="w-5 h-5 text-purple-600" /><span>تعديل بيانات العميل</span></h3>
            <form onSubmit={handleSaveCustomerEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الزبون بالكامل *</label>
                <input type="text" required value={editCustName} onChange={(e) => setEditCustName(e.target.value)} className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (اختياري)</label>
                <input type="text" value={editCustPhone} onChange={(e) => setEditCustPhone(e.target.value)} placeholder="091-XXXXXXX" className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مُحصّل الدين *</label>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <label className="flex-1 cursor-pointer">
                    <div className={`p-3 rounded-lg text-center transition-all ${editCustCollector === "abdullah" ? "bg-indigo-100 border-2 border-indigo-500 text-indigo-900 font-bold" : "bg-white border border-slate-200 text-slate-600"}`}>
                      <input type="radio" name="edit_collector" className="hidden" checked={editCustCollector === "abdullah"} onChange={() => setEditCustCollector("abdullah")} />ديون عبد الله
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <div className={`p-3 rounded-lg text-center transition-all ${editCustCollector === "ali" ? "bg-emerald-100 border-2 border-emerald-500 text-emerald-900 font-bold" : "bg-white border border-slate-200 text-slate-600"}`}>
                      <input type="radio" name="edit_collector" className="hidden" checked={editCustCollector === "ali"} onChange={() => setEditCustCollector("ali")} />ديون علي
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowEditCustomerModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs">إلغاء</button>
                <button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-5 py-2 rounded-lg">حفظ التعديلات</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 🆕 نافذة تعديل معاملة */}
      {/* ============================================================ */}
      {showEditTxModal && editingTx && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right">
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-3 flex items-center gap-2"><Pencil className="w-5 h-5 text-sky-600" /><span>تعديل المعاملة</span></h3>
            <form onSubmit={handleSaveEditTx} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع المعاملة</label>
                <div className="text-xs font-bold text-slate-500 bg-slate-50 p-2 rounded-lg">
                  {editingTx.type === "debt" ? "🔴 إضافة دين" : "🟢 دفعة سداد"}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ *</label>
                <div className="relative">
                  <input type="number" required value={editTxAmount} onChange={(e) => setEditTxAmount(e.target.value)} className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs font-bold font-mono bg-slate-50/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
                  <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">د.ل</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان / ملاحظة</label>
                <input type="text" value={editTxNote} onChange={(e) => setEditTxNote(e.target.value)} className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50" />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => { setShowEditTxModal(false); setEditingTx(null); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs">إلغاء</button>
                <button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs px-5 py-2 rounded-lg">حفظ التعديل</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* نافذة إضافة دين داخلي */}
      {/* ============================================================ */}
      {showAddDebtInnerModal && selectedAccDetails && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right">
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-rose-500"></span>إضافة دين جديد للعميل: {selectedAccDetails.cust.name}</h3>
            <form onSubmit={handleProcessInnerDebtSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المراد إضافته كدين *</label>
                <div className="relative">
                  <input type="number" required value={innerDebtAmount} onChange={(e) => setInnerDebtAmount(e.target.value)} placeholder="0" className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs font-bold font-mono bg-slate-50/50 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
                  <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">د.ل</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان / ملاحظة (اختياري)</label>
                <div className="relative">
                  <input type="text" value={innerDebtNote} onChange={(e) => setInnerDebtNote(e.target.value)} placeholder="مثال: دين إضافي عن بضاعة" className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
                  <div className="absolute right-1.5 top-1.5"><VoiceInputButton onResult={(text) => setInnerDebtNote((prev) => (prev ? prev + " " + text : text))} /></div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowAddDebtInnerModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors">إلغاء</button>
                <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-5 py-2 rounded-lg transition-all shadow-sm">تأكيد إضافة الدين</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* نافذة السداد */}
      {/* ============================================================ */}
      {showPaymentModal && selectedAccDetails && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right">
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-3">{paymentType === "full" ? "تسجيل سداد دين كامل وتسوية" : "تسجيل سداد جزء وقيد دفعة"}</h3>
            <form onSubmit={handleProcessPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المراد خصمه وتسديده *</label>
                <div className="relative">
                  <input type="number" required disabled={paymentType === "full"} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0" className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs font-bold font-mono bg-slate-50/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]" />
                  <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">د.ل</span>
                </div>
                {paymentType === "full" && <p className="text-[10px] text-slate-400 mt-1">* في الدفع الكامل، يتم جلب رصيد الدين المتبقي للزبون تلقائياً وهو {selectedAccDetails.debtBalance} د.ل.</p>}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظة عامة أو بيان السند (اختياري)</label>
                <div className="relative">
                  <input type="text" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="مثال: مستلم نقدًا بالكامل" className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50" />
                  <div className="absolute right-1.5 top-1.5"><VoiceInputButton onResult={(text) => setPaymentNote((prev) => (prev ? prev + " " + text : text))} /></div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs">إلغاء التراجع</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs px-5 py-2 rounded-lg transition-all">تسجيل السداد والخصم</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* الحاسبة العائمة */}
      {/* ============================================================ */}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col items-start gap-4">
        {showCalculator && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[320px] md:w-[380px] flex flex-col transform origin-bottom-left transition-all animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2"><Calculator className="w-4 h-4 text-indigo-600" />مسودة حاسبة تجار</h3>
              <button onClick={() => setShowCalculator(false)} className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2 mb-3 custom-scrollbar">
                {calcRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    <div className="flex-1"><input type="text" readOnly dir="ltr" value={calculateRowResult(row).toLocaleString(undefined, { maximumFractionDigits: 0 })} className="w-full text-center bg-transparent border-none text-[11px] font-bold font-mono text-indigo-700 focus:outline-none" /></div>
                    <span className="text-slate-400 text-xs font-black">=</span>
                    <div className="w-[70px]"><input type="number" step="any" dir="ltr" lang="en" placeholder="السعر" value={row.price} onChange={(e) => handleUpdateCalcRow(row.id, "price", e.target.value)} className="w-full text-center p-1.5 border border-slate-200 rounded text-xs font-bold font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                    <div className="grid grid-cols-2 gap-0.5 w-[42px]">
                      <button onClick={() => handleUpdateCalcRow(row.id, "operator", "multiply")} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === "multiply" ? "bg-indigo-100 text-indigo-700 font-bold" : "text-slate-400 hover:bg-slate-200"}`} title="ضرب">×</button>
                      <button onClick={() => handleUpdateCalcRow(row.id, "operator", "divide")} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === "divide" ? "bg-indigo-100 text-indigo-700 font-bold" : "text-slate-400 hover:bg-slate-200"}`} title="قسمة">÷</button>
                      <button onClick={() => handleUpdateCalcRow(row.id, "operator", "add")} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === "add" ? "bg-indigo-100 text-indigo-700 font-bold" : "text-slate-400 hover:bg-slate-200"}`} title="جمع">+</button>
                      <button onClick={() => handleUpdateCalcRow(row.id, "operator", "subtract")} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === "subtract" ? "bg-indigo-100 text-indigo-700 font-bold" : "text-slate-400 hover:bg-slate-200"}`} title="طرح">-</button>
                    </div>
                    <div className="w-[70px]"><input type="number" step="any" dir="ltr" lang="en" placeholder="القيمة" value={row.value} onChange={(e) => handleUpdateCalcRow(row.id, "value", e.target.value)} className="w-full text-center p-1.5 border border-slate-200 rounded text-xs font-bold font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" /></div>
                    <button onClick={() => handleRemoveCalcRow(row.id)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <button onClick={handleAddCalcRow} className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 mb-4"><Plus className="w-3.5 h-3.5" />إضافة صف جديد</button>
              <div className="bg-slate-900 rounded-xl p-3 flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-slate-400 text-[10px] font-bold">الناتج الإجمالي</span>
                  <span className="text-white font-mono font-black text-sm" dir="ltr">{Math.round(totalCalcResult).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
                <button onClick={handleCopyCalcResult} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition">
                  {calcCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {calcCopied ? "تم النسخ" : "نسخ الناتج"}
                </button>
              </div>
            </div>
          </div>
        )}
        <button onClick={() => setShowCalculator(!showCalculator)} className={`${showCalculator ? "bg-indigo-600 text-white shadow-indigo-500/25" : "bg-slate-900 text-white shadow-[0_8px_30px_rgb(0,0,0,0.15)]"} hover:scale-105 p-3.5 rounded-full shadow-lg transition-all flex items-center justify-center relative group self-start`} title="مسودة حاسبة تجار">
          <Calculator className="w-5 h-5" />
          {!showCalculator && <span className="absolute left-full ml-3 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none shadow-lg">مسودة حاسبة تجار</span>}
        </button>
      </div>
    </div>
  );
}
