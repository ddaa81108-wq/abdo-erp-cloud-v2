import React, { useMemo, useState } from 'react';
import { Check, Copy, Plus, Trash2, X } from 'lucide-react';

type Operator = 'add' | 'subtract' | 'multiply' | 'divide';

type CalculatorRow = {
  id: string;
  left: string;
  right: string;
  operator: Operator;
};

interface GlobalCalculatorProps {
  open: boolean;
  onClose: () => void;
}

const makeRow = (): CalculatorRow => ({
  id: `global_calc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  left: '',
  right: '',
  operator: 'multiply',
});

const calculate = (row: CalculatorRow) => {
  const left = Number(row.left) || 0;
  const right = Number(row.right) || 0;
  if (row.operator === 'add') return left + right;
  if (row.operator === 'subtract') return left - right;
  if (row.operator === 'divide') return right === 0 ? null : left / right;
  return left * right;
};

const formatResult = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 6 });

export default function GlobalCalculator({
  open,
  onClose,
}: GlobalCalculatorProps) {
  const [rows, setRows] = useState<CalculatorRow[]>([makeRow()]);
  const [copied, setCopied] = useState(false);
  const results = useMemo(() => rows.map(calculate), [rows]);
  const total = results.reduce<number>(
    (sum, value) => sum + (value === null ? 0 : value),
    0,
  );

  if (!open) return null;

  const patchRow = (id: string, patch: Partial<CalculatorRow>) => {
    setRows((current) =>
      current.map((row) => row.id === id ? { ...row, ...patch } : row));
  };

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="w-full max-w-3xl overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-emerald-700 px-5 py-4 text-white">
          <div>
            <h2 className="text-base font-black">الآلة الحاسبة العامة</h2>
            <p className="mt-0.5 text-[11px] font-bold text-emerald-100">
              حاسبة واحدة متاحة من جميع أقسام المنظومة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/15 p-2 transition hover:bg-white/25"
            aria-label="إغلاق الآلة الحاسبة"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[65vh] space-y-2 overflow-auto p-5">
          {rows.map((row, index) => {
            const result = results[index];
            return (
              <div
                key={row.id}
                className="grid grid-cols-[28px_minmax(0,1fr)_64px_minmax(0,1fr)_minmax(90px,auto)_32px] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2"
              >
                <span className="text-center text-xs font-black text-slate-500">
                  {index + 1}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.left}
                  onChange={(event) => patchRow(row.id, { left: event.target.value })}
                  className="min-w-0 rounded-xl border border-slate-300 bg-white p-2 text-center font-mono font-bold outline-none focus:border-emerald-500"
                  placeholder="القيمة الأولى"
                />
                <select
                  value={row.operator}
                  onChange={(event) =>
                    patchRow(row.id, { operator: event.target.value as Operator })}
                  className="rounded-xl border border-slate-300 bg-white p-2 text-center text-lg font-black outline-none focus:border-emerald-500"
                >
                  <option value="multiply">×</option>
                  <option value="divide">÷</option>
                  <option value="add">+</option>
                  <option value="subtract">−</option>
                </select>
                <input
                  type="text"
                  inputMode="decimal"
                  value={row.right}
                  onChange={(event) => patchRow(row.id, { right: event.target.value })}
                  className="min-w-0 rounded-xl border border-slate-300 bg-white p-2 text-center font-mono font-bold outline-none focus:border-emerald-500"
                  placeholder="القيمة الثانية"
                />
                <strong className={`text-center font-mono text-sm ${result === null ? 'text-rose-600' : 'text-emerald-800'}`}>
                  {result === null ? 'قسمة على صفر' : formatResult(result)}
                </strong>
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) =>
                      current.length === 1 ? [makeRow()] : current.filter((item) => item.id !== row.id))}
                  className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100"
                  aria-label="مسح السطر"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setRows((current) => [...current, makeRow()])}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 py-2.5 text-sm font-black text-emerald-700 hover:bg-emerald-50"
          >
            <Plus className="h-4 w-4" />
            إضافة سطر حساب
          </button>
        </div>

        <footer className="relative flex items-center justify-between bg-slate-950 px-5 py-4 text-white">
          <div>
            <span className="text-[11px] font-black text-slate-300">الإجمالي</span>
            <div className="font-mono text-2xl font-black">{formatResult(total)}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(String(total));
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black hover:bg-emerald-500"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'تم النسخ' : 'نسخ الإجمالي'}
          </button>
        </footer>
      </section>
    </div>
  );
}
