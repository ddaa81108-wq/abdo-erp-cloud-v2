import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Calculator,
  Check,
  Copy,
  X,
  FileText,
  Smartphone,
} from "lucide-react";
import { db } from "../firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { ERPState } from "../types";
import { openSmartCardStudio } from "../utils/imageExporterUtils";

interface PurchasesModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: any,
    headers: string[],
    rows: any[][],
  ) => void;
}

interface PurchaseRow {
  id: string;
  seq: number;
  type: string;
  value: number | string;
  op: "multiply" | "divide";
  rate: number | string;
  result: number;
  paid: number | string;
  remaining: number;
  consumer: number | string;
  date?: string;
}

interface ConsumerRow {
  id: string;
  name: string;
  amount: number | string;
}

interface MerchantPurchaseState {
  previousBalance: number | string;
  egyptianPreviousBalance?: number;
  rows: PurchaseRow[];
  manualConsumerValue: number | string;
  consumerRows?: ConsumerRow[];
}

const DEFAULT_STATE: Record<string, MerchantPurchaseState> = {
  baqy: {
    previousBalance: 0,
    egyptianPreviousBalance: 0,
    rows: [],
    manualConsumerValue: 0,
    consumerRows: [
      { id: "b_c_1", name: "المستهلك الأول", amount: 0 },
      { id: "b_c_2", name: "المستهلك الثاني", amount: 0 },
      { id: "b_c_3", name: "المستهلك الثالث", amount: 0 },
    ],
  },
  semsem: {
    previousBalance: 0,
    egyptianPreviousBalance: 0,
    rows: [],
    manualConsumerValue: 0,
    consumerRows: [
      { id: "s_c_1", name: "المستهلك الأول", amount: 0 },
      { id: "s_c_2", name: "المستهلك الثاني", amount: 0 },
      { id: "s_c_3", name: "المستهلك الثالث", amount: 0 },
    ],
  },
};

