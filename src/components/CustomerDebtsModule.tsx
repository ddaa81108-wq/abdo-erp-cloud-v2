import React, { useState, useEffect } from "react";
import { UserPlus, Calendar, Trash2, CircleCheck as CheckCircle, Clock, CircleAlert as AlertCircle, Camera, Search, X, Check, Landmark, SquareCheck as CheckSquare, Send, FileText, CircleCheck as CheckCircle2, Copy, Calculator, Plus, Minus } from "lucide-react";
import {
  ERPState,
  Customer,
  CustomerCycle,
  DebtTransaction,
  TreasuryTransaction,
} from "../types";
import { copySettledImage, openSmartCardStudio } from "../utils/imageExporterUtils";

import { VoiceInputButton } from "./VoiceInputButton";

interface CustomerDebtsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: any,
    headers: string[],
    rows: any[][],
    imageType?: "full" | "table" | "card",
    footerMetrics?: any[],
  ) => void;
  searchQuery?: string;
  // Global undo deletion system
  pendingDeletions?: string[];
  onScheduleDeletion?: (
    type: 'customer' | 'company' | 'merchant' | 'deposit' | 'transaction',
    itemId: string,
    displayName: string,
    executeDeletion: () => void
  ) => void;
  onCancelDeletion?: (itemId: string) => void;
}

