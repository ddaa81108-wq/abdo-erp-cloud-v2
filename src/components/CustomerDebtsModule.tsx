import React, { useState, useEffect, useMemo } from "react";
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

  const customerNameSuggestions = React.useMemo(() => {
    const query = newCustName.trim().toLowerCase();
    if (!query) return [];

    const matches = state.customers
      .filter((customer) => customer.name.trim().toLowerCase().includes(query))
      .slice(0, 8)
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));

    return matches.filter((customer, index, arr) => arr.findIndex((item) => item.id === customer.id) === index);
  }, [newCustName, state.customers]);

  const handleSelectSuggestedCustomer = (customer: Customer) => {
    // استرجاع تلقائي لو كان العميل محذوفاً — بدون أسئلة
    if (customer.isDeleted) {
      const restoredCustomers = state.customers.map((c) => {
        if (c.id === customer.id) {
          return { ...c, isDeleted: false, updatedAt: new Date().toISOString(), lastUpdated: new Date().toISOString() };
        }
        return c;
      });
      onUpdateState({ ...state, customers: restoredCustomers });
    }

    setNewCustName(customer.name);
    setNewCustPhone(customer.phone || "");
    setNewCustCollector((customer.collector as "abdullah" | "ali") || "abdullah");
    setSelectedCustomerId(customer.id);
    setShowAddCustomerModal(false);
    setNewCustName("");
    setNewCustDebt("");
    setShowRestorePrompt(false);
    setRestorableCustomer(null);
  };

  // 3.5 حالة إضافة دين جديد داخل النافذة الكبيرة
  const [showAddDebtInnerModal, setShowAddDebtInnerModal] = useState(false);
  const [innerDebtAmount, setInnerDebtAmount] = useState("");
  const [innerDebtNote, setInnerDebtNote] = useState("");

  // 4. حالات حذف الزبون الكلي
  const [quickXCustomer, setQuickXCustomer] = useState<any | null>(null);

  // 5. Debt Aging Alert State
  const [showDebtAlert, setShowDebtAlert] = useState(false);
  const [debtAlertDismissed, setDebtAlertDismissed] = useState(false);
  const [debtAlertBatchIndex, setDebtAlertBatchIndex] = useState(0);
  const [debtAlertFading, setDebtAlertFading] = useState(false);

  const updateCustomerTimestamp = (customers: Customer[], customerId: string, timestamp: string | number) => {
    const normalizedTimestamp = typeof timestamp === "number" ? new Date(timestamp).toISOString() : timestamp;
    return customers.map((cust) =>
      cust.id === customerId
        ? { ...cust, updatedAt: normalizedTimestamp, lastUpdated: normalizedTimestamp }
        : cust,
    );
  };

  const getCustomerLastUpdatedTime = (cust: Customer) => {
    const raw = cust.updatedAt || cust.createdAt || "";
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

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
      // استرجاع تلقائي للزبون المحذوف وفتح بطاقته فوراً — بدون نافذة منبثقة
      const debtAmount = Math.round(parseFloat(newCustDebt) || 0);

      const restoredCustomers = state.customers.map((c) => {
        if (c.id === existingDeleted.id) {
          return { ...c, isDeleted: false };
        }
        return c;
      });

      const newCycleId = `cycle_${existingDeleted.id}_${Date.now()}`;
      const newCycle: CustomerCycle = {
        id: newCycleId,
        customerId: existingDeleted.id,
        startDate: new Date().toISOString(),
        status: "active",
        initialBalance: debtAmount,
        currentBalance: debtAmount,
      };

      const updatedTransactions = [...state.debtTransactions];
      if (debtAmount > 0) {
        updatedTransactions.push({
          id: `tx_rest_${Date.now()}`,
          customerId: existingDeleted.id,
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
        customers: updateCustomerTimestamp(restoredCustomers, existingDeleted.id, Date.now()),
        cycles: [...state.cycles, newCycle],
        debtTransactions: updatedTransactions,
      });

      setSelectedCustomerId(existingDeleted.id);
      setShowAddCustomerModal(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustDebt("");
      setShowRestorePrompt(false);
      setRestorableCustomer(null);
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
    const timestamp = new Date().toISOString();
    const newCust: Customer = {
      id,
      name,
      phone,
      collector,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastUpdated: timestamp,
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
      customers: updateCustomerTimestamp(updatedCustomers, restorableCustomer.id, Date.now()),
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
  const sortedCustomers = [...state.customers]
    .filter((cust) => !cust.isDeleted)
    .sort((a, b) => getCustomerLastUpdatedTime(b) - getCustomerLastUpdatedTime(a));

  const allActiveAndSettledCustomers = sortedCustomers.map((cust) => {
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

  const sortedActiveCustomers = [...activeCustomersList].sort((a, b) => {
    const dateA = new Date(a.cust.updatedAt || a.cust.createdAt || 0).getTime();
    const dateB = new Date(b.cust.updatedAt || b.cust.createdAt || 0).getTime();
    return dateB - dateA;
  });

  // إجمالي الدين المتبقي لجميع الزبائن النشطين المعروضين على الشاشة
  const totalOutstandingDebt = sortedActiveCustomers.reduce(
    (sum, item) => sum + item.debtBalance,
    0,
  );

  // ----------------------------------------------------
  // قائمة العملاء اللي آخر دين عليهم تعدى يومين (لإشعار التنبيه)
  const staleDebtCustomers = useMemo(() => {
    const now = Date.now();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    return allActiveAndSettledCustomers
      .filter((item) => {
        if (item.debtBalance <= 0) return false;

        const debtOnlyTxs = item.historicalTxs
          .filter((tx: any) => tx.type === 'debt' && !tx.isDeleted)
          .sort((a: any, b: any) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );

        if (debtOnlyTxs.length === 0) return false;

        const lastDebtDate = new Date(debtOnlyTxs[0].date).getTime();
        return (now - lastDebtDate) >= twoDaysMs;
      })
      .map((item) => item.cust.name);
  }, [allActiveAndSettledCustomers]);

  // ⏰ Debt Aging Alert — ظهور تلقائي
  useEffect(() => {
    if (staleDebtCustomers.length === 0 || debtAlertDismissed) {
      setShowDebtAlert(false);
      return;
    }

    const showTimer = setTimeout(() => {
      setShowDebtAlert(true);
    }, 3000);

    return () => clearTimeout(showTimer);
  }, [staleDebtCustomers, debtAlertDismissed]);

  // 🔄 تدوير أسماء العملاء
  useEffect(() => {
    if (!showDebtAlert || staleDebtCustomers.length === 0) return;

    const batchSize = 3;
    const totalBatches = Math.ceil(staleDebtCustomers.length / batchSize);

    const interval = setInterval(() => {
      setDebtAlertBatchIndex((prev) => (prev + 1) % totalBatches);
    }, 4000);

    return () => clearInterval(interval);
  }, [showDebtAlert, staleDebtCustomers.length]);

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

    const updatedCustomers = updateCustomerTimestamp(state.customers, currentAcc.cust.id, Date.now());

    onUpdateState({
      ...state,
      customers: updatedCustomers,
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

    const updatedCustomers = updateCustomerTimestamp(state.customers, selectedCustomerId, Date.now());

    onUpdateState({
      ...state,
      customers: updatedCustomers,
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
  // حذف عملية مفردة من أرشيف الزبون مع تعديل الرصيد
  // ----------------------------------------------------
  const handleDeleteArchiveTx = (tx: DebtTransaction) => {
    if (!selectedCustomerId) return;

    const currentAcc = allActiveAndSettledCustomers.find(
      (a) => a.cust.id === selectedCustomerId,
    );
    if (!currentAcc) return;

    // إزالة العملية من قائمة المعاملات
    const updatedTransactions = state.debtTransactions.filter((t) => t.id !== tx.id);

    // تعديل رصيد الدورة بناءً على نوع العملية المحذوفة
    const updatedCycles = state.cycles.map((cy) => {
      if (cy.id === tx.cycleId) {
        const adjustment = tx.type === "debt" ? -tx.amount : tx.amount;
        const newBalance = cy.currentBalance + adjustment;
        return {
          ...cy,
          currentBalance: newBalance,
          status: newBalance <= 0 ? ("closed" as const) : ("active" as const),
          ...(newBalance <= 0 ? { endDate: new Date().toISOString() } : {}),
        };
      }
      return cy;
    });

    onUpdateState({
      ...state,
      cycles: updatedCycles,
      debtTransactions: updatedTransactions,
    });

    setShowSuccessToast("🗑️ تم حذف العملية وتحديث الرصيد.");
  };

  // ----------------------------------------------------
  // تصفير كامل لرصيد الزبون (شطب الدين)
  // ----------------------------------------------------
  const handleResetCustomerDebt = () => {
    if (!selectedCustomerId) return;

    const currentAcc = allActiveAndSettledCustomers.find(
      (a) => a.cust.id === selectedCustomerId,
    );
    if (!currentAcc || !currentAcc.activeCycle) {
      alert("⚠️ هذا الزبون ليس لديه حساب ديون نشط حالياً.");
      return;
    }

    if (currentAcc.debtBalance === 0) {
      alert("✅ رصيد الزبون صفر بالفعل.");
      return;
    }

    const updatedCycles = state.cycles.map((cy) => {
      if (cy.id === currentAcc.activeCycle?.id) {
        return {
          ...cy,
          currentBalance: 0,
          status: "closed" as const,
          endDate: new Date().toISOString(),
        };
      }
      return cy;
    });

    onUpdateState({
      ...state,
      cycles: updatedCycles,
    });

    setSelectedCustomerId(null);
    setShowSuccessToast("🔄 تم تصفير رصيد الزبون بنجاح.");
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
        return { ...c, isDeleted: true, updatedAt: timestamp, lastUpdated: timestamp };
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

  // المجموعة الحالية من الأسماء اللي حتظهر في الإشعار (كل دفعة 3 أسماء)
  const debtAlertBatchSize = 3;
  const debtAlertCurrentBatch = useMemo(() => {
    const start = debtAlertBatchIndex * debtAlertBatchSize;
    return staleDebtCustomers.slice(start, start + debtAlertBatchSize);
  }, [staleDebtCustomers, debtAlertBatchIndex]);

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-10 fade-in duration-300">
          <CheckCircle className="w-5 h-5" />
          <span className="font-bold">{showSuccessToast}</span>
        </div>
      )}

      {/* 🦅 Debt Aging Alert — Center Screen Notification */}
      {showDebtAlert && staleDebtCustomers.length > 0 && (
        <>
          {/* خلفية داكنة شفافة */}
          <div
            className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9997] transition-opacity duration-500 ${debtAlertFading ? 'opacity-0' : 'opacity-100'}`}
            onClick={() => {
              setDebtAlertFading(true);
              setTimeout(() => {
                setDebtAlertDismissed(true);
                setShowDebtAlert(false);
                setDebtAlertFading(false);
              }, 500);
            }}
          />

          {/* صندوق الإشعار في نص الشاشة */}
          <div className={`fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none p-4`}>
            <div className={`bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-8 shadow-[0_0_60px_rgba(245,158,11,0.3)] max-w-md w-full pointer-events-auto debt-alert-popup text-center relative transition-all duration-500 ${debtAlertFading ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
              {/* زر الإغلاق */}
              <button
                onClick={() => {
                  setDebtAlertFading(true);
                  setTimeout(() => {
                    setDebtAlertDismissed(true);
                    setShowDebtAlert(false);
                    setDebtAlertFading(false);
                  }, 500);
                }}
                className="absolute top-3 right-3 text-slate-500 hover:text-white hover:bg-slate-800 p-2 rounded-full transition-colors z-10"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>

              {/* الأيقونة */}
              <div className="text-6xl mb-3 drop-shadow-lg">
                🦅
              </div>

              {/* العنوان */}
              <h2 className="text-xl font-black text-amber-400 mb-5 tracking-wide">
                ⚠️ انتبه! ديون متأخرة
              </h2>

              {/* قائمة الأسماء */}
              <div className="space-y-2.5 mb-3">
                {debtAlertCurrentBatch.map((name, i) => (
                  <div
                    key={`${name}-${i}`}
                    className="debt-alert-name text-white font-extrabold text-base bg-slate-800/80 rounded-2xl py-3 px-5 border border-slate-700/80 shadow-inner"
                  >
                    {name}
                  </div>
                ))}
              </div>

              {/* عداد العملاء */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="text-slate-500 text-xs">
                  {staleDebtCustomers.length} {staleDebtCustomers.length === 1 ? 'عميل' : 'عملاء'} عليهم ديون متأخرة
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 debt-alert-dot animate-pulse" />
              </div>

              {/* نقاط التقدم (pagination dots) */}
              {Math.ceil(staleDebtCustomers.length / debtAlertBatchSize) > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  {Array.from({ length: Math.ceil(staleDebtCustomers.length / debtAlertBatchSize) }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i === debtAlertBatchIndex
                          ? 'bg-amber-400 w-4'
                          : 'bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CSS Animations */}
          <style>{`
            @keyframes debtAlertPopIn {
              0% { transform: scale(0.7); opacity: 0; }
              60% { transform: scale(1.05); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes debtNameSlideUp {
              0% { transform: translateY(10px); opacity: 0; }
              100% { transform: translateY(0); opacity: 1; }
            }
            .debt-alert-popup {
              animation: debtAlertPopIn 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards;
            }
            .debt-alert-name {
              animation: debtNameSlideUp 0.4s ease-out forwards;
            }
          `}</style>
        </>
      )}

      {/* القسم العلوي: إجمالي الديون وإجراءات الزبائن */}
      {!selectionMode ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
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

          {/* كرت إضافة عميل جديد */}
          <button
            onClick={() => setShowAddCustomerModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 rounded-2xl p-5 shadow-2xl relative overflow-hidden group cursor-pointer transition-all flex items-center justify-center gap-3 text-right"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <UserPlus className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md text-white">
                <UserPlus className="w-7 h-7" />
              </div>
              <span className="text-white font-extrabold text-xl tracking-wide">إضافة عميل جديد</span>
            </div>
          </button>

          {/* كرت وضع الإرسال السريع */}
          <button
            onClick={() => setSelectionMode(true)}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl p-5 shadow-2xl relative overflow-hidden group cursor-pointer transition-all flex items-center justify-center gap-3 text-right"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckSquare className="w-24 h-24 text-white" />
            </div>
            <div className="relative z-10 flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md text-white">
                <CheckSquare className="w-7 h-7" />
              </div>
              <span className="text-white font-extrabold text-xl tracking-wide">وضع الإرسال السريع</span>
            </div>
          </button>

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
          {sortedActiveCustomers.map((acc, i) => {
              const isSelected = selectedForRep.includes(acc.cust.id);

            const colors = [
              { bg: "bg-indigo-600", border: "border-indigo-500", text: "text-white", icon: "text-white" },
              { bg: "bg-rose-600", border: "border-rose-500", text: "text-white", icon: "text-white" },
              { bg: "bg-amber-600", border: "border-amber-500", text: "text-white", icon: "text-white" },
              { bg: "bg-emerald-600", border: "border-emerald-500", text: "text-white", icon: "text-white" },
              { bg: "bg-purple-600", border: "border-purple-500", text: "text-white", icon: "text-white" },
              { bg: "bg-teal-600", border: "border-teal-500", text: "text-white", icon: "text-white" },
            ];
            const clr = colors[i % colors.length];

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
                className={`${Number(acc.debtBalance) === 0 ? "bg-emerald-600 border-emerald-400 ring-2 ring-emerald-300 ring-offset-1" : clr.bg + " " + clr.border} border rounded-xl p-2 cursor-pointer transition-all hover:scale-[1.02] shadow-md group min-h-[64px] relative overflow-hidden flex flex-col items-center justify-center ${selectionMode && isSelected ? "ring-2 ring-emerald-500 ring-offset-1 scale-105" : ""} ${vaporizingCustomers.includes(acc.cust.id) ? "vaporizing" : ""}`}
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
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-white/80 hover:bg-white text-rose-600 p-1 rounded-full transition-all cursor-pointer z-10 border border-slate-200 shadow-sm"
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
                      className={`absolute top-1 left-6 opacity-0 group-hover:opacity-100 p-1 rounded-full transition-all cursor-pointer z-10 border border-white/20 bg-white/10 text-white shadow-sm ${Number(acc.debtBalance) === 0 ? 'bg-emerald-100/90 text-emerald-700 border-emerald-200' : ''}`}
                      title={Number(acc.debtBalance) === 0 ? "نسخ كارت المخالصة" : "نسخ كارت الصورة"}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </>
                )}

                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Landmark className="w-12 h-12 text-white" />
                </div>

                <h4 className={`font-extrabold ${Number(acc.debtBalance) === 0 ? 'text-white' : 'text-white'} text-[11px] w-full px-2 truncate mb-1.5 drop-shadow-sm`}>
                  {acc.cust.name}
                </h4>

                {acc.debtBalance > 0 ? (
                  <span className={`font-mono font-black ${Number(acc.debtBalance) > 9999 ? 'text-[10px]' : 'text-xs'} text-white px-2 py-0.5 rounded-2xl border-white/20 shadow-sm`}>
                    {Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل
                  </span>
                ) : acc.debtBalance < 0 ? (
                  <span className={`font-mono font-black text-white text-xs px-2 py-0.5 rounded-2xl border-white/20 shadow-sm`} title="رصيد دائن لصالحه (أمانة)">
                    {Math.round(acc.debtBalance).toLocaleString("en-US")} د.ل
                  </span>
                ) : (
                  <span className={`font-sans font-black text-white text-[10px] px-2 py-0.5 rounded-2xl border-white/20 shadow-sm`}>
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

                  {customerNameSuggestions.length > 0 && (
                    <ul className="absolute top-full mt-2 right-0 left-0 z-[60] max-h-52 overflow-y-auto rounded-2xl border border-white/20 bg-slate-950/80 backdrop-blur-xl shadow-2xl shadow-slate-950/40">
                      {customerNameSuggestions.map((customer) => (
                        <li key={customer.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectSuggestedCustomer(customer)}
                            className="flex w-full items-center justify-between px-3 py-2.5 text-right text-[11px] text-slate-100 transition hover:bg-white/10"
                          >
                            <span className="font-semibold">{customer.name}</span>
                            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                              {customer.isDeleted ? "أرشيف" : "موجود"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
            {/* رأس البطاقة: معلومات الزبون + جميع أزرار العمليات في صف واحد */}
            <div className="flex items-center justify-between border-b pb-3.5 mb-4 gap-3">
              {/* معلومات الزبون - يمين */}
              <div className="shrink-0">
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

              {/* جميع الأزرار في صف واحد - يسار (flex-row-reverse عشان يبدأ من اليسار للإغلاق) */}
              <div className="flex flex-row-reverse items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[11px] px-3 py-2 rounded-lg transition whitespace-nowrap"
                  title="إغلاق النافذة"
                >
                  ✕ إغلاق
                </button>
                <button
                  onClick={() => {
                    setInnerDebtAmount("");
                    setInnerDebtNote("");
                    setShowAddDebtInnerModal(true);
                  }}
                  className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg transition shadow-sm whitespace-nowrap"
                >
                  🔴 إضافة دين
                </button>
                <button
                  onClick={() => {
                    setPaymentType("partial");
                    setPaymentAmount("");
                    setShowPaymentModal(true);
                  }}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg transition shadow-sm whitespace-nowrap"
                >
                  🟢 دفع جزء
                </button>
                <button
                  onClick={() => {
                    setPaymentType("full");
                    setPaymentAmount(selectedAccDetails.debtBalance.toString());
                    setShowPaymentModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg transition shadow-sm whitespace-nowrap"
                >
                  ✅ سداد كامل
                </button>
                <button
                  onClick={handleResetCustomerDebt}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg transition shadow-sm whitespace-nowrap"
                  title="تصفير رصيد الزبون"
                >
                  🔄 تصفير
                </button>
              </div>
            </div>

            {/* بيانات الزبون الأساسية (موجزة) */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                {selectedAccDetails.cust.phone && (
                  <div>📞 <span className="font-mono">{selectedAccDetails.cust.phone}</span></div>
                )}
                {selectedAccDetails.cust.collector && (
                  <div>👤 محصل: <span className="font-bold text-slate-800">{selectedAccDetails.cust.collector}</span></div>
                )}
              </div>
              {/* إجمالي الدين الحالي */}
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-1.5">
                <span className="text-[11px] font-bold text-slate-500">إجمالي الدين:</span>
                <span className={`font-black text-lg font-mono ${selectedAccDetails.debtBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {Math.round(selectedAccDetails.debtBalance).toLocaleString("en-US")} د.ل
                </span>
              </div>
            </div>

            {/* الأرشيف وحركات الدفوعات التاريخية */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 mb-2 min-h-[160px]">
              <div className="sticky top-0 bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2 z-10">
                <Clock className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-extrabold text-slate-700">
                  أرشيف العمليات
                </span>
                <span className="text-[10px] text-slate-400 mr-auto">
                  ({selectedAccDetails.historicalTxs.length} عملية)
                </span>
              </div>

              {selectedAccDetails.historicalTxs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs italic">
                  لا توجد أي حركات دفع أو دين مسجلة بعد.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px]">
                        <th className="p-2.5 text-right">التاريخ والوقت</th>
                        <th className="p-2.5 text-right">نوع الحركة</th>
                        <th className="p-2.5 text-right">رقم المستند</th>
                        <th className="p-2.5 text-left">القيمة</th>
                        <th className="p-2.5 text-center w-10">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {[...selectedAccDetails.historicalTxs]
                        .reverse()
                        .map((tx) => (
                          <tr
                            key={tx.id}
                            className="hover:bg-slate-50/80 transition-colors group"
                          >
                            <td className="p-2.5 font-sans text-[10.5px] text-slate-600 whitespace-nowrap">
                              {new Date(tx.date).toLocaleDateString("ar-LY")}{" "}
                              {new Date(tx.date).toLocaleTimeString("ar-LY", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                                  tx.type === "debt"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {tx.type === "debt"
                                  ? "🔴 إضافة دين"
                                  : "🟢 سداد دفعة"}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-500 font-mono text-[10px]">
                              {tx.referenceNo}
                            </td>
                            <td
                              className={`p-2.5 text-left font-black font-mono ${
                                tx.type === "debt"
                                  ? "text-rose-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {Math.round(tx.amount).toLocaleString("en-US")} د.ل
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => handleDeleteArchiveTx(tx)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-all cursor-pointer"
                                title="حذف هذه العملية"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
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