export default function PurchasesModule({
  state,
  onUpdateState,
  onOpenExporter,
}: PurchasesModuleProps) {
  const [activeMerch, setActiveMerch] = useState<"baqy" | "semsem">("baqy");
  const lastEditTime = useRef<number>(0);

  const [showBird, setShowBird] = useState(false);
  const [birdDismissed, setBirdDismissed] = useState(false);
  const [isFlyingOut, setIsFlyingOut] = useState(false);

  const [showReviewAlert, setShowReviewAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertDismissed, setAlertDismissed] = useState(false);

  const [showCalculator, setShowCalculator] = useState(false);
  const [calcRows, setCalcRows] = useState<
    { id: string; value: string; price: string; operator: "multiply" | "divide" | "add" | "subtract" }[]
  >([{ id: "1", value: "", price: "", operator: "multiply" }]);
  const [calcCopied, setCalcCopied] = useState(false);

  const [merchStates, setMerchStates] = useState<
    Record<string, MerchantPurchaseState>
  >({
    baqy: {
      previousBalance: 0,
      rows: [],
      manualConsumerValue: 0,
      consumerRows: [
        { id: "baqy_c_1", name: "المستهلك الأول", amount: 0 },
        { id: "baqy_c_2", name: "المستهلك الثاني", amount: 0 },
        { id: "baqy_c_3", name: "المستهلك الثالث", amount: 0 },
      ],
    },
    semsem: {
      previousBalance: 0,
      rows: [],
      manualConsumerValue: 0,
      consumerRows: [
        { id: "semsem_c_1", name: "المستهلك الأول", amount: 0 },
        { id: "semsem_c_2", name: "المستهلك الثاني", amount: 0 },
        { id: "semsem_c_3", name: "المستهلك الثالث", amount: 0 },
      ],
    },
  });

  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load and sync from Firestore
  useEffect(() => {
    let unmounted = false;
    if (!db) return;

    const docRef = doc(db, "erp_system", "purchases_module_v4");
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        if (Date.now() - lastEditTime.current < 3000) {
          return;
        }
        const data = docSnap.data();
        if (!unmounted && data.merchStates) {
          const patchedMerch = { ...data.merchStates };
          Object.keys(patchedMerch).forEach((k) => {
            if (!patchedMerch[k].consumerRows) {
              patchedMerch[k].consumerRows = [
                {
                  id: `${k}_c_1`,
                  name: "المستهلك الأول",
                  amount: patchedMerch[k].manualConsumerValue || 0,
                },
                { id: `${k}_c_2`, name: "المستهلك الثاني", amount: 0 },
                { id: `${k}_c_3`, name: "المستهلك الثالث", amount: 0 },
              ];
            }
          });
          setMerchStates((current) => {
            if (JSON.stringify(current) === JSON.stringify(patchedMerch)) {
              return current;
            }
            return patchedMerch;
          });
        }
        if (!unmounted && data.historyRecords) {
          setHistoryRecords((current) => {
            if (JSON.stringify(current) === JSON.stringify(data.historyRecords)) {
              return current;
            }
            return data.historyRecords;
          });
        }
        if (!unmounted) {
          setIsLoaded(true);
        }
      } else {
        const localMerch = localStorage.getItem("ABDO_DAILY_PURCHASES_V4");
        const localHist = localStorage.getItem("ABDO_DAILY_PURCHASES_HISTORY_V4");
        const nextData: any = {};
        if (localMerch) {
          try {
            nextData.merchStates = JSON.parse(localMerch);
          } catch (e) {}
        }
        if (localHist) {
          try {
            nextData.historyRecords = JSON.parse(localHist);
          } catch (e) {}
        }
        if (nextData.merchStates || nextData.historyRecords) {
          await setDoc(docRef, nextData);
        }
        if (!unmounted) setIsLoaded(true);
      }
    });
    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  // Write changes to Firestore (debounced)
  useEffect(() => {
    if (!isLoaded) return;
    const handler = setTimeout(() => {
      if (!db) return;
      const docRef = doc(db, "erp_system", "purchases_module_v4");
      setDoc(docRef, { merchStates, historyRecords }, { merge: true }).catch(
        (err) => {
          console.error("Firebase save error (Purchases):", err);
        },
      );
    }, 1500);
    return () => clearTimeout(handler);
  }, [merchStates, historyRecords, isLoaded]);

  // Floating Calculator Logic
  const handleAddCalcRow = () => {
    setCalcRows([...calcRows, { id: Math.random().toString(), value: "", price: "", operator: "multiply" }]);
  };
  const handleUpdateCalcRow = (id: string, field: string, val: string) => {
    setCalcRows(calcRows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  };
  const handleRemoveCalcRow = (id: string) => {
    setCalcRows(calcRows.filter((r) => r.id !== id));
  };
  const calculateRowResult = (row: typeof calcRows[0]) => {
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

  const currentData = merchStates[activeMerch] || {
    previousBalance: 0,
    rows: [],
    manualConsumerValue: 0,
    consumerRows: [],
  };

  const updateCurrentMerchantState = (
    updater: (prev: MerchantPurchaseState) => MerchantPurchaseState,
  ) => {
    lastEditTime.current = Date.now();
    setMerchStates((prev) => ({
      ...prev,
      [activeMerch]: updater(
        prev[activeMerch] || {
          previousBalance: 0,
          rows: [],
          manualConsumerValue: 0,
          consumerRows: [],
        },
      ),
    }));
  };

  const handleRowChange = (
    rowId: string,
    field: keyof PurchaseRow,
    val: any,
  ) => {
    updateCurrentMerchantState((prev) => {
      const updatedRows = prev.rows.map((r) => {
        if (r.id !== rowId) return r;
        let newRow = { ...r };
        if (field === "value" || field === "paid" || field === "rate" || field === "consumer") {
          newRow[field] = val;
        } else {
          newRow = { ...r, [field]: val };
        }
        const valueNum = Number(newRow.value) || 0;
        const rateNum = Number(newRow.rate) || 0;
        if (newRow.op === "multiply") {
          newRow.result = Math.round(valueNum * rateNum);
        } else {
          newRow.result = rateNum !== 0 ? Math.round(valueNum / rateNum) : 0;
        }
        const paidNum = Number(newRow.paid) || 0;
        newRow.remaining = Math.round(newRow.result - paidNum);
        return newRow;
      });
      return { ...prev, rows: updatedRows };
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: string,
  ) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = e.key === "ArrowDown" ? rowIndex + 1 : rowIndex - 1;
      const currentRows = merchStates[activeMerch]?.rows || [];
      if (e.key === "ArrowDown" && nextIndex >= currentRows.length) {
        handleAddRow();
        setTimeout(() => {
          const nextInput = document.getElementById(
            `input-${activeMerch}-${field}-${nextIndex}`,
          );
          if (nextInput) {
            (nextInput as HTMLInputElement).focus();
          }
        }, 50);
        return;
      }
      const nextInput = document.getElementById(
        `input-${activeMerch}-${field}-${nextIndex}`,
      );
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      }
    }
  };

  const handleAddRow = () => {
    updateCurrentMerchantState((prev) => {
      const nextSeq =
        prev.rows.length > 0 ? Math.max(...prev.rows.map((r) => r.seq)) + 1 : 1;
      const newRow: PurchaseRow = {
        id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        seq: nextSeq,
        type: "",
        value: 0,
        op: "divide",
        rate: 10.0,
        result: 0,
        paid: 0,
        remaining: 0,
        consumer: 0,
        date: new Date().toISOString().split("T")[0],
      };
      return {
        ...prev,
        rows: [...prev.rows, newRow],
      };
    });
  };

  const handleDeleteRow = (rowId: string) => {
    updateCurrentMerchantState((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId),
    }));
  };

  const isVodafoneRow = (type: string) => {
    if (!type) return false;
    return type.includes("فودافون") || type.toLowerCase().includes("vodafone");
  };

  const prevBalance = Math.round(Number(currentData.previousBalance) || 0);

  const totalTodayWork = currentData.rows.reduce(
    (sum, r) => sum + (Number(r.result) || 0),
    0,
  );

  const totalPaidToday = currentData.rows.reduce(
    (sum, r) => sum + (Number(r.paid) || 0),
    0,
  );

  const remainingTotalOwed = prevBalance + totalTodayWork - totalPaidToday;

  const totalConsumerValue = currentData.rows.reduce(
    (sum, r) => sum + (Number(r.consumer) || 0),
    0,
  );

  const totalVodafoneBase = currentData.rows
    .filter((r) => isVodafoneRow(r.type))
    .reduce((sum, r) => sum + Number(r.value || 0), 0);

  const remainingEgyptianValue =
    (currentData.egyptianPreviousBalance || 0) +
    totalVodafoneBase -
    totalConsumerValue;

  const sumValueCol = currentData.rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
  const sumRateCol = currentData.rows.reduce((s, r) => s + (Number(r.rate) || 0), 0);

  const totalPurchasesDebt: number = Object.values(merchStates).reduce((sum: number, merch: any) => {
    const p = Math.round(Number(merch.previousBalance) || 0);
    const w = merch.rows.reduce((s: number, r: any) => s + (Number(r.result) || 0), 0);
    const pd = merch.rows.reduce((s: number, r: any) => s + (Number(r.paid) || 0), 0);
    return sum + (p + w - pd);
  }, 0 as number) as number;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (totalPurchasesDebt > 0 && !birdDismissed && !showBird) {
      timer = setTimeout(() => {
        setShowBird(true);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [totalPurchasesDebt, birdDismissed, showBird]);

  useEffect(() => {
    const checkTimeAndShowAlert = () => {
      const now = new Date();
      const hours = now.getHours();
      if (hours >= 3 && !alertDismissed) {
        const messages = [
          "هل نسيت إضافة عملية؟",
          "هل يوجد مبلغ مسدد لم يتم تسجيله؟",
          "هل الحسابات مكتملة؟",
          "هل راجعت جميع معاملات اليوم؟",
        ];
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        setAlertMessage(randomMessage);
        setShowReviewAlert(true);
      }
    };
    checkTimeAndShowAlert();
    const interval = setInterval(checkTimeAndShowAlert, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [alertDismissed]);

  return (
    <div className="space-y-4 text-right font-sans" dir="rtl">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-12">
          <div className="flex flex-wrap items-stretch gap-3">
            {/* المجموعة اليمنى: 4 كروت ذهبية مكبرة */}
            <div className="flex flex-wrap items-stretch gap-3">
              {/* Card 1 - إجمالي اليوم */}
              <div className="bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 border-2 border-amber-500 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[150px] min-h-[92px] flex flex-col justify-center">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-900 font-bold text-xs">📅 إجمالي اليوم</span>
                </div>
                <div>
                  <span className="font-mono text-2xl font-black text-amber-950 leading-none">
                    {totalTodayWork.toLocaleString()}{" "}
                    <span className="text-xs font-bold text-amber-700">د.ل</span>
                  </span>
                </div>
              </div>

              {/* Card 2 - إجمالي المسدد */}
              <div className="bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 border-2 border-amber-500 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[150px] min-h-[92px] flex flex-col justify-center">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-amber-900 font-bold text-xs">✅ إجمالي المسدد</span>
                </div>
                <div>
                  <span className="font-mono text-2xl font-black text-emerald-700 leading-none">
                    {totalPaidToday.toLocaleString()}{" "}
                    <span className="text-xs font-bold text-emerald-600">د.ل</span>
                  </span>
                </div>
              </div>

              {/* Card 3 - إجمالي الديون (متغير) */}
              <div className={`bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 border-2 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[150px] min-h-[92px] flex flex-col justify-center ${remainingTotalOwed > 0 ? "border-rose-500" : remainingTotalOwed < 0 ? "border-emerald-500" : "border-amber-500"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold text-xs ${remainingTotalOwed > 0 ? "text-rose-800" : remainingTotalOwed < 0 ? "text-emerald-800" : "text-amber-900"}`}>🙁 إجمالي الديون</span>
                </div>
                <div className="relative z-10">
                  <span className={`font-mono text-2xl font-black leading-none ${remainingTotalOwed > 0 ? "text-rose-700" : remainingTotalOwed < 0 ? "text-emerald-700" : "text-amber-950"}`}>
                    {remainingTotalOwed.toLocaleString()}{" "}
                    <span className={`text-xs font-bold ${remainingTotalOwed > 0 ? "text-rose-600" : remainingTotalOwed < 0 ? "text-emerald-600" : "text-amber-700"}`}>د.ل</span>
                  </span>
                </div>
              </div>

              {/* Card 4 - الباقي المصري (متغير) */}
              <div className={`bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 border-2 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[150px] min-h-[92px] flex flex-col justify-center ${remainingEgyptianValue > 0 ? "border-emerald-500" : remainingEgyptianValue < 0 ? "border-rose-500" : "border-amber-500"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-bold text-xs ${remainingEgyptianValue > 0 ? "text-emerald-800" : remainingEgyptianValue < 0 ? "text-rose-800" : "text-amber-900"}`}>🇪 الباقي المصري</span>
                </div>
                <div>
                  <span className={`font-mono text-2xl font-black leading-none ${remainingEgyptianValue > 0 ? "text-emerald-700" : remainingEgyptianValue < 0 ? "text-rose-700" : "text-amber-950"}`}>
                    {remainingEgyptianValue.toLocaleString()}{" "}
                    <span className={`text-xs font-bold ${remainingEgyptianValue > 0 ? "text-emerald-600" : remainingEgyptianValue < 0 ? "text-rose-600" : "text-amber-700"}`}>EGP</span>
                  </span>
                </div>
              </div>
            </div>

            {/* المجموعة اليسرى: 3 أزرار خضرا موزعة بنفس حجم الكروت */}
            <div className="flex-1 grid grid-cols-3 gap-3 min-w-[320px]">
              {/* Toggle Switch */}
              <div className="inline-flex items-stretch bg-emerald-700 p-1 rounded-xl border-2 border-emerald-500 min-h-[92px] w-full">
                <button
                  type="button"
                  onClick={() => setActiveMerch("baqy")}
                  className={`flex-1 px-3 rounded-lg font-bold text-sm transition-all duration-300 cursor-pointer flex items-center justify-center ${activeMerch === "baqy" ? "bg-white text-emerald-700 shadow-sm" : "text-emerald-50 hover:text-white hover:bg-emerald-600"}`}
                >
                  البيان
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMerch("semsem")}
                  className={`flex-1 px-3 rounded-lg font-bold text-sm transition-all duration-300 cursor-pointer flex items-center justify-center ${activeMerch === "semsem" ? "bg-white text-emerald-700 shadow-sm" : "text-emerald-50 hover:text-white hover:bg-emerald-600"}`}
                >
                  سمسم
                </button>
              </div>

              {/* Smart System Button */}
              <button
                type="button"
                onClick={() => {
                  openSmartCardStudio({
                    type: "purchases",
                    merchant: activeMerch === "baqy" ? "البيان" : "سمسم",
                    p1: prevBalance,
                    p2: totalTodayWork,
                    p3: totalPaidToday,
                    p4: remainingTotalOwed,
                    p5: remainingEgyptianValue,
                  });
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-sm border-2 border-emerald-500 min-h-[92px] w-full"
              >
                <Smartphone className="w-5 h-5" />
                <span>النظام الذكي</span>
              </button>

              {/* Add Transaction Button */}
              <button
                type="button"
                onClick={handleAddRow}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all shadow-sm border-2 border-emerald-500 min-h-[92px] w-full"
              >
                <Plus className="w-5 h-5" />
                <span>إضافة معاملة</span>
              </button>
            </div>
          </div>
        </div>

        {/* جدول المشتريات المستمر (القديم فوق، الأحدث تحت) - رأس الجدول مثبت */}
        <div className="xl:col-span-12">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-base leading-none">📋</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-sm">جدول المشتريات اليومية</h3>
                </div>
              </div>
            </div>

            {currentData.rows.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center flex-grow">
                <FileText className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-xs font-bold text-slate-500 mb-2">لا توجد قيود مسجلة اليوم.</p>
                <button
                  onClick={handleAddRow}
                  className="bg-slate-100/50 hover:bg-indigo-50 border border-slate-200 text-indigo-700 font-bold text-xs px-5 py-2.5 rounded-lg transition-all"
                >
                  📝 إنشاء قيد جديد
                </button>
              </div>
            ) : (
              <div className="flex-grow p-4 pt-0">
                <div className="border border-slate-200/80 rounded-xl shadow-sm mt-4 max-h-[70vh] overflow-auto">
                  <table className="w-full text-right text-[11px] border-collapse min-w-[1150px] table-fixed">
                    <thead className="bg-slate-100 text-slate-500 font-bold border-b-2 border-slate-200/80 sticky top-0 z-10">
                      <tr>
                        <th className="p-2 border-l border-slate-200/80 text-center w-[4%] bg-slate-100">ت</th>
                        <th className="p-2 border-l border-slate-200/80 text-center w-[11%] bg-slate-100">التاريخ</th>
                        <th className="p-2 border-l border-slate-200/80 text-center w-[15%] bg-slate-100">النوع</th>
                        <th className="p-2 border-l border-slate-200/80 text-center w-[11%] bg-slate-100">القيمة (مصري) EGP</th>
                        <th className="p-2 border-l border-slate-200/80 text-center w-[11%] bg-slate-100">العملية</th>
                        <th className="p-2 border-l border-slate-200/80 text-center w-[8%] bg-slate-100">صرف (لر)</th>
                        <th className="p-2 border-l border-slate-200/80 text-right w-[10%] bg-slate-100">الناتج (د.ل)</th>
                        <th className="p-2 border-l border-slate-200/80 text-center w-[10%] text-emerald-700 bg-slate-100">المسدد (د.ل)</th>
                        <th className="p-2 border-l border-slate-200/80 text-right w-[10%] text-indigo-700 bg-slate-100">الباقي (د.ل)</th>
                        <th className="p-2 border-l border-slate-200/80 text-center w-[10%] text-purple-700 bg-slate-100">مستهلك فودافون EGP</th>
                        <th className="p-2 text-center w-[4%] bg-slate-100"><Trash2 className="w-3 h-3 mx-auto" /></th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-slate-700 divide-y divide-slate-100">
                      {currentData.rows.map((row, idx) => {
                        const isVod = isVodafoneRow(row.type);
                        return (
                          <tr
                            key={row.id}
                            className={`group transition-colors ${isVod ? "bg-purple-50/20 font-bold hover:bg-purple-50/40" : "hover:bg-indigo-50/10"}`}
                          >
                            <td className="p-1 border-l border-slate-200/80 text-center font-bold bg-slate-50/50 text-slate-400">{idx + 1}</td>
                            <td className="p-0 border-l border-slate-200/80 text-center h-9">
                              <input
                                type="date"
                                value={row.date || ""}
                                onChange={(e) => handleRowChange(row.id, "date", e.target.value)}
                                className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-slate-900 text-[10px]"
                              />
                            </td>
                            <td className="p-0 border-l border-slate-200/80 relative h-9">
                              <input
                                id={`input-${activeMerch}-type-${idx}`}
                                type="text"
                                value={row.type}
                                onChange={(e) => handleRowChange(row.id, "type", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, idx, "type")}
                                placeholder="فودافون..."
                                className={`w-full h-full text-right bg-transparent px-2 py-1 outline-none font-sans font-bold placeholder-slate-300 ${isVod ? "text-purple-600" : "text-blue-600"}`}
                              />
                            </td>
                            <td className="p-0 border-l border-slate-200/80 w-28 text-center h-9">
                              <input
                                id={`input-${activeMerch}-value-${idx}`}
                                type="text"
                                value={row.value || ""}
                                onChange={(e) => handleRowChange(row.id, "value", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, idx, "value")}
                                placeholder="0"
                                className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-slate-900 focus:bg-indigo-50/50"
                              />
                            </td>
                            <td className="p-1 border-l border-slate-200/80 w-24 text-center bg-slate-50/30">
                              <div className="flex items-center justify-center rounded border border-slate-200/60 bg-white shadow-xs overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => handleRowChange(row.id, "op", "divide")}
                                  className={`flex-1 text-center py-1 text-[9px] font-extrabold transition-all ${row.op === "divide" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                                >
                                  ➗
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRowChange(row.id, "op", "multiply")}
                                  className={`flex-1 text-center py-1 text-[9px] font-extrabold transition-all border-r border-slate-200/40 ${row.op === "multiply" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                                >
                                  ✖
                                </button>
                              </div>
                            </td>
                            <td className="p-0 border-l border-slate-200/80 w-20 text-center h-9">
                              <input
                                id={`input-${activeMerch}-rate-${idx}`}
                                type="text"
                                value={row.rate || ""}
                                onChange={(e) => handleRowChange(row.id, "rate", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, idx, "rate")}
                                placeholder="1.0"
                                className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-slate-900 focus:bg-indigo-50/50"
                              />
                            </td>
                            <td className="p-2 border-l border-slate-200/80 text-right font-bold text-slate-900 bg-slate-50/30 w-24">{row.result.toLocaleString()}</td>
                            <td className="p-0 border-l border-slate-200/80 w-28 bg-emerald-50/10 h-9">
                              <input
                                id={`input-${activeMerch}-paid-${idx}`}
                                type="text"
                                value={row.paid || ""}
                                onChange={(e) => handleRowChange(row.id, "paid", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, idx, "paid")}
                                placeholder="0"
                                className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-emerald-950 focus:bg-emerald-100/50"
                              />
                            </td>
                            <td className="p-2 border-l border-slate-200/80 text-right font-black text-indigo-900 bg-indigo-50/30 w-24">{row.remaining.toLocaleString()}</td>
                            <td className="p-0 border-l border-slate-200/80 w-28 bg-purple-50/20 h-9">
                              <input
                                id={`input-${activeMerch}-consumer-${idx}`}
                                type="text"
                                value={row.consumer || ""}
                                onChange={(e) => handleRowChange(row.id, "consumer", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, idx, "consumer")}
                                placeholder="0"
                                className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-purple-700 focus:bg-purple-100/50"
                              />
                            </td>
                            <td className="p-1 text-center w-10">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition-all mx-auto block"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* صف الإجمالي */}
                      <tr className="bg-slate-50 font-black border-t-2 border-slate-200">
                        <td className="p-2 border-l border-slate-200/80"></td>
                        <td className="p-2 border-l border-slate-200/80"></td>
                        <td className="p-2 border-l border-slate-200/80"></td>
                        <td className="p-2 border-l border-slate-200/80 text-center text-slate-900">{sumValueCol.toLocaleString()}</td>
                        <td className="p-2 border-l border-slate-200/80 text-center text-slate-700">الإجمالي</td>
                        <td className="p-2 border-l border-slate-200/80 text-center text-slate-900">{sumRateCol.toLocaleString()}</td>
                        <td className="p-2 border-l border-slate-200/80 text-right text-slate-900">{totalTodayWork.toLocaleString()}</td>
                        <td className="p-2 border-l border-slate-200/80 text-center text-emerald-700">{totalPaidToday.toLocaleString()}</td>
                        <td className="p-2 border-l border-slate-200/80 text-right text-indigo-900">{currentData.rows.reduce((s, r) => s + (Number(r.remaining) || 0), 0).toLocaleString()}</td>
                        <td className="p-2 border-l border-slate-200/80 text-center text-purple-700">{totalConsumerValue.toLocaleString()}</td>
                        <td className="p-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ملاحظة مهمة */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed text-right">
        <strong className="text-emerald-700 block mb-1">ملاحظة مهمة:</strong>
        <ul className="list-disc pr-5 space-y-1">
          <li>الباقي المصري = (مجموع القيمة المصري لصفوف فودافون) − (إجمالي مستهلك فودافون في كل الجدول).</li>
          <li>إجمالي الخزينة (البومة) يقرأ مجموع ديون التاجرين معاً لتسهيل الترحيل.</li>
        </ul>
      </div>

      {/* Daily Review Alert */}
      {showReviewAlert && (
        <div className="fixed top-4 right-4 z-[10000] animate-in fade-in slide-in-from-right duration-300">
          <div className="bg-amber-500 border-2 border-amber-600 rounded-2xl shadow-2xl p-4 max-w-sm text-white">
            <div className="flex items-start gap-3">
              <div className="text-3xl animate-pulse">⏰</div>
              <div className="flex-1">
                <h4 className="font-black text-sm mb-1">تنبيه مراجعة الحسابات</h4>
                <p className="text-xs font-bold mb-3">{alertMessage}</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowReviewAlert(false)} className="flex-1 bg-white text-amber-600 font-bold text-xs py-2 px-3 rounded-lg hover:bg-amber-50 transition">حسناً، سأراجع</button>
                  <button onClick={() => { setShowReviewAlert(false); setAlertDismissed(true); }} className="bg-amber-600 text-white font-bold text-xs py-2 px-3 rounded-lg hover:bg-amber-700 transition">إخفاء للكامل</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flying Debt Bird */}
      {showBird && !birdDismissed && (
        <div
          style={{ position: "fixed", bottom: "50px", left: "50px", zIndex: 9999999 }}
          className={`cursor-pointer ${isFlyingOut ? "bird-container-out" : "bird-container-in"}`}
          onClick={() => { setIsFlyingOut(true); setTimeout(() => setBirdDismissed(true), 800); }}
        >
          <div className="bird-hover flex items-end gap-3 flex-row" dir="ltr">
            <div className="text-7xl drop-shadow-2xl bird-flap select-none z-20 relative transform -scale-x-100">🦉</div>
            <div className="bg-rose-600 text-white font-extrabold px-5 py-4 rounded-3xl rounded-bl-none shadow-2xl border-4 border-white bubble-pulse mb-8 relative z-10" dir="rtl">
              <div className="absolute -bottom-3 left-4 w-6 h-6 bg-rose-600 border-b-4 border-l-4 border-white transform rotate-45"></div>
              <p className="text-sm">سدد الفلوس اللي عليك!</p>
              <p className="text-yellow-300 mt-1.5 text-base whitespace-nowrap">الديون وصلت {Math.floor(totalPurchasesDebt).toLocaleString("en-US")}! أنجز!</p>
            </div>
          </div>
        </div>
      )}

      {/* Floating Calculator */}
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
                    <div className="flex-1">
                      <input type="text" readOnly dir="ltr" value={calculateRowResult(row).toLocaleString(undefined, { maximumFractionDigits: 0 })} className="w-full text-center bg-transparent border-none text-[11px] font-bold font-mono text-indigo-700 focus:outline-none" />
                    </div>
                    <span className="text-slate-400 text-xs font-black">=</span>
                    <div className="w-[70px]">
                      <input type="number" step="any" dir="ltr" lang="en" placeholder="القيمة 2" value={row.price} onChange={(e) => handleUpdateCalcRow(row.id, "price", e.target.value)} className="w-full text-center p-1.5 border border-slate-200 rounded text-xs font-bold font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-0.5 w-[42px]">
                      <button onClick={() => handleUpdateCalcRow(row.id, "operator", "multiply")} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === "multiply" ? "bg-indigo-100 text-indigo-700 font-bold" : "text-slate-400 hover:bg-slate-200"}`} title="ضرب">×</button>
                      <button onClick={() => handleUpdateCalcRow(row.id, "operator", "divide")} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === "divide" ? "bg-indigo-100 text-indigo-700 font-bold" : "text-slate-400 hover:bg-slate-200"}`} title="قسمة">÷</button>
                      <button onClick={() => handleUpdateCalcRow(row.id, "operator", "add")} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === "add" ? "bg-indigo-100 text-indigo-700 font-bold" : "text-slate-400 hover:bg-slate-200"}`} title="جمع">+</button>
                      <button onClick={() => handleUpdateCalcRow(row.id, "operator", "subtract")} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === "subtract" ? "bg-indigo-100 text-indigo-700 font-bold" : "text-slate-400 hover:bg-slate-200"}`} title="طرح">-</button>
                    </div>
                    <div className="w-[70px]">
                      <input type="number" step="any" dir="ltr" lang="en" placeholder="القيمة 1" value={row.value} onChange={(e) => handleUpdateCalcRow(row.id, "value", e.target.value)} className="w-full text-center p-1.5 border border-slate-200 rounded text-xs font-bold font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                    <button onClick={() => handleRemoveCalcRow(row.id)} className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <button onClick={handleAddCalcRow} className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 mb-4">
                <Plus className="w-3.5 h-3.5" />إضافة صف جديد
              </button>
              <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col relative overflow-hidden shadow-inner">
                <div className="text-[10px] text-slate-400 font-bold mb-1">الناتج الإجمالي</div>
                <div className="text-2xl font-mono font-black text-left" dir="ltr">{totalCalcResult.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <button onClick={handleCopyCalcResult} className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${calcCopied ? "bg-emerald-500 text-white" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}>
                  {calcCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {calcCopied ? "تم النسخ" : "نسخ الناتج"}
                </button>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowCalculator(!showCalculator)}
          className={`${showCalculator ? "bg-indigo-600 text-white shadow-indigo-500/25" : "bg-slate-900 text-white shadow-[0_8px_30px_rgb(0,0,0,0.15)]"} hover:scale-105 p-3.5 rounded-full shadow-lg transition-all flex items-center justify-center relative group self-start`}
          title="مسودة حاسبة تجار"
        >
          <Calculator className="w-5 h-5" />
          {!showCalculator && (
            <span className="absolute left-full ml-3 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none shadow-lg">مسودة حاسبة تجار</span>
          )}
        </button>
      </div>

      <style>{`
        @keyframes birdSwoopIn {
          0% { transform: translateX(-150vw) translateY(-50vh) rotate(-20deg) scale(0.5); opacity: 0; }
          60% { transform: translateX(5vw) translateY(5vh) rotate(10deg) scale(1.1); opacity: 1; }
          80% { transform: translateX(-1vw) translateY(-1vh) rotate(-5deg) scale(0.95); }
          100% { transform: translateX(0) translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes birdFlyOut {
          0% { transform: translateX(0) translateY(0) scale(1); opacity: 1; }
          100% { transform: translateX(150vw) translateY(-100vh) scale(0.5) rotate(45deg); opacity: 0; }
        }
        @keyframes birdHover { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes birdFlap { 0%, 100% { transform: rotate(-5deg) scaleX(-1); } 50% { transform: rotate(5deg) scaleX(-1); } }
        @keyframes bubblePulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .bird-container-in { animation: birdSwoopIn 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
        .bird-container-out { animation: birdFlyOut 0.8s cubic-bezier(0.5, 0, 1, 1) forwards; }
        .bird-hover { animation: birdHover 2.5s ease-in-out infinite; }
        .bird-flap { display: inline-block; animation: birdFlap 0.4s ease-in-out infinite; }
        .bubble-pulse { animation: bubblePulse 2s ease-in-out infinite; transform-origin: bottom left; }
      `}</style>
    </div>
  );
}