const DisintegrationParticles = () => {
  const particles = Array.from({ length: 120 }).map((_, i) => {
    const tx = (Math.random() - 0.5) * 300; // spread wider
    const ty = (Math.random() - 1) * 300; // fly up higher
    const duration = 0.3 + Math.random() * 0.4; // 0.3s to 0.7s
    const delay = Math.random() * 0.1; // start fast
    const rgb = ["148, 163, 184", "203, 213, 225", "15, 23, 42", "226, 232, 240"][
      Math.floor(Math.random() * 4)
    ]; // varied slate/grey tones
    const size = Math.random() * 5 + 1; // 1px to 6px

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
  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-visible">
      {particles}
    </div>
  );
};

export default function CustomerDebtsModule({
  state,
  onUpdateState,
  onOpenExporter,
  searchQuery = "",
  pendingDeletions = [],
  onScheduleDeletion,
  onCancelDeletion,
}: CustomerDebtsModuleProps) {
  // 1. حالات وإضافة زبون جديد
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // Floating Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcRows, setCalcRows] = useState<{ id: string; value: string; price: string; operator: "multiply" | "divide" | "add" | "subtract" }[]>([
    { id: '1', value: '', price: '', operator: 'multiply' }
  ]);
  const [calcCopied, setCalcCopied] = useState(false);

  // Floating Calculator Logic
  const handleAddCalcRow = () => {
    setCalcRows([...calcRows, { id: Math.random().toString(), value: '', price: '', operator: 'multiply' }]);
  };

  const handleUpdateCalcRow = (id: string, field: string, val: string) => {
    setCalcRows(calcRows.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleRemoveCalcRow = (id: string) => {
    setCalcRows(calcRows.filter(r => r.id !== id));
  };

  const calculateRowResult = (row: typeof calcRows[0]) => {
    const v = parseFloat(row.value) || 0;
    const p = parseFloat(row.price) || 0;
    
    if (v === 0 && p === 0) return 0;
    
    let result = 0;
    switch (row.operator) {
      case 'multiply': result = v * p; break;
      case 'divide': result = p !== 0 ? v / p : 0; break;
      case 'add': result = v + p; break;
      case 'subtract': result = v - p; break;
    }
    return Math.round(result);
  };

  const totalCalcResult = calcRows.reduce((acc, row) => acc + calculateRowResult(row), 0);

  const handleCopyCalcResult = () => {
    navigator.clipboard.writeText(totalCalcResult.toString());
    setCalcCopied(true);
    setTimeout(() => setCalcCopied(false), 2000);
  };
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustDebt, setNewCustDebt] = useState("");
  const [newCustCollector, setNewCustCollector] = useState<'abdullah' | 'ali'>('abdullah');

  // حالة لتصدير المندوب (الواتساب)
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedForRep, setSelectedForRep] = useState<string[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  React.useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const handleCopyDebtImage = (customerName: string, debtBalance: number) => {
    const type = debtBalance < 0 ? "trust" : "debt";
    openSmartCardStudio({
      type,
      name: customerName,
      amount: Math.abs(debtBalance),
      currency: "د.ل",
    });
    setShowSuccessToast("تم فتح منظومة الكروت الذكية 👑");
    setTimeout(() => setShowSuccessToast(null), 3000);
  };

  // حالة للتأكد إذا كان الزبون مسجل سابقاً ومحذوف
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);
  const [restorableCustomer, setRestorableCustomer] = useState<Customer | null>(
    null,
  );

  const [vaporizingCustomers, setVaporizingCustomers] = useState<string[]>([]);

  const stateRef = React.useRef(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 2. حالة فتح بطاقة الزبون (النافذة الكبيرة للزبون المختار)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );

  // 3. حالات دفع الأموال (كامل أو جزء) داخل النافذة الكبيرة
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [paymentAmount, setPaymentAmount] = useState("");

  const delegatesList = state.delegates || [];
  const [paymentNote, setPaymentNote] = useState("");

  // 3.5 حالة إضافة دين جديد داخل النافذة الكبيرة
  const [showAddDebtInnerModal, setShowAddDebtInnerModal] = useState(false);
  const [innerDebtAmount, setInnerDebtAmount] = useState("");
  const [innerDebtNote, setInnerDebtNote] = useState("");

  // 4. حالات حذف الزبون الكلي
  const [quickXCustomer, setQuickXCustomer] = useState<any | null>(null);

  // دالة لتوليد رقم مستند تلقائي وبسيط للحركات
  const generateDocNumber = () => {
    const totalCount = state.debtTransactions.length + 101;
    return `مستند-${totalCount}`;
  };

  // ----------------------------------------------------
  // إضافة زبون جديد أو التحقق مما إذا كان موجوداً سابقاً
  // ----------------------------------------------------
  const handleAddCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    const initialDebt = Math.round(parseFloat(newCustDebt) || 0);

    // البحث في قائمة كل الزبائن (حتى المحذوفين/المؤرشفين سابقاً)
    const existingInCompanies = state.companies.find(
      (c) => c.name.trim().toLowerCase() === newCustName.trim().toLowerCase(),
    );
    const existingInMerchants = state.merchants.find(
      (m) => m.name.trim().toLowerCase() === newCustName.trim().toLowerCase(),
    );

    if (existingInCompanies || existingInMerchants) {
      alert(
        `عذراً، يمنع تكرار الأسماء! هذا الاسم مستخدم مسبقاً في قسم (الشركات أو الموردين). الرجاء تغييره.`,
      );
      return;
    }

    const existingActive = state.customers.find(
      (c) =>
        !c.isDeleted &&
        c.name.trim().toLowerCase() === newCustName.trim().toLowerCase(),
    );

    let finalName = newCustName.trim();

    if (existingActive) {
      alert(
        `العميل "${existingActive.name}" مسجل مسبقاً في الدفاتر! لن يتم تكرار الاسم.\nسيتم الآن فتح بطاقة العميل الحالية لتتمكن من إضافة الدين الجديد من داخل بطاقته.`,
      );
      setSelectedCustomerId(existingActive.id);
      setShowAddCustomerModal(false);
      setNewCustName("");
      setNewCustDebt("");
      return;
    }

    const existingDeleted = state.customers.find(
      (c) =>
        c.isDeleted && c.name.trim().toLowerCase() === finalName.toLowerCase(),
    );

    if (existingDeleted) {
      // الزبون مسجل سابقاً ومحذوف! نعرض رسالة الاختيار
      setRestorableCustomer(existingDeleted);
      setShowRestorePrompt(true);
      return;
    }

    // زبون جديد كلياً
    createNewCustomer(finalName, newCustPhone.trim(), initialDebt, newCustCollector);
  };

  const createNewCustomer = (
    name: string,
    phone: string,
    debtAmount: number,
    collector: 'abdullah' | 'ali'
  ) => {
    const id = `cust_${Date.now()}`;
    const newCust: Customer = {
      id,
      name,
      phone,
      collector,
      createdAt: new Date().toISOString(),
      isDeleted: false,
      type: "customer", // دائماً زبون عادي
    };

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

    onUpdateState({
      ...state,
      customers: [...state.customers, newCust],
      cycles: [...state.cycles, newCycle],
      debtTransactions: updatedTransactions,
    });

    // تصفير الحقول وإغلاق النافذة
    setNewCustName("");
    setNewCustPhone("");
    setNewCustDebt("");
    setShowAddCustomerModal(false);
    setShowRestorePrompt(false);
    setRestorableCustomer(null);
  };

  // دالة استرجاع الزبون القديم مع دمج الأرشيف وحفظ الحركة الجديدة
  const handleRestoreOldCustomer = () => {
    if (!restorableCustomer) return;
    const debtAmount = parseFloat(newCustDebt) || 0;

    // إلغاء كونه محذوفاً
    const updatedCustomers = state.customers.map((c) => {
      if (c.id === restorableCustomer.id) {
        return { ...c, isDeleted: false };
      }
      return c;
    });

    // فتح دورة ديون جديدة نشطة ومستقلة للزبون المعاد تفعيله
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

    onUpdateState({
      ...state,
      customers: updatedCustomers,
      cycles: [...state.cycles, newCycle],
      debtTransactions: updatedTransactions,
    });

    setShowRestorePrompt(false);
    setShowAddCustomerModal(false);
    setSelectedCustomerId(restorableCustomer.id); // فتح تفاصيل حساب الزبون فوراً لرعاية الأرشيف القديم
    setRestorableCustomer(null);
    setNewCustName("");
    setNewCustPhone("");
    setNewCustDebt("");
  };

  // ----------------------------------------------------
  // تصفية الزبائن وتصنيفهم
  // ----------------------------------------------------
  // تحتوي هذه القائمة على كافة الحسابات غير المحذوفة للبحث والوصول وتسجيل العمليات حتى لو كان رصيدها صفراً
  const allActiveAndSettledCustomers = state.customers
    .map((cust) => {
      if (cust.isDeleted) return null;

      // الحصول على الدورة النشطة للديون الخاصة به حالياً
      const activeCycle = state.cycles.find(
        (cy) => cy.customerId === cust.id && cy.status === "active",
      );
      const debtBalance = activeCycle ? activeCycle.currentBalance : 0;

      // كافّة تحركات الديون والدفعات التاريخية لهذا الزبون من البداية للآن
      const historicalTxs = state.debtTransactions.filter(
        (t) => t.customerId === cust.id,
      );

      return {
        cust,
        activeCycle,
        debtBalance,
        historicalTxs,
      };
    })
    .filter(Boolean) as Array<{
    cust: Customer;
    activeCycle: CustomerCycle | undefined;
    debtBalance: number;
    historicalTxs: any[];
  }>;

  // القائمة المعروضة فقط على الشاشة ككروت للديون النشطة والمسواة التي لم تُحذف/تُؤرشف بعد كلياً من الشاشة
  const activeCustomersList = allActiveAndSettledCustomers.filter((item) => {
    const matchesSearch = item.cust.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) as Array<{
    cust: Customer;
    activeCycle: CustomerCycle | undefined;
    debtBalance: number;
    historicalTxs: any[];
  }>;

  // إجمالي الدين المتبقي لجميع الزبائن النشطين المعروضين على الشاشة
  const totalOutstandingDebt = activeCustomersList.reduce(
    (sum, item) => sum + item.debtBalance,
    0,
  );

  // ----------------------------------------------------
  // تسجيل إضافة دين جديد لعميل حالي
  // ----------------------------------------------------
  const handleProcessInnerDebtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    const currentAcc = allActiveAndSettledCustomers.find(
      (a) => a.cust.id === selectedCustomerId,
    );
    if (!currentAcc) return; // shouldn't happen

    let targetCycleId = currentAcc.activeCycle?.id;
    let updatedCycles = [...state.cycles];
    const timestamp = new Date().toISOString();
    const amountToAdd = Math.round(parseFloat(innerDebtAmount) || 0);

    if (amountToAdd <= 0) {
      alert("الرجاء كتابة مبلغ أكبر من الصفر.");
      return;
    }

    if (!targetCycleId) {
      targetCycleId = `cycle_${Date.now()}`;
      updatedCycles.push({
        id: targetCycleId,
        customerId: currentAcc.cust.id,
        startDate: timestamp,
        status: "active",
        currentBalance: amountToAdd,
        initialBalance: amountToAdd,
      });
    } else {
      updatedCycles = updatedCycles.map((cy) => {
        if (cy.id === targetCycleId) {
          return { ...cy, currentBalance: cy.currentBalance + amountToAdd };
        }
        return cy;
      });
    }

    const newTx = {
      id: `tx_debt_${Date.now()}`,
      customerId: currentAcc.cust.id,
      cycleId: targetCycleId,
      type: "debt" as const,
      amount: amountToAdd,
      currency: "د.ل",
      conversionRate: 1.0,
      date: timestamp,
      referenceNo: generateDocNumber(),
      note: innerDebtNote || "إضافة دين جديد (رصيد مستحق) من داخل البطاقة",
      postedToTreasury: false,
      createdAt: timestamp,
    };

    onUpdateState({
      ...state,
      cycles: updatedCycles,
      debtTransactions: [...state.debtTransactions, newTx],
    });

    setShowAddDebtInnerModal(false);
    setInnerDebtAmount("");
    setInnerDebtNote("");
  };

  // ----------------------------------------------------
  // تسجيل السداد (الكامل أو الجزئي)
  // ----------------------------------------------------
  const handleProcessPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    const currentAcc = allActiveAndSettledCustomers.find(
      (a) => a.cust.id === selectedCustomerId,
    );
    if (!currentAcc || !currentAcc.activeCycle) {
      alert("⚠️ هذا الزبون ليس لديه حساب ديون نشط حالياً.");
      return;
    }

    const amountToPay = Math.round(parseFloat(paymentAmount));
    if (isNaN(amountToPay) || amountToPay === 0) {
      alert("⚠️ الرجاء كتابة مبلغ مالي صحيح (لا يمكن أن يكون صفراً).");
      return;
    }

    if (paymentType === "full" && amountToPay !== currentAcc.debtBalance) {
      alert(
        `⚠️ للسداد الكامل، يجب أن تكون القيمة مساوية للرصيد المتبقي وهو: ${currentAcc.debtBalance} د.ل`,
      );
      return;
    }

    const docNum = generateDocNumber();
    const txId = `tx_pay_${Date.now()}`;
    const timestamp = new Date().toISOString();

    const noteText = `تم استلام الدفعة | ${paymentNote || "بدون بيان إضافي"}`;

    // إضافة معاملة سداد دين
    const paymentTx = {
      id: txId,
      customerId: selectedCustomerId,
      cycleId: currentAcc.activeCycle.id,
      type: "payment" as const,
      amount: amountToPay,
      currency: "د.ل",
      conversionRate: 1.0,
      date: timestamp,
      referenceNo: docNum,
      note: noteText,
      postedToTreasury: false,
      createdAt: timestamp,
    };

    // تعديل رصيد دورة الديون
    const updatedCycles = state.cycles.map((cy) => {
      if (cy.id === currentAcc.activeCycle?.id) {
        const remaining = cy.currentBalance - amountToPay;
        const cyUpdate: any = {
          ...cy,
          currentBalance: remaining,
          status: remaining === 0 ? ("closed" as const) : ("active" as const),
        };
        if (remaining === 0) cyUpdate.endDate = timestamp;
        else delete cyUpdate.endDate;
        return cyUpdate;
      }
      return cy;
    });

    onUpdateState({
      ...state,
      cycles: updatedCycles,
      debtTransactions: [...state.debtTransactions, paymentTx],
    });

    setPaymentAmount("");
    setPaymentNote("");
    setShowPaymentModal(false);

    if (paymentType === "full") {
      setSelectedCustomerId(null); // إغلاق البطاقة لانتهاء الدين
      setShowSuccessToast("🎉 تم تسديد الدين بالكامل وإغلاق دورة الزبون المالية بنجاح. يمكنك الآن نسخ كارت المخالصة.");
    } else {
      setShowSuccessToast("🎉 تم خصم الدفعة الجزئية من دين الزبون.");
    }
  };

  // ----------------------------------------------------
  // حذف الزبون الكلي مع الخيارات
  // ----------------------------------------------------
  const executeCustomerDeletion = (custId: string) => {
    const currentState = stateRef.current;
    const custToDel = currentState.customers.find((c) => c.id === custId);
    if (!custToDel || custToDel.isDeleted) {
      setVaporizingCustomers((prev) => prev.filter((id) => id !== custId));
      return;
    }

    const activeCycle = currentState.cycles.find(
      (cy) => cy.customerId === custId && cy.status === "active"
    );

    const transactions = currentState.debtTransactions.filter(
      (t) => t.cycleId === activeCycle?.id
    );
    const totalPurchases = transactions
      .filter((t) => t.type === "purchase")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = transactions
      .filter((t) => t.type === "payment")
      .reduce((sum, t) => sum + t.amount, 0);
    const outstanding = (activeCycle?.startBalance || 0) + totalPurchases - totalPayments;

    const timestamp = new Date().toISOString();
    const docNum = generateDocNumber();

    let updatedDebtTransactions = [...currentState.debtTransactions];

    const updatedCycles = currentState.cycles.map((cy) => {
      if (cy.customerId === custId && cy.status === "active") {
        return {
          ...cy,
          status: "closed" as const,
          currentBalance: 0,
          endDate: timestamp,
        };
      }
      return cy;
    });

    if (outstanding > 0) {
      updatedDebtTransactions.push({
        id: `tx_wipe_${Date.now()}`,
        customerId: custId,
        cycleId: activeCycle?.id || "",
        type: "payment",
        amount: outstanding,
        currency: "د.ل",
        conversionRate: 1.0,
        date: timestamp,
        referenceNo: docNum,
        note: `مسح الحساب وإلغاء الدين بالكامل`,
        postedToTreasury: false,
        createdAt: timestamp,
      });
    }

    const updatedCustomers = currentState.customers.map((c) => {
      if (c.id === custId) {
        return { ...c, isDeleted: true };
      }
      return c;
    });

    onUpdateState({
      ...currentState,
      customers: updatedCustomers,
      cycles: updatedCycles,
      debtTransactions: updatedDebtTransactions,
    });

    setVaporizingCustomers((prev) => prev.filter((id) => id !== custId));
  };

  const handleQuickDelete = (targetCustId?: string) => {
    const custId = targetCustId || selectedCustomerId;
    if (!custId) return;

    if (!targetCustId) {
      setSelectedCustomerId(null);
    }

    const custToDel = state.customers.find((c) => c.id === custId);
    const displayName = custToDel?.name || "زبون";

    if (onScheduleDeletion) {
      setVaporizingCustomers((prev) => [...prev, custId]);
      onScheduleDeletion('customer', custId, displayName, () => {
        executeCustomerDeletion(custId);
      });
    } else {
      setVaporizingCustomers((prev) => [...prev, custId]);
      setTimeout(() => {
        executeCustomerDeletion(custId);
      }, 500);
    }
  };

  // ----------------------------------------------------
  // تصوير شاشات وتقارير مبسطة للواتساب وصناعة الكروت
  // ----------------------------------------------------
  const handleShareWhatsApp = () => {
    if (selectedForRep.length === 0) {
      alert("⚠️ الرجاء تحديد زبون واحد على الأقل للمشاركة.");
      return;
    }
    const selectedCustomers = activeCustomersList.filter((acc) =>
      selectedForRep.includes(acc.cust.id),
    );

    let text = "*كشف حساب سريع*\n\n";
    selectedCustomers.forEach(({ cust, debtBalance }) => {
      if (debtBalance > 0) {
        text += `الاسم: ${cust.name}\nالقيمة المطلوب سدادها: ${Math.round(debtBalance).toLocaleString("en-US")} د.ل\n\n`;
      } else if (debtBalance < 0) {
        text += `الاسم: ${cust.name}\nرصيد دائن لصالحه (له أمانة): ${Math.round(debtBalance).toLocaleString("en-US")} د.ل\n\n`;
      } else {
        text += `الاسم: ${cust.name}\nالرصيد خالص وتم سداده.\n\n`;
      }
    });

    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, "_blank");

    setSelectionMode(false);
    setSelectedForRep([]);
  };

  const handleExportSelectedToRep = () => {
    if (selectedForRep.length === 0) {
      alert("⚠️ الرجاء تحديد زبون واحد على الأقل لتصديره للمندوب.");
      return;
    }
    const selectedCustomers = activeCustomersList.filter((acc) =>
      selectedForRep.includes(acc.cust.id),
    );

    const headers = ["اسم الزبون", "الرصيد المتبقي (الديون/الأمانات)"];
    const rows = selectedCustomers.map(({ cust, debtBalance }) => {
      let balanceStr = `${Math.round(debtBalance).toLocaleString("en-US")} د.ل`;
      if (debtBalance < 0) balanceStr += " (أمانة)";
      return [cust.name, balanceStr];
    });

    onOpenExporter(
      "كشف الديون للمندوب",
      {
        label1: "",
        value1: "",
        label2: "",
        value2: "",
        label3: "",
        value3: "",
      },
      headers,
      rows,
    );

    // الخروج من وضع التحديد بعد التصدير
    setSelectionMode(false);
    setSelectedForRep([]);
  };

  const handleExportSingleCustomerImage = (acc: any) => {
    const sortedTxs = [...acc.historicalTxs].sort(
      (a: any, b: any) =>
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    let runningBalance = 0; // Or whatever previous balance it had. usually 0 for a customer at initial cycle

    const rows = sortedTxs.map((t: any) => {
      let debit = 0;
      let credit = 0;
      if (t.type === "debt") {
        runningBalance += t.amount;
        credit = t.amount;
      } else if (t.type === "payment") {
        runningBalance -= t.amount;
        debit = t.amount;
      }

      return [
        new Date(t.date).toLocaleDateString("ar-LY") +
          " " +
          new Date(t.date).toLocaleTimeString("ar-LY", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        t.note || (credit > 0 ? "تسجيل دين" : "تسجيل دفعة سداد"),
        credit > 0 ? `+${Math.round(credit).toLocaleString("en-US")} ` : "-",
        debit > 0 ? `-${Math.round(debit).toLocaleString("en-US")} ` : "-",
        `${Math.round(runningBalance).toLocaleString("en-US")} د.ل`,
      ];
    });

    const headers = [
      "تاريخ الحركة",
      "البيان",
      "دين جديد (+)",
      "تسديد (-)",
      "الرصيد التراكمي",
    ];

    const totalDebts = sortedTxs
      .filter((t: any) => t.type === "debt")
      .reduce((acc: number, t: any) => acc + t.amount, 0);
    const totalPayments = sortedTxs
      .filter((t: any) => t.type === "payment")
      .reduce((acc: number, t: any) => acc + t.amount, 0);

    const footerMetrics = [
      {
        label: "شغل جديد",
        value: `+${Math.round(totalDebts).toLocaleString("en-US")} د.ل`,
        colorClass: "text-amber-700",
      },
      {
        label: "الدفع اليوم",
        value: `-${Math.round(totalPayments).toLocaleString("en-US")} د.ل`,
        colorClass: "text-emerald-700",
      },
      {
        label: "الرصيد الحالي",
        value: `${Math.round(runningBalance).toLocaleString("en-US")} د.ل`,
        colorClass: "text-rose-700",
      },
    ];

    onOpenExporter(
      `كشف حساب الزبون: ${acc.cust.name}`,
      {
        label1: "الاسم الحالي",
        value1: acc.cust.name,
        label2: "الرصيد المتبقي",
        value2: `${Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل${acc.debtBalance < 0 ? " (أمانة)" : ""}`,
        label3: "إجمالي الحركات",
        value3: `${acc.historicalTxs.length} حركة`,
      },
      headers,
      rows,
      "table",
      footerMetrics,
    );
  };

  const selectedAccDetails = allActiveAndSettledCustomers.find(
    (a) => a.cust.id === selectedCustomerId,
  );

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-10 fade-in duration-300">
          <CheckCircle className="w-5 h-5" />
          <span className="font-bold">{showSuccessToast}</span>
        </div>
      )}

      {/* القسم العلوي: إجمالي الديون وإجراءات الزبائن */}
      {!selectionMode ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          
          {/* صندوق إجمالي الديون */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Landmark className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-white font-extrabold text-sm tracking-wide">
                  إجمالي الديون المطلوبة
                </span>
                <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                  <Landmark className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="mt-auto">
                <div className="font-mono text-3xl font-black text-rose-500 tracking-widest drop-shadow-md block mb-1">
                  {Math.round(totalOutstandingDebt).toLocaleString("en-US")}{" "}
                  <span className="text-lg font-bold text-slate-300">د.ل</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold bg-white/5 px-2 py-1 rounded-md inline-block">
                  {activeCustomersList.length} حساب مفتوح
                </div>
              </div>
            </div>
          </div>

          {/* كرت مدمج: إضافة عميل جديد + وضع الإرسال السريع */}
          <div className="bg-emerald-600 hover:bg-emerald-700 border border-emerald-500 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <UserPlus className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10 flex flex-col gap-3">
              <button
                onClick={() => setShowAddCustomerModal(true)}
                className="flex items-center gap-3 text-right w-full bg-white/20 hover:bg-white/30 p-3 rounded-xl backdrop-blur-md transition-all"
              >
                <div className="bg-white p-2 rounded-xl">
                  <UserPlus className="w-6 h-6 text-emerald-600" />
                </div>
                <span className="text-white font-extrabold text-lg tracking-wide">إضافة عميل جديد</span>
              </button>
              <button
                onClick={() => setSelectionMode(true)}
                className="flex items-center gap-3 text-right w-full bg-white/20 hover:bg-white/30 p-3 rounded-xl backdrop-blur-md transition-all"
              >
                <div className="bg-white p-2 rounded-xl">
                  <CheckSquare className="w-6 h-6 text-emerald-600" />
                </div>
                <span className="text-white font-extrabold text-lg tracking-wide">وضع الإرسال السريع</span>
              </button>
            </div>
          </div>

          {/* بطاقة شريط الأخبار المتحرك للديون المتأخرة */}
          <div className="bg-amber-500 border border-amber-400 rounded-2xl p-5 shadow-2xl relative overflow-hidden lg:col-span-2">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <AlertCircle className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-extrabold text-sm tracking-wide">
                  تنبيه الديون المتأخرة (أكثر من يومين)
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-3 overflow-hidden">
                <div className="flex gap-4 animate-marquee whitespace-nowrap">
                  {[...activeCustomersList]
                    .filter(acc => {
                      const daysSinceCreation = Math.floor((Date.now() - new Date(acc.cust.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                      return daysSinceCreation > 2 && acc.debtBalance > 0;
                    })
                    .map(acc => {
                      const daysSinceCreation = Math.floor((Date.now() - new Date(acc.cust.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <div key={acc.cust.id} className="inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
                          <span className="text-white font-bold text-xs">{acc.cust.name}</span>
                          <span className="text-white/80 font-mono text-xs">{Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل</span>
                          <span className="text-amber-200 font-bold text-xs">({daysSinceCreation} يوم)</span>
                        </div>
                      );
                    })}
                  {[...activeCustomersList].filter(acc => {
                    const daysSinceCreation = Math.floor((Date.now() - new Date(acc.cust.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                    return daysSinceCreation > 2 && acc.debtBalance > 0;
                  }).length === 0 && (
                    <span className="text-white/80 font-bold text-xs">لا توجد ديون متأخرة</span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex justify-between items-center shadow-xs">
          <div>
            <h3 className="text-emerald-800 font-black text-sm mb-1 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              وضع الإرسال السريع
            </h3>
            <p className="text-emerald-600 text-[10px] md:text-xs">
              قم بالضغط على كروت الزبائن بالأسفل (أو سحبها) والمشاركة (تم تحديد{" "}
              {selectedForRep.length})
            </p>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-2">
            <button
              onClick={() => {
                setSelectionMode(false);
                setSelectedForRep([]);
              }}
              className="w-full md:w-auto bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleExportSelectedToRep}
              className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] lg:text-xs py-2 px-3 rounded-lg cursor-pointer flex justify-center items-center gap-1 shadow-sm transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>تصدير التقرير ({selectedForRep.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. شبكة كروت الزبائن */}
      <div className="bg-slate-50/50 p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 content-start">
          {[...activeCustomersList].reverse().map((acc, i) => {
            const isSelected = selectedForRep.includes(acc.cust.id);
            
            // Calculate days since creation
            const daysSinceCreation = Math.floor((Date.now() - new Date(acc.cust.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            
            // Determine card color based on days since creation
            let cardColorClass = "border-t-indigo-500";
            let textColorClass = "text-indigo-600";
            let bgBadgeClass = "bg-indigo-50";
            
            if (daysSinceCreation > 2 && acc.debtBalance > 0) {
              if (daysSinceCreation <= 5) {
                cardColorClass = "border-t-amber-500";
                textColorClass = "text-amber-600";
                bgBadgeClass = "bg-amber-50";
              } else if (daysSinceCreation <= 10) {
                cardColorClass = "border-t-orange-500";
                textColorClass = "text-orange-600";
                bgBadgeClass = "bg-orange-50";
              } else if (daysSinceCreation <= 15) {
                cardColorClass = "border-t-rose-500";
                textColorClass = "text-rose-600";
                bgBadgeClass = "bg-rose-50";
              } else {
                cardColorClass = "border-t-red-600";
                textColorClass = "text-red-600";
                bgBadgeClass = "bg-red-50";
              }
            } else if (Number(acc.debtBalance) === 0) {
              cardColorClass = "border-t-emerald-400";
              textColorClass = "text-emerald-600";
              bgBadgeClass = "bg-emerald-50";
            } else {
              // Default colors for new customers (≤ 2 days)
              const defaultColors = [
                { borderT: "border-t-indigo-500", text: "text-indigo-600", bgBadge: "bg-indigo-50" },
                { borderT: "border-t-purple-500", text: "text-purple-600", bgBadge: "bg-purple-50" },
                { borderT: "border-t-cyan-500", text: "text-cyan-600", bgBadge: "bg-cyan-50" },
                { borderT: "border-t-blue-500", text: "text-blue-600", bgBadge: "bg-blue-50" },
                { borderT: "border-t-teal-500", text: "text-teal-600", bgBadge: "bg-teal-50" },
                { borderT: "border-t-sky-500", text: "text-sky-600", bgBadge: "bg-sky-50" },
              ];
              const defaultClr = defaultColors[i % defaultColors.length];
              cardColorClass = defaultClr.borderT;
              textColorClass = defaultClr.text;
              bgBadgeClass = defaultClr.bgBadge;
            }
            
            const clr = { borderT: cardColorClass, text: textColorClass, bgBadge: bgBadgeClass };

            return (
              <div
                key={acc.cust.id}
                onClick={(e) => {
                  if ((e.target as Element).closest("button")) {
                    return;
                  }
                  if (selectionMode) {
                    setSelectedForRep((prev) =>
                      prev.includes(acc.cust.id)
                        ? prev.filter((id) => id !== acc.cust.id)
                        : [...prev, acc.cust.id],
                    );
                  } else {
                    setSelectedCustomerId(acc.cust.id);
                  }
                }}
                className={`bg-white border-x border-b border-t-4 border-slate-200 ${Number(acc.debtBalance) === 0 ? "border-t-emerald-400 bg-emerald-50/30" : clr.borderT} text-center ${selectionMode && isSelected ? "ring-2 ring-emerald-500 ring-offset-1 scale-105" : "hover:scale-105 hover:shadow-md"} p-2.5 rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center shadow-xs group min-h-[70px] relative ${vaporizingCustomers.includes(acc.cust.id) ? "vaporizing" : ""}`}
              >
                {vaporizingCustomers.includes(acc.cust.id) && <DisintegrationParticles />}
                {selectionMode && isSelected && (
                  <div className="absolute -top-2 -right-2 bg-emerald-500 text-white rounded-full p-0.5 shadow-md z-10 scale-90">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}

                {!selectionMode && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleQuickDelete(acc.cust.id);
                      }}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-rose-50 hover:bg-rose-100 text-rose-600 p-1 rounded transition-all cursor-pointer z-10 border border-slate-100 shadow-xs"
                      title="أرشفة ❌"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (Number(acc.debtBalance) === 0) {
                          const success = await copySettledImage(acc.cust.name);
                          if (success) {
                            setShowSuccessToast("تم مشاركة كارت المخالصة بنجاح 📋");
                            setTimeout(() => setShowSuccessToast(null), 3000);
                          }
                        } else {
                          handleCopyDebtImage(acc.cust.name, acc.debtBalance);
                        }
                      }}
                      className={`absolute top-1 left-7 opacity-0 group-hover:opacity-100 p-1 rounded transition-all cursor-pointer z-10 border shadow-xs ${Number(acc.debtBalance) === 0 ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border-slate-100'}`}
                      title={Number(acc.debtBalance) === 0 ? "نسخ كارت المخالصة" : "نسخ كارت الصورة"}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </>
                )}

                <h4 className={`font-bold ${clr.text} text-[11px] w-full px-3 truncate mb-1.5`}>
                  {acc.cust.name}
                </h4>

                {acc.debtBalance > 0 ? (
                  <span className={`font-mono font-black text-rose-600 text-xs ${clr.bgBadge} px-2 py-0.5 rounded border border-rose-100 shadow-xs`}>
                    {Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل
                  </span>
                ) : acc.debtBalance < 0 ? (
                  <span className={`font-mono font-black text-emerald-700 text-xs ${clr.bgBadge} px-2 py-0.5 rounded border border-emerald-200 shadow-xs ring-1 ring-emerald-500`} title="رصيد دائن لصالحه (أمانة)">
                    {Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل
                  </span>
                ) : (
                  <span className={`font-sans font-black text-emerald-600 text-[10px] ${clr.bgBadge} px-2 py-0.5 rounded border border-emerald-100 shadow-xs`}>
                    مسدد ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/*  نافذة إضافة زبون جديد */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right">
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-650" />
              <span>تسجيل زبون ودين مالي جديد</span>
            </h3>

            <form onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم الزبون بالكامل *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="مثال: صالح الفرجاني"
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <VoiceInputButton onResult={(text) => setNewCustName(prev => (prev ? prev + ' ' + text : text))} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="text"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="091-XXXXXXX"
                    className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    مبلغ الدين المديون به *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={newCustDebt}
                      onChange={(e) => setNewCustDebt(e.target.value)}
                      placeholder="0"
                      className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                    <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">
                      د.ل
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 mt-3">
                  مُحصّل الدين *
                </label>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <label className="flex-1 cursor-pointer">
                    <div className={`p-3 rounded-lg text-center transition-all ${newCustCollector === 'abdullah' ? 'bg-indigo-100 border-2 border-indigo-500 text-indigo-900 font-bold' : 'bg-white border border-slate-200 text-slate-600'}`}>
                      <input type="radio" name="collector" className="hidden" checked={newCustCollector === 'abdullah'} onChange={() => setNewCustCollector('abdullah')} />
                      ديون عبد الله
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <div className={`p-3 rounded-lg text-center transition-all ${newCustCollector === 'ali' ? 'bg-emerald-100 border-2 border-emerald-500 text-emerald-900 font-bold' : 'bg-white border border-slate-200 text-slate-600'}`}>
                      <input type="radio" name="collector" className="hidden" checked={newCustCollector === 'ali'} onChange={() => setNewCustCollector('ali')} />
                      ديون علي
                    </div>
                  </label>
                </div>
              </div>

              {/* إذا تم العثور على زبون يحمل نفس الاسم في المحذوفين */}
              {showRestorePrompt && restorableCustomer && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl space-y-2.5 text-xs text-amber-955 leading-relaxed">
                  <div className="flex items-center gap-1 font-bold text-amber-900">
                    <AlertCircle className="w-4.5 h-4.5 text-amber-600" />
                    <span>⚠️ هذا العميل كان مسجلاً سابقاً وسدد ديونه!</span>
                  </div>
                  <p className="text-[11px]">
                    المنظومة تفيد بأن الزبون "{restorableCustomer.name}" لديه
                    ملف قديم بالأرشيف. هل تريد استرجاع ملفه القديم ليتصل أرشيفه
                    السابق بالدين الجديد، أم إنشاء زبون مفرز جديد بالكامل؟
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRestoreOldCustomer}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 rounded-lg text-[10.5px] transition-colors"
                    >
                      نعم، استرجع الحساب واربطه بـ أرشيفه القديم
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setShowRestorePrompt(false);
                    setRestorableCustomer(null);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-2 rounded-lg"
                >
                  حفظ وتسجيل الزبون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📂 النافذة الكبيرة: تفاصيل أرشيف الزبون وحركات دفوعه التاريخية */}
      {selectedCustomerId && selectedAccDetails && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[90vh] text-right">
            {/* رأس البطاقة */}
            <div className="flex items-center justify-between border-b pb-3.5 mb-4">
              <div>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-sans">
                  بطاقة كشف زبون حالي
                </span>
                <h3 className="font-black text-base text-slate-900 mt-1 flex items-center gap-1">
                  <span>اسم الزبون:</span>
                  <span className="text-indigo-650">
                    {selectedAccDetails.cust.name}
                  </span>
                </h3>
              </div>

              <button
                onClick={() => setSelectedCustomerId(null)}
                className="bg-slate-100 hover:bg-slate-200 p-1 px-3 rounded-lg text-xs font-bold text-slate-700 transition"
              >
                إغلاق النافذة ✕
              </button>
            </div>

            {/* أرقام تجميع ديون هذا الزبون مع تصدير الصورة */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              {selectedAccDetails.debtBalance > 0 ? (
                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
                  <span className="text-rose-800 text-[10px] font-bold block mb-0.5">
                    الرصيد القائم حالياً عليه
                  </span>
                  <span className="text-base font-mono font-black text-rose-600">
                    {Math.round(selectedAccDetails.debtBalance).toLocaleString("en-US")} د.ل
                  </span>
                </div>
              ) : selectedAccDetails.debtBalance < 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl ring-1 ring-emerald-500" title="أمانة">
                  <span className="text-emerald-800 text-[10px] font-bold block mb-0.5">
                    رصيد دائن لصالحه (له أمانة)
                  </span>
                  <span className="text-base font-mono font-black text-emerald-700">
                    {Math.round(selectedAccDetails.debtBalance).toLocaleString("en-US")} د.ل
                  </span>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                  <span className="text-slate-800 text-[10px] font-bold block mb-0.5">
                    الرصيد القائم حالياً
                  </span>
                  <span className="text-base font-mono font-black text-slate-500">
                    مسدد و خالص ✓
                  </span>
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                <span className="text-emerald-800 text-[10px] font-bold block mb-0.5">
                  مجموع الدفوعات المسددة من قبل
                </span>
                <span className="text-base font-mono font-black text-emerald-700">
                  {Math.round(selectedAccDetails.historicalTxs
                    .filter((t) => t.type === "payment")
                    .reduce((sum, t) => sum + t.amount, 0)
                  ).toLocaleString("en-US")}{" "}
                  د.ل
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 font-bold text-[10px] block mb-0.5">
                      إرسال كشف للزبون
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      اضغط لتصدير نسخة مخصصة للواتساب
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {selectedAccDetails.debtBalance === 0 ? (
                      <button
                        onClick={async () => {
                          const success = await copySettledImage(selectedAccDetails.cust.name);
                          if (success) {
                            setShowSuccessToast("تم مشاركة كارت المخالصة بنجاح 📋");
                            setTimeout(() => setShowSuccessToast(null), 3000);
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg p-1.5 px-3 text-[10px] font-bold cursor-pointer flex justify-center gap-1 items-center shadow-md border border-emerald-500"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        نسخ كارت المخالصة 📋
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleCopyDebtImage(selectedAccDetails.cust.name, selectedAccDetails.debtBalance)
                        }
                        className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg p-1.5 px-3 text-[10px] font-bold cursor-pointer flex justify-center gap-1 items-center"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        نسخ كارت الدين السريع 📋
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* الأرشيف وحركات الدفوعات التاريخية */}
            <div className="flex-1 overflow-y-auto border border-slate-150 rounded-xl p-3 bg-slate-50 mb-4 min-h-[160px]">
              <h4 className="text-xs font-extrabold text-slate-700 mb-2.5 pb-1.5 border-b border-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-500 font-bold" />
                <span>
                  أرشيف الزبون (جميع الحركات التاريخية، السابقة والجديدة مع
                  الوقت والتاريخ والنوع)
                </span>
              </h4>

              {selectedAccDetails.historicalTxs.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">
                  لا توجد أي حركات دفع أو دين مسجلة في كشف حساب الزبون بعد.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-200 text-slate-700 font-bold border-b border-slate-300">
                        <th className="p-2 text-right">الوقت والتاريخ</th>
                        <th className="p-2 text-right">
                          الحركة (خيار الدفع / الذمة)
                        </th>
                        <th className="p-2 text-right">رقم المستند</th>
                        <th className="p-2 text-left">قيمة الحركة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {[...selectedAccDetails.historicalTxs]
                        .reverse()
                        .map((tx) => (
                          <tr
                            key={tx.id}
                            className="hover:bg-slate-50 font-mono"
                          >
                            <td className="p-2 font-sans text-[10.5px]">
                              {new Date(tx.date).toLocaleDateString("ar-LY")}{" "}
                              {new Date(tx.date).toLocaleTimeString("ar-LY", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="p-2">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                                  tx.type === "debt"
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {tx.type === "debt"
                                  ? "🔴 إضافة دين (مستحق)"
                                  : "🟢 سداد دفعة (مدفوع)"}
                              </span>
                            </td>
                            <td className="p-2 text-slate-500">
                              {tx.referenceNo}
                            </td>
                            <td
                              className={`p-2 text-left font-black ${
                                tx.type === "debt"
                                  ? "text-rose-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {Math.round(tx.amount).toLocaleString("en-US")} د.ل
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* شريط الإجراءات السفلي (سداد كامل/جزء ومسح الحساب) */}
            <div className="border-t pt-3 flex flex-wrap gap-2 justify-between items-center">
              {/* تصفير وحذف الزبون بالأول */}
              <button
                onClick={() => handleQuickDelete()}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs p-2.5 px-4 rounded-xl flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>مسح وإلغاء الزبون بالكامل 🗑️</span>
              </button>

              {/* تحصيل بالبوابة */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setInnerDebtAmount("");
                    setInnerDebtNote("");
                    setShowAddDebtInnerModal(true);
                  }}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-xs p-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  🔴 إضافة دين جديد
                </button>

                <button
                  onClick={() => {
                    setPaymentType("partial");
                    setPaymentAmount("");
                    setShowPaymentModal(true);
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-extrabold text-xs p-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  🟢 دفع جزء من الدين
                </button>

                <button
                  onClick={() => {
                    setPaymentType("full");
                    setPaymentAmount(selectedAccDetails.debtBalance.toString());
                    setShowPaymentModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs p-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
                >
                  ✅ سداد كامل وتصفير
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 نافذة إضافة دين جديد من داخل البطاقة */}
      {showAddDebtInnerModal && selectedAccDetails && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right">
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              إضافة دين جديد للعميل: {selectedAccDetails.cust.name}
            </h3>

            <form onSubmit={handleProcessInnerDebtSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 mb-1">
                  المبلغ المراد إضافته كدين *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    value={innerDebtAmount}
                    onChange={(e) => setInnerDebtAmount(e.target.value)}
                    placeholder="0"
                    className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs font-bold font-mono bg-slate-50/50 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                  />
                  <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">
                    د.ل
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  البيان / ملاحظة (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={innerDebtNote}
                    onChange={(e) => setInnerDebtNote(e.target.value)}
                    placeholder="مثال: دين إضافي عن بضاعة"
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <VoiceInputButton onResult={(text) => setInnerDebtNote(prev => (prev ? prev + ' ' + text : text))} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddDebtInnerModal(false)}
                  className="bg-slate-150 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-5 py-2 rounded-lg transition-all shadow-sm"
                >
                  تأكيد إضافة الدين
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔴 نافذة اختيار التحصيل وسداد الدفعات */}
      {showPaymentModal && selectedAccDetails && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right">
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-3">
              {paymentType === "full"
                ? "تسجيل سداد دين كامل وتسوية"
                : "تسجيل سداد جزء وقيد دفعة"}
            </h3>

            <form onSubmit={handleProcessPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-650 mb-1">
                  المبلغ المراد خصمه وتسديده *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    disabled={paymentType === "full"}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs font-bold font-mono bg-slate-50/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                  />
                  <span className="absolute left-3 top-2 text-slate-400 text-xs font-bold">
                    د.ل
                  </span>
                </div>
                {paymentType === "full" && (
                  <p className="text-[10px] text-slate-405 mt-1">
                    * في الدفع الكامل، يتم جلب رصيد الدين المتبقي للزبون
                    تلقائياً وهو {selectedAccDetails.debtBalance} د.ل.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ملاحظة عامة أو بيان السند (اختياري)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="مثال: مستلم نقدًا بالكامل"
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <VoiceInputButton onResult={(text) => setPaymentNote(prev => (prev ? prev + ' ' + text : text))} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="bg-slate-150 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-xs"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs px-5 py-2 rounded-lg transition-all"
                >
                  تسجيل السداد والخصم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Calculator Component */}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col items-start gap-4">
        {showCalculator && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[320px] md:w-[380px] flex flex-col transform origin-bottom-left transition-all animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                مسودة حاسبة تجار
              </h3>
              <button
                onClick={() => setShowCalculator(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2 mb-3 custom-scrollbar">
                {calcRows.map((row, index) => (
                  <div key={row.id} className="flex items-center gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    {/* Result (Readonly) */}
                    <div className="flex-1">
                      <input
                        type="text"
                        readOnly
                        dir="ltr"
                        value={calculateRowResult(row).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        className="w-full text-center bg-transparent border-none text-[11px] font-bold font-mono text-indigo-700 focus:outline-none"
                      />
                    </div>
                    
                    {/* Equals Sign */}
                    <span className="text-slate-400 text-xs font-black">=</span>
                    
                    {/* Price */}
                    <div className="w-[70px]">
                      <input
                        type="number"
                        step="any"
                        dir="ltr"
                        lang="en"
                        data-arrow-nav="true"
                        placeholder="السعر"
                        value={row.price}
                        onChange={(e) => handleUpdateCalcRow(row.id, 'price', e.target.value)}
                        className="w-full text-center p-1.5 border border-slate-200 rounded text-xs font-bold font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>

                    {/* Operator */}
                    <div className="grid grid-cols-2 gap-0.5 w-[42px]">
                      <button
                        onClick={() => handleUpdateCalcRow(row.id, 'operator', 'multiply')}
                        className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === 'multiply' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="ضرب"
                      >
                        ×
                      </button>
                      <button
                        onClick={() => handleUpdateCalcRow(row.id, 'operator', 'divide')}
                        className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === 'divide' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="قسمة"
                      >
                        ÷
                      </button>
                      <button
                        onClick={() => handleUpdateCalcRow(row.id, 'operator', 'add')}
                        className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === 'add' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="جمع"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleUpdateCalcRow(row.id, 'operator', 'subtract')}
                        className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === 'subtract' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="طرح"
                      >
                        -
                      </button>
                    </div>

                    {/* Value */}
                    <div className="w-[70px]">
                      <input
                        type="number"
                        step="any"
                        dir="ltr"
                        lang="en"
                        data-arrow-nav="true"
                        placeholder="القيمة"
                        value={row.value}
                        onChange={(e) => handleUpdateCalcRow(row.id, 'value', e.target.value)}
                        className="w-full text-center p-1.5 border border-slate-200 rounded text-xs font-bold font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>

                    {/* Remove Row Button */}
                    <button
                      onClick={() => handleRemoveCalcRow(row.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Row Button */}
              <button
                onClick={handleAddCalcRow}
                className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 mb-4"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة صف جديد
              </button>

              {/* Total Footer */}
              <div className="bg-slate-900 rounded-xl p-3 flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-slate-400 text-[10px] font-bold">الناتج الإجمالي</span>
                  <span className="text-white font-mono font-black text-sm" dir="ltr">
                    {Math.round(totalCalcResult).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <button
                  onClick={handleCopyCalcResult}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  {calcCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {calcCopied ? "تم النسخ" : "نسخ الناتج"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Button */}
        <button
          onClick={() => setShowCalculator(!showCalculator)}
          className={`${showCalculator ? 'bg-indigo-600 text-white shadow-indigo-500/25' : 'bg-slate-900 text-white shadow-[0_8px_30px_rgb(0,0,0,0.15)]'} hover:scale-105 p-3.5 rounded-full shadow-lg transition-all flex items-center justify-center relative group self-start`}
          title="مسودة حاسبة تجار"
        >
          <Calculator className="w-5 h-5" />
          {!showCalculator && (
            <span className="absolute left-full ml-3 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none shadow-lg">
              مسودة حاسبة تجار
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
