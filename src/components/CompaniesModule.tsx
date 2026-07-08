import React, { useState, useEffect } from "react";
import { Landmark, Trash2, Plus, Search, Calendar, Clock, ArrowDownLeft, ShieldAlert, CircleAlert as AlertCircle, X, Check, FileText, Camera, Calculator, Copy } from "lucide-react";
import { copySettledImage, openSmartCardStudio } from "../utils/imageExporterUtils";
import { ERPState, Company, CompanyTransaction } from "../types";
import { VoiceInputButton } from "./VoiceInputButton";

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

export default function CompaniesModule({
  state,
  onUpdateState,
  onOpenExporter,
  searchQuery = "",
  pendingDeletions = [],
  onScheduleDeletion,
  onCancelDeletion,
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
    setShowSuccessToast("🎉 تم قيد وتحديث السجل المالي للشركة بنجاح.");
  };

  const handleDeleteTransaction = (txId: string) => {
    const tx = state.companyTransactions.find((t) => t.id === txId);
    const displayName = tx ? `حركة حساب الشركة` : `حركة حساب`;

    if (onScheduleDeletion) {
      onScheduleDeletion('transaction', txId, displayName, () => {
        executeDeleteTransaction(txId);
      });
    } else {
      setCompanyDeleteTxId(txId);
    }
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
    const comp = state.companies.find((c) => c.id === compId);
    const displayName = comp ? comp.name : "شركة";

    if (onScheduleDeletion) {
      onScheduleDeletion('company', compId, displayName, () => {
        executeSoftDeleteCompany(compId);
      });
    } else {
      setCompanySoftDeleteId(compId);
    }
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

  const isLabeledCompany = (name: string) => {
    const n = name.toLowerCase();
    return n.includes("شركة") || n.includes("شركه") || n.includes("شركات") || n.includes("company");
  };

  const companiesList = filteredCompanies.filter(c => isLabeledCompany(c.name));
  const merchantsList = filteredCompanies.filter(c => !isLabeledCompany(c.name));

  const renderCompanyCard = (c: Company, i: number) => {
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
        className={`${Number(remaining) === 0 ? "bg-emerald-600 border-emerald-400 ring-2 ring-emerald-300 ring-offset-1" : clr.bg + " " + clr.border} border rounded-xl p-3.5 shadow-md relative overflow-hidden group cursor-pointer hover:scale-[1.02] transition-all`}
      >
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
          <Landmark className="w-16 h-16 text-white" />
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-start justify-between mb-3">
            <h4
              className="font-extrabold text-white text-[11px] sm:text-xs line-clamp-2 flex-1 text-right drop-shadow-md ml-2"
              title={c.name}
            >
              {c.name}
            </h4>
            <div className="flex items-center gap-1.5 shrink-0">
              {Number(remaining) === 0 ? (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const success = await copySettledImage(c.name, "كارت مخالصة للشركة");
                    if (success) {
                      alert("تم مشاركة كارت المخالصة بنجاح 📋");
                    }
                  }}
                  className="bg-emerald-500/80 hover:bg-emerald-600 text-white p-1.5 rounded-lg transition-all cursor-pointer backdrop-blur-md shadow-sm border border-emerald-300"
                  title="نسخ كارت المخالصة 📋"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleCopyCardImage(c, remaining);
                  }}
                  className="bg-white/10 hover:bg-white/30 text-white p-1.5 rounded-lg transition-all cursor-pointer backdrop-blur-md shadow-xs border border-white/10"
                  title="نسخ كشف مختصر كصورة 📋"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleSoftDeleteCompany(c.id);
                }}
                className="bg-white/10 hover:bg-rose-500/80 text-white p-1.5 rounded-lg transition-all cursor-pointer backdrop-blur-md shadow-xs border border-white/10"
                title="أرشفة وإخفاء ❌"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-auto">
            <div className="text-lg font-black text-white drop-shadow-md">
              {remaining.toLocaleString()}{" "}
              <span className="text-[9px] font-bold opacity-70">
                د.ل
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const totalOwedToCompanies = activeCompanies.reduce(
    (sum, c) => sum + (c.balance || 0),
    0,
  );

  const handleExportSingleCompanyImage = (comp: Company) => {
    const allCompTxs = (state.companyTransactions || [])
      .filter((t) => t.companyId === comp.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Filter out initial/restore transactions because they are already accounted for in comp.previousBalance
    const compTxs = allCompTxs.filter(
      (t) => !t.id.includes("tx_comp_init_") && !t.id.includes("tx_comp_restore_")
    );

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
        new Date(t.date).toLocaleDateString("en-GB") +
          " " +
          new Date(t.date).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        t.note || (credit > 0 ? "فاتورة آجل" : "سداد دفعة للمورد"),
        credit > 0 ? `+${Math.round(credit).toLocaleString("en-US")} ` : "-",
        debit > 0 ? `-${Math.round(debit).toLocaleString("en-US")} ` : "-",
        `${Math.round(runningBalance).toLocaleString("en-US")} د.ل`,
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
        value: `${Math.round(comp.previousBalance || 0).toLocaleString("en-US")} د.ل`,
        colorClass: "text-slate-700",
      },
      {
        label: "شغل جديد",
        value: `+${Math.round(totalPurchases).toLocaleString("en-US")} د.ل`,
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

  const handleCopyCardImage = (company: Company, remaining: number) => {
    openSmartCardStudio({
      type: "companies",
      acctype: "company",
      name: company.name,
      amount: Math.abs(remaining),
      currency: "د.ل",
    });
    setShowSuccessToast("تم فتح منظومة الكروت الذكية 👑");
    setTimeout(() => setShowSuccessToast(null), 3000);
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
      `${Math.round(c.previousBalance || 0).toLocaleString("en-US")} د.ل`,
      `${Math.round(c.newDebt || 0).toLocaleString("en-US")} د.ل`,
      `${Math.round(c.paymentToday || 0).toLocaleString("en-US")} د.ل`,
      `${Math.round(c.balance || 0).toLocaleString("en-US")} د.ل`,
    ]);

    onOpenExporter(
      "الشركات ومستحقات الموردين اليدوية اليومية",
      {
        label1: "إجمالي ديون الشركات المستحقة",
        value1: Math.round(totalOwedToCompanies).toLocaleString("en-US") + " د.ل",
        label2: "عدد الشركات النشطة والمسجلة",
        value2: activeCompanies.length.toLocaleString("en-US") + " شركات توريد",
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
    <div className="space-y-6 text-right" dir="rtl">
      {/* 🔴 الكروت الإجمالية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* الكارت الإجمالي */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Landmark className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-extrabold text-sm tracking-wide">
                إجمالي مستحقات الشركات والتجار
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <Landmark className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-3xl font-black text-white drop-shadow-md">
                {totalOwedToCompanies.toLocaleString()}{" "}
                <span className="text-sm font-bold opacity-70">د.ل</span>
              </div>
            </div>
          </div>
        </div>

        {/* كارت إضافة كشف مورد */}
        <div 
          onClick={() => setShowAddCompanyModal(true)}
          className="bg-emerald-600 border border-emerald-500 rounded-2xl p-5 shadow-xl relative overflow-hidden group cursor-pointer hover:bg-emerald-700 transition-colors"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Plus className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-emerald-50 font-extrabold text-sm tracking-wide">
                إجراءات سريعة
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <Plus className="w-5 h-5 text-emerald-50" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-2xl font-black text-white drop-shadow-md flex items-center gap-2">
                إضافة كشف مورد 🏭
              </div>
            </div>
          </div>
        </div>

        {/* كارت تصدير كشف حساب */}
        <div 
          onClick={handleOpenShareCard}
          className="bg-amber-600 border border-amber-500 rounded-2xl p-5 shadow-xl relative overflow-hidden group cursor-pointer hover:bg-amber-700 transition-colors"
          title="تصدير كشف حساب مورد بتصميم احترافي كبطاقة"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Camera className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-amber-50 font-extrabold text-sm tracking-wide">
                تصدير وطباعة
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <Camera className="w-5 h-5 text-amber-50" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-2xl font-black text-white drop-shadow-md flex items-center gap-2">
                تصدير كشف حساب 📄
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Split grid for Merchants (Right) and Companies (Left) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Right side: Merchants (Since dir="rtl", first item is right) */}
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-slate-800 border-b-2 border-emerald-500 pb-1">التجار</h3>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{merchantsList.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...merchantsList].reverse().map((c, i) => renderCompanyCard(c, i))}
          </div>
          {merchantsList.length === 0 && (
            <div className="bg-white/50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-400">
              <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
              <h4 className="font-bold text-slate-500 text-xs mb-1">
                لا يوجد تجار مسجلين
              </h4>
            </div>
          )}
        </div>

        {/* Left side: Companies (Second item) */}
        <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-slate-800 border-b-2 border-indigo-500 pb-1">الشركات</h3>
            <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-0.5 rounded-full">{companiesList.length}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {[...companiesList].reverse().map((c, i) => renderCompanyCard(c, i))}
          </div>
          {companiesList.length === 0 && (
            <div className="bg-white/50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-400">
              <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-50" />
              <h4 className="font-bold text-slate-500 text-xs mb-1">
                لا توجد شركات مسجلة
              </h4>
            </div>
          )}
        </div>
      </div>

      {/* 📂 النافذة الكبيرة: تفاصيل أرشيف الشركة وحركات قيودها التاريخية */}
      {selectedCompId && selectedCompDetails && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl max-w-4xl w-full border border-slate-200 flex flex-col max-h-[90vh] text-right">
            {/* رأس البطاقة: معلومات + أزرار في صف واحد */}
            <div className="flex items-center justify-between border-b pb-3.5 mb-3 gap-3">
              {/* معلومات الشركة - يمين */}
              <div className="shrink-0">
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-sans">
                  بطاقة كشف حساب جهة توريدية نشطة
                </span>
                <h3 className="font-black text-sm text-slate-900 mt-1">
                  <span>اسم الشركة/المورد: </span>
                  <span className="text-indigo-650">
                    {selectedCompDetails.comp.name}
                  </span>
                </h3>
              </div>

              {/* جميع الأزرار في صف واحد - يسار */}
              <div className="flex flex-row-reverse items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setSelectedCompId(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[11px] px-3 py-2 rounded-lg transition whitespace-nowrap"
                >
                  ✕ إغلاق
                </button>
                <button
                  onClick={() => {
                    setTxType("purchase_invoice");
                    setTxAmount("");
                    setTxNote("");
                    setShowAddTxModal(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg transition shadow-sm whitespace-nowrap"
                >
                  🔴 إضافة دين
                </button>
                <button
                  onClick={() => {
                    setTxType("payment");
                    setTxAmount("");
                    setTxNote("");
                    setShowAddTxModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg transition shadow-sm whitespace-nowrap"
                >
                  🟢 تسديد دين
                </button>
                <button
                  onClick={() => handleExportSingleCompanyImage(selectedCompDetails.comp)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] px-3 py-2 rounded-lg transition shadow-sm whitespace-nowrap"
                >
                  🖨️ طباعة PDF
                </button>
              </div>
            </div>

            {/* بيانات موجزة + إجمالي الدين */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                {selectedCompDetails.comp.contact && (
                  <div>📞 <span className="font-mono">{selectedCompDetails.comp.contact}</span></div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-1.5">
                <span className="text-[11px] font-bold text-slate-500">إجمالي الدين:</span>
                <span className={`font-black text-lg font-mono ${(selectedCompDetails.comp.balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {Math.round(selectedCompDetails.comp.balance || 0).toLocaleString("en-US")} د.ل
                </span>
              </div>
            </div>

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

            {/* الأرشيف */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 min-h-[160px]">
              {activeTab === 'ledger' ? (
                <>
                  <div className="sticky top-0 bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2 z-10">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-extrabold text-slate-700">أرشيف العمليات</span>
                    <span className="text-[10px] text-slate-400 mr-auto">({selectedCompDetails.txs.length} عملية)</span>
                  </div>

                  {selectedCompDetails.txs.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs italic">
                      لا توجد أي معاملات سابقة مسجلة بعد.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px]">
                            <th className="p-2.5 text-right">التاريخ والوقت</th>
                            <th className="p-2.5 text-right">نوع العملية</th>
                            <th className="p-2.5 text-left">القيمة</th>
                            <th className="p-2.5 text-center w-10">حذف</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {[...selectedCompDetails.txs].reverse().map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                              <td className="p-2.5 font-sans text-[10.5px] text-slate-600 whitespace-nowrap">
                                <span className="text-slate-400 text-[9px] block">{tx.referenceNo}</span>
                                {new Date(tx.date).toLocaleDateString("ar-LY")}{" "}
                                {new Date(tx.date).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="p-2.5">
                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                                  tx.type === "purchase_invoice" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {tx.type === "purchase_invoice" ? "🔴 إضافة دين" : "🟢 تسديد دين"}
                                </span>
                              </td>
                              <td className={`p-2.5 text-left font-black font-mono ${
                                tx.type === "purchase_invoice" ? "text-amber-700" : "text-emerald-700"
                              }`}>
                                {tx.type === "purchase_invoice" ? "+" : "-"}{Math.round(tx.amount).toLocaleString("en-US")} د.ل
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx.id); }}
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
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    placeholder="مثال: مجموعة التضامن للاستيراد"
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <VoiceInputButton onResult={(text) => setCompName(prev => (prev ? prev + ' ' + text : text))} />
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
                <div className="relative">
                  <input
                    type="text"
                    value={txNote}
                    onChange={(e) => setTxNote(e.target.value)}
                    placeholder={
                      txType === "purchase_invoice"
                        ? "فاتورة شراء بكرات أسلاك مجلفنة"
                        : "دفعة نقدية مسلمة للمندوب"
                    }
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/50 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
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

      {/* Floating Draft Calculator */}
      <div className="fixed bottom-24 left-5 z-[80] flex flex-col items-start gap-3">
        {/* Modal Window */}
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
                      <X className="w-3.5 h-3.5" />
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
                  {calcCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
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
