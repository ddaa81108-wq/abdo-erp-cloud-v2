import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Minus,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import type { ERPState, TreasuryTransaction } from '../types';
import {
  calculateTreasurySummary,
  manualTreasuryTransactions,
} from '../domain/treasurySummary';
import { useAutoScrollToLatest } from '../utils/useAutoScrollToLatest';

interface TreasuryModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: unknown,
    headers: string[],
    rows: unknown[][],
  ) => void;
}

type MovementMode = 'deposit' | 'withdraw';

const integer = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

const money = (value: number) =>
  `${integer(value).toLocaleString('en-US')} د.ل`;

const localDateTimeInput = (value = new Date()) =>
  new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);

const uid = () =>
  `treasury_manual_${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

export default function TreasuryModule({
  state,
  onUpdateState,
}: TreasuryModuleProps) {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [movementMode, setMovementMode] = useState<MovementMode | null>(null);
  const [editing, setEditing] = useState<TreasuryTransaction | null>(null);
  const [deleting, setDeleting] = useState<TreasuryTransaction | null>(null);
  const [amount, setAmount] = useState('');
  const [actorName, setActorName] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(localDateTimeInput());
  const [message, setMessage] = useState('');

  // One-time reset requested for the old experimental treasury ledger.
  useEffect(() => {
    if ((state.treasuryLedgerVersion || 0) >= 1) return;
    const cleanState: ERPState = {
      ...state,
      treasuryTransactions: [],
      treasuryLedgerVersion: 1,
    };
    stateRef.current = cleanState;
    onUpdateState(cleanState);
  }, [state.treasuryLedgerVersion]);

  const summary = useMemo(() => calculateTreasurySummary(state), [state]);
  const transactions = useMemo(
    () =>
      manualTreasuryTransactions(state)
        .filter((transaction) => !transaction.isDeleted)
        .sort(
          (left, right) =>
            new Date(left.date).getTime() - new Date(right.date).getTime(),
        ),
    [state],
  );

  const rowsWithBalance = useMemo(() => {
    let runningBalance = 0;
    return transactions.map((transaction, index) => {
      const value = integer(transaction.amount);
      runningBalance += transaction.type === 'in' ? value : -value;
      return { transaction, sequence: index + 1, runningBalance };
    });
  }, [transactions]);
  const ledgerScrollRef = useAutoScrollToLatest<HTMLDivElement>(
    'treasury-ledger',
    rowsWithBalance.at(-1)?.transaction.id,
  );

  const toast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3000);
  };

  const resetForm = () => {
    setMovementMode(null);
    setEditing(null);
    setAmount('');
    setActorName('');
    setNote('');
    setDate(localDateTimeInput());
  };

  const openMovement = (mode: MovementMode) => {
    resetForm();
    setMovementMode(mode);
  };

  const openEdit = (transaction: TreasuryTransaction) => {
    setEditing(transaction);
    setMovementMode(transaction.type === 'in' ? 'deposit' : 'withdraw');
    setAmount(String(integer(transaction.amount)));
    setActorName(
      transaction.actorName
      || transaction.description.match(/\[(?:المودع|الساحب):\s*(.*?)\]/)?.[1]
      || '',
    );
    setNote(
      transaction.note
      || transaction.description.replace(/\[.*?\]\s*/, '')
      || '',
    );
    setDate(localDateTimeInput(new Date(transaction.date)));
  };

  const saveMovement = (event: React.FormEvent) => {
    event.preventDefault();
    if (!movementMode) return;
    const cleanAmount = integer(amount);
    const cleanActor = actorName.trim();
    const cleanNote = note.trim();
    if (cleanAmount <= 0 || !cleanActor || !date) {
      toast('أكمل المبلغ الصحيح واسم المنفذ والتاريخ.');
      return;
    }

    const current = stateRef.current;
    const now = new Date().toISOString();
    const type = movementMode === 'deposit' ? 'in' : 'out';
    const source = movementMode === 'deposit'
      ? 'manual_deposit' as const
      : 'manual_withdraw' as const;
    const transaction: TreasuryTransaction = {
      id: editing?.id || uid(),
      type,
      amount: cleanAmount,
      currency: 'د.ل',
      conversionRate: 1,
      source,
      referenceNo: editing?.referenceNo
        || `TR-${type === 'in' ? 'IN' : 'OUT'}-${Date.now()}`,
      description:
        `[${type === 'in' ? 'المودع' : 'الساحب'}: ${cleanActor}] ${cleanNote}`.trim(),
      actorName: cleanActor,
      note: cleanNote,
      date: new Date(date).toISOString(),
      createdAt: editing?.createdAt || now,
      updatedAt: editing ? now : undefined,
    };

    const currentTransactions = manualTreasuryTransactions(current);
    const nextTransactions = editing
      ? currentTransactions.map((item) =>
          item.id === editing.id ? transaction : item)
      : [...currentTransactions, transaction];
    const nextState = {
      ...current,
      treasuryTransactions: nextTransactions,
      treasuryLedgerVersion: 1,
    };
    stateRef.current = nextState;
    onUpdateState(nextState);
    resetForm();
    toast(editing ? 'تم تعديل الحركة وتحديث الرصيد النشط.' : 'تم حفظ الحركة في سجل الرصيد النشط.');
  };

  const confirmDelete = () => {
    if (!deleting) return;
    const current = stateRef.current;
    const now = new Date().toISOString();
    const nextState = {
      ...current,
      treasuryTransactions: manualTreasuryTransactions(current).map(
        (transaction) =>
          transaction.id === deleting.id
            ? { ...transaction, isDeleted: true, deletedAt: now, updatedAt: now }
            : transaction,
      ),
      treasuryLedgerVersion: 1,
    };
    stateRef.current = nextState;
    onUpdateState(nextState);
    setDeleting(null);
    toast('تم نقل الحركة إلى سلة المهملات وتحديث الرصيد النشط.');
  };

  return (
    <div className="space-y-3 text-right" dir="rtl">
      {message && (
        <div className="fixed right-5 top-20 z-[120] rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-2xl">
          {message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          title="إجمالي إيجابيات الخزينة"
          value={money(summary.totalPositives)}
          note="الرصيد النشط + ديون العملاء + ديون الشركات والتجار"
          icon={<Landmark />}
        />
        <SummaryCard
          title="الرصيد النشط"
          value={money(summary.activeCash)}
          note="النقد الموجود فعليًا من الحركات اليدوية"
          icon={<Wallet />}
        />
        <SummaryCard
          title="الالتزامات علينا"
          value={money(summary.totalObligations)}
          note="إجمالي الأمانات الليبي + إجمالي المشتريات"
          icon={<ArrowDownLeft />}
        />
        <SummaryCard
          title="صافي الخزينة"
          value={money(summary.netTreasury)}
          note="إجمالي الإيجابيات − الالتزامات"
          icon={<ArrowUpRight />}
          negative={summary.netTreasury < 0}
        />
        <ActionCard
          title="إيداع نقدي"
          note="إضافة إلى الرصيد النشط"
          icon={<Plus />}
          onClick={() => openMovement('deposit')}
          tone="green"
        />
        <ActionCard
          title="سحب نقدي"
          note="خصم من الرصيد النشط"
          icon={<Minus />}
          onClick={() => openMovement('withdraw')}
          tone="red"
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              سجل حركة الرصيد النشط
            </h2>
            <p className="text-[10px] font-bold text-slate-500">
              الإيداعات والسحوبات اليدوية فقط — القديم أعلى والجديد أسفل
            </p>
          </div>
          <span className={`rounded-xl px-3 py-1.5 text-xs font-black ${
            summary.activeCash < 0
              ? 'bg-rose-100 text-rose-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            الرصيد الحالي: {money(summary.activeCash)}
          </span>
        </header>

        <div ref={ledgerScrollRef} className="max-h-[68vh] overflow-auto">
          <table className="treasury-ledger-table min-w-[1050px] w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr>
                {[
                  'ت',
                  'التاريخ',
                  'نوع الحركة',
                  'اسم المنفذ',
                  'البيان',
                  'إيداع',
                  'سحب',
                  'الرصيد بعد الحركة',
                  'تعديل',
                  'مسح',
                ].map((header) => (
                  <th key={header} className="border border-emerald-950 px-2 py-1.5 font-black">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsWithBalance.map(({ transaction, sequence, runningBalance }) => {
                const inbound = transaction.type === 'in';
                return (
                  <tr
                    key={transaction.id}
                    className={`treasury-ledger-row ${
                      inbound
                        ? 'treasury-ledger-deposit'
                        : 'treasury-ledger-withdraw'
                    }`}
                  >
                    <td className="px-2 py-1.5 text-center font-mono font-black">{sequence}</td>
                    <td className="px-2 py-1.5 text-center font-mono">
                      {new Date(transaction.date).toLocaleString('ar-LY', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-1.5 text-center font-black">
                      {inbound ? 'إيداع' : 'سحب'}
                    </td>
                    <td className="px-2 py-1.5 font-bold">{transaction.actorName || 'غير محدد'}</td>
                    <td className="max-w-[260px] truncate px-2 py-1.5" title={transaction.note || ''}>
                      {transaction.note || '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono font-black">
                      {inbound ? money(transaction.amount) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono font-black">
                      {!inbound ? money(transaction.amount) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-center font-mono font-black">
                      {money(runningBalance)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => openEdit(transaction)}
                        className="treasury-ledger-action rounded-lg p-1"
                        aria-label="تعديل الحركة"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => setDeleting(transaction)}
                        className="treasury-ledger-action rounded-lg p-1"
                        aria-label="مسح الحركة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rowsWithBalance.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-10 text-center font-bold text-slate-400">
                    لا توجد حركات يدوية في الرصيد النشط بعد.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="treasury-ledger-total sticky bottom-0">
              <tr>
                <td colSpan={7} className="px-4 py-2 text-left font-black">
                  الرصيد النشط الحالي
                </td>
                <td colSpan={3} className="px-2 py-2 text-center font-mono text-sm font-black">
                  {money(summary.activeCash)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {movementMode && (
        <Modal
          title={editing
            ? 'تعديل حركة الرصيد النشط'
            : movementMode === 'deposit'
              ? 'إيداع نقدي بالخزينة'
              : 'سحب نقدي من الخزينة'}
          onClose={resetForm}
        >
          <form onSubmit={saveMovement} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="المبلغ">
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 text-center font-mono font-black outline-none focus:border-emerald-500"
                  autoFocus
                />
              </Field>
              <Field label="اسم المنفذ">
                <input
                  value={actorName}
                  onChange={(event) => setActorName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-emerald-500"
                />
              </Field>
            </div>
            <Field label="البيان">
              <textarea
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:border-emerald-500"
              />
            </Field>
            <Field label="التاريخ والوقت">
              <input
                type="datetime-local"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 font-mono outline-none focus:border-emerald-500"
              />
            </Field>
            <button
              type="submit"
              className={`w-full rounded-xl py-3 text-sm font-black text-white ${
                movementMode === 'deposit'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-rose-700 hover:bg-rose-800'
              }`}
            >
              {editing ? 'حفظ التعديل' : movementMode === 'deposit' ? 'تأكيد الإيداع' : 'تأكيد السحب'}
            </button>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="مسح حركة من الرصيد النشط" onClose={() => setDeleting(null)}>
          <p className="mb-4 rounded-xl bg-rose-50 p-4 text-sm font-bold leading-7 text-rose-800">
            سيتم نقل الحركة إلى سلة المهملات وإعادة حساب الرصيد النشط والسجل فورًا.
          </p>
          <button
            type="button"
            onClick={confirmDelete}
            className="w-full rounded-xl bg-rose-700 py-3 text-sm font-black text-white"
          >
            تأكيد المسح
          </button>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  note,
  icon,
  negative = false,
}: {
  title: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <article className={`flex min-h-[118px] flex-col justify-between rounded-2xl border p-3 text-white shadow-md ${
      negative
        ? 'border-rose-500 bg-rose-700'
        : 'border-emerald-600 bg-emerald-700'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-black leading-5">{title}</span>
        <span className="rounded-xl bg-white/15 p-1.5 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      </div>
      <strong className="font-mono text-xl font-black">{value}</strong>
      <span className="text-[9px] font-bold leading-4 text-white/75">{note}</span>
    </article>
  );
}

function ActionCard({
  title,
  note,
  icon,
  onClick,
  tone,
}: {
  title: string;
  note: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone: 'green' | 'red';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[118px] flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-white p-3 text-center shadow-md transition hover:-translate-y-0.5 ${
        tone === 'green'
          ? 'border-emerald-500 text-emerald-800 hover:bg-emerald-50'
          : 'border-rose-500 text-rose-800 hover:bg-rose-50'
      }`}
    >
      <span className={`rounded-full border-2 p-2 [&>svg]:h-5 [&>svg]:w-5 ${
        tone === 'green' ? 'border-emerald-500' : 'border-rose-500'
      }`}>
        {icon}
      </span>
      <strong className="text-sm font-black">{title}</strong>
      <span className="text-[9px] font-bold opacity-70">{note}</span>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Modal({
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
      <section className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
