import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Calendar,
  Calculator,
  Check,
  Copy,
  Download,
  X,
  Eye,
  FileText,
  Smartphone,
  Edit3,
  Save,
  History,
  RotateCcw,
  Image,
  Landmark,
} from "lucide-react";
import { toPng } from "html-to-image";
import { db } from "../firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
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
  date?: string;
}

interface ConsumerRow {
  id: string;
  name: string;
  amount: number | string;
}

interface DayData {
  date: string;
  isArchived: boolean;
  isReadOnly: boolean;
  rows: PurchaseRow[];
  color: string;
  previousBalance: number;
  egyptianPreviousBalance: number;
  manualConsumerValue: number;
  consumerRows: ConsumerRow[];
}

interface MerchantPurchaseState {
  days: DayData[];
  currentDayDate: string;
  previousBalance: number | string;
  egyptianPreviousBalance?: number;
  manualConsumerValue: number;
  consumerRows?: ConsumerRow[];
}

const DEFAULT_STATE: Record<string, MerchantPurchaseState> = {
  baqy: {
    previousBalance: 0,
    egyptianPreviousBalance: 0,
    currentDayDate: new Date().toISOString().split("T")[0],
    days: [
      {
        date: new Date().toISOString().split("T")[0],
        isArchived: false,
        isReadOnly: false,
        rows: [],
        color: "bg-emerald-50",
        previousBalance: 0,
        egyptianPreviousBalance: 0,
        manualConsumerValue: 0,
        consumerRows: [
          { id: "b_c_1", name: "المستهلك الأول", amount: 0 },
          { id: "b_c_2", name: "المستهلك الثاني", amount: 0 },
          { id: "b_c_3", name: "المستهلك الثالث", amount: 0 },
        ],
      },
    ],
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
    currentDayDate: new Date().toISOString().split("T")[0],
    days: [
      {
        date: new Date().toISOString().split("T")[0],
        isArchived: false,
        isReadOnly: false,
        rows: [],
        color: "bg-emerald-50",
        previousBalance: 0,
        egyptianPreviousBalance: 0,
        manualConsumerValue: 0,
        consumerRows: [
          { id: "s_c_1", name: "المستهلك الأول", amount: 0 },
          { id: "s_c_2", name: "المستهلك الثاني", amount: 0 },
          { id: "s_c_3", name: "المستهلك الثالث", amount: 0 },
        ],
      },
    ],
    manualConsumerValue: 0,
    consumerRows: [
      { id: "s_c_1", name: "المستهلك الأول", amount: 0 },
      { id: "s_c_2", name: "المستهلك الثاني", amount: 0 },
      { id: "s_c_3", name: "المستهلك الثالث", amount: 0 },
    ],
  },
};

const DAY_COLORS = [
  "bg-rose-50",
  "bg-amber-50",
  "bg-purple-50",
  "bg-blue-50",
  "bg-cyan-50",
  "bg-emerald-50",
  "bg-lime-50",
  "bg-orange-50",
  "bg-pink-50",
  "bg-indigo-50",
];

