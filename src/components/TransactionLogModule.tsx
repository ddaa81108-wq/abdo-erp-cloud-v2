import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  FolderSymlink,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ERPState, SystemAuditEntry } from '../types';
import { seedSystemAuditLog } from '../domain/systemAudit';

interface TransactionLogModuleProps {
  state: ERPState;
  onOpenExporter: (
    section: string,
    metrics: unknown,
    headers: string[],
    rows: unknown[][],
  ) => void;
  onUpdateState: (newState: ERPState) => void;
}

const actionLabel: Record<SystemAuditEntry['action'], string> = {
  create: 'إضافة',
  update: 'تعديل',
  delete: 'مسح',
  restore: 'استرجاع',
};

const actionColor: Record<SystemAuditEntry['action'], string> = {
  create: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  update: 'border-sky-200 bg-sky-50 text-sky-800',
  delete: 'border-rose-200 bg-rose-50 text-rose-800',
  restore: 'border-violet-200 bg-violet-50 text-violet-800',
};

export default function TransactionLogModule({
  state,
  onOpenExporter,
  onUpdateState,
}: TransactionLogModuleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('الكل');
  const [deleteEntry, setDeleteEntry] = useState<SystemAuditEntry | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if ((state.systemAuditMigrationVersion || 0) >= 1) return;
    onUpdateState({
      ...state,
      systemAuditLog: state.systemAuditLog?.length
        ? state.systemAuditLog
        : seedSystemAuditLog(state, null),
      systemAuditMigrationVersion: 1,
    });
  }, [state.systemAuditMigrationVersion]);

  const entries = state.systemAuditLog || [];
  const sections = useMemo(
    () => ['الكل', ...new Set(entries.map((entry) => entry.section))],
    [entries],
  );
  const visibleEntries = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ar');
    return entries
      .filter((entry) =>
        sectionFilter === 'الكل' || entry.section === sectionFilter)
      .filter((entry) =>
        !query
        || entry.title.toLocaleLowerCase('ar').includes(query)
        || entry.details.toLocaleLowerCase('ar').includes(query)
        || entry.section.toLocaleLowerCase('ar').includes(query)
        || (entry.actorName || '').toLocaleLowerCase('ar').includes(query)
        || entry.entityId.toLocaleLowerCase('ar').includes(query))
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime()
          - new Date(left.occurredAt).getTime(),
      );
  }, [entries, searchQuery, sectionFilter]);

  const toast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 2800);
  };

  const removeOne = () => {
    if (!deleteEntry) return;
    onUpdateState({
      ...state,
      systemAuditLog: entries.filter((entry) => entry.id !== deleteEntry.id),
      systemAuditMigrationVersion: 1,
    });
    setDeleteEntry(null);
    toast('تم مسح السطر من السجل فقط، بدون التأثير على أي حساب.');
  };

  const clearAll = () => {
    onUpdateState({
      ...state,
      systemAuditLog: [],
      systemAuditMigrationVersion: 1,
    });
    setShowClearConfirm(false);
    toast('تم مسح سجل المعاملات بالكامل دون تغيير بيانات المنظومة.');
  };

  const handleExport = () => {
    onOpenExporter(
      'سجل المعاملات الشامل',
      {
        label1: 'عدد الحركات',
        value1: `${visibleEntries.length} حركة`,
        label2: 'طبيعة السجل',
        value2: 'قراءة ومراقبة فقط',
        label3: 'التأثير المحاسبي',
        value3: 'لا يؤثر على الحسابات',
      },
      ['التاريخ', 'القسم', 'الإجراء', 'العملية', 'التفاصيل', 'المنفذ'],
      visibleEntries.map((entry) => [
        new Date(entry.occurredAt).toLocaleString('ar-LY'),
        entry.section,
        actionLabel[entry.action],
        entry.title,
        entry.details,
        entry.actorName || 'غير محدد',
      ]),
    );
  };

  return (
    <div className="space-y-3 text-right" dir="rtl">
      {message && (
        <div className="fixed right-5 top-20 z-[120] rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-2xl">
          {message}
        </div>
      )}

      <header className="flex flex-col gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <FileText className="h-5 w-5 text-indigo-700" />
            سجل المعاملات الشامل
          </h2>
          <p className="mt-1 text-[11px] font-bold text-slate-500">
            يسجل الإضافة والتعديل والمسح والاسترجاع في جميع الأقسام. حذف السجل لا يغير أي حساب.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-700 px-3 py-2 text-xs font-black text-white hover:bg-indigo-800"
          >
            <FolderSymlink className="h-4 w-4" />
            تصدير السجل
          </button>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 rounded-xl bg-rose-700 px-3 py-2 text-xs font-black text-white hover:bg-rose-800 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
            مسح السجل بالكامل
          </button>
        </div>
      </header>

      <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ابحث في العملية أو القسم أو المنفذ..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-9 text-xs font-bold outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto">
            {sections.map((section) => (
              <button
                type="button"
                key={section}
                onClick={() => setSectionFilter(section)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black ${
                  sectionFilter === section
                    ? 'border-indigo-700 bg-indigo-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {section}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200">
          <table className="min-w-[1000px] w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-20 bg-slate-900 text-white">
              <tr>
                <th className="p-2">ت</th>
                <th className="p-2">التاريخ والوقت</th>
                <th className="p-2">القسم</th>
                <th className="p-2">الإجراء</th>
                <th className="p-2">العملية</th>
                <th className="p-2">التفاصيل</th>
                <th className="p-2">القيمة</th>
                <th className="p-2">المنفذ</th>
                <th className="p-2">مسح</th>
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((entry, index) => (
                <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2 text-center font-mono font-black">{index + 1}</td>
                  <td className="p-2 text-center font-mono text-[10px]">
                    {new Date(entry.occurredAt).toLocaleString('ar-LY')}
                  </td>
                  <td className="p-2 font-black text-slate-800">{entry.section}</td>
                  <td className="p-2 text-center">
                    <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${actionColor[entry.action]}`}>
                      {actionLabel[entry.action]}
                    </span>
                  </td>
                  <td className="p-2 font-bold">{entry.title}</td>
                  <td className="max-w-[320px] truncate p-2 text-slate-600" title={entry.details}>
                    {entry.details}
                  </td>
                  <td className="p-2 text-center font-mono font-black">
                    {entry.amount === undefined
                      ? '—'
                      : `${entry.amount.toLocaleString('en-US')} د.ل`}
                  </td>
                  <td className="p-2 text-center">{entry.actorName || 'غير محدد'}</td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => setDeleteEntry(entry)}
                      className="rounded-lg bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                      title="مسح من السجل فقط"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleEntries.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center font-bold text-slate-400">
                    لا توجد حركات مطابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-left text-[10px] font-bold text-slate-400">
          إجمالي السجل: {entries.length.toLocaleString('en-US')} حركة
        </p>
      </section>

      {deleteEntry && (
        <ConfirmModal title="مسح سطر من السجل" onClose={() => setDeleteEntry(null)}>
          <p className="mb-4 text-sm font-bold leading-7 text-slate-700">
            سيتم حذف هذا السطر من سجل المراقبة فقط، ولن تتغير المعاملة الأصلية أو أي إجمالي.
          </p>
          <button
            type="button"
            onClick={removeOne}
            className="w-full rounded-xl bg-rose-700 py-3 text-sm font-black text-white"
          >
            تأكيد مسح السطر
          </button>
        </ConfirmModal>
      )}

      {showClearConfirm && (
        <ConfirmModal title="مسح سجل المعاملات بالكامل" onClose={() => setShowClearConfirm(false)}>
          <p className="mb-4 text-sm font-bold leading-7 text-slate-700">
            سيتم تفريغ سجل المراقبة فقط. بيانات العملاء والخزينة والأمانات والمشتريات والصلاحيات لن تتأثر.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="w-full rounded-xl bg-rose-700 py-3 text-sm font-black text-white"
          >
            تأكيد مسح السجل بالكامل
          </button>
        </ConfirmModal>
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 p-2">
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
