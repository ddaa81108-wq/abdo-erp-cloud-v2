import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Landmark,
  RefreshCw,
  Scale,
  WalletCards,
} from 'lucide-react';
import type { ERPState } from '../types';
import {
  calculateDailyFinancialReport,
  reportDayKey,
  resolveFinancialReportRate,
} from '../domain/financialReports';

interface FinancialReportsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
}

const localToday = () => reportDayKey(new Date());

const shiftDay = (day: string, amount: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return reportDayKey(date);
};

const integer = (value: number) => Math.trunc(Number.isFinite(value) ? value : 0);

const formatNumber = (value: number) =>
  integer(value).toLocaleString('en-US');

const money = (value: number, currency: 'lyd' | 'egp') =>
  `${formatNumber(value)} ${currency === 'lyd' ? 'د.ل' : 'ج.م'}`;

export default function FinancialReportsModule({
  state,
  onUpdateState,
}: FinancialReportsModuleProps) {
  const [selectedDay, setSelectedDay] = useState(localToday);
  const savedRate = resolveFinancialReportRate(
    state.financialReportRates || [],
    selectedDay,
  );
  const [rateInput, setRateInput] = useState(
    savedRate > 0 ? String(savedRate) : '',
  );
  const typedRate = Number(rateInput);
  const effectiveRate = Number.isFinite(typedRate) && typedRate > 0
    ? typedRate
    : undefined;

  useEffect(() => {
    const nextRate = resolveFinancialReportRate(
      state.financialReportRates || [],
      selectedDay,
    );
    setRateInput(nextRate > 0 ? String(nextRate) : '');
  }, [selectedDay, state.financialReportRates]);

  const report = useMemo(
    () => calculateDailyFinancialReport(state, selectedDay, effectiveRate),
    [state, selectedDay, effectiveRate],
  );

  const saveRate = () => {
    if (!effectiveRate) return;
    const now = new Date().toISOString();
    const current = state.financialReportRates || [];
    const exact = current.find((item) => item.date === selectedDay);
    const nextRates = exact
      ? current.map((item) =>
          item.date === selectedDay
            ? { ...item, egpPerLyd: effectiveRate, updatedAt: now }
            : item)
      : [
          ...current,
          {
            id: `financial_rate_${selectedDay}`,
            date: selectedDay,
            egpPerLyd: effectiveRate,
            updatedAt: now,
          },
        ];
    if (
      exact?.egpPerLyd === effectiveRate
      && state.financialReportRates?.length === nextRates.length
    ) return;
    onUpdateState({ ...state, financialReportRates: nextRates });
  };

  const { movement, position } = report;
  const isPositive = (position.netPositionLyd || 0) >= 0;

  return (
    <div className="space-y-3 text-right animate-fadeIn" dir="rtl">
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950 text-white">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900">التقرير المالي اليومي</h2>
            <p className="text-[10px] font-bold text-slate-500">الأرقام محسوبة مباشرة من سجلات الأقسام</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3">
            <CircleDollarSign className="h-4 w-4 text-amber-700" />
            <span className="whitespace-nowrap text-[10px] font-black text-amber-900">1 د.ل =</span>
            <input
              value={rateInput}
              onChange={(event) => setRateInput(event.target.value)}
              onBlur={saveRate}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }
              }}
              inputMode="decimal"
              placeholder="سعر الصرف"
              className="w-24 bg-transparent text-center font-mono text-sm font-black text-amber-950 outline-none"
            />
            <span className="text-[10px] font-black text-amber-900">ج.م</span>
          </label>

          <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setSelectedDay((day) => shiftDay(day, -1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-white hover:shadow-sm"
              aria-label="اليوم السابق"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <label className="flex items-center gap-2 px-2">
              <CalendarDays className="h-4 w-4 text-emerald-800" />
              <input
                type="date"
                value={selectedDay}
                onChange={(event) => setSelectedDay(event.target.value)}
                className="bg-transparent font-mono text-xs font-black text-slate-800 outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setSelectedDay((day) => shiftDay(day, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-white hover:shadow-sm"
              aria-label="اليوم التالي"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ReportSection
        title="حركة اليوم"
        icon={<RefreshCw className="h-4 w-4" />}
      >
        <Metric label="ديون عملاء مضافة" value={money(movement.customerDebtsAddedLyd, 'lyd')} />
        <Metric label="تحصيلات العملاء" value={money(movement.customerPaymentsLyd, 'lyd')} tone="positive" />
        <Metric label="ديون شركات وتجار" value={money(movement.businessDebtsAddedLyd, 'lyd')} />
        <Metric label="تحصيلات الشركات والتجار" value={money(movement.businessPaymentsLyd, 'lyd')} tone="positive" />
        <Metric label="مشتريات اليوم" value={money(movement.purchaseWorkLyd, 'lyd')} tone="negative" />
        <Metric label="المسدد للمشتريات" value={money(movement.purchasePaidLyd, 'lyd')} />
        <Metric label="شغل البيان" value={money(movement.baqyWorkLyd, 'lyd')} />
        <Metric label="شغل سمسم" value={money(movement.semsemWorkLyd, 'lyd')} />
        <Metric label="أمانات داخلة ليبي" value={money(movement.trustDepositsLyd, 'lyd')} />
        <Metric label="أمانات خارجة ليبي" value={money(movement.trustWithdrawalsLyd, 'lyd')} />
        <Metric label="إيداع الخزينة" value={money(movement.treasuryDepositsLyd, 'lyd')} tone="positive" />
        <Metric label="سحب الخزينة" value={money(movement.treasuryWithdrawalsLyd, 'lyd')} tone="negative" />
        <Metric label="المستلم بالمصراوية" value={money(movement.egyptianReceivedEgp, 'egp')} />
        <Metric label="شغل المصراوية" value={money(movement.egyptianWorkEgp, 'egp')} />
        <Metric label="أمانات داخلة مصري" value={money(movement.trustDepositsEgp, 'egp')} />
        <Metric label="أمانات خارجة مصري" value={money(movement.trustWithdrawalsEgp, 'egp')} />
      </ReportSection>

      <ReportSection
        title="المركز المالي في نهاية اليوم"
        icon={<Landmark className="h-4 w-4" />}
      >
        <Metric label="الرصيد النشط بالخزينة" value={money(position.activeCashLyd, 'lyd')} />
        <Metric label="رصيد ديون العملاء" value={money(position.customerBalanceLyd, 'lyd')} signed />
        <Metric label="رصيد الشركات والتجار" value={money(position.businessBalanceLyd, 'lyd')} signed />
        <Metric label="التزامات المشتريات" value={money(position.purchaseDebtLyd, 'lyd')} signed invertSign />
        <Metric label="الأمانات الليبية" value={money(position.trustBalanceLyd, 'lyd')} signed invertSign />
        <Metric label="باقي المصراوية" value={money(position.egyptianRemainderEgp, 'egp')} signed />
        <Metric label="متبقي فودافون" value={money(position.vodafoneRemainderEgp, 'egp')} signed />
        <Metric label="الأمانات المصرية" value={money(position.trustBalanceEgp, 'egp')} signed invertSign />
        <Metric label="صافي المصري" value={money(position.netEgyptianPositionEgp, 'egp')} signed />
        <Metric
          label="قيمة صافي المصري بالليبي"
          value={position.conversionReady ? money(position.egyptianPositionLyd, 'lyd') : 'أدخل سعر الصرف'}
          signed
        />
      </ReportSection>

      <div className={`grid gap-2 rounded-2xl border p-3 shadow-sm sm:grid-cols-[1fr_auto] ${
        !position.conversionReady
          ? 'border-amber-300 bg-amber-50'
          : isPositive
            ? 'border-emerald-300 bg-emerald-950 text-white'
            : 'border-rose-300 bg-rose-950 text-white'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            position.conversionReady ? 'bg-white/10' : 'bg-amber-100 text-amber-800'
          }`}>
            <WalletCards className="h-6 w-6" />
          </div>
          <div>
            <p className={`text-[10px] font-black ${
              position.conversionReady ? 'text-white/65' : 'text-amber-800'
            }`}>
              النتيجة النهائية حتى نهاية {selectedDay}
            </p>
            <p className={`text-xl font-black ${
              position.conversionReady ? '' : 'text-amber-950'
            }`}>
              {!position.conversionReady
                ? 'أدخل سعر الصرف لإكمال النتيجة'
                : `${isPositive ? 'ليك' : 'عليك'} ${money(Math.abs(position.netPositionLyd || 0), 'lyd')}`}
            </p>
          </div>
        </div>

        <div className={`flex min-w-48 flex-col justify-center rounded-xl px-4 py-2 ${
          position.conversionReady ? 'bg-white/10' : 'bg-white'
        }`}>
          <span className={`text-[10px] font-black ${
            position.conversionReady ? 'text-white/65' : 'text-slate-500'
          }`}>
            فرق المركز عن أمس
          </span>
          <span className={`font-mono text-base font-black ${
            position.conversionReady
              ? 'text-white'
              : 'text-slate-900'
          }`}>
            {report.positionChangeLyd === null
              ? 'غير مكتمل'
              : `${report.positionChangeLyd >= 0 ? '+' : '-'} ${money(Math.abs(report.positionChangeLyd), 'lyd')}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function ReportSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="mb-2 flex items-center gap-2 px-1 text-xs font-black text-slate-800">
        <span className="text-emerald-800">{icon}</span>
        {title}
      </div>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4 xl:grid-cols-5">
        {children}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
  signed = false,
  invertSign = false,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
  signed?: boolean;
  invertSign?: boolean;
}) {
  const parsed = Number(value.replace(/[^0-9.-]/g, '').replace(/,/g, '')) || 0;
  const signValue = invertSign ? -parsed : parsed;
  const resolvedTone = signed
    ? signValue > 0
      ? 'positive'
      : signValue < 0
        ? 'negative'
        : 'neutral'
    : tone;
  const classes = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-900',
    positive: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    negative: 'border-rose-200 bg-rose-50 text-rose-950',
  }[resolvedTone];

  return (
    <div className={`min-w-0 rounded-xl border px-2.5 py-2 ${classes}`}>
      <p className="truncate text-[9px] font-black opacity-65" title={label}>{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs font-black sm:text-sm" title={value}>{value}</p>
    </div>
  );
}