export default function PurchasesModule({
  state,
  onUpdateState,
  onOpenExporter,
}: PurchasesModuleProps) {
  const [activeMerch, setActiveMerch] = useState<"baqy" | "semsem">("baqy");
  const [egTransferRate, setEgTransferRate] = useState<string>("1.0");
  const lastEditTime = useRef<number>(0);

  const [showHdModal, setShowHdModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copiedHd, setCopiedHd] = useState(false);
  const [generatingHd, setGeneratingHd] = useState(false);

  const [showBird, setShowBird] = useState(false);
  const [birdDismissed, setBirdDismissed] = useState(false);
  const [isFlyingOut, setIsFlyingOut] = useState(false);

  const [showReviewAlert, setShowReviewAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [editingDayDate, setEditingDayDate] = useState<string | null>(null);
  const [filterDayDate, setFilterDayDate] = useState<string | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilterDate, setHistoryFilterDate] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcRows, setCalcRows] = useState<
    { id: string; value: string; price: string; operator: "multiply" | "divide" | "add" | "subtract" }[]
  >([{ id: "1", value: "", price: "", operator: "multiply" }]);
  const [calcCopied, setCalcCopied] = useState(false);
  const [showCloseDayConfirm, setShowCloseDayConfirm] = useState(false);
  const [showRolloverConfirm, setShowRolloverConfirm] = useState(false);

  const hdCardsRef = useRef<HTMLDivElement>(null);

  const [merchStates, setMerchStates] = useState<
    Record<string, MerchantPurchaseState>
  >({
    baqy: { ...DEFAULT_STATE.baqy },
    semsem: { ...DEFAULT_STATE.semsem },
  });

  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // ═══════════════════════════════════════════
  // Firebase Sync
  // ═══════════════════════════════════════════
  useEffect(() => {
    let unmounted = false;
    if (!db) return;

    const docRef = doc(db, "erp_system", "purchases_module_v5");
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        if (Date.now() - lastEditTime.current < 3000) return;
        const data = docSnap.data();
        if (!unmounted && data.merchStates) {
          setMerchStates((current) =>
            JSON.stringify(current) === JSON.stringify(data.merchStates)
              ? current
              : data.merchStates,
          );
        }
        if (!unmounted && data.historyRecords) {
          setHistoryRecords((current) =>
            JSON.stringify(current) === JSON.stringify(data.historyRecords)
              ? current
              : data.historyRecords,
          );
        }
        if (!unmounted) setIsLoaded(true);
      } else {
        const localMerch = localStorage.getItem("ABDO_DAILY_PURCHASES_V4");
        const localHist = localStorage.getItem("ABDO_DAILY_PURCHASES_HISTORY_V4");
        const nextData: any = {};
        if (localMerch) {
          try {
            const parsed = JSON.parse(localMerch);
            const today = new Date().toISOString().split("T")[0];
            nextData.merchStates = {
              baqy: {
                ...DEFAULT_STATE.baqy,
                days: [{
                  date: today, isArchived: false, isReadOnly: false,
                  rows: parsed.baqy?.rows || [], color: "bg-emerald-50",
                  previousBalance: parsed.baqy?.previousBalance || 0,
                  egyptianPreviousBalance: parsed.baqy?.egyptianPreviousBalance || 0,
                  manualConsumerValue: parsed.baqy?.manualConsumerValue || 0,
                  consumerRows: parsed.baqy?.consumerRows || DEFAULT_STATE.baqy.consumerRows,
                }],
              },
              semsem: {
                ...DEFAULT_STATE.semsem,
                days: [{
                  date: today, isArchived: false, isReadOnly: false,
                  rows: parsed.semsem?.rows || [], color: "bg-emerald-50",
                  previousBalance: parsed.semsem?.previousBalance || 0,
                  egyptianPreviousBalance: parsed.semsem?.egyptianPreviousBalance || 0,
                  manualConsumerValue: parsed.semsem?.manualConsumerValue || 0,
                  consumerRows: parsed.semsem?.consumerRows || DEFAULT_STATE.semsem.consumerRows,
                }],
              },
            };
          } catch (e) {}
        }
        if (localHist) {
          try { nextData.historyRecords = JSON.parse(localHist); } catch (e) {}
        }
        if (nextData.merchStates || nextData.historyRecords) {
          await setDoc(docRef, nextData);
        }
        if (!unmounted) setIsLoaded(true);
      }
    });
    return () => { unmounted = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const handler = setTimeout(() => {
      if (!db) return;
      const docRef = doc(db, "erp_system", "purchases_module_v5");
      setDoc(docRef, { merchStates, historyRecords }, { merge: true }).catch(
        (err) => console.error("Firebase save error (Purchases):", err),
      );
    }, 1500);
    return () => clearTimeout(handler);
  }, [merchStates, historyRecords, isLoaded]);

  // ═══════════════════════════════════════════
  // ✅ FIX #1: اليوم النشط للتعديل
  // ═══════════════════════════════════════════
  const currentData = merchStates[activeMerch] || DEFAULT_STATE[activeMerch];
  const activeEditDayDate = editingDayDate || currentData.currentDayDate;
  const activeEditDay =
    currentData.days.find((d) => d.date === activeEditDayDate) ||
    currentData.days[0];
  const currentDay =
    currentData.days.find((d) => d.date === currentData.currentDayDate) ||
    currentData.days[0];

  // ═══════════════════════════════════════════
  // ✅ FIX #2: حساب اليوم الحالي فقط (مش كل الأيام)
  // ═══════════════════════════════════════════
  const dayRows = activeEditDay?.rows || [];
  const totalWork = dayRows.reduce((s, r) => s + (Number(r.result) || 0), 0);
  const totalPaid = dayRows.reduce((s, r) => s + (Number(r.paid) || 0), 0);
  const totalVodafoneBase = dayRows.reduce((s, r) => {
    if (r.type && (r.type.includes("فودافون") || r.type.toLowerCase().includes("vodafone")))
      return s + (Number(r.value) || 0);
    return s;
  }, 0);
  const consumerRows = activeEditDay?.consumerRows || [
    { id: "c_1", name: "المستهلك الأول", amount: 0 },
    { id: "c_2", name: "المستهلك الثاني", amount: 0 },
    { id: "c_3", name: "المستهلك الثالث", amount: 0 },
  ];
  const totalConsumerValue = consumerRows.reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0,
  );

  const prevBalance = Math.round(Number(currentData.previousBalance) || 0);
  const remainingTotalOwed = prevBalance + totalWork - totalPaid;
  const remainingEgyptianValue =
    (currentData.egyptianPreviousBalance || 0) +
    totalVodafoneBase -
    totalConsumerValue;

  const totalPurchasesDebt: number = Object.values(merchStates).reduce(
    (sum: number, merch: any) => {
      const p = Math.round(Number(merch.previousBalance) || 0);
      const curDay = merch.days?.find(
        (d: any) => d.date === merch.currentDayDate,
      );
      const w = curDay?.rows?.reduce(
        (ds: number, r: any) => ds + (Number(r.result) || 0),
        0,
      ) || 0;
      const pd = curDay?.rows?.reduce(
        (ds: number, r: any) => ds + (Number(r.paid) || 0),
        0,
      ) || 0;
      return sum + (p + w - pd);
    },
    0 as number,
  ) as number;

  // ═══════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════
  const updateCurrentMerchantState = (
    updater: (prev: MerchantPurchaseState) => MerchantPurchaseState,
  ) => {
    lastEditTime.current = Date.now();
    setMerchStates((prev) => ({
      ...prev,
      [activeMerch]: updater(prev[activeMerch] || DEFAULT_STATE[activeMerch]),
    }));
  };

  // ✅ FIX #3: كل التعديلات بتروح لليوم النشط صح
  const updateDayState = (
    dayDate: string,
    updater: (prev: DayData) => DayData,
  ) => {
    updateCurrentMerchantState((prev) => {
      const updatedDays = prev.days.map((day) =>
        day.date === dayDate ? updater(day) : day,
      );
      return { ...prev, days: updatedDays };
    });
  };

  // ═══════════════════════════════════════════
  // Row Operations (✅ FIX #4: بتستخدم activeEditDayDate)
  // ═══════════════════════════════════════════
  const handleRowChange = (
    rowId: string,
    field: keyof PurchaseRow,
    val: any,
  ) => {
    updateDayState(activeEditDayDate, (prev) => {
      const updatedRows = prev.rows.map((r) => {
        if (r.id !== rowId) return r;
        let newRow = { ...r };
        if (field === "value" || field === "paid" || field === "rate") {
          newRow[field] = val;
        } else {
          newRow = { ...r, [field]: val };
        }
        const valueNum = Number(newRow.value) || 0;
        const rateNum = Number(newRow.rate) || 0;
        newRow.result =
          newRow.op === "multiply"
            ? Math.round(valueNum * rateNum)
            : rateNum !== 0
              ? Math.round(valueNum / rateNum)
              : 0;
        const paidNum = Number(newRow.paid) || 0;
        newRow.remaining = Math.round(newRow.result - paidNum);
        return newRow;
      });
      return { ...prev, rows: updatedRows };
    });
  };

  // ✅ FIX #5: التنقل بالأسهم بيستخدم اليوم النشط
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    field: string,
  ) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = e.key === "ArrowDown" ? rowIndex + 1 : rowIndex - 1;
      const rows = activeEditDay?.rows || [];
      if (e.key === "ArrowDown" && nextIndex >= rows.length) {
        handleAddRow();
        setTimeout(() => {
          const nextInput = document.getElementById(
            `input-${activeMerch}-${field}-${nextIndex}`,
          );
          if (nextInput) (nextInput as HTMLInputElement).focus();
        }, 50);
        return;
      }
      const nextInput = document.getElementById(
        `input-${activeMerch}-${field}-${nextIndex}`,
      );
      if (nextInput) (nextInput as HTMLInputElement).focus();
    }
  };

  const handleAddRow = () => {
    updateDayState(activeEditDayDate, (prev) => {
      const nextSeq =
        prev.rows.length > 0
          ? Math.max(...prev.rows.map((r) => r.seq)) + 1
          : 1;
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
        date: new Date().toISOString().split("T")[0],
      };
      return { ...prev, rows: [...prev.rows, newRow] };
    });
  };

  const handleDeleteRow = (rowId: string) => {
    updateDayState(activeEditDayDate, (prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId),
    }));
  };

  const handleUpdatePreviousBalance = (val: number | string) => {
    updateCurrentMerchantState((prev) => ({
      ...prev,
      previousBalance: val,
    }));
  };

  // ✅ FIX #6: خصم الكاش بيروح لليوم النشط
  const handleUpdateConsumerRow = (id: string, amount: number | string) => {
    const cleanAmount =
      typeof amount === "string" ? amount.replace(/,/g, "") : amount;
    updateDayState(activeEditDayDate, (prev) => {
      const rows = prev.consumerRows || [
        { id: "c_1", name: "المستهلك الأول", amount: 0 },
        { id: "c_2", name: "المستهلك الثاني", amount: 0 },
        { id: "c_3", name: "المستهلك الثالث", amount: 0 },
      ];
      const updated = rows.map((r) =>
        r.id === id ? { ...r, amount: cleanAmount } : r,
      );
      const newSum = updated.reduce(
        (sum, r) => sum + (Number(r.amount) || 0),
        0,
      );
      return { ...prev, consumerRows: updated, manualConsumerValue: newSum };
    });
  };

  const handleUpdateConsumerName = (id: string, name: string) => {
    updateDayState(activeEditDayDate, (prev) => {
      const rows = prev.consumerRows || [];
      const updated = rows.map((r) => (r.id === id ? { ...r, name } : r));
      return { ...prev, consumerRows: updated };
    });
  };

  const isVodafoneRow = (type: string) => {
    if (!type) return false;
    return type.includes("فودافون") || type.toLowerCase().includes("vodafone");
  };

  // ═══════════════════════════════════════════
  // Day Operations
  // ═══════════════════════════════════════════
  const handleCloseDay = () => setShowCloseDayConfirm(true);

  const executeCloseDay = () => {
    if (!activeEditDay) return;
    const newHistoryRecord = {
      id: `hist_${Date.now()}`,
      date: new Date().toISOString(),
      merchantId: activeMerch,
      dayDate: activeEditDay.date,
      previousBalance: activeEditDay.previousBalance,
      totalTodayWork: totalWork,
      totalPaidToday: totalPaid,
      remainingTotalOwed,
      rows: activeEditDay.rows,
      consumerValue: totalConsumerValue,
      consumerRows: activeEditDay.consumerRows || [],
      egyptianPreviousBalance: activeEditDay.egyptianPreviousBalance || 0,
      remainingEgyptianValue,
    };
    setHistoryRecords((prev) => [newHistoryRecord, ...prev]);

    const colorIndex = currentData.days.length % DAY_COLORS.length;
    updateDayState(activeEditDayDate, (prev) => ({
      ...prev,
      isArchived: true,
      isReadOnly: true,
      color: DAY_COLORS[colorIndex],
    }));

    const newDate = new Date().toISOString().split("T")[0];
    const dayExists = currentData.days.some((d) => d.date === newDate);
    const finalDate = dayExists ? `${newDate}_${Date.now()}` : newDate;

    const newDay: DayData = {
      date: finalDate,
      isArchived: false,
      isReadOnly: false,
      rows: [],
      color: "bg-emerald-50",
      previousBalance: remainingTotalOwed,
      egyptianPreviousBalance: remainingEgyptianValue,
      manualConsumerValue: 0,
      consumerRows: [
        { id: `${activeMerch}_${Date.now()}_c_1`, name: "المستهلك الأول", amount: 0 },
        { id: `${activeMerch}_${Date.now()}_c_2`, name: "المستهلك الثاني", amount: 0 },
        { id: `${activeMerch}_${Date.now()}_c_3`, name: "المستهلك الثالث", amount: 0 },
      ],
    };

    updateCurrentMerchantState((prev) => ({
      ...prev,
      currentDayDate: finalDate,
      days: [newDay, ...prev.days],
      previousBalance: remainingTotalOwed,
      egyptianPreviousBalance: remainingEgyptianValue,
    }));
    setEditingDayDate(null);
    setShowCloseDayConfirm(false);
  };

  const handleEnableDayEdit = (dayDate: string) => {
    setEditingDayDate(dayDate);
    updateDayState(dayDate, (prev) => ({ ...prev, isReadOnly: false }));
  };

  const handleSaveDayEdit = (dayDate: string) => {
    setEditingDayDate(null);
    updateCurrentMerchantState((prev) => {
      const updatedDays = prev.days.map((day) =>
        day.date === dayDate ? { ...day, isReadOnly: true } : day,
      );
      return { ...prev, days: updatedDays };
    });
  };

  const handleSwitchToDay = (dayDate: string) => {
    updateCurrentMerchantState((prev) => ({
      ...prev,
      currentDayDate: dayDate,
    }));
    setEditingDayDate(null);
  };

  const getFilteredDays = () => {
    if (filterDayDate)
      return currentData.days.filter((d) => d.date === filterDayDate);
    return currentData.days;
  };
  const filteredDays = getFilteredDays();

  // ═══════════════════════════════════════════
  // Reset / Rollover
  // ═══════════════════════════════════════════
  const confirmResetPurchases = () => {
    const today = new Date().toISOString().split("T")[0];
    setMerchStates({
      baqy: {
        ...DEFAULT_STATE.baqy,
        days: [{
          date: today, isArchived: false, isReadOnly: false, rows: [],
          color: "bg-emerald-50", previousBalance: 0, egyptianPreviousBalance: 0,
          manualConsumerValue: 0,
          consumerRows: [
            { id: "b_c_1", name: "المستهلك الأول", amount: 0 },
            { id: "b_c_2", name: "المستهلك الثاني", amount: 0 },
            { id: "b_c_3", name: "المستهلك الثالث", amount: 0 },
          ],
        }],
      },
      semsem: {
        ...DEFAULT_STATE.semsem,
        days: [{
          date: today, isArchived: false, isReadOnly: false, rows: [],
          color: "bg-emerald-50", previousBalance: 0, egyptianPreviousBalance: 0,
          manualConsumerValue: 0,
          consumerRows: [
            { id: "s_c_1", name: "المستهلك الأول", amount: 0 },
            { id: "s_c_2", name: "المستهلك الثاني", amount: 0 },
            { id: "s_c_3", name: "المستهلك الثالث", amount: 0 },
          ],
        }],
      },
    });
    onUpdateState({ ...state, purchases: [] });
    setShowResetConfirm(false);
  };

  const executePerformRollover = () => {
    const newHistoryRecord = {
      id: `hist_${Date.now()}`,
      date: new Date().toISOString(),
      merchantId: activeMerch,
      previousBalance: currentData.previousBalance,
      totalTodayWork: totalWork,
      totalPaidToday: totalPaid,
      remainingTotalOwed,
      rows: activeEditDay?.rows || [],
      consumerValue: totalConsumerValue,
      consumerRows: activeEditDay?.consumerRows || [],
      egyptianPreviousBalance: currentData.egyptianPreviousBalance || 0,
      remainingEgyptianValue,
    };
    setHistoryRecords((prev) => [newHistoryRecord, ...prev]);
    updateCurrentMerchantState((prev) => ({
      ...prev,
      previousBalance: remainingTotalOwed,
      egyptianPreviousBalance: remainingEgyptianValue,
      days: prev.days.map((day) =>
        day.date === activeEditDayDate
          ? {
              ...day,
              rows: [],
              manualConsumerValue: 0,
              consumerRows: [
                { id: `${activeMerch}_c_1`, name: "المستهلك الأول", amount: 0 },
                { id: `${activeMerch}_c_2`, name: "المستهلك الثاني", amount: 0 },
                { id: `${activeMerch}_c_3`, name: "المستهلك الثالث", amount: 0 },
              ],
            }
          : day,
      ),
    }));
    setShowRolloverConfirm(false);
  };

  // ═══════════════════════════════════════════
  // Treasury Transfer
  // ═══════════════════════════════════════════
  const handleTransferEgyptToTreasury = () => {
    if (remainingEgyptianValue <= 0) {
      alert("لا توجد قيمة مصرية متبقية لترحيلها حالياً.");
      return;
    }
    const rate = parseFloat(egTransferRate) || 1.0;
    if (rate <= 0) {
      alert("يرجى إدخال سعر تحويل صحيح أكبر من الصفر.");
      return;
    }
    const lydEquivalent = Math.round(remainingEgyptianValue / rate);
    if (lydEquivalent <= 0) {
      alert("القيمة المعادلة بالدينار الليبي ضئيلة جداً.");
      return;
    }
    const refNo = `TX-TR-${Date.now().toString().slice(-6)}`;
    const merchTitle = activeMerch === "baqy" ? "البيان" : "سمسم";
    const newTx = {
      id: `settle_egypt_auto_${Date.now()}`,
      type: "in" as const,
      amount: lydEquivalent,
      currency: "د.ل",
      conversionRate: 1.0,
      date: new Date().toISOString(),
      partyName: "مورد خارجي",
      referenceNo: refNo,
      source: "manual_deposit" as const,
      description: `صرف عملة فودافون كاش (${remainingEgyptianValue.toLocaleString()} جنيه تقسيم سعر ${rate}) لـ (${merchTitle}) كأثر مالي إيجابي بالخزينة`,
      createdAt: new Date().toISOString(),
    };
    onUpdateState({
      ...state,
      treasuryTransactions: [...(state.treasuryTransactions || []), newTx as any],
    });
    alert(`تم الاعتماد وتم تسجيل الأثر برأس المال الإجمالي بـ ${lydEquivalent.toLocaleString()} د.ل! 🎉`);
  };

  // ═══════════════════════════════════════════
  // Export Functions
  // ═══════════════════════════════════════════
  const handleExportToPdf = () => {
    const merchTitle = activeMerch === "baqy" ? "التاجر الباقي" : "التاجر سمسم";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("تم حظر فتح النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة.");
      return;
    }
    printWindow.document.write(`
      <html dir="rtl" lang="ar"><head><title>كشف حساب - ${merchTitle}</title>
      <meta charset="utf-8"/><style>
        body{font-family:Arial,sans-serif;color:#111;padding:40px;direction:rtl}
        .header{display:flex;justify-content:space-between;border-bottom:4px solid #111;padding-bottom:20px;margin-bottom:30px}
        .cards-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:15px;margin-bottom:40px}
        .card{border:2px solid #111;border-radius:12px;padding:15px;background:#fbfbfb}
        .card-title{font-size:11px;font-weight:bold;color:#444;margin-bottom:5px}
        .card-value{font-size:18px;font-weight:bold}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th,td{border:1px solid #111;padding:10px;text-align:center}
        th{background:#f2f2f2;font-weight:bold}
      </style></head><body>
        <div class="header"><div><h1>عبدو للمنظومات الرقمية</h1>
        <p>كشف حساب مشتريات يومي • ${merchTitle}</p></div>
        <div><strong>التاريخ:</strong> ${new Date().toLocaleDateString("ar-LY")}<br/>
        <strong>الوقت:</strong> ${new Date().toLocaleTimeString("ar-LY",{hour:"2-digit",minute:"2-digit"})}</div></div>
        <div class="cards-grid">
          <div class="card"><div class="card-title">📝 القيمة السابقة</div><div class="card-value">${prevBalance.toLocaleString()} د.ل</div></div>
          <div class="card"><div class="card-title">⚡ إجمالي اليوم</div><div class="card-value">${totalWork.toLocaleString()} د.ل</div></div>
          <div class="card"><div class="card-title">🟢 المسدد</div><div class="card-value">${totalPaid.toLocaleString()} د.ل</div></div>
          <div class="card" style="border:3px solid #000;background:#f0f4ff"><div class="card-title">🎒 إجمالي الديون</div><div class="card-value" style="font-size:20px">${remainingTotalOwed.toLocaleString()} د.ل</div></div>
          <div class="card" style="background:#faf5ff"><div class="card-title">🇪🇬 الباقي المصري</div><div class="card-value" style="color:#6b21a8">${remainingEgyptianValue.toLocaleString()} جنيه</div></div>
        </div>
        <script>window.onload=function(){window.print();setTimeout(function(){window.close()},800)};</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleExportDailyImage = () => {
    const headers = ["ت", "نوع المعاملة", "القيمة", "العملية", "سعر العملة", "الناتج", "المسدد", "الباقي"];
    const rows = dayRows.map((r) => [
      r.seq.toString(), r.type || "غير محدد",
      Number(r.value).toLocaleString() + " مصري",
      r.op === "multiply" ? "ضرب (✖)" : "قسمة (➗)",
      Number(r.rate).toLocaleString(),
      r.result.toLocaleString() + " د.ل",
      Number(r.paid).toLocaleString() + " د.ل",
      r.remaining.toLocaleString() + " د.ل",
    ]);
    const merchTitle = activeMerch === "baqy" ? "البيان" : "سمسم";
    onOpenExporter(
      `كشف المشتريات اليومية لشغل (${merchTitle})`,
      {
        label1: "القيمة السابقة د.ل", value1: prevBalance.toLocaleString() + " د.ل",
        label2: "إجمالي الشغل والمدفوع", value2: `${totalWork.toLocaleString()} د.ل (مسدد: ${totalPaid.toLocaleString()})`,
        label3: "المتبقي فودافون كاش", value3: `${remainingEgyptianValue.toLocaleString()} جنيه`,
      },
      headers, rows,
    );
  };

  const saveHdCardsImage = async () => {
    if (!hdCardsRef.current) return;
    setGeneratingHd(true);
    try {
      const dataUrl = await toPng(hdCardsRef.current, { pixelRatio: 3, style: { transform: "scale(1)" } });
      const link = document.createElement("a");
      link.download = `Daily_Cards_${activeMerch.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      alert("حدث خطأ أثناء تصوير الكروت.");
    } finally {
      setGeneratingHd(false);
    }
  };

  const copyHdCardsToClipboard = async () => {
    if (!hdCardsRef.current) return;
    setGeneratingHd(true);
    try {
      const dataUrl = await toPng(hdCardsRef.current, { pixelRatio: 3, style: { transform: "scale(1)" } });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopiedHd(true);
      setTimeout(() => setCopiedHd(false), 3000);
    } catch (err) {
      saveHdCardsImage();
    } finally {
      setGeneratingHd(false);
    }
  };

  // ═══════════════════════════════════════════
  // Calculator
  // ═══════════════════════════════════════════
  const handleAddCalcRow = () =>
    setCalcRows([...calcRows, { id: Math.random().toString(), value: "", price: "", operator: "multiply" }]);
  const handleUpdateCalcRow = (id: string, field: string, val: string) =>
    setCalcRows(calcRows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  const handleRemoveCalcRow = (id: string) =>
    setCalcRows(calcRows.filter((r) => r.id !== id));
  const calculateRowResult = (row: (typeof calcRows)[0]) => {
    const v = parseFloat(row.value) || 0;
    const p = parseFloat(row.price) || 0;
    if (v === 0 && p === 0) return 0;
    switch (row.operator) {
      case "multiply": return Math.round(v * p);
      case "divide": return p !== 0 ? Math.round(v / p) : 0;
      case "add": return Math.round(v + p);
      case "subtract": return Math.round(v - p);
    }
  };
  const totalCalcResult = calcRows.reduce((acc, row) => acc + calculateRowResult(row), 0);
  const handleCopyCalcResult = () => {
    navigator.clipboard.writeText(totalCalcResult.toString());
    setCalcCopied(true);
    setTimeout(() => setCalcCopied(false), 2000);
  };

  // ═══════════════════════════════════════════
  // Effects
  // ═══════════════════════════════════════════
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (totalPurchasesDebt > 0 && !birdDismissed && !showBird) {
      timer = setTimeout(() => setShowBird(true), 3000);
    }
    return () => clearTimeout(timer);
  }, [totalPurchasesDebt, birdDismissed, showBird]);

  useEffect(() => {
    const checkTimeAndShowAlert = () => {
      const hours = new Date().getHours();
      if (hours >= 3 && !alertDismissed) {
        const messages = [
          "هل نسيت إضافة عملية؟",
          "هل يوجد مبلغ مسدد لم يتم تسجيله؟",
          "هل الحسابات مكتملة؟",
          "هل راجعت جميع معاملات اليوم؟",
        ];
        setAlertMessage(messages[Math.floor(Math.random() * messages.length)]);
        setShowReviewAlert(true);
      }
    };
    checkTimeAndShowAlert();
    const interval = setInterval(checkTimeAndShowAlert, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [alertDismissed]);

  // ═══════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════
  return (
    <div className="space-y-4 text-right font-sans" dir="rtl">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-12">
          <div className="flex flex-wrap items-center gap-3">
            {/* Card 1: Previous Balance */}
            <div className="bg-white border border-slate-200/70 rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[120px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500 font-bold text-[10px]">📝 القيمة السابقة</span>
              </div>
              <div className="flex items-end gap-1">
                <input
                  type="text"
                  value={prevBalance}
                  onChange={(e) => handleUpdatePreviousBalance(e.target.value)}
                  className="font-mono text-lg font-black text-slate-800 w-full border-none focus:ring-0 focus:outline-none p-0 bg-transparent text-right placeholder-slate-300 transition-colors focus:text-emerald-600"
                  placeholder="0"
                />
                <span className="text-[10px] font-bold text-slate-400 mb-0.5">د.ل</span>
              </div>
            </div>

            {/* Card 2: Today's Total */}
            <div className="bg-white border border-slate-200/70 rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[120px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500 font-bold text-[10px]">⚡ إجمالي اليوم</span>
              </div>
              <span className="font-mono text-lg font-black text-slate-700 leading-none">
                {totalWork.toLocaleString()}{" "}
                <span className="text-[10px] font-bold text-slate-400">د.ل</span>
              </span>
            </div>

            {/* Card 3: Total Paid */}
            <div className="bg-white border border-slate-200/70 rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[120px]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-500 font-bold text-[10px]">🟢 إجمالي المسددة</span>
              </div>
              <span className="font-mono text-lg font-black text-slate-700 leading-none">
                {totalPaid.toLocaleString()}{" "}
                <span className="text-[10px] font-bold text-slate-400">د.ل</span>
              </span>
            </div>

            {/* Card 4: Total Debts */}
            <div className={`bg-white border rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[120px] ${remainingTotalOwed > 0 ? "border-t-rose-500" : remainingTotalOwed < 0 ? "border-t-emerald-500" : "border-t-slate-300"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-bold text-[10px] ${remainingTotalOwed > 0 ? "text-rose-700/80" : remainingTotalOwed < 0 ? "text-emerald-700/80" : "text-slate-500"}`}>🎒 إجمالي الديون</span>
              </div>
              <span className={`font-mono text-lg font-black leading-none ${remainingTotalOwed > 0 ? "text-rose-600" : remainingTotalOwed < 0 ? "text-emerald-600" : "text-slate-700"}`}>
                {remainingTotalOwed.toLocaleString()}{" "}
                <span className={`text-[10px] font-bold ${remainingTotalOwed > 0 ? "text-rose-400" : remainingTotalOwed < 0 ? "text-emerald-400" : "text-slate-400"}`}>د.ل</span>
              </span>
            </div>

            {/* Card 5: Egyptian Remaining */}
            <div className={`bg-white border rounded-lg p-2 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden min-w-[120px] ${remainingEgyptianValue > 0 ? "border-t-emerald-500" : remainingEgyptianValue < 0 ? "border-t-rose-500" : "border-t-slate-300"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-bold text-[10px] ${remainingEgyptianValue > 0 ? "text-emerald-700/80" : remainingEgyptianValue < 0 ? "text-rose-700/80" : "text-slate-500"}`}>🇪🇬 الباقي المصري</span>
              </div>
              <span className={`font-mono text-lg font-black leading-none ${remainingEgyptianValue > 0 ? "text-emerald-600" : remainingEgyptianValue < 0 ? "text-rose-600" : "text-slate-700"}`}>
                {remainingEgyptianValue.toLocaleString()}{" "}
                <span className={`text-[10px] font-bold ${remainingEgyptianValue > 0 ? "text-emerald-400" : remainingEgyptianValue < 0 ? "text-rose-400" : "text-slate-400"}`}>EGP</span>
              </span>
            </div>

            {/* Merchant Toggle */}
            <div className="inline-flex items-center bg-slate-200/60 p-1 rounded-lg border border-slate-300/50">
              <button type="button" onClick={() => { setActiveMerch("baqy"); setEditingDayDate(null); }}
                className={`px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 cursor-pointer ${activeMerch === "baqy" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"}`}>
                البيان
              </button>
              <button type="button" onClick={() => { setActiveMerch("semsem"); setEditingDayDate(null); }}
                className={`px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 cursor-pointer ${activeMerch === "semsem" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"}`}>
                سمسم
              </button>
            </div>

            {/* Close Day */}
            {!activeEditDay?.isArchived && (
              <button type="button" onClick={handleCloseDay}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-amber-400">
                <Calendar className="w-4 h-4" /><span>إغلاق اليوم</span>
              </button>
            )}

            {/* Day Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={() => setFilterDayDate(null)}
                className={`text-xs font-bold px-3 py-2 rounded-lg transition ${!filterDayDate ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                جميع الأيام
              </button>
              {currentData.days.slice(0, 5).map((day) => (
                <button key={day.date} type="button" onClick={() => setFilterDayDate(day.date)}
                  className={`text-xs font-bold px-3 py-2 rounded-lg transition ${filterDayDate === day.date ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {day.date}
                </button>
              ))}
            </div>

            {/* ✅ FIX #7: الأزرار اللي كانت ناقصة */}
            <button type="button" onClick={() => openSmartCardStudio({ type: "purchases", merchant: activeMerch === "baqy" ? "البيان" : "سمسم", p1: prevBalance, p2: totalWork, p3: totalPaid, p4: remainingTotalOwed, p5: remainingEgyptianValue })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-all shadow-sm border border-emerald-500">
              <Smartphone className="w-4 h-4" /><span>النظام الذكي</span>
            </button>

            <button type="button" onClick={handleAddRow}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-emerald-500">
              <Plus className="w-4 h-4" /><span>إضافة معاملة</span>
            </button>

            <button type="button" onClick={handleExportToPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-blue-500">
              <FileText className="w-4 h-4" /><span>PDF</span>
            </button>

            <button type="button" onClick={handleExportDailyImage}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-purple-500">
              <Image className="w-4 h-4" /><span>تصدير صورة</span>
            </button>

            <button type="button" onClick={() => setShowHdModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-indigo-500">
              <Eye className="w-4 h-4" /><span>كروت HD</span>
            </button>

            <button type="button" onClick={() => setShowCalculator(true)}
              className="bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-slate-500">
              <Calculator className="w-4 h-4" /><span>آلة حاسبة</span>
            </button>

            <button type="button" onClick={() => setShowHistoryModal(true)}
              className="bg-slate-600 hover:bg-slate-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-slate-500">
              <History className="w-4 h-4" /><span>السجل</span>
            </button>

            <button type="button" onClick={handleTransferEgyptToTreasury}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-teal-500">
              <Landmark className="w-4 h-4" /><span>ترحيل للخزينة</span>
            </button>

            <button type="button" onClick={() => setShowRolloverConfirm(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-orange-500">
              <RotateCcw className="w-4 h-4" /><span>ترحيل الرصيد</span>
            </button>

            <button type="button" onClick={() => setShowResetConfirm(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all shadow-sm border border-rose-500">
              <Trash2 className="w-4 h-4" /><span>تصفير</span>
            </button>

            {/* Egyptian Transfer Rate Input */}
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-600 block mb-1">سعر التحويل 🇪🇬</span>
              <input type="text" value={egTransferRate} onChange={(e) => setEgTransferRate(e.target.value)}
                className="w-20 text-center bg-slate-50 border border-slate-200 rounded px-2 py-1.5 outline-none font-extrabold text-[12px] text-slate-900 focus:bg-emerald-50 focus:border-emerald-300 transition-colors"
                placeholder="1.0" />
            </div>

            {/* Cash Discount */}
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-600 block mb-1">خصم كاش</span>
              <div className="flex gap-2">
                {consumerRows.map((row, idx) => (
                  <input key={row.id} type="text" inputMode="numeric"
                    value={row.amount || ""}
                    onChange={(e) => handleUpdateConsumerRow(row.id, e.target.value)}
                    className="w-16 text-center bg-slate-50 border border-slate-200 rounded px-2 py-1.5 outline-none font-extrabold text-[12px] text-slate-900 focus:bg-emerald-50 focus:border-emerald-300 transition-colors"
                    placeholder="0" title={`الخصم ${idx + 1}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table Ledger */}
        <div className="xl:col-span-12">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-base leading-none">📋</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-sm">جدول المشتريات اليومية</h3>
                  <p className="text-xs text-slate-500">
                    اليوم النشط: {activeEditDayDate}
                    {editingDayDate && <span className="text-amber-600 font-bold mr-2">(وضع التعديل)</span>}
                  </p>
                </div>
              </div>
            </div>

            {filteredDays.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center flex-grow">
                <FileText className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-xs font-bold text-slate-500 mb-2">لا توجد قيود مسجلة.</p>
                <button onClick={handleAddRow}
                  className="bg-slate-100/50 hover:bg-indigo-50 border border-slate-200 text-indigo-700 font-bold text-xs px-5 py-2.5 rounded-lg transition-all">
                  📝 إنشاء قيد جديد
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto flex-grow p-4 pt-0">
                {filteredDays.map((day) => (
                  <div key={day.date} className={`mb-6 rounded-xl overflow-hidden border-2 ${day.color} ${day.isArchived ? "border-slate-300" : "border-emerald-200"}`}>
                    <div className={`p-3 flex items-center justify-between ${day.isArchived ? "bg-slate-100" : "bg-emerald-50"}`}>
                      <div className="flex items-center gap-3">
                        <span className="font-black text-sm text-slate-800">{day.date}</span>
                        {day.isArchived && (
                          <span className="bg-slate-600 text-white text-xs font-bold px-2 py-1 rounded-md">مؤرشف</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {day.isArchived && editingDayDate !== day.date && (
                          <button onClick={() => handleEnableDayEdit(day.date)}
                            className="text-slate-500 hover:text-emerald-600 p-1.5 bg-white rounded-lg transition border border-slate-200 hover:border-emerald-300" title="تعديل هذا اليوم">
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        {editingDayDate === day.date && (
                          <button onClick={() => handleSaveDayEdit(day.date)}
                            className="text-emerald-600 hover:text-emerald-700 p-1.5 bg-emerald-50 rounded-lg transition border border-emerald-200" title="حفظ التعديلات">
                            <Save className="w-4 h-4" />
                          </button>
                        )}
                        {!day.isArchived && day.date !== currentData.currentDayDate && (
                          <button onClick={() => handleSwitchToDay(day.date)}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg transition bg-emerald-50 hover:bg-emerald-100">
                            التبديل لهذا اليوم
                          </button>
                        )}
                      </div>
                    </div>

                    {day.rows.length > 0 ? (
                      <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-right text-[11px] border-collapse min-w-[1050px] table-fixed">
                          <thead className="bg-slate-100 text-slate-500 font-bold border-b-2 border-slate-200/80">
                            <tr>
                              <th className="p-2 border-l border-slate-200/80 text-center w-[4%]">ت</th>
                              <th className="p-0 border-l border-slate-200/80 text-center w-[12%]">التاريخ</th>
                              <th className="p-0 border-l border-slate-200/80 text-center w-[18%]">النوع</th>
                              <th className="p-0 border-l border-slate-200/80 text-center w-[11%]">القيمة (مصري)</th>
                              <th className="p-2 border-l border-slate-200/80 text-center w-[12%]">العملية</th>
                              <th className="p-0 border-l border-slate-200/80 text-center w-[9%]">صرف</th>
                              <th className="p-2 border-l border-slate-200/80 text-right w-[11%]">الناتج</th>
                              <th className="p-0 border-l border-slate-200/80 text-center w-[12%] text-emerald-700">المسدد د.ل</th>
                              <th className="p-2 border-l border-slate-200/80 text-right w-[11%] text-indigo-700">الباقي د.ل</th>
                              <th className="p-2 text-center w-[4%]"><Trash2 className="w-3 h-3 mx-auto" /></th>
                            </tr>
                          </thead>
                          <tbody className="font-mono text-slate-700 divide-y divide-slate-100">
                            {[...day.rows].reverse().map((row, idx) => {
                              const isVod = isVodafoneRow(row.type);
                              const originalIdx = day.rows.length - 1 - idx;
                              const isReadOnly = day.isReadOnly && editingDayDate !== day.date;
                              return (
                                <tr key={row.id}
                                  className={`group transition-colors ${isVod ? "bg-purple-50/20 font-bold hover:bg-purple-50/40" : "hover:bg-indigo-50/10"} ${isReadOnly ? "opacity-75" : ""}`}>
                                  <td className="p-1 border-l border-slate-200/80 text-center font-bold bg-slate-50/50 text-slate-400">{row.seq}</td>
                                  <td className="p-0 border-l border-slate-200/80 text-center h-9">
                                    <input type="date" value={row.date || ""} onChange={(e) => handleRowChange(row.id, "date", e.target.value)} disabled={isReadOnly}
                                      className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-slate-900 text-[10px] disabled:opacity-50" />
                                  </td>
                                  <td className="p-0 border-l border-slate-200/80 relative h-9">
                                    <input id={`input-${activeMerch}-type-${originalIdx}`} type="text" value={row.type}
                                      onChange={(e) => handleRowChange(row.id, "type", e.target.value)}
                                      onKeyDown={(e) => handleKeyDown(e, originalIdx, "type")} disabled={isReadOnly}
                                      placeholder="فودافون..."
                                      className="w-full h-full text-right bg-transparent px-2 py-1 outline-none font-sans font-bold text-slate-900 placeholder-slate-300 disabled:opacity-50" />
                                  </td>
                                  <td className="p-0 border-l border-slate-200/80 w-28 text-center h-9">
                                    <input id={`input-${activeMerch}-value-${originalIdx}`} type="text" value={row.value || ""}
                                      onChange={(e) => handleRowChange(row.id, "value", e.target.value)}
                                      onKeyDown={(e) => handleKeyDown(e, originalIdx, "value")} disabled={isReadOnly}
                                      placeholder="0"
                                      className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-slate-900 focus:bg-indigo-50/50 disabled:opacity-50" />
                                  </td>
                                  <td className="p-1 border-l border-slate-200/80 w-24 text-center bg-slate-50/30">
                                    <div className="flex items-center justify-center rounded border border-slate-200/60 bg-white shadow-xs overflow-hidden">
                                      <button type="button" onClick={() => handleRowChange(row.id, "op", "divide")} disabled={isReadOnly}
                                        className={`flex-1 text-center py-1 text-[9px] font-extrabold transition-all ${row.op === "divide" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50"} disabled:opacity-50`}>➗</button>
                                      <button type="button" onClick={() => handleRowChange(row.id, "op", "multiply")} disabled={isReadOnly}
                                        className={`flex-1 text-center py-1 text-[9px] font-extrabold transition-all border-r border-slate-200/40 ${row.op === "multiply" ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-50"} disabled:opacity-50`}>✖</button>
                                    </div>
                                  </td>
                                  <td className="p-0 border-l border-slate-200/80 w-20 text-center h-9">
                                    <input id={`input-${activeMerch}-rate-${originalIdx}`} type="text" value={row.rate || ""}
                                      onChange={(e) => handleRowChange(row.id, "rate", e.target.value)}
                                      onKeyDown={(e) => handleKeyDown(e, originalIdx, "rate")} disabled={isReadOnly}
                                      placeholder="1.0"
                                      className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-slate-900 focus:bg-indigo-50/50 disabled:opacity-50" />
                                  </td>
                                  <td className="p-2 border-l border-slate-200/80 text-right font-bold text-slate-900 bg-slate-50/30 w-24">{row.result.toLocaleString()}</td>
                                  <td className="p-0 border-l border-slate-200/80 w-28 bg-emerald-50/10 h-9">
                                    <input id={`input-${activeMerch}-paid-${originalIdx}`} type="text" value={row.paid || ""}
                                      onChange={(e) => handleRowChange(row.id, "paid", e.target.value)}
                                      onKeyDown={(e) => handleKeyDown(e, originalIdx, "paid")} disabled={isReadOnly}
                                      placeholder="0"
                                      className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-emerald-950 focus:bg-emerald-100/50 disabled:opacity-50" />
                                  </td>
                                  <td className="p-2 border-l border-slate-200/80 text-right font-black text-indigo-900 bg-indigo-50/30 w-24">{row.remaining.toLocaleString()}</td>
                                  <td className="p-1 text-center w-10">
                                    {!isReadOnly && (
                                      <button type="button" onClick={() => handleDeleteRow(row.id)}
                                        className="text-slate-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded transition-all mx-auto block">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-slate-400 text-xs font-bold">لا توجد عمليات في هذا اليوم</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ✅ FIX #8: الطائر المتحرك */}
      {showBird && (
        <div className={`fixed bottom-6 left-6 z-[10000] transition-all duration-1000 ${isFlyingOut ? "translate-x-[-200vw] opacity-0" : ""}`}>
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl shadow-2xl p-4 max-w-xs text-white relative">
            <button onClick={() => { setIsFlyingOut(true); setTimeout(() => { setShowBird(false); setBirdDismissed(true); }, 1000); }}
              className="absolute top-2 left-2 text-white/70 hover:text-white"><X className="w-4 h-4" /></button>
            <div className="text-3xl mb-2">🐦</div>
            <p className="text-xs font-bold">عندك ديون مشتريات بقيمة {totalPurchasesDebt.toLocaleString()} د.ل! راجع حساباتك.</p>
          </div>
        </div>
      )}

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
                  <button onClick={() => setShowReviewAlert(false)}
                    className="flex-1 bg-white text-amber-600 font-bold text-xs py-2 px-3 rounded-lg hover:bg-amber-50 transition">حسناً، سأراجع</button>
                  <button onClick={() => { setShowReviewAlert(false); setAlertDismissed(true); }}
                    className="bg-amber-600 text-white font-bold text-xs py-2 px-3 rounded-lg hover:bg-amber-700 transition">إخفاء للكامل</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Day Confirm */}
      {showCloseDayConfirm && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-right">
            <h3 className="font-extrabold text-[#f1f5f9] text-base mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span>إغلاق وترحيل اليوم الحالي 🔄</span>
            </h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              هل أنت متأكد من إغلاق اليوم الحالي وتأرشيفه؟
              <br />
              <strong className="text-emerald-400 block mt-1">سيتم تحويل اليوم إلى وضع القراءة فقط، وبدء يوم جديد.</strong>
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={executeCloseDay}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black py-2.5 px-4 rounded-xl transition cursor-pointer">نعم، إغلاق اليوم 📁</button>
              <button type="button" onClick={() => setShowCloseDayConfirm(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Rollover Confirm */}
      {showRolloverConfirm && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-right">
            <h3 className="font-extrabold text-[#f1f5f9] text-base mb-2">🔄 ترحيل الرصيد لليوم التالي</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              سيتم ترحيل الرصيد الحالي ({remainingTotalOwed.toLocaleString()} د.ل) كقيمة سابقة، وتصفير عمليات اليوم.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={executePerformRollover}
                className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-2.5 px-4 rounded-xl transition cursor-pointer">نعم، ترحيل</button>
              <button type="button" onClick={() => setShowRolloverConfirm(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirm */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl text-right">
            <h3 className="font-extrabold text-rose-400 text-base mb-2">⚠️ تصفير كامل البيانات</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              هل أنت متأكد؟ سيتم مسح جميع بيانات المشتريات للتاجرين نهائياً ولا يمكن التراجع.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={confirmResetPurchases}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black py-2.5 px-4 rounded-xl transition cursor-pointer">نعم، تصفير كامل</button>
              <button type="button" onClick={() => setShowResetConfirm(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">📜 سجل العمليات السابقة</h3>
              <button onClick={() => setShowHistoryModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-3 py-1.5 rounded-full text-xs transition">إغلاق ✕</button>
            </div>
            <input type="date" value={historyFilterDate} onChange={(e) => setHistoryFilterDate(e.target.value)}
              className="mb-4 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400" />
            {historyRecords
              .filter((r) => !historyFilterDate || r.dayDate === historyFilterDate)
              .map((record) => (
                <div key={record.id} className="border border-slate-200 rounded-xl p-4 mb-3 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-black text-sm text-slate-800">{record.dayDate}</span>
                    <span className="text-xs font-bold text-slate-500">{record.merchantId === "baqy" ? "البيان" : "سمسم"}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-slate-500 font-bold">سابق:</span> <span className="font-black">{Number(record.previousBalance).toLocaleString()} د.ل</span></div>
                    <div><span className="text-slate-500 font-bold">شغل:</span> <span className="font-black">{Number(record.totalTodayWork).toLocaleString()} د.ل</span></div>
                    <div><span className="text-slate-500 font-bold">مسدد:</span> <span className="font-black text-emerald-600">{Number(record.totalPaidToday).toLocaleString()} د.ل</span></div>
                    <div><span className="text-slate-500 font-bold">باقي:</span> <span className="font-black text-rose-600">{Number(record.remainingTotalOwed).toLocaleString()} د.ل</span></div>
                  </div>
                </div>
              ))}
            {historyRecords.length === 0 && (
              <p className="text-center text-slate-400 text-xs font-bold py-8">لا توجد سجلات محفوظة بعد.</p>
            )}
          </div>
        </div>
      )}

      {/* Calculator Modal */}
      {showCalculator && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">🧮 الآلة الحاسبة السريعة</h3>
              <button onClick={() => setShowCalculator(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-3 py-1.5 rounded-full text-xs transition">إغلاق ✕</button>
            </div>
            <div className="space-y-2 mb-4">
              {calcRows.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <input type="text" value={row.value} onChange={(e) => handleUpdateCalcRow(row.id, "value", e.target.value)}
                    placeholder="القيمة" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-emerald-400" />
                  <select value={row.operator} onChange={(e) => handleUpdateCalcRow(row.id, "operator", e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs font-bold outline-none">
                    <option value="multiply">✖ ضرب</option>
                    <option value="divide">➗ قسمة</option>
                    <option value="add">➕ جمع</option>
                    <option value="subtract">➖ طرح</option>
                  </select>
                  <input type="text" value={row.price} onChange={(e) => handleUpdateCalcRow(row.id, "price", e.target.value)}
                    placeholder="السعر" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-emerald-400" />
                  <span className="text-xs font-black text-slate-700 w-16 text-center">{calculateRowResult(row).toLocaleString()}</span>
                  <button onClick={() => handleRemoveCalcRow(row.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <button onClick={handleAddCalcRow} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition">➕ إضافة صف</button>
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-slate-800">الإجمالي: {totalCalcResult.toLocaleString()}</span>
                <button onClick={handleCopyCalcResult}
                  className={`font-bold text-xs px-4 py-2 rounded-lg transition ${calcCopied ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {calcCopied ? "✓ تم النسخ" : "📋 نسخ"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HD Cards Modal */}
      {showHdModal && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-slate-900 text-base">🖼️ كروت HD للتصدير</h3>
              <button onClick={() => setShowHdModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-3 py-1.5 rounded-full text-xs transition">إغلاق ✕</button>
            </div>
            <div ref={hdCardsRef} className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white mb-4">
              <h4 className="text-center font-black text-lg mb-4 text-amber-400">
                {activeMerch === "baqy" ? "البيان" : "سمسم"} - كشف يومي
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-slate-300">القيمة السابقة</div>
                  <div className="font-black text-lg">{prevBalance.toLocaleString()} د.ل</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-slate-300">إجمالي اليوم</div>
                  <div className="font-black text-lg">{totalWork.toLocaleString()} د.ل</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-slate-300">المسدد</div>
                  <div className="font-black text-lg text-emerald-400">{totalPaid.toLocaleString()} د.ل</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-slate-300">إجمالي الديون</div>
                  <div className="font-black text-lg text-rose-400">{remainingTotalOwed.toLocaleString()} د.ل</div>
                </div>
              </div>
              <div className="text-center mt-3 text-[10px] text-slate-400">
                {new Date().toLocaleDateString("ar-LY")} • عبدو للمنظومات الرقمية
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveHdCardsImage} disabled={generatingHd}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl transition disabled:opacity-50">
                {generatingHd ? "جاري التوليد..." : "💾 تحميل صورة"}
              </button>
              <button onClick={copyHdCardsToClipboard} disabled={generatingHd}
                className={`flex-1 font-bold text-xs py-2.5 rounded-xl transition disabled:opacity-50 ${copiedHd ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {copiedHd ? "✓ تم النسخ" : "📋 نسخ للحافظة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
