import React, { useState, useRef } from "react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import {
  Camera,
  Image,
  Copy,
  Download,
  Share2,
  Eye,
  Sliders,
  Smartphone,
  Laptop,
  Check,
  AlertCircle,
  FileText,
} from "lucide-react";
import {
  Customer,
  CustomerCycle,
  DebtTransaction,
  Company,
  CompanyTransaction,
  PurchaseRecord,
  TrustDeposit,
} from "../types";

interface ImageExporterProps {
  sectionName: string;
  activeCurrency: string;
  // Dynamic statistics to display in the card
  metrics: {
    label1: string;
    value1: string | number;
    label2: string;
    value2: string | number;
    label3: string;
    value3: string | number;
  };
  // Dynamic table rows to export
  tableHeaders: string[];
  tableRows: Array<Array<string | number>>;
  footerMetrics?: Array<{
    label: string;
    value: string | number;
    colorClass: string;
  }>;
  onClose?: () => void;
}

export default function ImageExporter({
  sectionName,
  activeCurrency,
  metrics,
  tableHeaders,
  tableRows,
  footerMetrics,
  onClose,
}: ImageExporterProps) {
  const [imageType, setImageType] = useState<
    "full" | "cards" | "table" | "report"
  >("full");
  const [quality, setQuality] = useState<"high" | "standard">("high");
  const [layoutMode, setLayoutMode] = useState<"portrait" | "landscape">(
    "portrait",
  ); // 📱 صورة طولية | 🖥️ صورة عرضية
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);

  const generateCardImage = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    setGenerating(true);
    setErrorMessage(null);
    try {
      // Small timeout to allow styles and fonts to fully paint
      await new Promise((resolve) => setTimeout(resolve, 400));

      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: quality === "high" ? 4 : 2,
        backgroundColor: "#FFFFFF",
        style: {
          transform: "none",
          transformOrigin: "unset",
        },
      });
      setExportUrl(dataUrl);
      setGenerating(false);
      return dataUrl;
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        "فشل النظام في تشكيل الصورة الرسومية بسبب حماية المتصفح، يرجى إعادة المحاولة.",
      );
      setGenerating(false);
      return null;
    }
  };

  // 1. Double action: Download Image
  const handleDownload = async () => {
    const url = await generateCardImage();
    if (!url) return;

    const link = document.createElement("a");
    link.download = `ABDO_ERP_${sectionName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = url;
    link.click();
  };

  const handlePrintPdf = async () => {
    // Open a popup window immediately to bypass popup blockers
    const popupWin = window.open("", "_blank");
    if (popupWin) {
      popupWin.document.write(
        '<body><h2 style="text-align:center; font-family:sans-serif; margin-top: 50px;">جاري تجهيز مستند الـ PDF الملكي... الرجاء الانتظار</h2></body>',
      );
    }

    try {
      const el = cardRef.current;
      if (!el) {
        if (popupWin) popupWin.close();
        return;
      }

      const dataUrl = await toPng(el, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#FFFFFF",
        style: {
          transform: "none",
          transformOrigin: "top left",
        },
      });

      const pdfPattern = layoutMode === "portrait" ? "portrait" : "landscape";

      const pdf = new jsPDF({
        orientation: pdfPattern,
        unit: "pt",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const elWidth = el.offsetWidth || 1200;
      const elHeight = el.offsetHeight || 1600;

      const finalW = pdfWidth;
      const finalH = (pdfWidth * elHeight) / elWidth;

      let heightLeft = finalH;
      let position = 0;

      pdf.addImage(dataUrl, "PNG", 0, position, finalW, finalH);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - finalH;
        pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, position, finalW, finalH);
        heightLeft -= pdfHeight;
      }

      // Close the waiting window
      if (popupWin) {
        popupWin.close();
      }

      // Force download the file
      pdf.save(`مستند_كشف_${sectionName.replace(/\s+/g, "_")}_الفاخر.pdf`);
    } catch (err) {
      console.error(err);
      if (popupWin) popupWin.close();
      setErrorMessage("حدث خطأ أثناء التصدير للـ PDF.");
    }
  };

  // 3. Clipboard integration: Write image blob directly
  const handleCopyToClipboard = async () => {
    try {
      const makeImagePromise = async (): Promise<Blob> => {
        const url = await generateCardImage();
        if (!url) throw new Error("Failed to generate image");
        const response = await fetch(url);
        return await response.blob();
      };

      // Attempt writing image to clipboard
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': makeImagePromise() as any,
        }),
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.warn(
        "ClipboardItem failed", err
      );
      setErrorMessage(
        'قيود الأمان للمتصفح تمنع النسخ التلقائي المباشر للصور للحافظة. يرجى الضغط زر "حفظ الصورة" أو النقر مطولاً على مستعرض المعاينة وحفظها.',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/45backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 overflow-hidden text-right">
        {/* Left Side: Parameters / Settings Controls */}
        <div className="p-5 lg:col-span-5 border-l border-slate-100 flex flex-col justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b mb-4">
              <Camera className="w-5 h-5 text-indigo-600 animate-pulse" />
              <div>
                <h2 className="font-bold text-sm text-slate-800">
                  📸 إعداد وتصدير كارت الصورة المحترف
                </h2>
                <p className="text-[10px] text-slate-400">
                  خاصية WhatsApp Share Card الفورية
                </p>
              </div>
            </div>

            {/* Error alerts */}
            {errorMessage && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg text-[10px] leading-relaxed mb-3 flex items-start gap-1.5 font-sans">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Image Type Selector has been removed as per the user's request, the ledger view is the unified output strategy. */}

              {/* Quality Settings */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  دقة وجودة التوليد الرسومي للشير بالواتساب:
                </label>
                <div className="flex flex-col gap-2 mt-1">
                  <label className="flex items-center gap-2 cursor-pointer bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition">
                    <input
                      type="radio"
                      name="quality"
                      checked={quality === "high"}
                      onChange={() => setQuality("high")}
                      className="text-indigo-600 w-4 h-4"
                    />
                    <div>
                      <span className="font-extrabold text-indigo-950 block">
                        💎 صورة فائقة الوضوح (Ultra HD 4K)
                      </span>
                      <span className="text-[10px] text-indigo-600">
                        مثالية للطباعة والمشاركة بأعلى جودة تكبير على الواتساپ
                      </span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition">
                    <input
                      type="radio"
                      name="quality"
                      checked={quality === "standard"}
                      onChange={() => setQuality("standard")}
                      className="text-slate-600 w-4 h-4"
                    />
                    <div>
                      <span className="font-bold text-slate-800 block">
                        📱 صورة قياسية سريعة (Full HD 1080p)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        سريعة التوليد وقليلة المساحة ومناسبة للشاشات العادية
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Layout Mode (Portrait vs. Landscape) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  أبعاد وتنسيق العرض:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLayoutMode("portrait")}
                    className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                      layoutMode === "portrait"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold"
                        : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-indigo-600" />
                    <span>📱 صورة طولية (مناسب للواتس)</span>
                  </button>
                  <button
                    onClick={() => setLayoutMode("landscape")}
                    className={`p-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                      layoutMode === "landscape"
                        ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold"
                        : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Laptop className="w-4 h-4 text-indigo-600" />
                    <span>🖥️ صورة عرضية (للحاسب)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            {/* Download and copy action buttons */}
            <button
              onClick={handleCopyToClipboard}
              disabled={generating}
              className={`w-full py-2.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-all border ${
                copied
                  ? "bg-emerald-605 text-white border-emerald-600"
                  : "bg-indigo-605 hover:bg-indigo-700 text-white border-indigo-600 shadow-lg shadow-indigo-100"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4.5 h-4.5" />
                  <span>تم نسخ الصورة بنجاح! انسخ بالواتس (Ctrl+V)</span>
                </>
              ) : (
                <>
                  <Copy className="w-4.5 h-4.5" />
                  <span>📋 نسخ كرت الصورة لشرائح الواتس</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              disabled={generating}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-black text-white rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition-all"
            >
              <Download className="w-4.5 h-4.5" />
              <span>📥 حفظ وتنزيل كارت صورة PNG فائقة الوضوح</span>
            </button>

            {sectionName !== "كشف الديون للمندوب" && (
              <button
                onClick={handlePrintPdf}
                disabled={generating}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold flex items-center justify-center gap-2 text-xs shadow-md cursor-pointer transition-all hover:scale-101 border-0"
              >
                <FileText className="w-4.5 h-4.5 text-white" />
                <span>📄 تصدير ومعاينة كـ PDF ملكي فوري (صورة مدمجة)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs transition-all text-center font-extrabold"
            >
              المغادرة وإغلاق النافذة ×
            </button>
          </div>
        </div>

        {/* Right Side: LIVE PREVIEW SCREEN containing the exact rendered element to print */}
        <div className="p-5 lg:col-span-7 bg-slate-200 border-r border-slate-100 flex items-center justify-center overflow-auto max-h-[85vh]">
          {/* Card Wrapper specifying size depending on Layout (Portrait vs Landscape) */}
          <div
            ref={cardRef}
            className={`bg-white text-slate-950 p-3 shrink-0 select-none text-right font-sans`}
            style={{
              width:
                sectionName === "صورة واتساب (ديون العملاء)" ||
                sectionName === "كشف الديون للمندوب"
                  ? "auto"
                  : layoutMode === "portrait"
                    ? "520px"
                    : "820px",
              minHeight: "auto",
              minWidth:
                sectionName === "صورة واتساب (ديون العملاء)" ||
                sectionName === "كشف الديون للمندوب"
                  ? "350px"
                  : "auto",
            }}
          >
            {/* Simple one-line header */}
            {sectionName !== "صورة واتساب (ديون العملاء)" &&
              sectionName !== "كشف الديون للمندوب" && (
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3 text-[12px] font-black">
                  <div className="flex items-center gap-2">
                    <span>المنظومة الملكية</span>
                    <span className="text-slate-400">|</span>
                    <span>{sectionName}</span>
                  </div>
                  <span>
                    {new Date().toLocaleDateString("ar-LY")} •{" "}
                    {new Date().toLocaleTimeString("ar-LY", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}

            {/* Data Table */}
            <div
              className={`${sectionName === "صورة واتساب (ديون العملاء)" || sectionName === "كشف الديون للمندوب" ? "" : ""} w-full bg-white`}
            >
              <table className="w-full text-right text-xs border-collapse">
                {sectionName !== "كشف الديون للمندوب" && (
                  <thead
                    className={`${sectionName === "صورة واتساب (ديون العملاء)" ? "bg-indigo-50 text-indigo-900 border-b border-indigo-100" : "bg-slate-100 border-b-2 border-slate-950 text-slate-900"} font-black`}
                  >
                    <tr>
                      {tableHeaders.map((hdr, idx) => (
                        <th
                          key={idx}
                          className={`px-1 py-1 ${sectionName === "صورة واتساب (ديون العملاء)" ? "border-none text-[14px] font-bold text-center" : "border-r last:border-r-0 border-slate-700 text-[10px] font-black"}`}
                        >
                          {hdr}
                        </th>
                      ))}
                    </tr>
                  </thead>
                )}
                <tbody>
                  {tableRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={`hover:bg-slate-50 ${sectionName === "صورة واتساب (ديون العملاء)" ? "border-b border-slate-100" : sectionName === "كشف الديون للمندوب" ? "border-b border-slate-300" : "border-b border-slate-200"} last:border-none`}
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          contentEditable={
                            sectionName === "صورة واتساب (ديون العملاء)"
                          }
                          suppressContentEditableWarning={true}
                          className={`px-1 py-0.5 ${sectionName === "صورة واتساب (ديون العملاء)" ? 'border-none font-bold text-[14px] text-center focus:outline-none focus:bg-indigo-50/50 min-h-[30px] empty:before:content-["....."] empty:before:text-slate-300' : sectionName === "كشف الديون للمندوب" ? "border-r border-slate-300 last:border-r-0 font-bold text-[14px] text-center" : "border-r last:border-r-0 border-slate-200 font-bold font-mono text-[10px]"} text-slate-950`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {footerMetrics && footerMetrics.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-4 border-t-2 border-slate-900 pt-3">
                  {footerMetrics.map((fm, idx) => (
                    <div key={idx} className="text-center font-mono">
                      <span className="block text-slate-500 font-extrabold text-[10px] mb-1">
                        {fm.label}
                      </span>
                      <span
                        className={`text-[12px] font-black ${fm.colorClass}`}
                      >
                        {fm.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
