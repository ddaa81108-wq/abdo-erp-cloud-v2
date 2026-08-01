import { useMemo, useRef, useState } from 'react';
import { FileDown, X } from 'lucide-react';
import { toPng } from 'html-to-image';

export type LedgerPdfCell = string | number;

export type LedgerPdfTotal = {
  label: string;
  value: LedgerPdfCell;
};

interface LedgerPdfModalProps {
  title: string;
  headers: string[];
  rows: LedgerPdfCell[][];
  totals: LedgerPdfTotal[];
  onClose: () => void;
}

const ROWS_PER_PAGE = 20;

const safeFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80);

export default function LedgerPdfModal({
  title,
  headers,
  rows,
  totals,
  onClose,
}: LedgerPdfModalProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const pages = useMemo(() => {
    if (!rows.length) return [[]] as LedgerPdfCell[][][];
    const chunks: LedgerPdfCell[][][] = [];
    for (let index = 0; index < rows.length; index += ROWS_PER_PAGE) {
      chunks.push(rows.slice(index, index + ROWS_PER_PAGE));
    }
    return chunks;
  }, [rows]);

  const exportPdf = async () => {
    if (!pagesRef.current || generating) return;
    setGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      await document.fonts.ready;
      const pageElements = Array.from(
        pagesRef.current.querySelectorAll<HTMLElement>('[data-ledger-pdf-page]'),
      );
      if (pageElements.length === 0) throw new Error('No ledger pages found');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 4;

      for (const [index, page] of pageElements.entries()) {
        const dataUrl = await toPng(page, {
          pixelRatio: 2,
          quality: 1,
          backgroundColor: '#ffffff',
          cacheBust: true,
        });
        if (index > 0) pdf.addPage('a4', 'landscape');
        const properties = pdf.getImageProperties(dataUrl);
        const scale = Math.min(
          (pdfWidth - margin * 2) / properties.width,
          (pdfHeight - margin * 2) / properties.height,
        );
        const width = properties.width * scale;
        const height = properties.height * scale;
        pdf.addImage(
          dataUrl,
          'PNG',
          (pdfWidth - width) / 2,
          (pdfHeight - height) / 2,
          width,
          height,
          undefined,
          'FAST',
        );
      }

      pdf.save(`${safeFileName(title) || 'ledger'}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Ledger PDF export failed', error);
      window.alert('تعذر إنشاء ملف PDF. لم يتم تغيير أي بيانات، حاول مرة أخرى.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex flex-col bg-slate-950/85 p-2 backdrop-blur-md sm:p-4" dir="rtl">
      <div className="mx-auto mb-3 grid w-full max-w-5xl grid-cols-2 gap-2">
        <button
          type="button"
          disabled={generating}
          onClick={exportPdf}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-lg transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
        >
          <FileDown className="h-4 w-4" />
          {generating ? 'جاري تجهيز PDF...' : 'طباعة PDF'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-black text-slate-700 shadow-lg transition hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
          إغلاق الصفحة
        </button>
      </div>

      <div className="flex-1 overflow-auto rounded-2xl bg-slate-200 p-2 sm:p-4">
        <div ref={pagesRef} className="mx-auto flex w-max flex-col gap-4">
          {pages.map((pageRows, pageIndex) => (
            <section
              key={pageIndex}
              data-ledger-pdf-page
              className="flex h-[760px] w-[1120px] flex-col overflow-hidden bg-white p-8 text-slate-950 shadow-xl"
            >
              <header className="mb-4 flex items-end justify-between border-b-2 border-slate-900 pb-3">
                <div>
                  <h2 className="text-xl font-black">{title}</h2>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    سجل مالي مرتب زمنيًا — القديم أعلى والجديد أسفل
                  </p>
                </div>
                <div className="text-left text-[10px] font-bold text-slate-500">
                  <div>تاريخ الطباعة: {new Date().toLocaleString('ar-LY')}</div>
                  <div>صفحة {pageIndex + 1} من {pages.length}</div>
                </div>
              </header>

              <table className="w-full table-fixed border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    {headers.map((header, index) => (
                      <th key={`${header}-${index}`} className="border border-slate-700 px-2 py-2 text-center font-black">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="odd:bg-white even:bg-slate-50">
                      {headers.map((_, columnIndex) => (
                        <td
                          key={columnIndex}
                          className="h-7 border border-slate-300 px-2 py-1 text-center font-bold leading-tight"
                        >
                          {row[columnIndex] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!rows.length && (
                    <tr>
                      <td colSpan={Math.max(headers.length, 1)} className="border border-slate-300 p-12 text-center font-bold text-slate-400">
                        لا توجد معاملات مسجلة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="mt-auto pt-4">
                {pageIndex === pages.length - 1 && (
                  <div className="grid grid-cols-3 gap-2 border-t-2 border-slate-900 pt-3">
                    {totals.map((total) => (
                      <div key={total.label} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-center">
                        <span className="block text-[9px] font-bold text-slate-500">{total.label}</span>
                        <strong className="mt-1 block text-sm font-black text-slate-950">{total.value}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
