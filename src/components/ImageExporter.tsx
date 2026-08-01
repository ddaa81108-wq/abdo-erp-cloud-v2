import React, { useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import { AlertCircle, Check, Copy, FileText, X } from "lucide-react";

interface ImageExporterProps {
  sectionName: string;
  activeCurrency: string;
  metrics: {
    label1: string;
    value1: string | number;
    label2: string;
    value2: string | number;
    label3: string;
    value3: string | number;
  };
  tableHeaders: string[];
  tableRows: Array<Array<string | number>>;
  footerMetrics?: Array<{
    label: string;
    value: string | number;
    colorClass: string;
  }>;
  onClose?: () => void;
}

const ROWS_PER_PAGE = 10;

const safeFileName = (value: string) =>
  value.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_");

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

export default function ImageExporter({
  sectionName,
  tableHeaders,
  tableRows,
  footerMetrics,
  onClose,
}: ImageExporterProps) {
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pagesRef = useRef<HTMLDivElement>(null);

  const rowPages = useMemo(() => {
    if (tableRows.length === 0) return [[]];
    const pages: typeof tableRows[] = [];
    for (let index = 0; index < tableRows.length; index += ROWS_PER_PAGE) {
      pages.push(tableRows.slice(index, index + ROWS_PER_PAGE));
    }
    return pages;
  }, [tableRows]);

  const getPageElements = () => Array.from(
    pagesRef.current?.querySelectorAll<HTMLElement>("[data-export-page]") || [],
  );

  const renderPageImages = async (pixelRatio = 2) => {
    await document.fonts.ready;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    const elements = getPageElements();
    if (elements.length === 0) throw new Error("No export pages found");
    return Promise.all(elements.map((element) => toPng(element, {
      quality: 1,
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
    })));
  };

  const createCombinedImageBlob = async (dataUrls: string[]): Promise<Blob> => {
    const images = await Promise.all(dataUrls.map(loadImage));
    const gap = 24;
    const width = Math.max(...images.map((image) => image.naturalWidth));
    const height = images.reduce((sum, image) => sum + image.naturalHeight, 0)
      + gap * Math.max(0, images.length - 1);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    let top = 0;
    images.forEach((image) => {
      context.drawImage(image, 0, top);
      top += image.naturalHeight + gap;
    });
    return new Promise((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Image creation failed")),
      "image/png",
      1,
    ));
  };

  const handleCopy = async () => {
    setGenerating(true);
    setErrorMessage(null);
    try {
      const dataUrls = await renderPageImages(2);
      const blob = await createCombinedImageBlob(dataUrls);
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 3_000);
          return;
        } catch (clipboardError) {
          // Android browsers do not all support image clipboard writes. In
          // that case continue to the native share sheet below.
          console.warn("Image clipboard is unavailable; trying native share", clipboardError);
        }
      }

      const file = new File([blob], `${safeFileName(sectionName) || "كشف"}.png`, {
        type: "image/png",
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: sectionName });
        return;
      }
      throw new Error("Clipboard image copy is unsupported");
    } catch (error) {
      console.error("Direct image copy failed", error);
      setErrorMessage("تعذر النسخ المباشر في هذا المتصفح. جرّب فتح المنظومة من Chrome أو استخدم زر PDF.");
    } finally {
      setGenerating(false);
    }
  };

  const handlePdf = async () => {
    setGenerating(true);
    setErrorMessage(null);
    try {
      const dataUrls = await renderPageImages(2);
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;

      for (let index = 0; index < dataUrls.length; index += 1) {
        if (index > 0) pdf.addPage("a4", "landscape");
        const properties = pdf.getImageProperties(dataUrls[index]);
        const scale = Math.min(
          (pdfWidth - margin * 2) / properties.width,
          (pdfHeight - margin * 2) / properties.height,
        );
        const width = properties.width * scale;
        const height = properties.height * scale;
        pdf.addImage(
          dataUrls[index],
          "PNG",
          (pdfWidth - width) / 2,
          (pdfHeight - height) / 2,
          width,
          height,
          undefined,
          "FAST",
        );
      }

      pdf.save(`${safeFileName(sectionName) || "كشف"}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF export failed", error);
      setErrorMessage("تعذر إنشاء PDF. لم تتغير أي بيانات، حاول مرة أخرى.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm"
      dir="rtl"
    >
      <div className="grid max-h-[94vh] w-full max-w-6xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="order-2 flex flex-col justify-center gap-3 border-t border-slate-200 bg-white p-4 lg:order-1 lg:border-l lg:border-t-0">
          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-bold leading-relaxed text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? "تم النسخ - الصق مباشرة" : "نسخ مباشر"}</span>
          </button>

          <button
            type="button"
            onClick={handlePdf}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            <FileText className="h-4 w-4" />
            <span>{generating ? "جاري التجهيز..." : "تنزيل PDF"}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            <span>إغلاق</span>
          </button>
        </aside>

        <main className="order-1 max-h-[76vh] overflow-auto bg-slate-200 p-4 lg:order-2 lg:max-h-[94vh]">
          <div ref={pagesRef} className="mx-auto flex w-max flex-col gap-4">
            {rowPages.map((rows, pageIndex) => (
              <section
                key={pageIndex}
                data-export-page
                className="flex min-h-[580px] w-[820px] flex-col bg-white p-6 text-slate-950 shadow-sm"
              >
                <header className="mb-5 flex items-center justify-between border-b-2 border-slate-900 pb-3 text-[15px] font-black">
                  <div className="flex items-center gap-2">
                    <span>المنظومة الملكية</span>
                    <span className="text-slate-400">|</span>
                    <span>{sectionName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {rowPages.length > 1 && (
                      <span>صفحة {pageIndex + 1} من {rowPages.length}</span>
                    )}
                    <span>{new Date().toLocaleDateString("ar-LY")}</span>
                  </div>
                </header>

                <table className="w-full table-fixed border-collapse text-right">
                  <thead>
                    <tr className="border-b-2 border-slate-900 bg-slate-100">
                      {tableHeaders.map((header, index) => (
                        <th
                          key={`${header}-${index}`}
                          className="border-l border-slate-300 px-4 py-3 text-center text-[16px] font-black last:border-l-0"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-slate-300 last:border-b-0">
                        {row.map((cell, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="h-11 border-l border-slate-200 px-4 py-2 text-center text-[17px] font-extrabold last:border-l-0"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={Math.max(1, tableHeaders.length)}
                          className="px-4 py-12 text-center text-base font-bold text-slate-500"
                        >
                          لا توجد بيانات في الكشف
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {footerMetrics && footerMetrics.length > 0 && (
                  <footer className="mt-auto grid grid-cols-4 gap-3 border-t-2 border-slate-900 pt-4">
                    {footerMetrics.map((metric, index) => (
                      <div key={index} className="rounded-lg bg-slate-50 p-2 text-center">
                        <span className="block text-[11px] font-black text-slate-500">{metric.label}</span>
                        <span className={`mt-1 block text-[15px] font-black ${metric.colorClass}`}>{metric.value}</span>
                      </div>
                    ))}
                  </footer>
                )}
              </section>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
