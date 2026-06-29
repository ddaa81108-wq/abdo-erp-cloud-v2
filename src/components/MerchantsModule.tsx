import React, { useState, useEffect } from "react";
import {
  Users,
  Trash2,
  Plus,
  Search,
  Calendar,
  Clock,
  ArrowDownLeft,
  ShieldAlert,
  AlertCircle,
  X,
  Check,
  FileText,
  Camera,
  Copy,
} from "lucide-react";
import { ERPState, Merchant, MerchantTransaction } from "../types";
import DebtBird from "./DebtBird";
import { copySettledImage, generateUnifiedSmartCard } from "../utils/imageExporterUtils";
import { VoiceInputButton } from "./VoiceInputButton";

interface MerchantsModuleProps {
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
}

export default function MerchantsModule({
  state,
  onUpdateState,
  onOpenExporter,
  searchQuery = "",
}: MerchantsModuleProps) {
  // Create Merchant state
  const [showAddMerchantModal, setShowAddMerchantModal] = useState(false);
  const [merchName, setMerchName] = useState("");
  const [merchContact, setMerchContact] = useState("");
  const [initialDebt, setInitialDebt] = useState("");

  // Name collision detection state
  const [showCollisionModal, setShowCollisionModal] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<Merchant | null>(null);

  // Big Detailed Modal state (card clicked)
  const [selectedMerchId, setSelectedMerchId] = useState<string | null>(null);

  // Add Transaction states (opened on top of the big detailed modal, or directly)
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [txType, setTxType] = useState<"debt" | "payment">("debt");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [quickXMerchant, setQuickXMerchant] = useState<Merchant | null>(null);

  // States for custom confirmation dialogs to bypass standard blocked iframe confirm()
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [merchantDeleteTxId, setMerchantDeleteTxId] = useState<string | null>(
    null,
  );
  const [merchantSoftDeleteId, setMerchantSoftDeleteId] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const generateReferenceNo = () => {
    const totalTxsCount =
      (state.debtTransactions?.length || 0) +
      (state.companyTransactions?.length || 0) +
      (state.merchantTransactions?.length || 0) +
      120;
    const padding = String(totalTxsCount + 107).padStart(6, "0");
    return `TX-2026-${padding}`;
  };

  const handleCreateMerchantAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchName.trim()) return;

    // Check collision across all lists
    const existingInCustomers = state.customers.find(
      (c) => c.name.trim().toLowerCase() === merchName.trim().toLowerCase(),
    );
    const existingInCompanies = state.companies.find(
      (c) => c.name.trim().toLowerCase() === merchName.trim().toLowerCase(),
    );

    if (existingInCustomers || existingInCompanies) {
      alert(
        `عذراً، يمنع تكرار الأسماء! هذا الاسم مستخدم مسبقاً في قسم (الديون أو الشركات). الرجاء تغييره.`,
      );
      return;
    }

    // Search for existing active first
    const exactMatchActive = (state.merchants || []).find(
      (m) =>
        !m.isDeleted &&
        m.name.trim().toLowerCase() === merchName.trim().toLowerCase(),
    );

    let finalName = merchName.trim();

    if (exactMatchActive) {
      alert(
        `التاجر "${exactMatchActive.name}" مسجل مسبقاً في الدفاتر! لن يتم تكرار الاسم.\nسيتم الآن فتح بطاقة التاجر الحالية لتتمكن من إضافة عمليات جديدة (فواتير مشتريات) من داخل بطاقته.`,
      );
      setSelectedMerchId(exactMatchActive.id);
      setShowAddMerchantModal(false);
      setMerchName("");
      setInitialDebt("");
      setMerchContact("");
      return;
    }

    // Search for deleted
    const exactMatchDeleted = (state.merchants || []).find(
      (m) =>
        m.isDeleted && m.name.trim().toLowerCase() === finalName.toLowerCase(),
    );

    if (exactMatchDeleted) {
      // Collision detected! Open prompt modal
      setDuplicateTarget(exactMatchDeleted);
      setShowCollisionModal(true);
      return;
    }

    // No collision -> Create brand new
    createNewMerchantDirect(
      finalName,
      merchContact.trim(),
      parseFloat(initialDebt) || 0,
    );
  };

  const createNewMerchantDirect = (
    name: string,
    contact: string,
    startingDebt: number,
  ) => {
    const todayStr = new Date().toLocaleDateString("en-US");
    const merchId = `mer_${Date.now()}`;
    const newMerch: Merchant = {
      id: merchId,
      name: name,
      contact: contact,
      balance: startingDebt,
      previousBalance: startingDebt,
      newDebt: 0,
      paymentToday: 0,
      lastRolloverDate: todayStr,
      isDeleted: false,
      createdAt: new Date().toISOString(),
    };

    const updatedTransactions = [...(state.merchantTransactions || [])];
    if (startingDebt > 0) {
      updatedTransactions.push({
        id: `tx_mer_init_${Date.now()}`,
        merchantId: merchId,
        type: "debt",
        amount: startingDebt,
        currency: "د.ل",
        date: new Date().toISOString(),
        referenceNo: generateReferenceNo(),
        note: "رصيد مدين أول المدخر عند تهيئة الكشف بقسم التجار",
        postedToTreasury: false,
        createdAt: new Date().toISOString(),
      });
    }

    onUpdateState({
      ...state,
      merchants: [...(state.merchants || []), newMerch],
      merchantTransactions: updatedTransactions,
    });

    setMerchName("");
    setMerchContact("");
    setInitialDebt("");
    setShowAddMerchantModal(false);
  };

  const handleRestoreOldMerchant = () => {
    if (!duplicateTarget) return;
    const extraDebt = parseFloat(initialDebt) || 0;

    // Restore matches and optionally add starting debt
    const updatedMerchants = (state.merchants || []).map((m) => {
      if (m.id === duplicateTarget.id) {
        const prevBal = m.balance || 0;
        const newTotalBal = prevBal + extraDebt;
        return {
          ...m,
          isDeleted: false,
          previousBalance: newTotalBal,
          newDebt: 0,
          paymentToday: 0,
          balance: newTotalBal,
        };
      }
      return m;
    });

    const updatedTransactions = [...(state.merchantTransactions || [])];
    if (extraDebt > 0) {
      updatedTransactions.push({
        id: `tx_mer_restore_${Date.now()}`,
        merchantId: duplicateTarget.id,
        type: "debt",
        amount: extraDebt,
        currency: "د.ل",
        date: new Date().toISOString(),
        referenceNo: generateReferenceNo(),
        note: "دين مضاف عند استعادة كارت التاجر من الأرشيف",
        postedToTreasury: false,
        createdAt: new Date().toISOString(),
      });
    }

    onUpdateState({
      ...state,
      merchants: updatedMerchants,
      merchantTransactions: updatedTransactions,
    });

    setShowCollisionModal(false);
    setShowAddMerchantModal(false);
    setSelectedMerchId(duplicateTarget.id); // Open restored card
    setDuplicateTarget(null);
    setMerchName("");
    setMerchContact("");
    setInitialDebt("");
    alert(
      `🎉 تم إعادة استرجاع وتفعيل كارت التاجر واحتسابه بالأرشيف التاريخي بنجاح: ${duplicateTarget.name}`,
    );
  };

  const handleAddTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0 || !selectedMerchId) return;

    const merchIndex = (state.merchants || []).findIndex(
      (m) => m.id === selectedMerchId,
    );
    if (merchIndex === -1) return;

    const merch = state.merchants[merchIndex];
    const txId = `tx_mer_${Date.now()}`;
    const refNo = generateReferenceNo();

    const newTx: MerchantTransaction = {
      id: txId,
      merchantId: selectedMerchId,
      type: txType,
      amount: amount,
      currency: "د.ل",
      date: new Date().toISOString(),
      referenceNo: refNo,
      note:
        txNote ||
        (txType === "debt"
          ? "فاتورة بيع/استلام بالآجل"
          : "دفعة سداد حساب من التاجر"),
      postedToTreasury: false,
      createdAt: new Date().toISOString(),
    };

    // Calculate rolling balances inside
    const updatedMerchList = [...(state.merchants || [])];
    const prevBal = merch.previousBalance || 0;
    const curNewDebt = merch.newDebt || 0;
    const curPayToday = merch.paymentToday || 0;

    let nextPrev = prevBal;
    let nextNewDebt = curNewDebt;
    let nextPayToday = curPayToday;

    if (txType === "debt") {
      nextNewDebt += amount;
    } else {
      nextPayToday += amount;
    }

    const nextBalance = prevBal + nextNewDebt - nextPayToday;

    updatedMerchList[merchIndex] = {
      ...merch,
      previousBalance: nextPrev,
      newDebt: nextNewDebt,
      paymentToday: nextPayToday,
      balance: nextBalance,
    };

    onUpdateState({
      ...state,
      merchants: updatedMerchList,
      merchantTransactions: [...(state.merchantTransactions || []), newTx],
    });

    setTxAmount("");
    setTxNote("");
    setShowAddTxModal(false);
    setShowSuccessToast("🎉 تم قيد وتحديث السجل المالي للتاجر بنجاح.");
  };

  const handleDeleteTransaction = (txId: string) => {
    setMerchantDeleteTxId(txId);
  };

  const executeDeleteTransaction = (txId: string) => {
    const tx = (state.merchantTransactions || []).find((t) => t.id === txId);
    if (!tx) return;

    const updatedTxs = state.merchantTransactions.filter((t) => t.id !== txId);

    const updatedMerch = state.merchants.map((m) => {
      if (m.id === tx.merchantId) {
        const merchTxs = updatedTxs.filter((t) => t.merchantId === m.id);

        let calcNewDebt = 0;
        let calcPayToday = 0;
        merchTxs.forEach((t) => {
          if (t.type === "debt") calcNewDebt += t.amount;
          else calcPayToday += t.amount;
        });

        const prev = m.previousBalance || 0;
        return {
          ...m,
          newDebt: calcNewDebt,
          paymentToday: calcPayToday,
          balance: prev + calcNewDebt - calcPayToday,
        };
      }
      return m;
    });

    onUpdateState({
      ...state,
      merchantTransactions: updatedTxs,
      merchants: updatedMerch,
    });
    setMerchantDeleteTxId(null);
    setShowSuccessToast("تم حذف حركة الحساب للتاجر بنجاح.");
  };

  const handleSoftDeleteMerchant = (merchId: string) => {
    setMerchantSoftDeleteId(merchId);
  };

  const executeSoftDeleteMerchant = (merchId: string) => {
    const merch = (state.merchants || []).find((m) => m.id === merchId);
    if (!merch) return;

    const updatedMerch = state.merchants.map((m) => {
      if (m.id === merchId) {
        return { ...m, isDeleted: true };
      }
      return m;
    });

    onUpdateState({
      ...state,
      merchants: updatedMerch,
    });

    setSelectedMerchId(null);
    setMerchantSoftDeleteId(null);
    setShowSuccessToast(`📥 تم نقل وأرشفة بطاقة التاجر (${merch.name}) بنجاح.`);
  };

  const handleExecuteQuickMerchantSettle = (
    strategy: "settle_directly" | "archive_only",
    merch: Merchant,
  ) => {
    const outstanding = merch.balance || 0;
    const refNo = generateReferenceNo();
    const timestamp = new Date().toISOString();

    let updatedTxs = [...(state.merchantTransactions || [])];

    if (strategy === "settle_directly") {
      if (outstanding > 0) {
        const txId = `tx_mer_settle_${Date.now()}`;
        updatedTxs.push({
          id: txId,
          merchantId: merch.id,
          type: "payment",
          amount: outstanding,
          currency: "د.ل",
          date: timestamp,
          referenceNo: refNo,
          note: "دفعة سداد تصفية سريعة وخروج من الشاشة النشطة للزبون المباشر",
          postedToTreasury: false,
          createdAt: timestamp,
        });
      }
    }

    const updatedMerchs = state.merchants.map((m) => {
      if (m.id === merch.id) {
        return {
          ...m,
          balance: 0,
          paymentToday:
            (m.paymentToday || 0) +
            (strategy === "settle_directly" ? outstanding : 0),
        };
      }
      return m;
    });

    onUpdateState({
      ...state,
      merchants: updatedMerchs,
      merchantTransactions: updatedTxs,
    });

    setQuickXMerchant(null);
    setSelectedMerchId(null);
  };

  // تصفية كافة بطاقات التجار النشطة وغير المحذوفة (حتى لو كان الرصيد صفراً) لتتم تصفيتهم وأرشتهم بالتحكم اليدوي وزر X
  const activeMerchants = (state.merchants || []).filter((m) => {
    return !m.isDeleted;
  });

  const filteredMerchants = activeMerchants.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalOwedToMerchants = activeMerchants.reduce(
    (sum, m) => sum + (m.balance || 0),
    0,
  );

  const handleExportSingleMerchantImage = (merch: Merchant) => {
    const merchTxs = (state.merchantTransactions || [])
      .filter((t) => t.merchantId === merch.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = merch.previousBalance || 0;

    const rows = merchTxs.map((t) => {
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
        t.note || (credit > 0 ? "تسجيل دين" : "سداد دفعة من التاجر"),
        credit > 0 ? `+${credit.toLocaleString()} ` : "-",
        debit > 0 ? `-${debit.toLocaleString()} ` : "-",
        `${runningBalance.toLocaleString()} د.ل`,
      ];
    });

    const headers = [
      "تاريخ الحركة",
      "البيان",
      "دين جديد (+)",
      "تسديد (-)",
      "الرصيد التراكمي",
    ];

    const totalDebts = merchTxs
      .filter((t) => t.type === "debt")
      .reduce((acc, t) => acc + t.amount, 0);
    const totalPayments = merchTxs
      .filter((t) => t.type === "payment")
      .reduce((acc, t) => acc + t.amount, 0);

    const footerMetrics = [
      {
        label: "رصيد سابق",
        value: `${(merch.previousBalance || 0).toLocaleString()} د.ل`,
        colorClass: "text-slate-700",
      },
      {
        label: "شغل جديد",
        value: `+${totalDebts.toLocaleString()} د.ل`,
        colorClass: "text-amber-700",
      },
      {
        label: "الدفع اليوم",
        value: `-${totalPayments.toLocaleString()} د.ل`,
        colorClass: "text-emerald-700",
      },
      {
        label: "الرصيد الحالي",
        value: `${runningBalance.toLocaleString()} د.ل`,
        colorClass: "text-rose-700",
      },
    ];

    onOpenExporter(
      `كشف حساب التاجر: ${merch.name}`,
      {
        label1: "التاجر المعتمد",
        value1: merch.name,
        label2: "باقي المتبقي بذمته",
        value2: `${(merch.balance || 0).toLocaleString()} د.ل`,
        label3: "إجمالي الحركات",
        value3: `${merchTxs.length} معاملة بالدفتر`,
      },
      headers,
      rows,
      "table",
      footerMetrics,
    );
  };

  const handleOpenShareCard = () => {
    const headers = [
      "التاجر والتواصل",
      "الدين السابق المتراكم",
      "دين اليوم المضاف",
      "المبالغ المسددة اليوم",
      "الدين المتبقي الحالي ببطاقته",
    ];
    const rows = filteredMerchants.map((m) => [
      `${m.name} (${m.contact || "بدون هاتف"})`,
      `${(m.previousBalance || 0).toLocaleString()} د.ل`,
      `${(m.newDebt || 0).toLocaleString()} د.ل`,
      `${(m.paymentToday || 0).toLocaleString()} د.ل`,
      `${(m.balance || 0).toLocaleString()} د.ل`,
    ]);

    onOpenExporter(
      "قسم التجار ومستحقات الذمم اليومية",
      {
        label1: "إجمالي ديون التجار المترصدة",
        value1: totalOwedToMerchants.toLocaleString() + " د.ل",
        label2: "عدد حسابات التجار المسجلين",
        value2: activeMerchants.length + " كشف تاجر نشط",
        label3: "مستوى الثقة والتطابق للقيود",
        value3: "كامل ومرحّل إيجابياً للتحصيلات",
      },
      headers,
      rows,
    );
  };

  // Details for selected merchant detailed ledger card
  const selectedMerchDetails = selectedMerchId
    ? (() => {
        const merch = state.merchants.find((m) => m.id === selectedMerchId);
        if (!merch) return null;
        const txs = (state.merchantTransactions || []).filter(
          (t) => t.merchantId === selectedMerchId,
        );
        return { merch, txs };
      })()
    : null;

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Metric 1 (Distinct White Style) */}
        <div className="bg-white border-y border-x border-slate-200 border-t-4 border-t-purple-600 rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Users className="w-24 h-24 text-slate-800" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 font-extrabold text-xs tracking-wide">
                إجمالي ديون التجار المترصدة
              </span>
              <div className="bg-purple-50 p-2 rounded-xl text-purple-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-3xl font-black text-purple-600 drop-shadow-sm">
                {totalOwedToMerchants.toLocaleString()}{" "}
                <span className="text-sm font-bold opacity-70">د.ل</span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold mt-1.5 inline-block bg-slate-100 px-2 py-1 rounded-md">
                {activeMerchants.length} كشف تاجر نشط
              </div>
            </div>
          </div>
        </div>

        {/* Action card & control (Distinct White Style) */}
        <div className="bg-white border-y border-x border-slate-200 border-t-4 border-t-fuchsia-600 rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileText className="w-24 h-24 text-slate-800" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 font-extrabold text-xs tracking-wide">
                إدارة قسم التجار
              </span>
              <div className="bg-fuchsia-50 p-2 rounded-xl text-fuchsia-600">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="flex flex-col gap-2 relative z-20 mt-auto">
              <button
                onClick={() => setShowAddMerchantModal(true)}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] px-3 py-2.5 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all text-center border border-slate-200"
              >
                <Plus className="w-4 h-4 text-fuchsia-600" />
                <span>إضافة كشف تاجر 👤</span>
              </button>

              <button
                onClick={handleOpenShareCard}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] px-3 py-2.5 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all text-center border border-slate-200"
                title="تصدير الكشوفات للواتساب"
              >
                <Camera className="w-4 h-4 text-fuchsia-600" />
                <span>صورة كشوفات 📸</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Merchants (Small Cards layout - ultra compact) */}
      {filteredMerchants.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-2" />
          <h4 className="font-bold text-slate-600 text-sm mb-1">
            لا توجد كشوفات للتجار مطابقة
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            انقر على زر "إضافة كشف تاجر جديد" بالأعلى لتهيئة معاملة تاجر جديد أو
            تفعيل ملف مؤرشف.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {[...filteredMerchants].reverse().map((m, i) => {
            const prev = m.previousBalance || 0;
            const plus = m.newDebt || 0;
            const minus = m.paymentToday || 0;
            const remaining = prev + plus - minus;

            return (
              <div
                key={m.id}
                onClick={(e) => {
                  if ((e.target as Element).closest("button")) {
                    return;
                  }
                  setSelectedMerchId(m.id);
                }}
                className={`bg-white border-y border-l border-slate-200 border-r-4 ${Number(remaining) > 0 ? "border-r-purple-500 hover:border-purple-450" : "border-r-emerald-500 bg-emerald-50/40"} p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between shadow-xs hover:shadow-xs group max-h-[58px]`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleExecuteQuickMerchantSettle("archive_only", m);
                    }}
                    className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1 rounded-md transition-all cursor-pointer shrink-0 hover:scale-105"
                    title="أرشفة ❌"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="min-w-0 flex-1 text-right">
                    <h4
                      className="font-bold text-slate-900 text-xs group-hover:text-purple-650 transition-colors truncate"
                      title={m.name}
                    >
                      {m.name}
                    </h4>
                  </div>
                </div>

                <div className="text-left shrink-0">
                  {Number(remaining) > 0 ? (
                    <span className="font-mono font-extrabold text-purple-600 text-xs bg-purple-50/50 px-2 py-1 rounded border border-purple-100/50 block">
                      {remaining.toLocaleString()} د.ل
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const success = await copySettledImage(m.name, "كارت مخالصة للتاجر");
                          if (success) {
                            alert("تم نسخ كارت المخالصة بنجاح 📋");
                          }
                        }}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 p-1 rounded border border-emerald-100 shadow-xs cursor-pointer transition-colors"
                        title="نسخ كارت المخالصة 📋"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <span className="font-sans font-extrabold text-emerald-700 text-[10px] bg-emerald-50 px-2 py-1 rounded border border-emerald-100 block">
                        مسدد ✓
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📂 النافذة الكبيرة: تفاصيل أرشيف التاجر وحركات قيوده التاريخية */}
      {selectedMerchId && selectedMerchDetails && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[90vh] text-right">
            {/* رأس البطاقة */}
            <div className="flex items-center justify-between border-b pb-3.5 mb-4">
              <div>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-sans">
                  بطاقة كشف حساب تاجر نشط
                </span>
                <h3 className="font-black text-sm text-slate-900 mt-1 flex items-center gap-1">
                  <span>اسم التاجر:</span>
                  <span className="text-purple-650">
                    {selectedMerchDetails.merch.name}
                  </span>
                </h3>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedMerchId(null)}
                  className="bg-slate-100 hover:bg-slate-200 p-1 px-3 rounded-lg text-xs font-bold text-slate-750 transition"
                >
                  إغلاق النافذة ✕
                </button>
              </div>
            </div>

            {/* أرقام تجميع ديون التاجر اليومية والتاريخية (ما داخل الكارت) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-center">
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <span className="text-slate-505 text-[10px] font-bold block mb-0.5">
                  الدين القديم (المنتقل)
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-slate-700">
                  {(
                    selectedMerchDetails.merch.previousBalance || 0
                  ).toLocaleString()}{" "}
                  د.ل
                </span>
              </div>

              <div className="bg-purple-50 border border-purple-100 p-2.5 rounded-xl">
                <span className="text-purple-805 text-[10px] font-bold block mb-0.5">
                  ديون السحوبات اليوم (+)
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-purple-700">
                  {(selectedMerchDetails.merch.newDebt || 0).toLocaleString()}{" "}
                  د.ل
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                <span className="text-emerald-805 text-[10px] font-bold block mb-0.5">
                  مسدد اليوم (-)
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-emerald-700">
                  {(
                    selectedMerchDetails.merch.paymentToday || 0
                  ).toLocaleString()}{" "}
                  د.ل
                </span>
              </div>

              <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                <span className="text-rose-805 text-[10px] font-bold block mb-0.5">
                  صافي المتبقي بذمته
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-rose-600">
                  {(
                    (selectedMerchDetails.merch.previousBalance || 0) +
                    (selectedMerchDetails.merch.newDebt || 0) -
                    (selectedMerchDetails.merch.paymentToday || 0)
                  ).toLocaleString()}{" "}
                  د.ل
                </span>
              </div>
            </div>

            {/* التنبيه لو الرصيد مصفى لسهولة الأرشفة */}
            {(selectedMerchDetails.merch.previousBalance || 0) +
              (selectedMerchDetails.merch.newDebt || 0) -
              (selectedMerchDetails.merch.paymentToday || 0) ===
              0 && (
              <div className="bg-emerald-50 border border-emerald-250 p-3 rounded-xl mb-3 text-xs text-emerald-955 flex items-center justify-between">
                <div>
                  <span className="font-bold flex items-center gap-1">
                    🎯 تم تسوية وتصفية حساب التاجر بالكامل!
                  </span>
                  <p className="text-[10px] text-emerald-800 mt-0.5">
                    حسابه مصفى برصيد (0 د.ل) حالياً. يمكنك أرشفة وإخفاء هذا
                    الكرت ليبقى نظيفاً على الشاشة.
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleSoftDeleteMerchant(selectedMerchDetails.merch.id)
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] p-1.5 px-3 rounded-lg transition"
                >
                  أرشفة وإخفاء الكرت الآن 📥
                </button>
              </div>
            )}

            {/* الأرشيف وحركات الفواتير التاريخية للتاجر */}
            <div className="flex-1 overflow-y-auto border border-slate-150 rounded-xl p-3 bg-slate-50 mb-4 min-h-[160px]">
              <h4 className="text-xs font-extrabold text-slate-705 mb-2.5 pb-1.5 border-b border-slate-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-500 font-bold" />
                <span>
                  أرشيف التاجر (السحوبات التاريخية وفواتير الذمم وتواريخ قيود
                  الدفوعات والترحيل اليومي)
                </span>
              </h4>

              {selectedMerchDetails.txs.length === 0 ? (
                <div className="text-center py-8 text-slate-404 text-xs italic">
                  لا توجد أي معاملات سابقة مسجلة (لا شغل جديد ولا تسديد) في كشف
                  حساب هذا التاجر بعد.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse text-right">
                    <thead>
                      <tr className="bg-slate-200 text-slate-700 font-bold border-b border-slate-300">
                        <th className="p-2 text-right">المستند والوقت</th>
                        <th className="p-2 text-right">الوصف (سداد / مستحق)</th>
                        <th className="p-2 text-left">مبلغ الحركة</th>
                        <th className="p-2 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white font-mono">
                      {[...selectedMerchDetails.txs].reverse().map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="p-2">
                            <span className="text-slate-400 block text-[9px]">
                              {tx.referenceNo}
                            </span>
                            <span className="text-slate-600 block text-[9.5px]/none font-sans">
                              {new Date(tx.date).toLocaleDateString("ar-LY")}
                            </span>
                          </td>
                          <td className="p-2">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-sans font-black ${
                                tx.type === "debt"
                                  ? "bg-purple-105 text-purple-800"
                                  : "bg-emerald-105 text-emerald-800"
                              }`}
                            >
                              {tx.type === "debt"
                                ? "🔴 مستحقات تاجر (ذمة)"
                                : "🟢 دفعة مسددة"}
                            </span>
                          </td>
                          <td
                            className={`p-2 text-left font-black ${
                              tx.type === "debt"
                                ? "text-purple-650"
                                : "text-emerald-700"
                            }`}
                          >
                            {tx.type === "debt" ? "+" : "-"}
                            {tx.amount.toLocaleString()} د.ل
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTransaction(tx.id);
                              }}
                              className="text-slate-350 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition animate-bounce cursor-pointer"
                              title="حذف القيد وتراجع الرصيد"
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

            {/* شريط الإجراءات السفلي (قيد وسحب وحذف) */}
            <div className="border-t pt-3.5 flex flex-wrap gap-2 justify-between items-center">
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    handleSoftDeleteMerchant(selectedMerchDetails.merch.id)
                  }
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs p-2.5 px-4 rounded-xl flex items-center gap-1 transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>أرشفة وإخفاء التاجر من الشاشة 🗑️</span>
                </button>

                {Number(selectedMerchDetails.merch.balance) === 0 ? (
                  <button
                    onClick={async () => {
                      const success = await copySettledImage(selectedMerchDetails.merch.name, "كارت مخالصة للتاجر");
                      if (success) {
                        alert("تم نسخ كارت المخالصة بنجاح 📋");
                      }
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white border border-emerald-400 font-bold text-xs p-2.5 px-4 rounded-xl flex items-center gap-1 transition cursor-pointer shadow-md"
                    title="نسخ كارت المخالصة 📋"
                  >
                    <Copy className="w-4 h-4" />
                    <span>نسخ كارت المخالصة 📋</span>
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      const remaining = selectedMerchDetails.merch.balance || 0;
                      const type = remaining < 0 ? "trust" : "debt";
                      const success = await generateUnifiedSmartCard(selectedMerchDetails.merch.name, remaining, type, undefined, "د.ل");
                      if (success) {
                        alert("تم نسخ كارت الدين السريع 📋");
                      } else {
                        alert("حدث خطأ أثناء نسخ الصورة");
                      }
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white border border-purple-500 font-bold text-xs p-2.5 px-4 rounded-xl flex items-center gap-1 transition cursor-pointer shadow-md"
                    title="نسخ كارت الدين السريع 📋"
                  >
                    <Copy className="w-4 h-4" />
                    <span>نسخ كارت الدين السريع 📋</span>
                  </button>
                )}

                <button
                  onClick={() =>
                    handleExportSingleMerchantImage(selectedMerchDetails.merch)
                  }
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 font-bold text-xs p-2.5 px-4 rounded-xl flex items-center gap-1 transition cursor-pointer"
                  title="تصدير كشف الحساب كصورة لمشاركتها عبر الواتساب"
                >
                  <span>صورة كشوفات التاجر 📸</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setTxType("debt");
                    setTxAmount("");
                    setTxNote("");
                    setShowAddTxModal(true);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-750 border border-slate-250 font-bold text-xs p-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  ➕ قيد سحب / فاتورة آجل
                </button>

                <button
                  onClick={() => {
                    setTxType("payment");
                    setTxAmount("");
                    setTxNote("");
                    setShowAddTxModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-755 text-white font-extrabold text-xs p-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer"
                >
                  💸 تسجيل وتوريد دفعة سداد 💰
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW MERCHANT */}
      {showAddMerchantModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right"
            dir="rtl"
          >
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-600" />
              <span>تسجيل كشف تاجر جديد</span>
            </h3>

            <form onSubmit={handleCreateMerchantAttempt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1">
                  اسم التاجر الشريك بالكامل *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={merchName}
                    onChange={(e) => setMerchName(e.target.value)}
                    placeholder="مثال: الحاج صالح التاجوري"
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <VoiceInputButton onResult={(text) => setMerchName(prev => (prev ? prev + ' ' + text : text))} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">
                    هاتف وتواصل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={merchContact}
                    onChange={(e) => setMerchContact(e.target.value)}
                    placeholder="092-XXXXXXXX"
                    className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-755 mb-1">
                    دين مالي أول (اختياري)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={initialDebt}
                      onChange={(e) => setInitialDebt(e.target.value)}
                      placeholder="0.00"
                      className="w-full text-right p-2.5 pl-8 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50/50 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    />
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-[10px]">
                      د.ل
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMerchantModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-5 py-2 rounded-lg text-xs cursor-pointer transition"
                >
                  حفظ وتسجيل التاجر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD TRANSACTION OVERLAY */}
      {showAddTxModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right"
            dir="rtl"
          >
            <h3
              className={`font-black text-xs border-b pb-3 mb-4 flex items-center gap-2 ${
                txType === "debt" ? "text-purple-800" : "text-emerald-700"
              }`}
            >
              {txType === "debt" ? (
                <>
                  <Plus className="w-5 h-5 text-purple-600" />
                  <span>🔴 قيد سحب بضاعة بالآجل للتاجر (دين جديد)</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-emerald-600" />
                  <span>🟢 قيد وتوريد دفعة سداد حساب من التاجر (مدفوع)</span>
                </>
              )}
            </h3>

            <form onSubmit={handleAddTransactionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1">
                  قيمة القيد المالي الكلي *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    step="any"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    placeholder="أدخل المبلغ بالدينار الليبي د.ل"
                    className="w-full text-right p-2.5 pr-3 pl-9 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50/50 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs font-mono">
                    د.ل
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1">
                  بيان وملاحظة السند
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder={
                      txType === "debt"
                        ? "فاتورة سحب كابلات وأسلاك نحاسية"
                        : "استلام دفعة نقدية بيد المودع"
                    }
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <VoiceInputButton onResult={(text) => setTxNote(prev => (prev ? prev + ' ' + text : text))} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2 rounded-lg text-xs cursor-pointer transition"
                >
                  تثبيت وقيد العملية المحاسبية
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COLLISION DETECTED DIALOG */}
      {showCollisionModal && duplicateTarget && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full border border-slate-200 text-right"
            dir="rtl"
          >
            <div className="flex items-center gap-3 text-amber-600 mb-4 border-b pb-3">
              <ShieldAlert className="w-8 h-8 shrink-0 animate-pulse" />
              <div>
                <h4 className="font-black text-slate-900 text-sm">
                  تنبيه: محاولة تكرار أو استرداد كارت تاجر قديم!
                </h4>
                <p className="text-xs text-slate-404">
                  تاجر شريك باسم "{merchName}" متواجد بالفعل بالأرشيف القديم.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-605 leading-relaxed mb-4">
              المنظومة تفيد بأن التاجر "{merchName}" لديه ملف قديم بالأرشيف
              المالي. هل تريد استرجاع ملفه القديم وحفظ الحركة الجديدة لتظل
              معاملاته التاريخية متكاملة؟ أم تريد كارت مستقل جديد كلياً؟
            </p>

            <div className="space-y-2">
              <button
                onClick={handleRestoreOldMerchant}
                className="w-full text-right bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 font-bold p-3 rounded-xl text-xs transition cursor-pointer flex flex-col justify-start"
              >
                <span className="font-extrabold text-[12px] text-indigo-700">
                  🟢 نعم، استرجع بطاقة حسابه القديمة (الأرشيف متكامل):
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  سيعاد تفعيله ميكانيكياً مع ربط الدين الجديد وسجل سحوباته
                  ودفعاته التاريخية.
                </span>
              </button>

              <button
                onClick={() => {
                  setShowCollisionModal(false);
                  setDuplicateTarget(null);
                }}
                className="w-full text-center bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
              >
                تراجع وإلغاء العملية
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deleting Merchant Transaction */}
      {merchantDeleteTxId && (
        <div
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl relative text-right">
            <h3 className="font-extrabold text-slate-900 text-base mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span>تأكيد حذف المعاملة المالية ⚠️</span>
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              هل أنت واثق من رغبتك في حذف حركة الحساب للتاجر وتعديل الأرصدة
              التراكمية تلقائياً؟ لا يمكن استرجاع هذه العملية بعد التأكيد.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => executeDeleteTransaction(merchantDeleteTxId)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer focus:outline-none"
              >
                تأكيد الحذف والخصم
              </button>
              <button
                type="button"
                onClick={() => setMerchantDeleteTxId(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Archiving Merchant */}
      {merchantSoftDeleteId &&
        (() => {
          const merch = state.merchants.find(
            (m) => m.id === merchantSoftDeleteId,
          );
          if (!merch) return null;
          return (
            <div
              className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in"
              dir="rtl"
            >
              <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl relative text-right">
                <h3 className="font-extrabold text-slate-900 text-base mb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>أرشفة وبطاقة التاجر المعتمد 📥</span>
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  هل أنت واثق من إخفاء وأرشفة التاجر{" "}
                  <strong className="text-slate-900">({merch.name})</strong> من
                  الشاشة الرئيسية؟ سيتم الاحتفاظ بكامل كشف المعاملات التاريخي في
                  قاعدة البيانات، وعند كتابة اسمه مجدداً ستتمكن من استعادة
                  أرشيفه فوراً.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      executeSoftDeleteMerchant(merchantSoftDeleteId)
                    }
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer focus:outline-none"
                  >
                    نعم، إخفاء وأرشفة البطاقة
                  </button>
                  <button
                    type="button"
                    onClick={() => setMerchantSoftDeleteId(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer"
                  >
                    تراجع
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Beautiful Non-Blocking Toast Success Alert */}
      {showSuccessToast && (
        <div
          className="fixed bottom-5 left-5 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-800 z-[99999] flex items-center gap-2.5 animate-slide-up"
          dir="rtl"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-900 font-black flex items-center justify-center text-xs">
            ✓
          </div>
          <span className="text-xs font-bold">{showSuccessToast}</span>
        </div>
      )}

      <DebtBird totalDebt={totalOwedToMerchants} />
    </div>
  );
}
