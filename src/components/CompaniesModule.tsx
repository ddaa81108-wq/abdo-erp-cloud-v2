import React, { useState, useEffect } from "react";
import {
  Landmark,
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
  Calculator,
} from "lucide-react";
import { ERPState, Company, CompanyTransaction } from "../types";

interface CompaniesModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: any,
    headers?: string[],
    rows?: any[][],
    imageType?: "full" | "table" | "card",
    footerMetrics?: any[],
  ) => void;
  searchQuery?: string;
}

export default function CompaniesModule({
  state,
  onUpdateState,
  onOpenExporter,
  searchQuery = "",
}: CompaniesModuleProps) {
  // Create Company state
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [compName, setCompName] = useState("");
  const [compContact, setCompContact] = useState("");
  const [initialDebt, setInitialDebt] = useState("");

  // Name collision detection state
  const [showCollisionModal, setShowCollisionModal] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<Company | null>(null);

  // Big Detailed Modal state (card clicked)
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);

  // Add Transaction states (opened on top of the big detailed modal, or directly)
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [txType, setTxType] = useState<"purchase_invoice" | "payment">(
    "purchase_invoice",
  );
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [quickXCompany, setQuickXCompany] = useState<Company | null>(null);

  // Bulk add state
  const [activeTab, setActiveTab] = useState<"ledger" | "bulk">("ledger");
  const [bulkRows, setBulkRows] = useState([
    { id: 1, amount: "", note: "" },
    { id: 2, amount: "", note: "" },
    { id: 3, amount: "", note: "" },
  ]);

  // States for custom confirmation dialogs to bypass standard blocked iframe confirm()
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [companyDeleteTxId, setCompanyDeleteTxId] = useState<string | null>(
    null,
  );
  const [companySoftDeleteId, setCompanySoftDeleteId] = useState<string | null>(
    null,
  );

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
      10;
    const padding = String(totalTxsCount + 107).padStart(6, "0");
    return `TX-2026-${padding}`;
  };

  const handleCreateCompanyAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim()) return;

    // Check collision across all lists
    const existingInCustomers = state.customers.find(
      (c) => c.name.trim().toLowerCase() === compName.trim().toLowerCase(),
    );
    const existingInMerchants = state.merchants.find(
      (m) => m.name.trim().toLowerCase() === compName.trim().toLowerCase(),
    );

    if (existingInCustomers || existingInMerchants) {
      alert(
        `عذراً، يمنع تكرار الأسماء! هذا الاسم مستخدم مسبقاً في قسم (الديون أو الموردين). الرجاء تغييره.`,
      );
      return;
    }

    // Search for existing active first
    const exactMatchActive = state.companies.find(
      (c) =>
        !c.isDeleted &&
        c.name.trim().toLowerCase() === compName.trim().toLowerCase(),
    );

    let finalName = compName.trim();

    if (exactMatchActive) {
      alert(
        `الشركة "${exactMatchActive.name}" مسجلة مسبقاً في الدفاتر! لن يتم تكرار الاسم.\nسيتم الآن فتح بطاقة الشركة الحالية لتتمكن من إضافة عمليات جديدة (فواتير مشتريات) من داخل بطاقتها.`,
      );
      setSelectedCompId(exactMatchActive.id);
      setShowAddCompanyModal(false);
      setCompName("");
      setInitialDebt("");
      setCompContact("");
      return;
    }

    // Search for deleted
    const exactMatchDeleted = state.companies.find(
      (c) =>
        c.isDeleted && c.name.trim().toLowerCase() === finalName.toLowerCase(),
    );

    if (exactMatchDeleted) {
      // Collision detected! Open prompt modal
      setDuplicateTarget(exactMatchDeleted);
      setShowCollisionModal(true);
      return;
    }

    // No collision -> Create brand new
    createNewCompanyDirect(
      finalName,
      compContact.trim(),
      parseFloat(initialDebt) || 0,
    );
  };

  const createNewCompanyDirect = (
    name: string,
    contact: string,
    startingDebt: number,
  ) => {
    const todayStr = new Date().toLocaleDateString("en-US");
    const compId = `comp_${Date.now()}`;
    const newComp: Company = {
      id: compId,
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

    const updatedTransactions = [...state.companyTransactions];
    if (startingDebt > 0) {
      updatedTransactions.push({
        id: `tx_comp_init_${Date.now()}`,
        companyId: compId,
        type: "purchase_invoice",
        amount: startingDebt,
        currency: "د.ل",
        date: new Date().toISOString(),
        referenceNo: generateReferenceNo(),
        note: "رصيد دائن أول المدخر عند تهيئة الكشف",
        postedToTreasury: false,
        createdAt: new Date().toISOString(),
      });
    }

    onUpdateState({
      ...state,
      companies: [...state.companies, newComp],
      companyTransactions: updatedTransactions,
    });

    setCompName("");
    setCompContact("");
    setInitialDebt("");
    setShowAddCompanyModal(false);
  };

  const handleRestoreOldCompany = () => {
    if (!duplicateTarget) return;
    const extraDebt = parseFloat(initialDebt) || 0;

    // Restore matches and optionally add starting debt
    const updatedCompanies = state.companies.map((c) => {
      if (c.id === duplicateTarget.id) {
        const prevBal = c.balance || 0;
        const newTotalBal = prevBal + extraDebt;
        return {
          ...c,
          isDeleted: false,
          previousBalance: newTotalBal,
          newDebt: 0,
          paymentToday: 0,
          balance: newTotalBal,
        };
      }
      return c;
    });

    const updatedTransactions = [...state.companyTransactions];
    if (extraDebt > 0) {
      updatedTransactions.push({
        id: `tx_comp_restore_${Date.now()}`,
        companyId: duplicateTarget.id,
        type: "purchase_invoice",
        amount: extraDebt,
        currency: "د.ل",
        date: new Date().toISOString(),
        referenceNo: generateReferenceNo(),
        note: "دين مضاف عند استعادة كارت المورد من الأرشيف",
        postedToTreasury: false,
        createdAt: new Date().toISOString(),
      });
    }

    onUpdateState({
      ...state,
      companies: updatedCompanies,
      companyTransactions: updatedTransactions,
    });

    setShowCollisionModal(false);
    setShowAddCompanyModal(false);
    setSelectedCompId(duplicateTarget.id); // Open restored card
    setDuplicateTarget(null);
    setCompName("");
    setCompContact("");
    setInitialDebt("");
    alert(
      `🎉 تم إعادة استرجاع وتفعيل كارت الشركة واحتسابه بالأرشيف التاريخي بنجاح: ${duplicateTarget.name}`,
    );
  };

  const handleAddTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (isNaN(amount) || amount <= 0 || !selectedCompId) return;

    const compIndex = state.companies.findIndex((c) => c.id === selectedCompId);
    if (compIndex === -1) return;

    const comp = state.companies[compIndex];
    const txId = `tx_comp_${Date.now()}`;
    const refNo = generateReferenceNo();

    const newTx: CompanyTransaction = {
      id: txId,
      companyId: selectedCompId,
      type: txType,
      amount: amount,
      currency: "د.ل",
      date: new Date().toISOString(),
      referenceNo: refNo,
      note:
        txNote ||
        (txType === "purchase_invoice"
          ? "فاتورة استلام بالآجل"
          : "دفعة سداد حساب للمورد"),
      postedToTreasury: false,
      createdAt: new Date().toISOString(),
    };

    // Calculate rolling balances inside
    const updatedCompList = [...state.companies];
    const prevBal = comp.previousBalance || 0;
    const curNewDebt = comp.newDebt || 0;
    const curPayToday = comp.paymentToday || 0;

    let nextPrev = prevBal;
    let nextNewDebt = curNewDebt;
    let nextPayToday = curPayToday;

    if (txType === "purchase_invoice") {
      nextNewDebt += amount;
    } else {
      nextPayToday += amount;
    }

    const nextBalance = prevBal + nextNewDebt - nextPayToday;

    updatedCompList[compIndex] = {
      ...comp,
      previousBalance: nextPrev,
      newDebt: nextNewDebt,
      paymentToday: nextPayToday,
      balance: nextBalance,
    };

    onUpdateState({
      ...state,
      companies: updatedCompList,
      companyTransactions: [...(state.companyTransactions || []), newTx],
    });

    setTxAmount("");
    setTxNote("");
    setShowAddTxModal(false);
    alert("🎉 تم قيد وتحديث السجل المالي للشركة بنجاح.");
  };

  const handleDeleteTransaction = (txId: string) => {
    setCompanyDeleteTxId(txId);
  };

  const executeDeleteTransaction = (txId: string) => {
    const tx = state.companyTransactions.find((t) => t.id === txId);
    if (!tx) return;

    const updatedTxs = state.companyTransactions.filter((t) => t.id !== txId);

    const updatedComps = state.companies.map((c) => {
      if (c.id === tx.companyId) {
        const compTxs = updatedTxs.filter((t) => t.companyId === c.id);

        let calcNewDebt = 0;
        let calcPayToday = 0;
        compTxs.forEach((t) => {
          if (t.type === "purchase_invoice") calcNewDebt += t.amount;
          else calcPayToday += t.amount;
        });

        const prev = c.previousBalance || 0;
        return {
          ...c,
          newDebt: calcNewDebt,
          paymentToday: calcPayToday,
          balance: prev + calcNewDebt - calcPayToday,
        };
      }
      return c;
    });

    onUpdateState({
      ...state,
      companyTransactions: updatedTxs,
      companies: updatedComps,
    });
    setCompanyDeleteTxId(null);
    setShowSuccessToast("تم حذف حركة الحساب للمورد بنجاح.");
  };

  const handleSoftDeleteCompany = (compId: string) => {
    setCompanySoftDeleteId(compId);
  };

  const executeSoftDeleteCompany = (compId: string) => {
    const comp = state.companies.find((c) => c.id === compId);
    if (!comp) return;

    const updatedComps = state.companies.map((c) => {
      if (c.id === compId) {
        return { ...c, isDeleted: true };
      }
      return c;
    });

    onUpdateState({
      ...state,
      companies: updatedComps,
    });

    setSelectedCompId(null);
    setCompanySoftDeleteId(null);
    setShowSuccessToast(`📥 تم نقل وأرشفة بطاقة الشركة (${comp.name}) بنجاح.`);
  };

  const handleExecuteQuickCompanySettle = (
    strategy: "settle_directly" | "archive_only",
    comp: Company,
  ) => {
    const outstanding = comp.balance || 0;
    const refNo = generateReferenceNo();
    const timestamp = new Date().toISOString();

    let updatedTxs = [...(state.companyTransactions || [])];

    if (strategy === "settle_directly") {
      if (outstanding > 0) {
        const txId = `tx_comp_settle_${Date.now()}`;
        updatedTxs.push({
          id: txId,
          companyId: comp.id,
          type: "payment",
          amount: outstanding,
          currency: "د.ل",
          date: timestamp,
          referenceNo: refNo,
          note: "دفعة سداد حساب سريعة لتصفير الرصيد وإغلاق الكارت",
          postedToTreasury: false,
          createdAt: timestamp,
        });
      }
    }

    const updatedComps = state.companies.map((c) => {
      if (c.id === comp.id) {
        return {
          ...c,
          balance: 0,
          paymentToday:
            (c.paymentToday || 0) +
            (strategy === "settle_directly" ? outstanding : 0),
          isDeleted: true,
        };
      }
      return c;
    });

    onUpdateState({
      ...state,
      companies: updatedComps,
      companyTransactions: updatedTxs,
    });

    setQuickXCompany(null);
    setSelectedCompId(null);
  };

  // تصفية كافة بطاقات الموردين/الشركات النشطة وغير المحذوفة (حتى لو كان الرصيد صفراً) لتتم تصفيتهم وأرشتهم بالتحكم اليدوي وزر X
  const activeCompanies = state.companies.filter((c) => {
    return !c.isDeleted;
  });

  const filteredCompanies = activeCompanies.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalOwedToCompanies = activeCompanies.reduce(
    (sum, c) => sum + (c.balance || 0),
    0,
  );

  const handleExportSingleCompanyImage = (comp: Company) => {
    const compTxs = (state.companyTransactions || [])
      .filter((t) => t.companyId === comp.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = comp.previousBalance || 0;

    const rows = compTxs.map((t) => {
      let debit = 0;
      let credit = 0;
      if (t.type === "purchase_invoice") {
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
        t.note || (credit > 0 ? "فاتورة آجل" : "سداد دفعة للمورد"),
        credit > 0 ? `+${credit.toLocaleString()} ` : "-",
        debit > 0 ? `-${debit.toLocaleString()} ` : "-",
        `${runningBalance.toLocaleString()} د.ل`,
      ];
    });

    const headers = [
      "التاريخ",
      "البيان",
      "دين جديد (+)",
      "تسديد (-)",
      "الرصيد التراكمي",
    ];

    const totalPurchases = compTxs
      .filter((t) => t.type === "purchase_invoice")
      .reduce((acc, t) => acc + t.amount, 0);
    const totalPayments = compTxs
      .filter((t) => t.type === "payment")
      .reduce((acc, t) => acc + t.amount, 0);

    const footerMetrics = [
      {
        label: "رصيد سابق",
        value: `${(comp.previousBalance || 0).toLocaleString()} د.ل`,
        colorClass: "text-slate-700",
      },
      {
        label: "شغل جديد",
        value: `+${totalPurchases.toLocaleString()} د.ل`,
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
      `كشف حساب: ${comp.name}`,
      {
        label1: "الجهة التوريدية",
        value1: comp.name,
        label2: "رقم المورد/الشركة",
        value2: comp.contact || "بدون رقم",
        label3: "إجمالي الحركات",
        value3: `${compTxs.length} معاملة`,
      },
      headers,
      rows,
      "table",
      footerMetrics,
    );
  };

  const handleOpenShareCard = () => {
    const headers = [
      "المورد / الشركة والتواصل",
      "القيمة السابـقة",
      "دين اليوم الجديد",
      "المدفوع من الشريك",
      "الدين المتبقي (الخارجي)",
    ];
    const rows = filteredCompanies.map((c) => [
      `${c.name} (${c.contact || "بدون هاتف"})`,
      `${(c.previousBalance || 0).toLocaleString()} د.ل`,
      `${(c.newDebt || 0).toLocaleString()} د.ل`,
      `${(c.paymentToday || 0).toLocaleString()} د.ل`,
      `${(c.balance || 0).toLocaleString()} د.ل`,
    ]);

    onOpenExporter(
      "الشركات ومستحقات الموردين اليدوية اليومية",
      {
        label1: "إجمالي ديون الشركات المستحقة",
        value1: totalOwedToCompanies.toLocaleString() + " د.ل",
        label2: "عدد الشركات النشطة والمسجلة",
        value2: activeCompanies.length + " شركات توريد",
        label3: "مستوى الثقة ومستندات الإرشاد",
        value3: "كامل ومحتفظ بالأرشيف التاريخي",
      },
      headers,
      rows,
    );
  };

  // Details for selected company detailed ledger card
  const selectedCompDetails = selectedCompId
    ? (() => {
        const comp = state.companies.find((c) => c.id === selectedCompId);
        if (!comp) return null;
        const txs = (state.companyTransactions || []).filter(
          (t) => t.companyId === selectedCompId,
        );
        return { comp, txs };
      })()
    : null;

  // Bulk Adding Logic
  const handleAddBulkRow = () => {
    setBulkRows([...bulkRows, { id: Date.now(), amount: "", note: "" }]);
  };

  const handleUpdateBulkRow = (id: number, key: keyof typeof bulkRows[0], value: string) => {
    setBulkRows(bulkRows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const handleRemoveBulkRow = (id: number) => {
    setBulkRows(bulkRows.filter((r) => r.id !== id));
  };

  const bulkTotal = bulkRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  const handleSaveBulkToLedger = () => {
    if (bulkTotal <= 0) return;
    
    const validRows = bulkRows.filter(r => parseFloat(r.amount) > 0);
    const notesSummary = validRows.map(r => `${r.amount} (${r.note || 'بدون بيان'})`).join(' + ');
    
    const newTx: CompanyTransaction = {
      id: "tx_c_" + Date.now().toString(),
      companyId: selectedCompId!,
      type: "purchase_invoice",
      amount: bulkTotal,
      currency: "LYD",
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      note: `دفتر التجميع: ${notesSummary}`,
      referenceNo: "T-" + Math.floor(Math.random() * 100000),
      postedToTreasury: true,
    };

    const newTransactions = [...(state.companyTransactions || []), newTx];
    let updatedCompanies = state.companies;
    updatedCompanies = state.companies.map((c) => {
      if (c.id === selectedCompId) {
        const debt = c.newDebt || 0;
        return {
          ...c,
          newDebt: debt + bulkTotal,
          balance: (c.previousBalance || 0) + debt + bulkTotal - (c.paymentToday || 0),
        };
      }
      return c;
    });

    onUpdateState({
      ...state,
      companyTransactions: newTransactions,
      companies: updatedCompanies,
    });
    
    setBulkRows([
      { id: 1, amount: "", note: "" },
      { id: 2, amount: "", note: "" },
      { id: 3, amount: "", note: "" },
    ]);
    setActiveTab("ledger");
    setShowSuccessToast("تم ترحيل مجموع الجدول إلى حساب الشركة بنجاح.");
  };


  return (
    <div className="space-y-4 text-right" dir="rtl">
      {/* Unified grid for Metrics, Actions and Companies */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Card 1: Total (Distinct White Style) */}
        <div className="bg-white border-y border-x border-slate-200 border-t-4 border-t-amber-600 rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Landmark className="w-24 h-24 text-slate-800" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-slate-500 font-extrabold text-xs tracking-wide">
                إجمالي مستحقات الشركات والتجار
              </span>
              <div className="bg-amber-50 p-2 rounded-xl text-amber-600">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-3xl font-black text-amber-600 drop-shadow-sm">
                {totalOwedToCompanies.toLocaleString()}{" "}
                <span className="text-sm font-bold opacity-70">د.ل</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Actions (Distinct White Style) */}
        <div className="bg-white border-y border-x border-slate-200 border-t-4 border-t-cyan-600 rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <FileText className="w-24 h-24 text-slate-800" />
          </div>
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-slate-500 font-extrabold text-xs tracking-wide">
                إجراءات سريعة
              </span>
              <div className="bg-cyan-50 p-2 rounded-xl text-cyan-600">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="flex flex-col gap-2 relative z-20 mt-auto">
              <button
                onClick={() => setShowAddCompanyModal(true)}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] px-3 py-2.5 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all text-center border border-slate-200"
              >
                <Plus className="w-4 h-4 text-cyan-600" />
                <span>إضافة كشف مورد 🏭</span>
              </button>

              <button
                onClick={handleOpenShareCard}
                className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] px-3 py-2.5 rounded-xl shadow-sm cursor-pointer flex items-center justify-center gap-1.5 transition-all text-center border border-slate-200"
                title="تصدير كشف حساب مورد بتصميم احترافي كبطاقة"
              >
                <Camera className="w-4 h-4 text-cyan-600" />
                <span>تصدير كشف حساب 📄</span>
              </button>
            </div>
          </div>
        </div>

        {/* Company Cards */}
        {[...filteredCompanies].reverse().map((c, i) => {
          const prev = c.previousBalance || 0;
          const plus = c.newDebt || 0;
          const minus = c.paymentToday || 0;
          const remaining = prev + plus - minus;

          const colors = [
            { bg: "bg-indigo-600", border: "border-indigo-500" },
            { bg: "bg-rose-600", border: "border-rose-500" },
            { bg: "bg-amber-600", border: "border-amber-500" },
            { bg: "bg-emerald-600", border: "border-emerald-500" },
            { bg: "bg-purple-600", border: "border-purple-500" },
            { bg: "bg-teal-600", border: "border-teal-500" },
            { bg: "bg-fuchsia-600", border: "border-fuchsia-500" },
          ];
          const clr = colors[i % colors.length];

          return (
            <div
              key={c.id}
              onClick={(e) => {
                if ((e.target as Element).closest("button")) return;
                setSelectedCompId(c.id);
              }}
              className={`${clr.bg} ${clr.border} border rounded-2xl p-5 shadow-xl relative overflow-hidden group cursor-pointer hover:scale-101 transition-all`}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Landmark className="w-24 h-24 text-white" />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <h4
                    className="font-extrabold text-white text-sm line-clamp-1 flex-1 text-right drop-shadow-md ml-2"
                    title={c.name}
                  >
                    {c.name}
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleExecuteQuickCompanySettle("archive_only", c);
                    }}
                    className="bg-white/10 hover:bg-rose-500/80 text-white p-2 rounded-xl transition-all cursor-pointer shrink-0 backdrop-blur-md shadow-xs border border-white/10"
                    title="أرشفة ❌"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-auto">
                  <div className="text-2xl font-black text-white drop-shadow-md">
                    {remaining.toLocaleString()}{" "}
                    <span className="text-[10px] font-bold opacity-70">
                      د.ل
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {plus > 0 && (
                      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 backdrop-blur-md shadow-xs">
                        +{plus.toLocaleString()} (جديد)
                      </span>
                    )}
                    {minus > 0 && (
                      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 backdrop-blur-md shadow-xs">
                        -{minus.toLocaleString()} (دفعة)
                      </span>
                    )}
                    {plus === 0 && minus === 0 && remaining === 0 && (
                      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded border border-white/10 backdrop-blur-md shadow-xs">
                        خالص ✓
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredCompanies.length === 0 && (
          <div className="bg-white/5 border border-slate-200 border-dashed rounded-2xl p-12 col-span-full text-center text-slate-400">
            <Landmark className="w-12 h-12 text-slate-300 mx-auto mb-3 opacity-50" />
            <h4 className="font-bold text-slate-500 text-sm mb-1">
              لا توجد شركات مسجلة مطابقة
            </h4>
          </div>
        )}
      </div>

      {/* 📂 النافذة الكبيرة: تفاصيل أرشيف الشركة وحركات قيودها التاريخية */}
      {selectedCompId && selectedCompDetails && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[90vh] text-right">
            {/* رأس البطاقة */}
            <div className="flex items-center justify-between border-b pb-3.5 mb-4">
              <div>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-sans">
                  بطاقة كشف حساب جهة توريدية نشطة
                </span>
                <h3 className="font-black text-sm text-slate-900 mt-1 flex items-center gap-1">
                  <span>اسم الشركة/المورد:</span>
                  <span className="text-indigo-650">
                    {selectedCompDetails.comp.name}
                  </span>
                </h3>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCompId(null)}
                  className="bg-slate-100 hover:bg-slate-200 p-1 px-3 rounded-lg text-xs font-bold text-slate-750 transition"
                >
                  إغلاق النافذة ✕
                </button>
              </div>
            </div>

            {/* أرقام تجميع ديون المورد اليومية والتاريخية (ما داخل الكارت) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-center">
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <span className="text-slate-505 text-[10px] font-bold block mb-0.5">
                  الدين القديم (المنتقل)
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-slate-700">
                  {(
                    selectedCompDetails.comp.previousBalance || 0
                  ).toLocaleString()}{" "}
                  د.ل
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-xl">
                <span className="text-amber-805 text-[10px] font-bold block mb-0.5">
                  ديون فواتير اليوم (+)
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-amber-700">
                  {(selectedCompDetails.comp.newDebt || 0).toLocaleString()} د.ل
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">
                <span className="text-emerald-805 text-[10px] font-bold block mb-0.5">
                  مدفوعات اليوم (-)
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-emerald-700">
                  {(
                    selectedCompDetails.comp.paymentToday || 0
                  ).toLocaleString()}{" "}
                  د.ل
                </span>
              </div>

              <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl">
                <span className="text-rose-805 text-[10px] font-bold block mb-0.5">
                  صافي المتبقي للمورد
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-rose-600">
                  {(
                    (selectedCompDetails.comp.previousBalance || 0) +
                    (selectedCompDetails.comp.newDebt || 0) -
                    (selectedCompDetails.comp.paymentToday || 0)
                  ).toLocaleString()}{" "}
                  د.ل
                </span>
              </div>
            </div>

            {/* التنبيه لو الرصيد مصفى عشان نسهل المسح */}
            {(selectedCompDetails.comp.previousBalance || 0) +
              (selectedCompDetails.comp.newDebt || 0) -
              (selectedCompDetails.comp.paymentToday || 0) ===
              0 && (
              <div className="bg-emerald-50 border border-emerald-250 p-3 rounded-xl mb-3 text-xs text-emerald-955 flex items-center justify-between">
                <div>
                  <span className="font-bold flex items-center gap-1">
                    🎯 تم تسديد وتصفية حساب الشركة بالكامل!
                  </span>
                  <p className="text-[10px] text-emerald-800 mt-0.5">
                    الحساب نشط برصيد (0 د.ل) حالياً. يمكنك أرشفة وإخفاء هذا
                    الكرت ليبقى نظيفاً على الشاشة.
                  </p>
                </div>
                <button
                  onClick={() =>
                    handleSoftDeleteCompany(selectedCompDetails.comp.id)
                  }
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] p-1.5 px-3 rounded-lg transition"
                >
                  أرشفة وإخفاء الكرت الآن 📥
                </button>
              </div>
            )}

            {/* Tabs Form */}
            <div className="flex gap-2 mb-3 border-b border-slate-200 pb-2">
              <button
                onClick={() => setActiveTab('ledger')}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${activeTab === 'ledger' ? 'bg-indigo-100 text-indigo-800' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                دفتر الأستاذ (القيود)
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${activeTab === 'bulk' ? 'bg-amber-100 text-amber-800' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                مسودة تجميع سريع (آلة حاسبة)
              </button>
            </div>

            {/* الأرشيف وحركات الفواتير التاريخية للمورد */}
            <div className="flex-1 overflow-y-auto border border-slate-150 rounded-xl p-3 bg-slate-50 mb-4 min-h-[160px] max-h-[400px]">
              {activeTab === 'ledger' ? (
                <>
                  <h4 className="text-xs font-extrabold text-slate-705 mb-2.5 pb-1.5 border-b border-slate-200 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-500 font-bold" />
                    <span>
                      أرشيف الشركة المورّدة (الفواتير التاريخية وتواريخ قيود
                      الدفوعات والترحيل اليومي)
                    </span>
                  </h4>

                  {selectedCompDetails.txs.length === 0 ? (
                    <div className="text-center py-8 text-slate-404 text-xs italic">
                      لا توجد أي معاملات سابقة مسجلة (لا شغل جديد ولا تسديد) في كشف
                      حساب هذه الشركة بعد.
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
                          {[...selectedCompDetails.txs].reverse().map((tx) => (
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
                                    tx.type === "purchase_invoice"
                                      ? "bg-amber-105 text-amber-800"
                                      : "bg-emerald-105 text-emerald-800"
                                  }`}
                                >
                                  {tx.type === "purchase_invoice"
                                    ? "🔴 مستحقات توريد (آجل)"
                                    : "🟢 دفعة مسددة"}
                                </span>
                              </td>
                              <td
                                className={`p-2 text-left font-black ${
                                  tx.type === "purchase_invoice"
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                }`}
                              >
                                {tx.type === "purchase_invoice" ? "+" : "-"}
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
                        <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-800 text-[11px] font-mono">
                          <tr>
                            <td colSpan={2} className="p-2 text-right">
                              رصيد ديون قديم:{" "}
                              {(
                                selectedCompDetails.comp.previousBalance || 0
                              ).toLocaleString()}
                            </td>
                            <td
                              colSpan={2}
                              className="p-2 text-left text-amber-700"
                            >
                              دائن (+):{" "}
                              {(
                                selectedCompDetails.comp.newDebt || 0
                              ).toLocaleString()}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} className="p-2 text-right"></td>
                            <td
                              colSpan={2}
                              className="p-2 text-left text-emerald-700"
                            >
                              مدين (-):{" "}
                              {(
                                selectedCompDetails.comp.paymentToday || 0
                              ).toLocaleString()}
                            </td>
                          </tr>
                          <tr className="bg-slate-100/80">
                            <td
                              colSpan={2}
                              className="p-2 text-right text-xs font-black"
                            >
                              صافي الدين المستحق للشركة:
                            </td>
                            <td
                              colSpan={2}
                              className="p-2 text-left text-xs font-black text-rose-700"
                            >
                              {(
                                selectedCompDetails.comp.balance || 0
                              ).toLocaleString()}{" "}
                              د.ل
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                    <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                      <Calculator className="w-4 h-4 text-amber-600" />
                      <span>مسودة تجميع قيم للفواتير المتعددة قبل الترحيل للدفتر</span>
                    </h4>
                    <button onClick={handleAddBulkRow} className="bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded shadow-sm flex items-center gap-1 hover:bg-slate-50 transition font-bold cursor-pointer">
                      <Plus className="w-3 h-3" />
                      إضافة حقل آخر
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    {bulkRows.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <div className="bg-white px-2 py-2 border border-slate-200 rounded text-[10px] text-slate-400 font-bold w-7 text-center">
                          {i + 1}
                        </div>
                        <input 
                          type="number"
                          placeholder="المبلغ د.ل" 
                          value={r.amount}
                          onChange={(e) => handleUpdateBulkRow(r.id, 'amount', e.target.value)}
                          className="w-1/3 text-right bg-white p-2.5 border border-slate-200 rounded focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs font-mono font-bold"
                        />
                        <input 
                          type="text"
                          placeholder="تفاصيل الفاتورة (اختياري)" 
                          value={r.note}
                          onChange={(e) => handleUpdateBulkRow(r.id, 'note', e.target.value)}
                          className="flex-1 text-right bg-white p-2.5 border border-slate-200 rounded focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs"
                        />
                        <button onClick={() => handleRemoveBulkRow(r.id)} className="p-2.5 text-slate-400 hover:text-rose-500 bg-white border border-slate-200 rounded transition cursor-pointer">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
                    <div className="text-slate-600 text-xs font-bold w-1/3">
                      إجمالي القيم المجمعة:
                    </div>
                    <div className="text-xl font-black text-amber-700 space-x-1 font-mono flex-1 text-left flex items-center justify-between" dir="ltr">
                      <div className="text-xs text-amber-600 font-bold ml-4">
                        (سيتم الترحيل كقيد אחד في حساب المستحقات)
                      </div>
                      <div>
                        <span>{bulkTotal.toLocaleString()}</span> <span className="text-xs">د.ل</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex flex-row-reverse border-t border-slate-200/60 pt-4">
                    <button 
                      onClick={handleSaveBulkToLedger}
                      disabled={bulkTotal <= 0}
                      className="bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-amber-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
                    >
                      <span>ترحيل الإجمالي ( إيداع القيد ) لدفتر المستحقات اليومية</span>
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Action Bottom Bar */}
            <div className="border-t pt-3.5 flex flex-wrap gap-2 justify-between items-center bg-slate-50 p-3 rounded-b-2xl">
              <button
                onClick={() =>
                  handleExportSingleCompanyImage(selectedCompDetails.comp)
                }
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs p-2.5 px-6 rounded-xl transition cursor-pointer flex items-center justify-center shadow-xs"
              >
                🖨️ طباعة الكشف (مشاركة للواتساب)
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setTxType("purchase_invoice");
                    setTxAmount("");
                    setTxNote("");
                    setShowAddTxModal(true);
                  }}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-xs p-2.5 px-6 rounded-xl transition cursor-pointer flex items-center justify-center shadow-xs"
                >
                  ➕ إضافة قيد
                </button>

                <button
                  onClick={() => {
                    setTxType("payment");
                    setTxAmount("");
                    setTxNote("");
                    setShowAddTxModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs p-2.5 px-6 rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center"
                >
                  💸 تسديد دفعة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE SUPPLIER COMPANY */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl p-5 shadow-2xl max-w-md w-full border border-slate-200 text-right"
            dir="rtl"
          >
            <h3 className="font-black text-sm text-slate-950 border-b pb-3 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              <span>تسجيل شركة أو جهة توريدية جديدة</span>
            </h3>

            <form onSubmit={handleCreateCompanyAttempt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-705 mb-1">
                  اسم المورّد / الشركة الشريكة *
                </label>
                <input
                  type="text"
                  required
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="مثال: مجموعة التضامن للاستيراد"
                  className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-705 mb-1">
                    هاتف وتواصل (اختياري)
                  </label>
                  <input
                    type="text"
                    value={compContact}
                    onChange={(e) => setCompContact(e.target.value)}
                    placeholder="091-XXXXXXXX"
                    className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
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
                      className="w-full text-right p-2.5 pl-8 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
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
                  onClick={() => setShowAddCompanyModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs cursor-pointer transition"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2 rounded-lg text-xs cursor-pointer transition"
                >
                  حفظ وتسجيل المورد
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
                txType === "purchase_invoice"
                  ? "text-amber-800"
                  : "text-emerald-700"
              }`}
            >
              {txType === "purchase_invoice" ? (
                <>
                  <Plus className="w-5 h-5 text-amber-600" />
                  <span>🔴 قيد فاتورة شحنة توريد واردة ذمم (دين جديد)</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-emerald-600" />
                  <span>🟢 قيد وتصدير دفعة سداد حساب للمورد (مدفوع)</span>
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
                    className="w-full text-right p-2.5 pr-3 pl-9 border border-slate-200 rounded-xl text-xs font-mono font-bold bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
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
                <input
                  type="text"
                  value={txNote}
                  onChange={(e) => setTxNote(e.target.value)}
                  placeholder={
                    txType === "purchase_invoice"
                      ? "فاتورة شراء بكرات أسلاك مجلفنة"
                      : "دفعة نقدية مسلمة للمندوب"
                  }
                  className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
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
                  تنبيه: محاولة تكرار أو استرداد كارت مورد قديم!
                </h4>
                <p className="text-xs text-slate-400">
                  مورّد شريك باسم "{compName}" متواجد بالفعل بالأرشيف القديم.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              المنظومة تفيد بأن المورد "{compName}" لديه ملف قديم بالأرشيف
              المالي. هل تريد استرجاع ملفه القديم وحفظ الحركة الجديدة لتظل
              معاملاته التاريخية متكاملة؟ أم تريد كارت مستقل جديد كلياً؟
            </p>

            <div className="space-y-2">
              <button
                onClick={handleRestoreOldCompany}
                className="w-full text-right bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 font-bold p-3 rounded-xl text-xs transition cursor-pointer flex flex-col justify-start"
              >
                <span className="font-extrabold text-[12px] text-indigo-700">
                  🟢 نعم، استرجع بطاقة حسابه القديمة (الأرشيف متكامل):
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  سيعاد تفعيله ميكانيكياً مع ربط الدين الجديد وسجل فواتيره
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

      {/* Custom Confirmation Modal for Deleting Company Transaction */}
      {companyDeleteTxId && (
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
              هل أنت واثق من رغبتك في حذف حركة الحساب للمورد وتعديل الأرصدة
              التراكمية تلقائياً؟ لا يمكن استرجاع هذه العملية بعد التأكيد.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => executeDeleteTransaction(companyDeleteTxId)}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer focus:outline-none"
              >
                تأكيد الحذف والخصم
              </button>
              <button
                type="button"
                onClick={() => setCompanyDeleteTxId(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Archiving Company */}
      {companySoftDeleteId &&
        (() => {
          const comp = state.companies.find(
            (c) => c.id === companySoftDeleteId,
          );
          if (!comp) return null;
          return (
            <div
              className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in"
              dir="rtl"
            >
              <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl relative text-right">
                <h3 className="font-extrabold text-slate-900 text-base mb-2 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>أرشفة وبطاقة الشركة الموردة 📥</span>
                </h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  هل أنت واثق من إخفاء وأرشفة الشركة الموردة{" "}
                  <strong className="text-slate-900">({comp.name})</strong> من
                  الشاشة الرئيسية؟ سيتم الاحتفاظ بكامل كشف المعاملات التاريخي في
                  قاعدة البيانات، وعند كتابة اسمها مجدداً ستتمكن من استعادة
                  أرشيفها فوراً.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      executeSoftDeleteCompany(companySoftDeleteId)
                    }
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer focus:outline-none"
                  >
                    نعم، إخفاء وأرشفة البطاقة
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanySoftDeleteId(null)}
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
    </div>
  );
}
