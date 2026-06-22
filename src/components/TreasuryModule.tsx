import React, { useState, useEffect } from "react";
import {
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Sparkles,
  Plus,
  Minus,
  Trash2,
  FileText,
  UserCircle,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { ERPState, TreasuryTransaction } from "../types";

interface TreasuryModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: any,
    headers: string[],
    rows: any[][],
  ) => void;
}

export default function TreasuryModule({
  state,
  onUpdateState,
  onOpenExporter,
}: TreasuryModuleProps) {
  // 1. Calculate Debts (Positive outstandings we are owed)
  const totalCustomerDebts = state.customers
    .filter((c) => !c.isDeleted)
    .map((c) => {
      const activeCycle = state.cycles.find(
        (cy) => cy.customerId === c.id && cy.status === "active",
      );
      return activeCycle ? activeCycle.currentBalance : 0;
    })
    .reduce((sum, val) => sum + val, 0);

  const totalCompanyDebts = state.companies
    .filter((c) => !c.isDeleted)
    .reduce((sum, c) => sum + (c.balance || 0), 0);

  const totalMerchantDebts = (state.merchants || [])
    .filter((m) => !m.isDeleted)
    .reduce((sum, m) => sum + (m.balance || 0), 0);

  const totalPositiveDebts =
    totalCustomerDebts + totalCompanyDebts + totalMerchantDebts;

  // 2. Calculate Liabilities (Deposits & Purchases)
  const totalDeposits = state.trustDeposits
    .filter((d) => !d.isDeleted && d.status === "held")
    .reduce(
      (sum, d) => sum + (d.amountLyd !== undefined ? d.amountLyd : d.amount),
      0,
    );

  const [totalPurchases, setTotalPurchases] = useState(0);
  useEffect(() => {
    let unmounted = false;
    const fetchPurchases = async () => {
      try {
        const { doc, getDoc, onSnapshot } = await import("firebase/firestore");
        const { db } = await import("../firebase");
        if (!db) return;

        const docRef = doc(db, "erp_system", "purchases_module_v4");

        // Listen to realtime updates to accurately reflect liability
        const unsub = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists() && !unmounted) {
            let sum = 0;
            const data = docSnap.data();
            if (data.merchStates) {
              Object.values(data.merchStates).forEach((merch: any) => {
                const prev = merch.previousBalance || 0;
                const rowsRes = (merch.rows || []).reduce(
                  (s: number, r: any) => s + (Number(r.result) || 0),
                  0,
                );
                const rowsPaid = (merch.rows || []).reduce(
                  (s: number, r: any) => s + (Number(r.paid) || 0),
                  0,
                );
                sum += prev + rowsRes - rowsPaid;
              });
            }
            setTotalPurchases(sum);
          }
        });

        return unsub;
      } catch (e) {
        console.error(e);
      }
    };

    let unsubPromise = fetchPurchases();

    return () => {
      unmounted = true;
      unsubPromise.then((unsub) => {
        if (unsub && typeof unsub === "function") unsub();
      });
    };
  }, []);

  const totalLiabilities = totalDeposits + totalPurchases;

  // 3. Active Cash (الفلوس النشطة)
  const validTreasuryTxs = (state.treasuryTransactions || []).filter(
    (tx) => !tx.isDeleted,
  );
  const activeCash = validTreasuryTxs.reduce((sum, tx) => {
    return tx.type === "in" ? sum + tx.amount : sum - tx.amount;
  }, 0);

  // 4. Grand Positives (Card 1)
  const grandTotalPositives = activeCash + totalPositiveDebts;

  // 5. Net Total (Card 4)
  const netTotal = grandTotalPositives - totalLiabilities;

  // Internal forms for Active Cash
  const [depositAmount, setDepositAmount] = useState("");
  const [depositActor, setDepositActor] = useState("");
  const [depositNote, setDepositNote] = useState("");

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawActor, setWithdrawActor] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;
    if (!depositActor.trim()) return;

    const newTx: TreasuryTransaction = {
      id: `tx_tres_${Date.now()}`,
      type: "in",
      amount: amt,
      currency: "د.ل",
      conversionRate: 1,
      source: "manual_deposit",
      referenceNo: `TR-IN-${Math.floor(Math.random() * 1000000)}`,
      description:
        `[المودع: ${depositActor.trim()}] ${depositNote.trim()}`.trim(),
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    onUpdateState({
      ...state,
      treasuryTransactions: [...(state.treasuryTransactions || []), newTx],
    });

    setDepositAmount("");
    setDepositActor("");
    setDepositNote("");
  };

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) return;
    if (!withdrawActor.trim()) return;

    const newTx: TreasuryTransaction = {
      id: `tx_tres_${Date.now()}`,
      type: "out",
      amount: amt,
      currency: "د.ل",
      conversionRate: 1,
      source: "manual_withdraw",
      referenceNo: `TR-OUT-${Math.floor(Math.random() * 1000000)}`,
      description:
        `[الساحب: ${withdrawActor.trim()}] ${withdrawNote.trim()}`.trim(),
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    onUpdateState({
      ...state,
      treasuryTransactions: [...(state.treasuryTransactions || []), newTx],
    });

    setWithdrawAmount("");
    setWithdrawActor("");
    setWithdrawNote("");
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmWord, setResetConfirmWord] = useState("");

  const confirmDeleteTransaction = () => {
    if (!deleteConfirmId) return;
    onUpdateState({
      ...state,
      treasuryTransactions: (state.treasuryTransactions || []).map((tx) =>
        tx.id === deleteConfirmId ? { ...tx, isDeleted: true } : tx,
      ),
    });
    setDeleteConfirmId(null);
  };

  const executeResetTreasury = () => {
    if (resetConfirmWord === "تأكيد") {
      const updatedTxs = (state.treasuryTransactions || []).map((tx) => ({
        ...tx,
        isDeleted: true,
      }));
      onUpdateState({
        ...state,
        treasuryTransactions: updatedTxs,
      });
      setShowResetConfirm(false);
      setResetConfirmWord("");
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* 🔴 الكروت الإجمالية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* الكارت الإجمالي الجامع */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Landmark className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-extrabold text-sm tracking-wide">
                إجمالي إيجابيات الخزينة
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <Landmark className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-3xl font-black text-white drop-shadow-md">
                {grandTotalPositives.toLocaleString()}{" "}
                <span className="text-sm font-bold opacity-70">د.ل</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-2 font-medium leading-relaxed">
                = الرصيد النشط الفعلي + الديون (لنا)
              </div>
            </div>
          </div>
        </div>

        {/* كارت الرصيد النشط الفعلي */}
        <div className="bg-emerald-600 border border-emerald-500 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Wallet className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-emerald-50 font-extrabold text-sm tracking-wide">
                الرصيد النشط (الكاش الفعلي)
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <Sparkles className="w-5 h-5 text-emerald-50" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-3xl font-black text-white drop-shadow-md">
                {activeCash.toLocaleString()}{" "}
                <span className="text-sm font-bold opacity-70">د.ل</span>
              </div>
              <div className="text-[10px] text-emerald-200 mt-2 font-medium">
                السيولة النقدية المُدارة فعلياً باليد الآن
              </div>
            </div>
          </div>
        </div>

        {/* إجمالي الالتزامات والأمانات */}
        <div className="bg-rose-600 border border-rose-500 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowDownLeft className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-rose-50 font-extrabold text-sm tracking-wide">
                الالتزامات (علينا)
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <ArrowDownLeft className="w-5 h-5 text-rose-50" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-3xl font-black text-white drop-shadow-md">
                {totalLiabilities.toLocaleString()}{" "}
                <span className="text-sm font-bold opacity-70">د.ل</span>
              </div>
              <div className="text-[10px] text-rose-100 mt-2 font-medium">
                مجموع (الأمانات + المشتريات) المتبقية
              </div>
            </div>
          </div>
        </div>

        {/* صافي المركز المالي */}
        <div className="bg-indigo-600 border border-indigo-500 rounded-2xl p-5 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowUpRight className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-indigo-50 font-extrabold text-sm tracking-wide">
                صافي الخزينة المعياري
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <ArrowUpRight className="w-5 h-5 text-indigo-50" />
              </div>
            </div>
            <div className="mt-auto">
              <div className="text-3xl font-black text-white drop-shadow-md">
                {netTotal.toLocaleString()}{" "}
                <span className="text-sm font-bold opacity-70">د.ل</span>
              </div>
              <div className="text-[10px] text-indigo-100 mt-2 font-medium">
                إجمالي الإيجابيات (الكارت الأول) - الالتزامات (الكارت الثالث)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔴 الحركات اليدوية للإيداع والسحب */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* إيداع يدوي */}
        <div className="bg-white border text-right border-emerald-100 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3 text-emerald-800">
            <div className="bg-emerald-100 p-1.5 rounded-full">
              <Plus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm">إيداع نقدي بالخزينة</h3>
          </div>

          <form onSubmit={handleDeposit} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  المبلغ المودع
                </label>
                <input
                  type="number"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full p-1.5 border border-emerald-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-sm text-emerald-900 bg-emerald-50/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  اسم المودع
                </label>
                <div className="relative">
                  <UserCircle className="w-3 h-3 absolute top-1/2 right-2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="اسم المنفذ"
                    value={depositActor}
                    onChange={(e) => setDepositActor(e.target.value)}
                    className="w-full p-1.5 pr-6 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                البيان (اختياري)
              </label>
              <input
                type="text"
                placeholder="ملاحظات..."
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500 outline-none text-[11px]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 rounded-lg transition text-[11px]"
            >
              تأكيد الإدخال
            </button>
          </form>
        </div>

        {/* سحب يدوي */}
        <div className="bg-white border text-right border-rose-100 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-1.5 mb-3 text-rose-800">
            <div className="bg-rose-100 p-1.5 rounded-full">
              <Minus className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm">سحب نقدي من الخزينة</h3>
          </div>

          <form onSubmit={handleWithdraw} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  المبلغ المسحوب
                </label>
                <input
                  type="number"
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full p-1.5 border border-rose-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none font-bold text-sm text-rose-900 bg-rose-50/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                  اسم المستلم أو الساحب
                </label>
                <div className="relative">
                  <UserCircle className="w-3 h-3 absolute top-1/2 right-2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="استلمها / سحبها"
                    value={withdrawActor}
                    onChange={(e) => setWithdrawActor(e.target.value)}
                    className="w-full p-1.5 pr-6 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none text-[11px]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                التفاصيل والبيان
              </label>
              <input
                type="text"
                required
                placeholder="سبب السحب..."
                value={withdrawNote}
                onChange={(e) => setWithdrawNote(e.target.value)}
                className="w-full p-1.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-rose-500 outline-none text-[11px]"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 rounded-lg transition text-[11px]"
            >
              تأكيد وخصم
            </button>
          </form>
        </div>
      </div>

      {/* 🔴 سجل الحركات اليدوية للإيداع والسحب المقسّمة */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            سجل حركة الخزينة (إيداعات وسحوبات)
          </h3>
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg font-bold text-[10px] transition cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            تصفير السجلات
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {/* جدول المودعات */}
          <div>
            <div className="flex items-center justify-between bg-emerald-50 px-3 py-2 border border-emerald-100 rounded-t-lg">
              <span className="text-emerald-800 font-extrabold text-xs">
                إيداعات بالخزينة
              </span>
              <span className="text-emerald-600 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-md">
                {validTreasuryTxs.filter((tx) => tx.type === "in").length}{" "}
                عمليات
              </span>
            </div>
            <div className="w-full border-x border-b border-emerald-100 rounded-b-lg overflow-x-auto">
              <table className="w-full text-right whitespace-nowrap">
                <thead className="bg-emerald-50/50">
                  <tr>
                    <th className="px-2 py-1.5 text-emerald-700 font-black border-b border-emerald-100 text-[9px] w-8 text-center">
                      ت
                    </th>
                    <th className="px-2 py-1.5 text-emerald-700 font-bold border-b border-emerald-100 text-[10px]">
                      الاسم
                    </th>
                    <th className="px-2 py-1.5 text-emerald-700 font-bold border-b border-emerald-100 text-[10px]">
                      المبلغ
                    </th>
                    <th className="px-2 py-1.5 text-emerald-700 font-bold border-b border-emerald-100 text-[10px]">
                      البيان
                    </th>
                    <th className="px-2 py-1.5 text-emerald-700 font-bold border-b border-emerald-100 text-[10px]">
                      التاريخ واليوم
                    </th>
                    <th className="px-2 py-1.5 text-emerald-700 font-bold border-b border-emerald-100 text-[10px] w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {validTreasuryTxs
                    .filter((tx) => tx.type === "in")
                    .map((tx, idx, arr) => {
                      const match = tx.description.match(/\[(.*?)\](.*)/);
                      const actorName = match
                        ? match[1]
                            .replace("المودع:", "")
                            .replace("الساحب:", "")
                            .trim()
                        : "متفرقات";
                      const noteStr = match ? match[2].trim() : tx.description;
                      const d = new Date(tx.date);
                      const isNew = true; // since we will reverse
                      const seqNum = arr.length - idx; // new descending seq
                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-emerald-100 transition even:bg-emerald-50 odd:bg-white border-b border-emerald-100"
                        >
                          <td className="px-2 py-1 text-emerald-600/70 font-black text-[9px] text-center border-l border-emerald-50 bg-emerald-50/20">
                            {seqNum}
                          </td>
                          <td
                            className="px-2 py-1 text-slate-700 font-bold text-[10px] max-w-[80px] truncate"
                            title={actorName}
                          >
                            {actorName}
                          </td>
                          <td className="px-2 py-1 text-emerald-700 font-black text-[10px] font-mono">
                            +{tx.amount.toLocaleString()}
                          </td>
                          <td
                            className="px-2 py-1 text-slate-500 font-medium text-[9px] max-w-[100px] truncate"
                            title={noteStr}
                          >
                            {noteStr || "-"}
                          </td>
                          <td className="px-2 py-1 text-slate-500 font-mono text-[9px]">
                            {d.toLocaleDateString("ar-EG", {
                              weekday: "short",
                            })}{" "}
                            {d.toLocaleDateString("en-GB")}
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button
                              onClick={() => setDeleteConfirmId(tx.id)}
                              className="text-emerald-400 hover:text-rose-500 transition cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                    .reverse()}
                  {validTreasuryTxs.filter((tx) => tx.type === "in").length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-3 text-center text-[10px] text-emerald-500/60 font-bold"
                      >
                        لا يوجد إيداعات حتى الآن
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* جدول المسحوبات */}
          <div>
            <div className="flex items-center justify-between bg-rose-50 px-3 py-2 border border-rose-100 rounded-t-lg">
              <span className="text-rose-800 font-extrabold text-xs">
                سحوبات من الخزينة
              </span>
              <span className="text-rose-600 font-bold text-[10px] bg-rose-100 px-2 py-0.5 rounded-md">
                {validTreasuryTxs.filter((tx) => tx.type === "out").length}{" "}
                عمليات
              </span>
            </div>
            <div className="w-full border-x border-b border-rose-100 rounded-b-lg overflow-x-auto">
              <table className="w-full text-right whitespace-nowrap">
                <thead className="bg-rose-50/50">
                  <tr>
                    <th className="px-2 py-1.5 text-rose-700 font-black border-b border-rose-100 text-[9px] w-8 text-center">
                      ت
                    </th>
                    <th className="px-2 py-1.5 text-rose-700 font-bold border-b border-rose-100 text-[10px]">
                      الاسم
                    </th>
                    <th className="px-2 py-1.5 text-rose-700 font-bold border-b border-rose-100 text-[10px]">
                      المبلغ
                    </th>
                    <th className="px-2 py-1.5 text-rose-700 font-bold border-b border-rose-100 text-[10px]">
                      البيان
                    </th>
                    <th className="px-2 py-1.5 text-rose-700 font-bold border-b border-rose-100 text-[10px]">
                      التاريخ واليوم
                    </th>
                    <th className="px-2 py-1.5 text-rose-700 font-bold border-b border-rose-100 text-[10px] w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50">
                  {validTreasuryTxs
                    .filter((tx) => tx.type === "out")
                    .map((tx, idx, arr) => {
                      const match = tx.description.match(/\[(.*?)\](.*)/);
                      const actorName = match
                        ? match[1]
                            .replace("المودع:", "")
                            .replace("الساحب:", "")
                            .trim()
                        : "متفرقات";
                      const noteStr = match ? match[2].trim() : tx.description;
                      const d = new Date(tx.date);
                      const seqNum = arr.length - idx; // new descending seq
                      return (
                        <tr
                          key={tx.id}
                          className="hover:bg-rose-100 transition even:bg-rose-50 odd:bg-white border-b border-rose-100"
                        >
                          <td className="px-2 py-1 text-rose-600/70 font-black text-[9px] text-center border-l border-rose-50 bg-rose-50/20">
                            {seqNum}
                          </td>
                          <td
                            className="px-2 py-1 text-slate-700 font-bold text-[10px] max-w-[80px] truncate"
                            title={actorName}
                          >
                            {actorName}
                          </td>
                          <td className="px-2 py-1 text-rose-700 font-black text-[10px] font-mono">
                            -{tx.amount.toLocaleString()}
                          </td>
                          <td
                            className="px-2 py-1 text-slate-500 font-medium text-[9px] max-w-[100px] truncate"
                            title={noteStr}
                          >
                            {noteStr || "-"}
                          </td>
                          <td className="px-2 py-1 text-slate-500 font-mono text-[9px]">
                            {d.toLocaleDateString("ar-EG", {
                              weekday: "short",
                            })}{" "}
                            {d.toLocaleDateString("en-GB")}
                          </td>
                          <td className="px-2 py-1 text-center">
                            <button
                              onClick={() => setDeleteConfirmId(tx.id)}
                              className="text-rose-400 hover:text-rose-600 transition cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                    .reverse()}
                  {validTreasuryTxs.filter((tx) => tx.type === "out").length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-2 py-3 text-center text-[10px] text-rose-500/60 font-bold"
                      >
                        لا يوجد سحوبات حتى الآن
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div
            className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm text-center"
            dir="rtl"
          >
            <div className="mx-auto w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              تأكيد حذف المعاملة
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              هل أنت متأكد من حذف هذه المعاملة النشطة والخزينة ستقوم بتعديل
              الرصيد؟
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={confirmDeleteTransaction}
                className="px-5 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition"
              >
                تأكيد الحذف
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Treasury Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div
            className="bg-white border-2 border-rose-500 rounded-3xl p-6 shadow-2xl w-full max-w-md text-right border"
            dir="rtl"
          >
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <ShieldAlert className="w-8 h-8" />
              <h3 className="text-xl font-black">تحذير خطير: تصفير الخزينة</h3>
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-4 leading-relaxed">
              هذا الإجراء سيقوم بحذف كافة الحركات النقدية (الإيداع والسحب) من
              الخزينة المركزية بشكل، وسيتم إعادة الرصيد النشط إلى صفر د.ل.
            </p>

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl mb-6">
              <p className="text-xs font-bold text-rose-800 mb-2">
                للتأكيد، يرجى كتابة كلمة "تأكيد" في المربع أدناه:
              </p>
              <input
                type="text"
                placeholder="أكتب: تأكيد"
                value={resetConfirmWord}
                onChange={(e) => setResetConfirmWord(e.target.value)}
                className="w-full text-center p-3 border border-rose-300 rounded-lg focus:outline-none focus:border-rose-500 font-bold text-rose-900 mx-auto"
              />
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
              >
                تراجع وإلغاء
              </button>
              <button
                onClick={executeResetTreasury}
                disabled={resetConfirmWord !== "تأكيد"}
                className="px-6 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                تنفيذ التصفير
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
