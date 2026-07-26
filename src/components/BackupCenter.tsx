import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Cloud,
  DatabaseBackup,
  Download,
  FileJson,
  HardDriveDownload,
  History,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AUTO_BACKUP_INTERVAL_MS,
  AUTO_BACKUP_RETENTION,
  isAutoBackup,
  latestAutoBackupAt,
  nextAutoBackupAt,
  snapshotForBackup,
} from '../domain/backups';
import type { BackupPoint, ERPState } from '../types';

interface BackupCenterProps {
  state: ERPState;
  isOnline: boolean;
  onRestoreState: (newState: ERPState) => void;
  onSaveBackupPoint: (name: string, description: string) => void;
  onDeleteBackupPoint: (id: string) => void;
}

const formatDateTime = (value: string | number) =>
  new Date(value).toLocaleString('ar-LY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

const validBackupState = (value: unknown): value is ERPState => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ERPState>;
  return [
    candidate.customers,
    candidate.cycles,
    candidate.debtTransactions,
    candidate.companies,
    candidate.purchases,
    candidate.trustDeposits,
  ].every(Array.isArray);
};

export default function BackupCenter({
  state,
  isOnline,
  onRestoreState,
  onSaveBackupPoint,
  onDeleteBackupPoint,
}: BackupCenterProps) {
  const [pointName, setPointName] = useState('');
  const [pointDesc, setPointDesc] = useState('');
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmRestorePoint, setConfirmRestorePoint] =
    useState<BackupPoint | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const backups = useMemo(
    () => [...(state.backupPoints || [])].sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime(),
    ),
    [state.backupPoints],
  );
  const automaticBackups = backups.filter(isAutoBackup);
  const lastAutomaticAt = latestAutoBackupAt(backups);
  const nextAutomaticAt = nextAutoBackupAt(backups);
  const remainingMs = Math.max(0, nextAutomaticAt - now);
  const remainingHours = Math.floor(remainingMs / 3_600_000);
  const remainingMinutes = Math.ceil((remainingMs % 3_600_000) / 60_000);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 4500);
  };

  const handleExportJSON = () => {
    try {
      const cleanSnapshot = snapshotForBackup(state);
      const blob = new Blob(
        [JSON.stringify(cleanSnapshot, null, 2)],
        { type: 'application/json;charset=utf-8' },
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ABDO_ERP_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showStatus('success', 'تم تصدير نسخة JSON نظيفة وكاملة بنجاح.');
    } catch {
      showStatus('error', 'تعذر تجهيز ملف النسخة الاحتياطية.');
    }
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ''));
        if (!validBackupState(parsed)) {
          showStatus('error', 'الملف لا يحتوي على نسخة صحيحة للمنظومة.');
          return;
        }
        onRestoreState(parsed);
        showStatus('success', 'تم استيراد النسخة واستعادة بياناتها بنجاح.');
      } catch {
        showStatus('error', 'تعذر قراءة الملف أو أن محتواه غير صالح.');
      }
    };
    reader.onerror = () => showStatus('error', 'تعذر فتح ملف النسخة.');
    reader.readAsText(file);
  };

  const handleAddNewPoint = (event: React.FormEvent) => {
    event.preventDefault();
    if (!pointName.trim()) {
      showStatus('error', 'اكتب اسماً واضحاً لنقطة الاستعادة.');
      return;
    }
    onSaveBackupPoint(pointName.trim(), pointDesc.trim());
    setPointName('');
    setPointDesc('');
    showStatus('success', 'أُضيفت نقطة الاستعادة إلى المزامنة.');
  };

  const restoreSelectedPoint = () => {
    if (!confirmRestorePoint) return;
    try {
      const parsed = JSON.parse(confirmRestorePoint.dataJson);
      if (!validBackupState(parsed)) throw new Error('invalid backup');
      onRestoreState(parsed);
      setConfirmRestorePoint(null);
      showStatus('success', `تمت استعادة: ${confirmRestorePoint.name}`);
    } catch {
      showStatus('error', 'هذه النسخة ناقصة أو تالفة ولا يمكن استعادتها.');
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 text-right" dir="rtl">
      <header className="overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-l from-emerald-950 via-emerald-900 to-slate-950 p-5 text-white shadow-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
              <DatabaseBackup className="h-7 w-7 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-xl font-black">الإعدادات الشاملة وحماية البيانات</h2>
              <p className="mt-1 text-xs font-bold text-emerald-100/75">
                نسخ تلقائي كل 12 ساعة، نقاط استعادة يدوية، وتصدير محلي آمن
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black ${
            isOnline
              ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30'
              : 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30'
          }`}>
            <Cloud className="h-4 w-4" />
            {isOnline ? 'المزامنة السحابية متصلة' : 'العمل محلي — بانتظار الاتصال'}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusCard
          icon={<Clock3 />}
          label="دورة النسخ التلقائي"
          value="كل 12 ساعة"
          hint={AUTO_BACKUP_INTERVAL_MS === 43_200_000 ? 'مفعّلة ومؤكدة' : 'راجع الإعداد'}
        />
        <StatusCard
          icon={<History />}
          label="آخر نسخة تلقائية"
          value={lastAutomaticAt ? formatDateTime(lastAutomaticAt) : 'عند أول دخول'}
          hint={lastAutomaticAt
            ? `القادمة بعد ${remainingHours}س ${remainingMinutes}د`
            : 'ستُنشأ فوراً'}
        />
        <StatusCard
          icon={<DatabaseBackup />}
          label="النسخ التلقائية المحفوظة"
          value={`${automaticBackups.length} من ${AUTO_BACKUP_RETENTION}`}
          hint="الأقدم يُستبدل تلقائياً"
        />
        <StatusCard
          icon={<ShieldCheck />}
          label="حالة الحماية"
          value={isOnline ? 'سحابية + محلية' : 'محلية مؤقتاً'}
          hint="لا تُضمَّن النسخ القديمة داخل الجديدة"
        />
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black ${
          message.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          <CheckCircle2 className="h-5 w-5" />
          {message.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ActionCard
          icon={<HardDriveDownload />}
          title="تصدير نسخة إلى جهازك"
          description="ملف JSON كامل ونظيف يمكن الاحتفاظ به خارج Firebase."
          action={(
            <button onClick={handleExportJSON} className="backup-primary-btn">
              <Download className="h-4 w-4" />
              تنزيل النسخة
            </button>
          )}
        />
        <ActionCard
          icon={<FileJson />}
          title="استيراد نسخة محفوظة"
          description="يفحص بنية الملف أولاً، ثم يستبدل البيانات بعد اختياره."
          action={(
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportJSON}
                className="hidden"
              />
              <button onClick={() => fileInputRef.current?.click()} className="backup-secondary-btn">
                <Upload className="h-4 w-4" />
                اختيار ملف
              </button>
            </>
          )}
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Save className="h-5 w-5 text-emerald-700" />
          <div>
            <h3 className="text-sm font-black text-slate-900">إنشاء نقطة استعادة يدوية</h3>
            <p className="text-[11px] font-bold text-slate-500">
              استخدمها قبل أي تعديل كبير أو استيراد بيانات.
            </p>
          </div>
        </div>
        <form onSubmit={handleAddNewPoint} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <input
            value={pointName}
            onChange={(event) => setPointName(event.target.value)}
            placeholder="اسم نقطة الاستعادة"
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
          />
          <input
            value={pointDesc}
            onChange={(event) => setPointDesc(event.target.value)}
            placeholder="ملاحظة اختيارية"
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-emerald-500"
          />
          <button type="submit" className="backup-primary-btn justify-center">
            <Save className="h-4 w-4" />
            حفظ نقطة
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">سجل نقاط الاستعادة</h3>
            <p className="text-[11px] font-bold text-slate-500">الأحدث أولاً — الحذف لا يغيّر البيانات الحالية</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
            {backups.length} نسخة
          </span>
        </div>

        <div className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
          {backups.length === 0 ? (
            <div className="p-10 text-center text-sm font-bold text-slate-400">
              لا توجد نقاط استعادة حتى الآن.
            </div>
          ) : backups.map((point) => (
            <div key={point.id} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-sm text-slate-900">{point.name}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isAutoBackup(point)
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {isAutoBackup(point) ? 'تلقائية' : 'يدوية'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  {formatDateTime(point.date)}
                  {point.description ? ` — ${point.description}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setConfirmRestorePoint(point)}
                  className="flex items-center gap-1 rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-800 transition hover:bg-amber-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  استعادة
                </button>
                <button
                  onClick={() => onDeleteBackupPoint(point.id)}
                  className="rounded-xl bg-rose-50 p-2 text-rose-600 transition hover:bg-rose-100"
                  title="حذف نقطة الاستعادة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .backup-primary-btn, .backup-secondary-btn {
          display: inline-flex; align-items: center; gap: .5rem; border-radius: .75rem;
          padding: .75rem 1rem; font-size: .75rem; font-weight: 900; transition: .2s;
        }
        .backup-primary-btn { background: #047857; color: white; }
        .backup-primary-btn:hover { background: #065f46; }
        .backup-secondary-btn { background: #0f172a; color: white; }
        .backup-secondary-btn:hover { background: #1e293b; }
      `}</style>

      {confirmRestorePoint && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-950 p-6 text-white shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-amber-300">
              <RotateCcw className="h-5 w-5" />
              <h4 className="font-black">تأكيد استعادة النسخة</h4>
            </div>
            <p className="text-sm font-bold leading-7 text-slate-300">
              سيتم استبدال البيانات الحالية بمحتوى
              {' '}<strong className="text-white">«{confirmRestorePoint.name}»</strong>.
              يفضّل تصدير نسخة حالية أولاً.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={restoreSelectedPoint} className="rounded-xl bg-amber-500 py-3 text-sm font-black text-slate-950 hover:bg-amber-400">
                تأكيد الاستعادة
              </button>
              <button onClick={() => setConfirmRestorePoint(null)} className="rounded-xl border border-slate-700 bg-slate-900 py-3 text-sm font-black text-slate-300 hover:bg-slate-800">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-emerald-700">
        {React.cloneElement(icon, { className: 'h-4 w-4' } as React.SVGProps<SVGSVGElement>)}
        <span className="text-[11px] font-black">{label}</span>
      </div>
      <strong className="block text-sm font-black text-slate-900">{value}</strong>
      <small className="mt-1 block text-[10px] font-bold text-slate-500">{hint}</small>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactElement;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          {React.cloneElement(icon, { className: 'h-6 w-6' } as React.SVGProps<SVGSVGElement>)}
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-900">{title}</h3>
          <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
