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
} from "lucide-react";
import { toPng } from "html-to-image";
import { db } from "../firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { ERPState } from "../types";

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
  type: string; // النوع
  value: number | string; // القيمة (مستور مالي صحيح)
  op: "multiply" | "divide"; // ضرب أو قسمة
  rate: number | string; // السعر / نسبة التحويل (يمكن أن تكون عشرية كالصرف)
  result: number; // الناتج المعادل (مستور مالي صحيح)
  paid: number | string; // المسدد اليوم د.ل (مستور مالي صحيح)
  remaining: number; // باقي القيد د.ل (مستور مالي صحيح)
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
  manualConsumerValue: number | string; // المبلغ الإجمالي للمستهلك بالمصري المدخل يدوياً
  consumerRows?: ConsumerRow[]; // المستهلكين المنفصلين لقيمة فودافون كاش
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
  // Merchant switcher tab: 'baqy' (الباقي) or 'semsem' (سمسم)
  const [activeMerch, setActiveMerch] = useState<"baqy" | "semsem">("baqy");

  // State for Egypt currency exchange transfer rate
  const [egTransferRate, setEgTransferRate] = useState<string>("1.0");

  // States for the new Giant HD Capture modal
  const [showHdModal, setShowHdModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [copiedHd, setCopiedHd] = useState(false);
  const [generatingHd, setGeneratingHd] = useState(false);

  // Debt Bird Animation States
  const [showBird, setShowBird] = useState(false);
  const [birdDismissed, setBirdDismissed] = useState(false);
  const [isFlyingOut, setIsFlyingOut] = useState(false);

  const confirmResetPurchases = () => {
    setMerchStates({
      baqy: {
        previousBalance: 0,
        egyptianPreviousBalance: 0,
        rows: [],
        manualConsumerValue: 0,
        consumerRows: [],
      },
      semsem: {
        previousBalance: 0,
        egyptianPreviousBalance: 0,
        rows: [],
        manualConsumerValue: 0,
        consumerRows: [],
      },
    });
    onUpdateState({ ...state, purchases: [] });
    setShowResetConfirm(false);
  };
  const hdCardsRef = useRef<HTMLDivElement>(null);

  // Generate and save Full HD cards
  const saveHdCardsImage = async () => {
    if (!hdCardsRef.current) return;
    setGeneratingHd(true);
    try {
      const dataUrl = await toPng(hdCardsRef.current, {
        pixelRatio: 3, // Full HD / 4K level crisp scale
        style: {
          transform: "scale(1)",
        },
      });
      const link = document.createElement("a");
      const filename = `Daily_Cards_${activeMerch.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.png`;
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Error generating image", err);
      alert("حدث خطأ أثناء تصوير الكروت، يرجى المحاولة لاحقاً.");
    } finally {
      setGeneratingHd(false);
    }
  };

  // Generate and copy to clipboard
  const copyHdCardsToClipboard = async () => {
    if (!hdCardsRef.current) return;
    setGeneratingHd(true);
    try {
      const dataUrl = await toPng(hdCardsRef.current, {
        pixelRatio: 3,
        style: {
          transform: "scale(1)",
        },
      });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      setCopiedHd(true);
      setTimeout(() => setCopiedHd(false), 3005);
    } catch (err) {
      console.error("Error copying to clipboard", err);
      saveHdCardsImage();
    } finally {
      setGeneratingHd(false);
    }
  };

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

  // Load and sync from Firestore
  useEffect(() => {
    let unmounted = false;
    if (!db) return;

    // Load initial data (if none, stay with defaults) and subscribe
    const docRef = doc(db, "erp_system", "purchases_module_v4");
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!unmounted && data.merchStates) {
          // Ensure consumerRows exists
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
          setMerchStates(patchedMerch);
        }
        if (!unmounted && data.historyRecords) {
          setHistoryRecords(data.historyRecords);
        }
      } else {
        // Fallback to localStorage migration once
        const localMerch = localStorage.getItem("ABDO_DAILY_PURCHASES_V4");
        const localHist = localStorage.getItem(
          "ABDO_DAILY_PURCHASES_HISTORY_V4",
        );

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
      }
    });

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  // Write changes to Firestore (debounced)
  useEffect(() => {
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
  }, [merchStates, historyRecords]);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilterDate, setHistoryFilterDate] = useState("");

  const currentData = merchStates[activeMerch] || {
    previousBalance: 0,
    rows: [],
    manualConsumerValue: 0,
    consumerRows: [],
  };

  // Helper to update active merchant's state
  const updateCurrentMerchantState = (
    updater: (prev: MerchantPurchaseState) => MerchantPurchaseState,
  ) => {
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

  // Inputs inside row changed
  const handleRowChange = (
    rowId: string,
    field: keyof PurchaseRow,
    val: any,
  ) => {
    updateCurrentMerchantState((prev) => {
      const updatedRows = prev.rows.map((r) => {
        if (r.id !== rowId) return r;

        let newRow = { ...r };

        if (field === "value" || field === "paid" || field === "rate") {
          newRow[field] = val;
        } else {
          newRow = { ...r, [field]: val };
        }

        // Recalculate result
        const valueNum = Number(newRow.value) || 0;
        const rateNum = Number(newRow.rate) || 0;
        if (newRow.op === "multiply") {
          newRow.result = Math.round(valueNum * rateNum);
        } else {
          newRow.result = rateNum !== 0 ? Math.round(valueNum / rateNum) : 0;
        }

        // Recalculate remaining
        const paidNum = Number(newRow.paid) || 0;
        newRow.remaining = Math.round(newRow.result - paidNum);

        return newRow;
      });
      return { ...prev, rows: updatedRows };
    });
  };

  // Navigate between rows with arrows
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

  // Add New Row
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
      };
      return {
        ...prev,
        rows: [...prev.rows, newRow],
      };
    });
  };

  // Delete row
  const handleDeleteRow = (rowId: string) => {
    updateCurrentMerchantState((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId),
    }));
  };

  // Update Previous Balance
  const handleUpdatePreviousBalance = (val: number | string) => {
    updateCurrentMerchantState((prev) => ({
      ...prev,
      previousBalance: val,
    }));
  };

  const consumerRows = currentData.consumerRows || [
    { id: "c_1", name: "المستهلك الأول", amount: 0 },
    { id: "c_2", name: "المستهلك الثاني", amount: 0 },
    { id: "c_3", name: "المستهلك الثالث", amount: 0 },
  ];

  const handleUpdateConsumerRow = (id: string, amount: number | string) => {
    updateCurrentMerchantState((prev) => {
      const rows = prev.consumerRows || [
        {
          id: "c_1",
          name: "المستهلك الأول",
          amount: prev.manualConsumerValue || 0,
        },
        { id: "c_2", name: "المستهلك الثاني", amount: 0 },
        { id: "c_3", name: "المستهلك الثالث", amount: 0 },
      ];
      const updated = rows.map((r) => (r.id === id ? { ...r, amount } : r));
      const newSum = updated.reduce(
        (sum, r) => sum + (Number(r.amount) || 0),
        0,
      );
      return {
        ...prev,
        consumerRows: updated,
        manualConsumerValue: newSum,
      };
    });
  };

  const handleUpdateConsumerName = (id: string, name: string) => {
    updateCurrentMerchantState((prev) => {
      const rows = prev.consumerRows || [
        {
          id: "c_1",
          name: "المستهلك الأول",
          amount: prev.manualConsumerValue || 0,
        },
        { id: "c_2", name: "المستهلك الثاني", amount: 0 },
        { id: "c_3", name: "المستهلك الثالث", amount: 0 },
      ];
      const updated = rows.map((r) => (r.id === id ? { ...r, name } : r));
      return {
        ...prev,
        consumerRows: updated,
      };
    });
  };

  // Helper to determine if a row is a Vodafone row
  const isVodafoneRow = (type: string) => {
    if (!type) return false;
    return type.includes("فودافون") || type.toLowerCase().includes("vodafone");
  };

  // 1. القيمة السابقة
  const prevBalance = Math.round(currentData.previousBalance || 0);

  // 2. إجمالي شغل اليوم (مجموع القيمة المقيدة بالدينار لكل المعاملات، اللي هي مجموع result)
  const totalTodayWork = currentData.rows.reduce(
    (sum, r) => sum + (Number(r.result) || 0),
    0,
  );

  // 3. القيمة المسددة اليوم (مجموع المسدد بالدينار لكل المعاملات)
  const totalPaidToday = currentData.rows.reduce(
    (sum, r) => sum + (Number(r.paid) || 0),
    0,
  );

  // 4. الباقي من شغل اليوم (الدين الإجمالي المترصد)
  // حسبة معتمدة: (السابقة + شغل اليوم) - المسدد
  const remainingTotalOwed = prevBalance + totalTodayWork - totalPaidToday;

  // 5. إجمالي مبالغ المستهلكين المدخلة يدوياً
  const totalConsumerValue = consumerRows.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0,
  );

  // 6. المجموع الكلي لفودافون كاش المقيد بالجدول بالجنيه
  const totalVodafoneBase = currentData.rows
    .filter((r) => isVodafoneRow(r.type))
    .reduce((sum, r) => sum + Number(r.value || 0), 0);

  // 7. القيمة المصرية الباقية من فودافون كاش (الكارت الخامس)
  const remainingEgyptianValue =
    (currentData.egyptianPreviousBalance || 0) +
    totalVodafoneBase -
    totalConsumerValue;

  const totalPurchasesDebt = Object.values(merchStates).reduce((sum, merch) => {
    const p = Math.round(Number(merch.previousBalance) || 0);
    const w = merch.rows.reduce((s, r) => s + (Number(r.result) || 0), 0);
    const pd = merch.rows.reduce((s, r) => s + (Number(r.paid) || 0), 0);
    return sum + (p + w - pd);
  }, 0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    console.log("Debt Bird check - Total Purchases Debt:", totalPurchasesDebt, "showBird:", showBird, "birdDismissed:", birdDismissed);
    if (totalPurchasesDebt > 0 && !birdDismissed && !showBird) {
      timer = setTimeout(() => {
        console.log("Debt Bird is now visible!");
        setShowBird(true);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [totalPurchasesDebt, birdDismissed, showBird]);

  const handleExportToPdf = () => {
    const merchTitle = activeMerch === "baqy" ? "التاجر الباقي" : "التاجر سمسم";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert(
        "تم حظر فتح النافذة المنبثقة من قبل المتصفح. يرجى السماح بالنوافذ المنبثقة لتصدير ملف الـ PDF.",
      );
      return;
    }

    const htmlContent = `
      <html dir="rtl" lang="ar">
        <head>
          <title>كشف حساب مشتريات يومي - ${merchTitle}</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #111;
              background-color: #fff;
              padding: 40px;
              margin: 0;
              direction: rtl;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 4px solid #111;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              font-size: 26px;
              font-weight: bold;
            }
            .header p {
              margin: 5px 0 0 0;
              font-size: 14px;
              color: #444;
            }
            .metadata {
              text-align: left;
              font-size: 13px;
              line-height: 1.6;
            }
            .cards-grid {
              display: grid;
              grid-template-cols: repeat(5, 1fr);
              gap: 15px;
              margin-bottom: 40px;
            }
            .card {
              border: 2px solid #111;
              border-radius: 12px;
              padding: 15px;
              background-color: #fbfbfb;
            }
            .card-title {
              font-size: 11px;
              font-weight: bold;
              color: #444;
              margin-bottom: 5px;
            }
            .card-value {
              font-size: 18px;
              font-weight: bold;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              margin-top: 30px;
              margin-bottom: 15px;
              border-bottom: 2px solid #111;
              padding-bottom: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
              font-size: 13px;
            }
            th, td {
              border: 1px solid #111;
              padding: 10px;
              text-align: center;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #fafafa;
            }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>عبدو للمنظومات الرقمية</h1>
              <p>كشف حساب مشتريات يومي للذمم والعملات • ${merchTitle}</p>
            </div>
            <div class="metadata">
              <strong>تاريخ الاستخراج:</strong> ${new Date().toLocaleDateString("ar-LY")} <br/>
              <strong>الوقت:</strong> ${new Date().toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>

          <div class="cards-grid">
            <div class="card">
              <div class="card-title">📝 1. القيمة السابقة</div>
              <div class="card-value">${prevBalance.toLocaleString()} د.ل</div>
            </div>
            <div class="card">
              <div class="card-title">⚡ 2. إجمالي شغل اليوم</div>
              <div class="card-value">${totalTodayWork.toLocaleString()} د.ل</div>
            </div>
            <div class="card">
              <div class="card-title">🟢 3. القيمة المسددة</div>
              <div class="card-value">${totalPaidToday.toLocaleString()} د.ل</div>
            </div>
            <div class="card" style="border: 3px solid #000; background-color: #f0f4ff;">
              <div class="card-title" style="color: #000;">🎒 4. الباقي من شغل اليوم</div>
              <div class="card-value" style="font-size: 20px;">${remainingTotalOwed.toLocaleString()} د.ل</div>
            </div>
            <div class="card" style="background-color: #faf5ff;">
              <div class="card-title">🇪🇬 5. القيمة المصرية الباقية</div>
              <div class="card-value" style="color: #6b21a8;">${remainingEgyptianValue.toLocaleString()} جنيه</div>
            </div>
          </div>

          <div class="section-title">👤 تفاصيل وسحوبات فودافون كاش للمستهلك:</div>
          <table style="max-width: 500px;">
            <thead>
              <tr>
                <th>توصيف المستهلك لسحب كاش</th>
                <th>القيمة بالإيجيبشن (جنيه مصري)</th>
              </tr>
            </thead>
            <tbody>
              ${consumerRows
                .map(
                  (c) => `
                <tr>
                  <td>${c.name}</td>
                  <td>${Number(c.amount || 0).toLocaleString()} جنيه مصري</td>
                </tr>
              `,
                )
                .join("")}
              <tr style="font-weight: bold; background-color: #e9d5ff;">
                <td>إجمالي المجهود المخصوم العام</td>
                <td>${totalConsumerValue.toLocaleString()} جنيه مصري</td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">📊 تفاصيل جدول معاملات التوريد والمشتريات:</div>
          <table>
            <thead>
              <tr>
                <th>ت</th>
                <th>نوع المعاملة والبيان</th>
                <th>القيمة بالكامل</th>
                <th>العملية الحسابية</th>
                <th>سعر العملة / التحويل</th>
                <th>الناتج المعادل اليومي</th>
                <th>المسدد اليوم نقداً</th>
                <th>المتبقي بالدينار</th>
              </tr>
            </thead>
            <tbody>
              ${currentData.rows
                .map(
                  (r) => `
                <tr>
                  <td>${r.seq}</td>
                  <td>${r.type || "غير محمد"}</td>
                  <td>${r.value.toLocaleString()}</td>
                  <td>${r.op === "multiply" ? "ضرب (✖)" : "قسمة (➗)"}</td>
                  <td>${r.rate}</td>
                  <td style="font-weight: bold;">${r.result.toLocaleString()} د.ل</td>
                  <td style="color: green;">${r.paid.toLocaleString()} د.ل</td>
                  <td style="font-weight: bold; color: #1e1b4b;">${r.remaining.toLocaleString()} د.ل</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>

          <div style="font-size: 11px; color: #555; text-align: center; margin-top: 50px; border-top: 1px solid #111; padding-top: 15px;">
            تم توليد المستند وحفظه تلقائياً بصيغة PDF عالية الوضوح بنجاح عبر نظام عبدو لبرمجيات الـ ERP المتكاملة.
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 800);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Rollover (ترحيل)
  const [showRolloverConfirm, setShowRolloverConfirm] = useState(false);

  const handlePerformRollover = () => {
    setShowRolloverConfirm(true);
  };

  const executePerformRollover = () => {
    const newHistoryRecord = {
      id: `hist_${Date.now()}`,
      date: new Date().toISOString(),
      merchantId: activeMerch,
      previousBalance: currentData.previousBalance,
      totalTodayWork,
      totalPaidToday,
      remainingTotalOwed,
      rows: currentData.rows,
      consumerValue: totalConsumerValue,
      consumerRows: currentData.consumerRows || [],
      egyptianPreviousBalance: currentData.egyptianPreviousBalance || 0,
      remainingEgyptianValue,
    };
    setHistoryRecords((prev) => [newHistoryRecord, ...prev]);

    updateCurrentMerchantState((prev) => ({
      ...prev,
      previousBalance: remainingTotalOwed,
      egyptianPreviousBalance: remainingEgyptianValue,
      rows: [],
      manualConsumerValue: 0,
      consumerRows: [
        { id: `${activeMerch}_c_1`, name: "المستهلك الأول", amount: 0 },
        { id: `${activeMerch}_c_2`, name: "المستهلك الثاني", amount: 0 },
        { id: `${activeMerch}_c_3`, name: "المستهلك الثالث", amount: 0 },
      ],
    }));
    setShowRolloverConfirm(false);
  };

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
      treasuryTransactions: [
        ...(state.treasuryTransactions || []),
        newTx as any,
      ],
    });

    alert(
      `تم الاعتماد وتم تسجيل الأثر برأس المال الإجمالي بـ ${lydEquivalent.toLocaleString()} د.ل! 🎉`,
    );
  };

  // WhatsApp Exporter
  const handleExportDailyImage = () => {
    const headers = [
      "ت",
      "نوع المعاملة",
      "القيمة بالكامل",
      "العملية",
      "سعر العملة",
      "الناتج المعادل",
      "المسدد اليوم",
      "باقي القيد د.ل",
    ];
    const rows = currentData.rows.map((r) => [
      r.seq.toString(),
      r.type || "غير محدد",
      r.value.toLocaleString() + " مصري",
      r.op === "multiply" ? "ضرب (✖)" : "قسمة (➗)",
      r.rate.toLocaleString(),
      r.result.toLocaleString() + " د.ل",
      r.paid.toLocaleString() + " د.ل",
      r.remaining.toLocaleString() + " د.ل",
    ]);

    const merchTitle = activeMerch === "baqy" ? "البيان" : "سمسم";

    onOpenExporter(
      `كشف المشتريات اليومية لشغل (${merchTitle})`,
      {
        label1: "القيمة السابقة د.ل",
        value1: prevBalance.toLocaleString() + " د.ل",
        label2: "إجمالي الشغل والمدفوع اليوم",
        value2: `${totalTodayWork.toLocaleString()} د.ل (مسدد: ${totalPaidToday.toLocaleString()})`,
        label3: "المتبقي لـ فودافون كاش",
        value3: `${remainingEgyptianValue.toLocaleString()} جنيه`,
      },
      headers,
      rows,
    );
  };

  return (
    <div className="space-y-4 text-right font-sans" dir="rtl">
      {/* Tab Switcher & Global Actions - Consolidated Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-2 bg-slate-50 border border-slate-200/60 rounded-2xl shadow-sm">
        {/* Toggle Switch */}
        <div className="inline-flex items-center bg-slate-200/60 p-1 rounded-xl border border-slate-300/50">
          <button
            type="button"
            onClick={() => setActiveMerch("baqy")}
            className={`px-6 py-2 rounded-lg font-bold text-xs transition-all duration-300 w-32 cursor-pointer ${
              activeMerch === "baqy"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            البيان (Baqy)
          </button>
          <button
            type="button"
            onClick={() => setActiveMerch("semsem")}
            className={`px-6 py-2 rounded-lg font-bold text-xs transition-all duration-300 w-32 cursor-pointer ${
              activeMerch === "semsem"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            سمسم (Semsem)
          </button>
        </div>

        {/* Global Action Buttons - All merged here */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-end gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5 justify-end">
            {/* Transfer Egypt to Treasury Section */}
            <div className="flex items-center gap-1.5 bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
              <input
                type="text"
                value={egTransferRate}
                onChange={(e) => setEgTransferRate(e.target.value)}
                placeholder="سعر الصرف"
                className="w-16 h-7 text-center bg-white border border-indigo-200 rounded outline-none font-bold text-[10px] text-indigo-900 focus:border-indigo-500"
                title="سعر الصرف (قسمة)"
              />
              <button
                type="button"
                onClick={handleTransferEgyptToTreasury}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 h-7 rounded shadow-sm cursor-pointer transition-colors"
                title="ترحيل للخزينة بالدينار"
              >
                ترحيل د.ل للخزنة
              </button>
            </div>

            {/* 3 small Vodafone cash inputs */}
            <div className="flex items-center gap-1.5 bg-purple-50 p-1.5 rounded-lg border border-purple-100">
              <span className="text-[10px] font-bold text-purple-700 mx-1">
                خصم كاش:
              </span>
              {consumerRows.map((row, idx) => (
                <input
                  key={row.id}
                  type="text"
                  value={row.amount || ""}
                  onChange={(e) =>
                    handleUpdateConsumerRow(row.id, e.target.value)
                  }
                  className="w-16 text-center bg-white border border-slate-200/60 rounded px-1 py-1.5 outline-none font-bold text-[11px] text-slate-900 focus:border-purple-500"
                  placeholder="0"
                  title={`الخصم ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowHdModal(true)}
            className="group relative bg-gradient-to-l from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg cursor-pointer flex items-center gap-2 transition overflow-hidden shadow-sm"
          >
            <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <Smartphone className="w-4 h-4" />
            <span>تصوير الكروت 📸</span>
          </button>

          <button
            type="button"
            onClick={handlePerformRollover}
            className="bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs px-4 py-2.5 rounded-lg border border-amber-300 cursor-pointer flex items-center gap-1.5 transition"
          >
            <Calendar className="w-4 h-4" />
            <span>ترحيل الحساب 🔄</span>
          </button>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Right Column: 5 Cards (takes 2 cols) */}
        <div className="xl:col-span-3 flex flex-col gap-3">
          {/* Card 1 */}
          <div className="bg-white border border-slate-200/70 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 font-bold text-[11px]">
                📝 1. القيمة السابقة
              </span>
            </div>
            <div className="flex items-end gap-1.5">
              <input
                type="number"
                step="1"
                value={prevBalance}
                onChange={(e) => handleUpdatePreviousBalance(e.target.value)}
                className="font-mono text-2xl font-black text-slate-800 w-full border-none focus:ring-0 focus:outline-none p-0 bg-transparent text-right placeholder-slate-300 transition-colors focus:text-indigo-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0"
              />
              <span className="text-xs font-bold text-slate-400 mb-1">د.ل</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-emerald-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow border-t-2 border-t-emerald-400 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-emerald-700/80 font-bold text-[11px]">
                ⚡ 2. إجمالي شغل اليوم
              </span>
            </div>
            <div>
              <span className="font-mono text-xl font-black text-emerald-600 leading-none">
                {totalTodayWork.toLocaleString()}{" "}
                <span className="text-xs font-bold text-emerald-400">د.ل</span>
              </span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-rose-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow border-t-2 border-t-rose-400 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-rose-700/80 font-bold text-[11px]">
                🟢 3. إجمالي المسددة
              </span>
            </div>
            <div>
              <span className="font-mono text-xl font-black text-rose-600 leading-none">
                {totalPaidToday.toLocaleString()}{" "}
                <span className="text-xs font-bold text-rose-400">د.ل</span>
              </span>
            </div>
          </div>

          {/* Card 4 - Highlighted */}
          <div className="bg-white border border-indigo-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden border-t-2 border-t-indigo-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-indigo-700/80 font-bold text-[11px]">
                🎒 4. الباقي من الشغل
              </span>
            </div>
            <div className="relative z-10">
              <span className="font-mono text-xl font-black text-indigo-900 leading-none">
                {remainingTotalOwed.toLocaleString()}{" "}
                <span className="text-xs font-bold text-indigo-400">د.ل</span>
              </span>
            </div>
          </div>

          {/* Card 5 - Highlighted Egypt */}
          <div className="bg-white border border-purple-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden border-t-2 border-t-purple-500">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-700/80 font-bold text-[11px]">
                🇪🇬 5. الباقية مصري
              </span>
            </div>
            <div>
              <span
                className={`font-mono text-xl font-black leading-none ${remainingEgyptianValue < 0 ? "text-rose-600" : "text-purple-600"}`}
              >
                {remainingEgyptianValue.toLocaleString()}{" "}
                <span className="text-xs font-bold text-purple-400">EGP</span>
              </span>
            </div>
          </div>
        </div>

        {/* Middle Column: Table Ledger (takes 9 cols) */}
        <div className="xl:col-span-9">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-base leading-none">📋</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-sm">
                    جدول المشتريات اليومية
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-extrabold text-xs px-4 py-2.5 rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 transition-all border border-purple-200"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>سجل الترحيلات</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة معاملة</span>
                </button>
              </div>
            </div>

            {currentData.rows.length === 0 ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center flex-grow">
                <FileText className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-xs font-bold text-slate-500 mb-2">
                  لا توجد قيود مسجلة اليوم.
                </p>
                <button
                  onClick={handleAddRow}
                  className="bg-slate-100/50 hover:bg-indigo-50 border border-slate-200 text-indigo-700 font-bold text-xs px-5 py-2.5 rounded-lg transition-all"
                >
                  📝 إنشاء قيد جديد
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto flex-grow p-4 pt-0">
                <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm mt-4">
                  <table className="w-full text-right text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-500 font-bold border-b-2 border-slate-200/80">
                      <tr>
                        <th className="p-2 border-l border-slate-200/80 text-center w-8">
                          ت
                        </th>
                        <th className="p-0 border-l border-slate-200/80 text-center">
                          النوع
                        </th>
                        <th className="p-0 border-l border-slate-200/80 text-center w-28">
                          القيمة (مصري)
                        </th>
                        <th className="p-2 border-l border-slate-200/80 text-center w-24">
                          العملية
                        </th>
                        <th className="p-0 border-l border-slate-200/80 text-center w-20">
                          صرف
                        </th>
                        <th className="p-2 border-l border-slate-200/80 text-right w-24">
                          الناتج
                        </th>
                        <th className="p-0 border-l border-slate-200/80 text-center w-28 text-emerald-700">
                          المسدد د.ل
                        </th>
                        <th className="p-2 border-l border-slate-200/80 text-right w-24 text-indigo-700">
                          الباقي د.ل
                        </th>
                        <th className="p-2 text-center w-10">
                          <Trash2 className="w-3 h-3 mx-auto" />
                        </th>
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
                            <td className="p-1 border-l border-slate-200/80 text-center font-bold bg-slate-50/50 w-8 text-slate-400">
                              {row.seq}
                            </td>
                            <td className="p-0 border-l border-slate-200/80 relative h-9">
                              <input
                                id={`input-${activeMerch}-type-${idx}`}
                                type="text"
                                value={row.type}
                                onChange={(e) =>
                                  handleRowChange(
                                    row.id,
                                    "type",
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) => handleKeyDown(e, idx, "type")}
                                placeholder="فودافون..."
                                className="w-full h-full text-right bg-transparent px-2 py-1 outline-none font-sans font-bold text-slate-900 placeholder-slate-300"
                              />
                            </td>
                            <td className="p-0 border-l border-slate-200/80 w-28 text-center h-9">
                              <input
                                id={`input-${activeMerch}-value-${idx}`}
                                type="text"
                                value={row.value || ""}
                                onChange={(e) =>
                                  handleRowChange(
                                    row.id,
                                    "value",
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(e, idx, "value")
                                }
                                placeholder="0"
                                className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-slate-900 focus:bg-indigo-50/50"
                              />
                            </td>
                            <td className="p-1 border-l border-slate-200/80 w-24 text-center bg-slate-50/30">
                              <div className="flex items-center justify-center rounded border border-slate-200/60 bg-white shadow-xs overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRowChange(row.id, "op", "divide")
                                  }
                                  className={`flex-1 text-center py-1 text-[9px] font-extrabold transition-all ${
                                    row.op === "divide"
                                      ? "bg-indigo-600 text-white"
                                      : "text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  ➗
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRowChange(row.id, "op", "multiply")
                                  }
                                  className={`flex-1 text-center py-1 text-[9px] font-extrabold transition-all border-r border-slate-200/40 ${
                                    row.op === "multiply"
                                      ? "bg-indigo-600 text-white"
                                      : "text-slate-500 hover:bg-slate-50"
                                  }`}
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
                                onChange={(e) =>
                                  handleRowChange(
                                    row.id,
                                    "rate",
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) => handleKeyDown(e, idx, "rate")}
                                placeholder="1.0"
                                className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-slate-900 focus:bg-indigo-50/50"
                              />
                            </td>
                            <td className="p-2 border-l border-slate-200/80 text-right font-bold text-slate-900 bg-slate-50/30 w-24">
                              {row.result.toLocaleString()}
                            </td>
                            <td className="p-0 border-l border-slate-200/80 w-28 bg-emerald-50/10 h-9">
                              <input
                                id={`input-${activeMerch}-paid-${idx}`}
                                type="text"
                                value={row.paid || ""}
                                onChange={(e) =>
                                  handleRowChange(
                                    row.id,
                                    "paid",
                                    e.target.value,
                                  )
                                }
                                onKeyDown={(e) => handleKeyDown(e, idx, "paid")}
                                placeholder="0"
                                className="w-full h-full text-center bg-transparent px-2 py-1 outline-none font-bold text-emerald-950 focus:bg-emerald-100/50"
                              />
                            </td>
                            <td className="p-2 border-l border-slate-200/80 text-right font-black text-indigo-900 bg-indigo-50/30 w-24">
                              {row.remaining.toLocaleString()}
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
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-650 leading-relaxed text-right mt-4 auto-animate">
        💡 <strong className="text-slate-900">نظام فودافون كاش الذكي:</strong>{" "}
        أي سطر بالجدول يحتوي على كلمة{" "}
        <span className="text-purple-700 font-bold">"فودافون"</span> أو{" "}
        <span className="text-purple-700 font-bold">"Vodafone"</span> في حقل
        البيان، يتم سحب قيمته تلقائياً بالجنيه وإضافته لمجموع فودافون الكلي
        بالجدول (المجموع الحالي: {totalVodafoneBase.toLocaleString()} جنيه)،
        ليتم موازنته مع مسحوبات المستهلكين.
      </div>

      {/* 📸 AMAZING FULL HD 5-CARDS CAPTURE MODAL - Brings the five cards visually perfectly to the screen with high layout quality */}
      {showHdModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col transition-all transform scale-100">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
                <h3 className="font-sans font-black text-xs">
                  شاشة تصوير الكروت الخمسة عالية الوضوح واللمعان | 5 Work Cards
                  HD Live View
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHdModal(false)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body & Live High Definition Preview Render Stage */}
            <div className="p-6 overflow-y-auto max-h-[60vh] bg-slate-950 flex flex-col items-center">
              <p className="text-xs text-slate-400 mb-4 font-sans text-center">
                هذه النسخة المدمرة بصريًا مهيأة للنسخ المباشر أو التحميل بدقة{" "}
                <strong className="text-emerald-400">
                  Full HD (300% DPI Pixel-Ratio)
                </strong>{" "}
                لمشاركتها على واتساب والمنصات.
              </p>

              {/* 📷 CRISP STAGE (To Be Captured) */}
              <div className="w-full overflow-auto p-2 flex justify-center bg-slate-900">
                <div
                  ref={hdCardsRef}
                  className="bg-white p-6 rounded-3xl border border-slate-200 font-sans text-right text-slate-800 relative shadow-2xl shrink-0"
                  style={{
                    width: "600px",
                    minWidth: "600px",
                    direction: "rtl",
                    boxSizing: "border-box",
                  }}
                >
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-black text-slate-800">
                      ملخص حساب المشتريات
                    </h2>
                    <p className="text-sm font-bold text-slate-500 mt-1">
                      {activeMerch === "baqy" ? "البيان" : "سمسم"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      {new Date().toLocaleDateString("ar-LY")}
                    </p>
                  </div>
                  {/* Stack of the exactly Five Cards with spectacular clean design */}
                  <div className="grid grid-cols-6 gap-4 font-sans">
                    {/* Card 1 */}
                    <div className="col-span-2 bg-white border border-slate-200/70 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
                      <span className="text-slate-500 font-bold text-xs shrink-0 mb-2">
                        📝 1. القيمة السابقة
                      </span>
                      <span className="font-mono text-xl font-extrabold text-slate-800 tracking-wide text-left overflow-hidden text-ellipsis">
                        {prevBalance.toLocaleString()}{" "}
                        <span className="text-xs text-slate-400 font-bold">
                          د.ل
                        </span>
                      </span>
                    </div>

                    {/* Card 2 */}
                    <div className="col-span-2 bg-white border-t-2 border-slate-200 border-t-emerald-400 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
                      <span className="text-emerald-700/80 font-bold text-xs shrink-0 mb-2">
                        ⚡ 2. إجمالي الشغل
                      </span>
                      <span className="font-mono text-xl font-extrabold text-emerald-600 tracking-wide text-left overflow-hidden text-ellipsis">
                        {totalTodayWork.toLocaleString()}{" "}
                        <span className="text-xs text-emerald-400 font-bold">
                          د.ل
                        </span>
                      </span>
                    </div>

                    {/* Card 3 */}
                    <div className="col-span-2 bg-white border-t-2 border-slate-200 border-t-rose-400 rounded-2xl p-4 flex flex-col justify-center shadow-sm">
                      <span className="text-rose-700/80 font-bold text-xs shrink-0 mb-2">
                        🟢 3. إجمالي المسددة
                      </span>
                      <span className="font-mono text-xl font-extrabold text-rose-600 tracking-wide text-left overflow-hidden text-ellipsis">
                        {totalPaidToday.toLocaleString()}{" "}
                        <span className="text-xs text-rose-400 font-bold">
                          د.ل
                        </span>
                      </span>
                    </div>

                    {/* Card 4 */}
                    <div className="col-span-3 bg-white border-t-2 border-slate-200 border-t-indigo-500 rounded-2xl p-4 flex flex-col justify-center shadow-sm relative overflow-hidden">
                      <div className="absolute inset-0 bg-indigo-50/50 outline-none"></div>
                      <span className="text-indigo-700 font-bold text-xs relative z-10 shrink-0 mb-2">
                        🎒 4. الباقي من الشغل
                      </span>
                      <span className="font-mono text-2xl font-black text-indigo-900 tracking-wide relative z-10 text-left overflow-hidden text-ellipsis">
                        {remainingTotalOwed.toLocaleString()}{" "}
                        <span className="text-xs text-indigo-400 font-bold">
                          د.ل
                        </span>
                      </span>
                    </div>

                    {/* Card 5 */}
                    <div className="col-span-3 bg-white border-t-2 border-slate-200 border-t-purple-500 rounded-2xl p-4 flex flex-col justify-center shadow-sm relative overflow-hidden">
                      <div className="absolute inset-0 bg-purple-50/50 outline-none"></div>
                      <span className="text-purple-700 font-bold text-xs relative z-10 shrink-0 mb-2">
                        🇪🇬 5. الباقية مصري
                      </span>
                      <span className="font-mono text-2xl font-black text-purple-900 tracking-wide relative z-10 text-left overflow-hidden text-ellipsis">
                        {remainingEgyptianValue.toLocaleString()}{" "}
                        <span className="text-xs text-purple-400 font-bold">
                          EGP
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={copyHdCardsToClipboard}
                disabled={generatingHd}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>
                  {copiedHd
                    ? "تم النسخ للحافظة بنجاح! 📋"
                    : "نسخ لوحة الكروت للحافظة 📋"}
                </span>
              </button>

              <button
                type="button"
                onClick={saveHdCardsImage}
                disabled={generatingHd}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-5 py-3 rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>
                  {generatingHd
                    ? "جاري السحب ومعالجة الـ HD..."
                    : "تحميل الصورة بجودة Ultra HD 📸"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowHdModal(false)}
                className="bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs px-4 py-3 rounded-xl transition cursor-pointer"
              >
                إغلاق الشاشة ❌
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Rollover in Purchases Module */}
      {showRolloverConfirm && (
        <div
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]"
          dir="rtl"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative text-right">
            <h3 className="font-extrabold text-[#f1f5f9] text-base mb-2 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <span>تسوية وترحيل الحساب الحالي اليوم 🔄</span>
            </h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              هل أنت متأكد من ترحيل الحساب لـ تيسير المعاملات اليومية للمستلم
              النشط:{" "}
              <strong className="text-amber-400">
                {activeMerch === "baqy" ? "البيان" : "سمسم"}
              </strong>
              ؟ <br />
              <strong className="text-emerald-400 block mt-1">
                سيتم نقل الباقي الإجمالي المترصد بالدينار (
                {remainingTotalOwed.toLocaleString()} د.ل) ليكون القيمة السابقة
                لليوم الجديد، وتصفير جدول اليوم الجديد.
              </strong>
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={executePerformRollover}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <span>نعم، ترحيل رصيد كشف المورد الكلي 📁</span>
              </button>
              <button
                type="button"
                onClick={() => setShowRolloverConfirm(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Purchases Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999]"
          dir="rtl"
        >
          <div className="bg-white border-2 border-rose-500 rounded-3xl p-6 max-w-md w-full shadow-2xl relative text-right">
            <h3 className="font-extrabold text-rose-600 text-lg mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>تحذير: تصفير قسم المشتريات بالكامل ⚠️</span>
            </h3>
            <p className="text-sm font-semibold text-slate-600 mb-6 leading-relaxed">
              هل أنت متأكد من تصفير وإفراغ جميع بيانات وحركة المخزن (قسم
              المشتريات) بالكامل وبناء مخزن جديد من الصفر؟{" "}
              <strong className="text-rose-600">
                لا يمكن التراجع عن هذا الإجراء!
              </strong>
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={confirmResetPurchases}
                className="bg-rose-600 hover:bg-rose-700 text-white w-full text-sm font-black py-3 px-4 rounded-xl transition cursor-pointer flex items-center justify-center"
              >
                الموافقة والتصفير بالكامل الآن
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 w-full text-sm font-bold py-3 px-4 rounded-xl transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div
          className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex justify-center items-center z-[9999] p-4"
          dir="rtl"
        >
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-800">
                    السجل التاريخي للمعاملات (الأرشيف الآمن)
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    هذه المعاملات غير قابلة للحذف ويمكن الرجوع إليها بالبحث.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-200 hover:bg-rose-100 hover:text-rose-600 text-slate-500 rounded-lg cursor-pointer transition-colors"
                title="إغلاق الشاشة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-white border-b border-slate-100 flex items-center gap-4 shrink-0">
              <div className="flex-1 max-w-sm">
                <input
                  type="date"
                  value={historyFilterDate}
                  onChange={(e) => setHistoryFilterDate(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-2 font-mono text-slate-800 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              {historyFilterDate && (
                <button
                  onClick={() => setHistoryFilterDate("")}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 underline cursor-pointer"
                >
                  إلغاء تصفية التاريخ
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 space-y-4">
              {historyRecords
                .filter(
                  (rec) =>
                    !historyFilterDate ||
                    rec.date.startsWith(historyFilterDate),
                )
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                )
                .map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-md">
                          {rec.merchantId === "baqy" ? "البيان" : "سمسم"}
                        </span>
                        <span className="font-mono text-sm font-bold text-slate-600 bg-slate-100 px-2 rounded-md">
                          {new Date(rec.date).toLocaleDateString("ar-LY")} -{" "}
                          {new Date(rec.date).toLocaleTimeString("ar-LY", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold text-slate-600 flex-wrap">
                        <div>
                          سابقة د.ل:{" "}
                          <span className="font-mono text-slate-900">
                            {rec.previousBalance.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          باقي د.ل:{" "}
                          <span className="font-mono text-indigo-700">
                            {rec.remainingTotalOwed.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          إجمالي المستهلكين:{" "}
                          <span className="font-mono text-rose-700">
                            {rec.consumerValue?.toLocaleString() || 0}
                          </span>{" "}
                          ج.م
                        </div>
                      </div>
                    </div>

                    {rec.rows && rec.rows.length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 rounded-xl mb-3">
                        <table className="w-full text-right text-[10px] sm:text-xs">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="p-2 border-b border-slate-200 pr-3">
                                البيان
                              </th>
                              <th className="p-2 border-b border-slate-200 text-center">
                                القيمة (ج.م / يورو)
                              </th>
                              <th className="p-2 border-b border-slate-200 text-center">
                                العملية
                              </th>
                              <th className="p-2 border-b border-slate-200 text-center">
                                الناتج د.ل
                              </th>
                              <th className="p-2 border-b border-slate-200 text-center">
                                المسدد د.ل
                              </th>
                              <th className="p-2 border-b border-slate-200 text-center">
                                باقي القيد د.ل
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-mono">
                            {rec.rows.map((r: any) => (
                              <tr key={r.id} className="hover:bg-slate-50/50">
                                <td className="p-2 pr-3 text-slate-800 font-sans font-bold text-xs">
                                  {r.type || "غير محدد"}
                                </td>
                                <td className="p-2 text-slate-600 text-center">
                                  {Number(r.value || 0).toLocaleString()}
                                </td>
                                <td className="p-2 text-slate-500 text-[10px] text-center">
                                  {r.op === "multiply" ? "ضرب فى" : "قسمة على"}{" "}
                                  {r.rate}
                                </td>
                                <td className="p-2 text-indigo-700 font-bold text-center">
                                  {Number(r.result || 0).toLocaleString()}
                                </td>
                                <td className="p-2 text-emerald-600 font-bold text-center">
                                  {Number(r.paid || 0).toLocaleString()}
                                </td>
                                <td className="p-2 text-rose-600 font-bold text-center">
                                  {Number(r.remaining || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center text-xs font-bold text-slate-400 py-3 mb-3 border border-dashed border-slate-200 rounded-xl">
                        لا توجد عمليات مسجلة للجدول.
                      </div>
                    )}

                    {rec.consumerRows && rec.consumerRows.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 overflow-x-auto pb-1 bg-purple-50/50 p-2 rounded-xl">
                        <div className="text-xs font-bold text-purple-900 w-full mb-1">
                          تفاصيل مستهلكي فودافون كاش:
                        </div>
                        {rec.consumerRows.map((cr: any) => (
                          <div
                            key={cr.id}
                            className="bg-white border border-purple-200 shadow-sm rounded-lg flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-purple-800 whitespace-nowrap"
                          >
                            <span>{cr.name}:</span>
                            <span className="font-mono text-purple-600">
                              {Number(cr.amount || 0).toLocaleString()} ج.م
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

              {historyRecords.filter(
                (rec) =>
                  !historyFilterDate || rec.date.startsWith(historyFilterDate),
              ).length === 0 && (
                <div className="text-center py-20">
                  <div className="text-slate-300 mb-2 mt-4 inline-flex items-center justify-center bg-white p-6 rounded-full shadow-sm">
                    <FileText className="w-10 h-10 text-slate-300" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-500 mt-2">
                    لا توجد سجلات ترحيلات مطابقة لتاريخ البحث.
                  </h4>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-100 border-t border-slate-200 text-center shrink-0">
              <span className="text-[10px] font-bold text-slate-400">
                جميع القيود مؤرشفة ولا يمكن تعديلها أو حذفها للحفاظ على شفافية
                النظام المحاسبي.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* FLYING DEBT BIRD ALERT - INJECTED FORCE MOUNT */}
      {showBird && !birdDismissed && (
        <div 
          style={{ position: 'fixed', bottom: '50px', left: '50px', zIndex: 9999999 }}
          className={`cursor-pointer ${isFlyingOut ? 'bird-container-out' : 'bird-container-in'}`}
          onClick={() => {
            setIsFlyingOut(true);
            setTimeout(() => setBirdDismissed(true), 800);
          }}
        >
          <div className="bird-hover flex items-end gap-3 flex-row" dir="ltr">
            {/* Bird */}
            <div className="text-7xl drop-shadow-2xl bird-flap select-none z-20 relative transform -scale-x-100">
              🦉
            </div>
            
            {/* Speech Bubble */}
            <div className="bg-rose-600 text-white font-extrabold px-5 py-4 rounded-3xl rounded-bl-none shadow-2xl border-4 border-white bubble-pulse mb-8 relative z-10" dir="rtl">
              <div className="absolute -bottom-3 left-4 w-6 h-6 bg-rose-600 border-b-4 border-l-4 border-white transform rotate-45"></div>
              <p className="text-sm">سدد الفلوس اللي عليك!</p>
              <p className="text-yellow-300 mt-1.5 text-base whitespace-nowrap">الديون وصلت {Math.floor(totalPurchasesDebt).toLocaleString('en-US')}! أنجز!</p>
            </div>
          </div>
        </div>
      )}

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
        @keyframes birdHover {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes birdFlap {
          0%, 100% { transform: rotate(-5deg) scaleX(-1); }
          50% { transform: rotate(5deg) scaleX(-1); }
        }
        @keyframes bubblePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .bird-container-in {
          animation: birdSwoopIn 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .bird-container-out {
          animation: birdFlyOut 0.8s cubic-bezier(0.5, 0, 1, 1) forwards;
        }
        .bird-hover {
          animation: birdHover 2.5s ease-in-out infinite;
        }
        .bird-flap {
          display: inline-block;
          animation: birdFlap 0.4s ease-in-out infinite;
        }
        .bubble-pulse {
          animation: bubblePulse 2s ease-in-out infinite;
          transform-origin: bottom left;
        }
      `}</style>
    </div>
  );
}
