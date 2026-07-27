import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarDays,
  ClipboardList,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TableProperties,
} from 'lucide-react';
import { ERPState, EgyptianCashRow } from '../types';
import {
  calculateEgyptianRemainder,
  calculateEgyptianRowTotal,
  calculateEgyptianWorkTotal,
  getEgyptianPreviousValue,
} from '../domain/egyptianCash';
import { openSmartCardStudio } from '../utils/imageExporterUtils';

interface MailManualModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
}

export default function MailManualModule({ state, onUpdateState }: MailManualModuleProps) {
  const latestStateRef = useRef(state);
  const latestUpdateRef = useRef(onUpdateState);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    latestStateRef.current = state;
    latestUpdateRef.current = onUpdateState;
  }, [state, onUpdateState]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });

  const [localEgyptRecord, setLocalEgyptRecord] = useState<{
    date: string;
    rows: EgyptianCashRow[];
    previousValue: number;
    receivedValue: number;
  } | null>(null);

  useEffect(() => {
    const existing = state.egyptianCashRecords?.find(r => r.date === selectedDay);
    if (existing) {
      const rows = existing.rows.map(r => ({ 
        value: Number(r.value) || 0,
        commission: Number((r as any).commission) || 0
      }));
      while (rows.length < 7) {
        rows.push({ value: 0, commission: 0 });
      }
      setLocalEgyptRecord({
        date: existing.date,
        rows,
        previousValue: state.egyptianCashRecords.some(r => r.date < selectedDay)
          ? getEgyptianPreviousValue(state.egyptianCashRecords || [], selectedDay)
          : Number(existing.previousValue) || 0,
        receivedValue: Number(existing.receivedValue) || 0,
      });
    } else {
      const defaultRows = Array.from({ length: 7 }, () => ({ value: 0, commission: 0 }));
      setLocalEgyptRecord({
        date: selectedDay,
        rows: defaultRows,
        previousValue: getEgyptianPreviousValue(state.egyptianCashRecords || [], selectedDay),
        receivedValue: 0,
      });
    }
  }, [state.egyptianCashRecords, selectedDay]);

  const queueRecordSave = (
    record: NonNullable<typeof localEgyptRecord>,
    delay = 650,
  ) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const latestState = latestStateRef.current;
      const others = (latestState.egyptianCashRecords || [])
        .filter((item) => item.date !== record.date);
      latestUpdateRef.current({
        ...latestState,
        egyptianCashRecords: [...others, record],
      });
    }, delay);
  };

  const handleEgyptRowChange = (index: number, field: 'value' | 'commission', val: string) => {
    if (!localEgyptRecord) return;
    const numVal = parseFloat(val) || 0;
    const updatedRows = [...localEgyptRecord.rows];
    updatedRows[index] = { ...updatedRows[index], [field]: numVal };

    const newRec = {
      ...localEgyptRecord,
      rows: updatedRows
    };
    setLocalEgyptRecord(newRec);
    queueRecordSave(newRec);
  };

  const handleEgyptSummaryChange = (val: string) => {
    if (!localEgyptRecord) return;
    const numVal = parseFloat(val) || 0;
    const newRec = {
      ...localEgyptRecord,
      receivedValue: numVal,
    };
    setLocalEgyptRecord(newRec);
    queueRecordSave(newRec);
  };

  const handleOpenSmartImage = () => {
    if (!localEgyptRecord) return;
    openSmartCardStudio({
      type: 'masraweya',
      currency: 'ج.م',
      prev: previousValue,
      recv: receivedValue,
      total: table1GrandTotal,
      remain: remainderValue,
      date: selectedDay,
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    fieldName: 'value' | 'commission',
  ) => {
    const isVertical = e.key === 'ArrowUp' || e.key === 'ArrowDown';
    const isHorizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    if (!isVertical && !isHorizontal) return;

    // Arrow keys are navigation only. They must never increment/decrement a value.
    e.preventDefault();

    if (isVertical) {
      const nextIndex = e.key === 'ArrowDown' ? rowIndex + 1 : rowIndex - 1;

      if (e.key === 'ArrowDown' && localEgyptRecord && nextIndex >= localEgyptRecord.rows.length) {
        // Add a new row dynamically
        const updatedRows = [...localEgyptRecord.rows, { value: 0, commission: 0 }];
        const newRec = { ...localEgyptRecord, rows: updatedRows };
        setLocalEgyptRecord(newRec);
        queueRecordSave(newRec);

        setTimeout(() => {
          const nextInput = document.getElementById(`masr-${fieldName}-${nextIndex}`);
          if (nextInput) {
            (nextInput as HTMLInputElement).focus();
          }
        }, 50);
        return;
      }

      const nextInput = document.getElementById(`masr-${fieldName}-${nextIndex}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
        (nextInput as HTMLInputElement).select();
      }
      return;
    }

    const nextField = e.key === 'ArrowLeft'
      ? (fieldName === 'value' ? 'commission' : null)
      : (fieldName === 'commission' ? 'value' : null);
    if (nextField) {
      const nextInput = document.getElementById(`masr-${nextField}-${rowIndex}`) as HTMLInputElement | null;
      nextInput?.focus();
      nextInput?.select();
    }
  };

  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() + days);
    setSelectedDay(d.toISOString().slice(0, 10));
  };

  const rows = localEgyptRecord?.rows || [];
  const table1GrandTotal = calculateEgyptianWorkTotal(rows);
  const previousValue = Number(localEgyptRecord?.previousValue) || 0;
  const receivedValue = Number(localEgyptRecord?.receivedValue) || 0;
  const remainderValue = localEgyptRecord ? calculateEgyptianRemainder(localEgyptRecord) : 0;

  return (
    <div className="w-full space-y-5 text-right animate-fadeIn" dir="rtl">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleOpenSmartImage}
          disabled={!localEgyptRecord}
          className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-900 px-6 text-sm font-black text-white shadow-md transition hover:bg-indigo-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-5 w-5" />
          الصورة الذكية
        </button>

        <div className="flex h-12 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5 sm:min-w-[340px]">
          <button
            type="button"
            onClick={() => handleShiftDate(-1)}
            className="flex h-full w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white hover:text-indigo-900 hover:shadow-sm"
            aria-label="اليوم السابق"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-center gap-2">
            <CalendarDays className="h-4 w-4 text-indigo-700" />
            <input
              type="date"
              value={selectedDay}
              onChange={(event) => setSelectedDay(event.target.value)}
              className="h-full border-0 bg-transparent px-2 text-center font-mono text-sm font-black text-slate-800 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => handleShiftDate(1)}
            className="flex h-full w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white hover:text-indigo-900 hover:shadow-sm"
            aria-label="اليوم التالي"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
      </div>

      {!localEgyptRecord ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-500">
          <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin text-indigo-700" />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <TableProperties className="h-5 w-5 text-emerald-700" />
              <h3 className="text-lg font-black text-slate-900">جدول القيم المصرية</h3>
            </div>

            <div className="max-h-[720px] overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-right text-xs">
                <thead className="sticky top-0 z-10 bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="w-14 border border-slate-200 p-3 text-center">رقم</th>
                    <th className="border border-slate-200 p-3 text-center">القيمة</th>
                    <th className="border border-slate-200 p-3 text-center">العمولة</th>
                    <th className="border border-slate-200 p-3 text-center">الإجمالي الصافي</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-800">
                  {rows.map((row, index) => {
                    const netValue = calculateEgyptianRowTotal(row);
                    return (
                      <tr key={index} className="group transition hover:bg-slate-50">
                        <td className="border border-slate-200 bg-slate-50 p-2 text-center font-semibold text-slate-500">
                          {index + 1}
                        </td>
                        <td className="h-11 w-1/3 border border-slate-200 p-0">
                          <input
                            id={`masr-value-${index}`}
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={row.value || ''}
                            onChange={(event) => handleEgyptRowChange(index, 'value', event.target.value)}
                            onBlur={() => localEgyptRecord && queueRecordSave(localEgyptRecord, 0)}
                            onKeyDown={(event) => handleKeyDown(event, index, 'value')}
                            className="h-full w-full border-0 bg-transparent px-3 py-2 text-center font-mono font-bold text-slate-900 outline-none focus:bg-indigo-50"
                            aria-label={`القيمة في الصف ${index + 1}`}
                          />
                        </td>
                        <td className="h-11 w-1/3 border border-slate-200 bg-rose-50/20 p-0">
                          <input
                            id={`masr-commission-${index}`}
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={row.commission || ''}
                            onChange={(event) => handleEgyptRowChange(index, 'commission', event.target.value)}
                            onBlur={() => localEgyptRecord && queueRecordSave(localEgyptRecord, 0)}
                            onKeyDown={(event) => handleKeyDown(event, index, 'commission')}
                            className="h-full w-full border-0 bg-transparent px-3 py-2 text-center font-mono font-bold text-rose-900 outline-none focus:bg-rose-100/70"
                            aria-label={`العمولة في الصف ${index + 1}`}
                          />
                        </td>
                        <td className="w-1/4 border border-slate-200 bg-indigo-50/40 p-2 text-center font-bold text-indigo-950">
                          {netValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3">
              <span className="font-black text-emerald-900">إجمالي الشغل</span>
              <span className="font-mono text-xl font-black text-emerald-950" dir="ltr">
                {table1GrandTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })} ج.م
              </span>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border-2 border-indigo-900 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-indigo-800" />
                <h3 className="text-xl font-black text-indigo-950">الكشف النهائي</h3>
              </div>
              <span className="rounded-xl bg-indigo-50 px-3 py-1.5 font-mono text-sm font-bold text-indigo-800">
                {selectedDay}
              </span>
            </div>

            <div className="divide-y divide-slate-100 pt-2">
              <SummaryRow label="القيمة السابقة" value={previousValue} />
              <div className="flex min-h-20 items-center justify-between gap-4 py-4">
                <span className="text-lg font-bold text-slate-800">المستلم اليوم</span>
                <div className="flex w-1/2 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3">
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={localEgyptRecord.receivedValue || ''}
                    onChange={(event) => handleEgyptSummaryChange(event.target.value)}
                    onBlur={() => localEgyptRecord && queueRecordSave(localEgyptRecord, 0)}
                    className="min-w-0 flex-1 bg-transparent py-3 text-left font-mono text-2xl font-black text-slate-900 outline-none"
                    dir="ltr"
                    aria-label="المستلم اليوم"
                  />
                  <span className="text-xs font-black text-emerald-800">ج.م</span>
                </div>
              </div>
              <SummaryRow label="إجمالي الشغل" value={table1GrandTotal} />
              <SummaryRow label="الباقي النهائي" value={remainderValue} final />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ label, value, final = false }: { label: string; value: number; final?: boolean }) {
  return (
    <div className={`flex min-h-20 items-center justify-between gap-4 py-4 ${final ? 'mt-2 rounded-2xl border border-violet-200 bg-violet-50 px-4' : ''}`}>
      <span className={`${final ? 'text-xl font-black text-violet-900' : 'text-lg font-bold text-slate-800'}`}>
        {label}
      </span>
      <span
        className={`font-mono font-black ${final ? 'text-3xl' : 'text-2xl'} ${value < 0 ? 'text-rose-600' : final ? 'text-violet-800' : 'text-slate-900'}`}
        dir="ltr"
      >
        {value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ج.م
      </span>
    </div>
  );
}
