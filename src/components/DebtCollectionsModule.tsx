import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Check,
  CheckCircle2,
  Clock3,
  Coins,
  Phone,
  RefreshCw,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import type {
  DebtCollectionAssignment,
  DebtCollectorWithdrawal,
  ERPState,
  User,
} from '../types';
import {
  activeCollectionAssignments,
  activeCollectionReceipts,
  approveCollectionReceipt,
  assignmentReceiptSummary,
  clearCollectorBatch,
  collectionTotal,
  payrollForMonth,
  payrollSummary,
  recordCollectionReceipt,
  rejectCollectionReceipt,
} from '../domain/debtCollections';

interface Props {
  state: ERPState;
  currentUser: User;
  onUpdateState: (newState: ERPState) => void;
}

const money = (value: number) => `${Math.round(value).toLocaleString('en-US')} د.ل`;
const uid = (prefix: string) =>
  `${prefix}_${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

function cardStyle(remaining: number, pending: number, collected: number) {
  if (remaining <= 0) return 'border-emerald-400 from-emerald-600 to-emerald-950';
  if (pending > 0) return 'border-amber-400 from-amber-500 to-orange-900';
  if (collected > 0) return 'border-cyan-400 from-cyan-700 to-indigo-950';
  return 'border-indigo-400 from-indigo-700 to-slate-950';
}

export default function DebtCollectionsModule({ state, currentUser, onUpdateState }: Props) {
  const isAdmin = currentUser.role === 'admin';
  const collectors = useMemo(
    () => isAdmin
      ? (state.users || []).filter((user) =>
          user.role !== 'admin'
          && user.isActive !== false
          && user.permissions?.canViewDebtCollections === true)
      : [currentUser],
    [currentUser, isAdmin, state.users],
  );
  const [collectorId, setCollectorId] = useState(
    isAdmin ? collectors[0]?.id || '' : currentUser.id,
  );
  const [tab, setTab] = useState<'collections' | 'salary'>('collections');
  const [partialAssignment, setPartialAssignment] = useState<DebtCollectionAssignment | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [salaryValue, setSalaryValue] = useState('3500');
  const [withdrawalValue, setWithdrawalValue] = useState('');
  const [withdrawalNote, setWithdrawalNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!collectorId && collectors[0]) setCollectorId(collectors[0].id);
    if (collectorId && !collectors.some((user) => user.id === collectorId)) {
      setCollectorId(collectors[0]?.id || '');
    }
  }, [collectorId, collectors]);

  const collector = collectors.find((user) => user.id === collectorId);
  const assignments = collector ? activeCollectionAssignments(state, collector.id) : [];
  const receipts = collector ? activeCollectionReceipts(state, collector.id) : [];
  const pendingReceipts = receipts.filter((receipt) => receipt.status === 'pending');
  const month = new Date().toISOString().slice(0, 7);
  const payroll = collector ? payrollForMonth(state, collector, month) : null;
  const withdrawals = collector
    ? (state.debtCollectorWithdrawals || []).filter((item) =>
        !item.isDeleted
        && item.collectorUserId === collector.id
        && item.month === month)
    : [];
  const salarySummary = payroll ? payrollSummary(payroll, withdrawals) : null;

  useEffect(() => {
    if (payroll) setSalaryValue(String(payroll.salary));
  }, [payroll?.id, payroll?.salary]);

  const toast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const run = (operation: () => ERPState, success: string) => {
    try {
      onUpdateState(operation());
      toast(success);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر إتمام العملية.');
    }
  };

  const recordPartial = (event: React.FormEvent) => {
    event.preventDefault();
    if (!partialAssignment) return;
    const amount = Number(partialAmount);
    try {
      onUpdateState(recordCollectionReceipt(
        state,
        partialAssignment.id,
        'partial',
        amount,
      ));
      setPartialAssignment(null);
      setPartialAmount('');
      toast('تم تسجيل التسديد الجزئي وأصبح بانتظار مراجعة المدير.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر تسجيل العملية.');
    }
  };

  const saveSalary = () => {
    if (!isAdmin || !collector || !payroll) return;
    const salary = Number(salaryValue);
    if (!Number.isFinite(salary) || salary < 0) return toast('أدخل راتبًا صحيحًا.');
    const now = new Date().toISOString();
    const exists = (state.debtCollectorPayrolls || []).some((item) => item.id === payroll.id);
    onUpdateState({
      ...state,
      debtCollectorPayrolls: exists
        ? (state.debtCollectorPayrolls || []).map((item) =>
            item.id === payroll.id
              ? { ...item, salary, collectorName: collector.name, updatedAt: now }
              : item)
        : [...(state.debtCollectorPayrolls || []), { ...payroll, salary, updatedAt: now }],
    });
    toast('تم حفظ راتب الشهر.');
  };

  const addWithdrawal = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !collector) return;
    const amount = Number(withdrawalValue);
    if (!Number.isFinite(amount) || amount <= 0) return toast('أدخل قيمة سحب صحيحة.');
    const now = new Date().toISOString();
    const withdrawal: DebtCollectorWithdrawal = {
      id: uid('collector_withdrawal'),
      collectorUserId: collector.id,
      month,
      amount,
      note: withdrawalNote.trim(),
      date: now,
      createdAt: now,
      updatedAt: now,
    };
    onUpdateState({
      ...state,
      debtCollectorWithdrawals: [...(state.debtCollectorWithdrawals || []), withdrawal],
    });
    setWithdrawalValue('');
    setWithdrawalNote('');
    toast('تم تسجيل السحب من الراتب.');
  };

  return (
    <div dir="rtl" className="space-y-4 text-right">
      {message && (
        <div className="fixed left-1/2 top-5 z-[120] w-[min(92vw,560px)] -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-black text-white shadow-2xl">
          {message}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">استلامات الديون من العملاء</h2>
            <p className="mt-1 text-[11px] font-bold text-slate-500">التحصيل لا يغيّر حساب العميل إلا بعد اعتماد المدير.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <select value={collectorId} onChange={(event) => setCollectorId(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black">
                <option value="">اختر الموظف</option>
                {collectors.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            )}
            <TabButton active={tab === 'collections'} onClick={() => setTab('collections')}>كروت التحصيل</TabButton>
            <TabButton active={tab === 'salary'} onClick={() => setTab('salary')}>الراتب والسحوبات</TabButton>
          </div>
        </div>
      </section>

      {!collector ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-10 text-center text-sm font-black text-amber-800">
          لا يوجد موظف نشط لديه صلاحية هذا القسم حتى الآن.
        </div>
      ) : tab === 'collections' ? (
        <>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <SummaryCard icon={<WalletCards />} label="إجمالي ما تم تحصيله" value={money(collectionTotal(state, collector.id))} />
            <SummaryCard icon={<UserRound />} label="عدد العملاء" value={String(assignments.length)} />
            <SummaryCard icon={<Clock3 />} label="بانتظار المراجعة" value={String(pendingReceipts.length)} />
            <SummaryCard icon={<CheckCircle2 />} label="عمليات معتمدة" value={String(receipts.filter((item) => item.status === 'approved').length)} />
          </section>

          {isAdmin && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <strong className="text-sm text-slate-900">مراجعة المدير</strong>
                  <p className="text-[10px] text-slate-500">الاعتماد وحده يرحّل السداد إلى حساب العميل الأصلي.</p>
                </div>
                <button
                  onClick={() => run(
                    () => clearCollectorBatch(state, collector.id),
                    'تم تصفير القسم وبدء دورة جديدة دون المساس بحسابات العملاء أو الراتب.',
                  )}
                  className="flex items-center gap-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white"
                >
                  <Trash2 className="h-4 w-4" /> مسح الكل
                </button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {pendingReceipts.map((receipt) => (
                  <div key={receipt.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-sm text-slate-900">{receipt.customerName}</strong>
                        <p className="mt-1 text-xs font-black text-amber-800">{money(receipt.amount)} — {receipt.mode === 'full' ? 'تسديد كلي' : 'تسديد جزئي'}</p>
                      </div>
                      <span className="text-[9px] text-slate-500">{new Date(receipt.createdAt).toLocaleString('ar-LY')}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button onClick={() => run(() => approveCollectionReceipt(state, receipt.id, currentUser), 'تم اعتماد التحصيل وتحديث حساب العميل مرة واحدة.')} className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-xs font-black text-white"><Check className="h-4 w-4" /> اعتماد</button>
                      <button onClick={() => run(() => rejectCollectionReceipt(state, receipt.id, currentUser), 'تم رفض العملية ولم تتأثر ديون العميل.')} className="flex items-center justify-center gap-1 rounded-lg bg-white py-2 text-xs font-black text-rose-600"><X className="h-4 w-4" /> رفض</button>
                    </div>
                  </div>
                ))}
                {!pendingReceipts.length && <div className="rounded-xl bg-slate-50 p-5 text-center text-xs font-bold text-slate-400">لا توجد عمليات معلقة للمراجعة.</div>}
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {assignments.map((assignment) => {
              const summary = assignmentReceiptSummary(assignment, receipts);
              return (
                <article key={assignment.id} className={`min-h-56 rounded-3xl border bg-gradient-to-br p-4 text-white shadow-xl ${cardStyle(summary.displayedRemaining, summary.pending, summary.approved)}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="block text-base font-black">{assignment.customerName}</strong>
                      <span className="mt-1 block text-[10px] text-white/70">الدين الحالي</span>
                    </div>
                    {summary.hasPending && <span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-black">بانتظار المراجعة</span>}
                  </div>
                  <div className="my-5 text-center">
                    <strong className="text-3xl font-black">{money(summary.displayedRemaining)}</strong>
                    {summary.totalCollected > 0 && <p className="mt-2 text-xs font-bold text-white/80">تم استلام {money(summary.totalCollected)}</p>}
                  </div>
                  {!isAdmin ? (
                    <div className="mt-auto grid grid-cols-3 gap-2">
                      <button disabled={summary.hasPending || assignment.currentDebt <= 0} onClick={() => run(() => recordCollectionReceipt(state, assignment.id, 'full'), 'تم تسجيل التسديد الكلي وأصبح بانتظار مراجعة المدير.')} className="rounded-xl bg-white/95 px-2 py-2.5 text-[10px] font-black text-emerald-800 disabled:opacity-40">تسديد كلي</button>
                      <button disabled={summary.hasPending || assignment.currentDebt <= 0} onClick={() => { setPartialAssignment(assignment); setPartialAmount(''); }} className="rounded-xl bg-white/95 px-2 py-2.5 text-[10px] font-black text-indigo-800 disabled:opacity-40">تسديد جزئي</button>
                      <a href={assignment.phone ? `tel:${assignment.phone}` : undefined} onClick={(event) => { if (!assignment.phone) { event.preventDefault(); toast('لا يوجد رقم هاتف مسجل لهذا العميل.'); } }} className={`flex items-center justify-center gap-1 rounded-xl bg-white/95 px-2 py-2.5 text-[10px] font-black text-slate-800 ${assignment.phone ? '' : 'opacity-40'}`}><Phone className="h-3.5 w-3.5" /> اتصال</a>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-white/10 p-2 text-center text-[10px] font-bold">{assignment.phone || 'لا يوجد رقم هاتف'}</p>
                  )}
                </article>
              );
            })}
            {!assignments.length && <div className="col-span-full rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm font-black text-slate-400">لم يرسل المدير أي كروت لهذه الدورة.</div>}
          </section>
        </>
      ) : (
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SummaryCard icon={<Banknote />} label="راتب الشهر" value={money(payroll?.salary || 0)} />
            <SummaryCard icon={<Coins />} label="المسحوبات" value={money(salarySummary?.withdrawn || 0)} />
            <SummaryCard icon={<RefreshCw />} label="المتبقي" value={money(salarySummary?.remaining || 0)} negative={(salarySummary?.remaining || 0) < 0} />
          </div>
          {isAdmin && (
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-black text-slate-700">راتب الشهر</label>
                <div className="flex gap-2">
                  <input type="number" min="0" value={salaryValue} onChange={(event) => setSalaryValue(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 font-black" />
                  <button onClick={saveSalary} className="rounded-xl bg-indigo-700 px-4 py-2 text-xs font-black text-white">حفظ</button>
                </div>
              </div>
              <form onSubmit={addWithdrawal}>
                <label className="mb-1 block text-xs font-black text-slate-700">إضافة سحب</label>
                <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input type="number" min="1" value={withdrawalValue} onChange={(event) => setWithdrawalValue(event.target.value)} placeholder="القيمة" className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 font-black" />
                  <input value={withdrawalNote} onChange={(event) => setWithdrawalNote(event.target.value)} placeholder="البيان" className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-xs" />
                  <button className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white">إضافة</button>
                </div>
              </form>
            </div>
          )}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[auto_1fr_auto] bg-slate-900 px-4 py-3 text-xs font-black text-white"><span>التاريخ</span><span className="px-4">البيان</span><span>القيمة</span></div>
            {withdrawals.slice().sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
              <div key={item.id} className="grid grid-cols-[auto_1fr_auto] border-t border-slate-100 px-4 py-3 text-xs"><span>{new Date(item.date).toLocaleDateString('ar-LY')}</span><span className="px-4 font-bold">{item.note || 'سحب من الراتب'}</span><strong className="text-rose-700">{money(item.amount)}</strong></div>
            ))}
            {!withdrawals.length && <div className="p-8 text-center text-xs font-bold text-slate-400">لا توجد سحوبات في هذا الشهر.</div>}
          </div>
        </section>
      )}

      {partialAssignment && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4">
          <form onSubmit={recordPartial} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-black text-slate-950">تسديد جزئي — {partialAssignment.customerName}</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">الدين الحالي: {money(partialAssignment.currentDebt)}</p>
            <input autoFocus type="number" min="1" value={partialAmount} onChange={(event) => setPartialAmount(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-black" placeholder="القيمة المستلمة" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="rounded-xl bg-emerald-600 py-3 text-xs font-black text-white">تسجيل</button>
              <button type="button" onClick={() => setPartialAssignment(null)} className="rounded-xl bg-slate-100 py-3 text-xs font-black text-slate-700">إلغاء</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-xl px-4 py-2 text-xs font-black ${active ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{children}</button>;
}

function SummaryCard({ icon, label, value, negative = false }: { icon: React.ReactNode; label: string; value: string; negative?: boolean }) {
  return (
    <div className={`min-h-24 rounded-2xl border p-4 text-white shadow-lg ${negative ? 'border-rose-400 bg-gradient-to-br from-rose-600 to-rose-950' : 'border-indigo-400 bg-gradient-to-br from-indigo-700 to-slate-950'}`}>
      <div className="flex items-center gap-2 text-[10px] font-black text-white/75">{icon}<span>{label}</span></div>
      <strong className="mt-3 block text-xl font-black">{value}</strong>
    </div>
  );
}
