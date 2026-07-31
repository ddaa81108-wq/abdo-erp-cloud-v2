import { useMemo, useState, type ReactNode } from 'react';
import {
  Banknote,
  CircleDollarSign,
  Landmark,
  Save,
  Scale,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import type { ERPState } from '../types';
import {
  calculateFinancialReportSources,
  createFinancialReportSnapshot,
  reportDayKey,
  upsertFinancialReportRate,
  upsertFinancialReportSnapshot,
} from '../domain/financialReports';

interface FinancialReportsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
}

const integer = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

const money = (value: number, currency: 'lyd' | 'egp') =>
  `${integer(value).toLocaleString('en-US')} ${currency === 'lyd' ? 'د.ل' : 'ج.م'}`;

const rateLabel = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 4 });

export default function FinancialReportsModule({
  state,
  onUpdateState,
}: FinancialReportsModuleProps) {
  const today = reportDayKey(new Date());
  const [rateInput, setRateInput] = useState('');
  const [message, setMessage] = useState('');
  const rate = Number(rateInput);
  const validRate = Number.isFinite(rate) && rate > 0;
  const sources = useMemo(
    () => calculateFinancialReportSources(state, today),
    [state, today],
  );
  const egyptianEquivalentLyd = validRate
    ? Math.trunc(sources.netEgyptianPositionEgp / rate)
    : null;
  const totalOwnedLyd = egyptianEquivalentLyd === null
    ? null
    : integer(sources.treasuryPositivesLyd + egyptianEquivalentLyd);
  const netPositionLyd = totalOwnedLyd === null
    ? null
    : integer(totalOwnedLyd - sources.treasuryObligationsLyd);
  const snapshots = [...(state.financialReportSnapshots || [])]
    .sort((left, right) => right.date.localeCompare(left.date));

  const saveToday = () => {
    if (!validRate) {
      setMessage('أدخل سعر صرف اليوم بصورة صحيحة أولًا.');
      return;
    }
    const now = new Date().toISOString();
    try {
      const snapshot = createFinancialReportSnapshot(state, today, rate, now);
      onUpdateState({
        ...state,
        financialReportSnapshots: upsertFinancialReportSnapshot(
          state.financialReportSnapshots || [],
          snapshot,
        ),
        financialReportRates: upsertFinancialReportRate(
          state.financialReportRates || [],
          today,
          rate,
          now,
        ),
      });
      setMessage('تم حفظ نتيجة اليوم. إذا أعدت الحفظ اليوم سيتم تحديث الصف نفسه.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'تعذر حفظ نتيجة اليوم.');
    }
  };

  return (
    <div className="space-y-3 text-right animate-fadeIn" dir="rtl">
      {message && (
        <div className="fixed left-1/2 top-20 z-[120] -translate-x-1/2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-black text-white shadow-2xl">
          {message}
        </div>
      )}

      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-950 text-white">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-950">سجل المركز المالي اليومي</h2>
            <p className="text-[10px] font-bold text-slate-500">
              النتيجة مأخوذة من كروت إجماليات الأقسام وليست من حركات يومية منفصلة
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3">
            <CircleDollarSign className="h-4 w-4 text-amber-700" />
            <span className="whitespace-nowrap text-[10px] font-black text-amber-950">سعر اليوم: 1 د.ل =</span>
            <input
              value={rateInput}
              onChange={(event) => {
                setRateInput(event.target.value);
                setMessage('');
              }}
              inputMode="decimal"
              placeholder="أدخل السعر"
              className="w-24 bg-transparent text-center font-mono text-sm font-black text-amber-950 outline-none"
            />
            <span className="text-[10px] font-black text-amber-950">ج.م</span>
          </label>
          <button
            type="button"
            onClick={saveToday}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-800"
          >
            <Save className="h-4 w-4" />
            تسجيل نتيجة اليوم
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-800">
          <Banknote className="h-4 w-4 text-emerald-700" />
          تفاصيل الأموال المصرية الحالية
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <SmallMetric label="باقي المصراوية" value={money(sources.egyptianCashRemainderEgp, 'egp')} />
          <SmallMetric
            label="إجمالي باقي فودافون — البيان + سمسم"
            value={money(sources.vodafoneTotalRemainderEgp, 'egp')}
            highlight
          />
          <SmallMetric
            label="صافي أمانات المصري"
            value={money(sources.trustBalanceEgp, 'egp')}
            note={sources.trustBalanceEgp < 0 ? 'السالب حق لنا' : 'الموجب التزام علينا'}
            negative={sources.trustBalanceEgp > 0}
          />
          <SmallMetric
            label="صافي المصري بعد الأمانات"
            value={money(sources.netEgyptianPositionEgp, 'egp')}
            highlight
            negative={sources.netEgyptianPositionEgp < 0}
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MainMetric
          icon={<Landmark />}
          label="إجمالي إيجابيات الخزينة"
          value={money(sources.treasuryPositivesLyd, 'lyd')}
        />
        <MainMetric
          icon={<ShieldCheck />}
          label="إجمالي الالتزامات علينا"
          value={money(sources.treasuryObligationsLyd, 'lyd')}
          negative
        />
        <MainMetric
          icon={<CircleDollarSign />}
          label="المصري بعد التحويل لليبي"
          value={egyptianEquivalentLyd === null ? 'أدخل سعر اليوم' : money(egyptianEquivalentLyd, 'lyd')}
        />
        <MainMetric
          icon={<WalletCards />}
          label="النتيجة النهائية اليوم"
          value={netPositionLyd === null
            ? 'أدخل سعر اليوم'
            : `${netPositionLyd >= 0 ? 'لك' : 'عليك'} ${money(Math.abs(netPositionLyd), 'lyd')}`}
          negative={netPositionLyd !== null && netPositionLyd < 0}
          highlight
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">سجل النتائج اليومية</h3>
            <p className="text-[10px] font-bold text-slate-500">كل يوم صف مستقل — الأحدث ظاهر أولًا</p>
          </div>
          <span className="rounded-lg bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-800">
            {snapshots.length} يوم
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-[11px]">
            <thead className="bg-emerald-950 text-white">
              <tr>
                {[
                  'ت',
                  'التاريخ',
                  'إيجابيات الخزينة',
                  'الالتزامات علينا',
                  'صافي المصري',
                  'سعر الصرف',
                  'المصري بالليبي',
                  'إجمالي ما لنا',
                  'النتيجة النهائية',
                ].map((header) => (
                  <th key={header} className="border border-emerald-900 px-3 py-2 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot, index) => (
                <tr
                  key={snapshot.id}
                  className={`border-b ${
                    snapshot.netPositionLyd >= 0
                      ? 'bg-emerald-50/60'
                      : 'bg-rose-50/70'
                  }`}
                >
                  <td className="px-3 py-2 text-center font-mono font-black">{snapshots.length - index}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center font-mono font-black">{snapshot.date}</td>
                  <td className="px-3 py-2 text-center font-mono font-black">{money(snapshot.treasuryPositivesLyd, 'lyd')}</td>
                  <td className="px-3 py-2 text-center font-mono font-black text-rose-700">{money(snapshot.treasuryObligationsLyd, 'lyd')}</td>
                  <td className="px-3 py-2 text-center font-mono font-black">{money(snapshot.netEgyptianPositionEgp, 'egp')}</td>
                  <td className="px-3 py-2 text-center font-mono font-black">{rateLabel(snapshot.egpPerLyd)}</td>
                  <td className="px-3 py-2 text-center font-mono font-black">{money(snapshot.egyptianEquivalentLyd, 'lyd')}</td>
                  <td className="px-3 py-2 text-center font-mono font-black">{money(snapshot.totalOwnedLyd, 'lyd')}</td>
                  <td className={`px-3 py-2 text-center font-mono text-sm font-black ${
                    snapshot.netPositionLyd >= 0 ? 'text-emerald-800' : 'text-rose-800'
                  }`}>
                    {snapshot.netPositionLyd >= 0 ? 'لك' : 'عليك'} {money(Math.abs(snapshot.netPositionLyd), 'lyd')}
                  </td>
                </tr>
              ))}
              {!snapshots.length && (
                <tr>
                  <td colSpan={9} className="p-12 text-center font-bold text-slate-400">
                    لا توجد نتيجة محفوظة بعد. أدخل سعر اليوم ثم اضغط «تسجيل نتيجة اليوم».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  note,
  highlight = false,
  negative = false,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${
      negative
        ? 'border-rose-200 bg-rose-50 text-rose-950'
        : highlight
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
          : 'border-slate-200 bg-slate-50 text-slate-900'
    }`}>
      <span className="block text-[9px] font-black opacity-65">{label}</span>
      <strong className="mt-1 block font-mono text-sm font-black">{value}</strong>
      {note && <span className="mt-0.5 block text-[8px] font-bold opacity-70">{note}</span>}
    </div>
  );
}

function MainMetric({
  icon,
  label,
  value,
  negative = false,
  highlight = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex min-h-24 items-center gap-3 rounded-2xl border p-3 shadow-sm ${
      negative
        ? 'border-rose-300 bg-rose-950 text-white'
        : highlight
          ? 'border-emerald-300 bg-emerald-950 text-white'
          : 'border-emerald-300 bg-white text-slate-950'
    }`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        negative || highlight ? 'bg-white/10' : 'bg-emerald-100 text-emerald-800'
      } [&_svg]:h-5 [&_svg]:w-5`}>
        {icon}
      </span>
      <div className="min-w-0">
        <span className="block truncate text-[9px] font-black opacity-65">{label}</span>
        <strong className="mt-1 block truncate font-mono text-sm font-black sm:text-base" title={value}>{value}</strong>
      </div>
    </div>
  );
}
