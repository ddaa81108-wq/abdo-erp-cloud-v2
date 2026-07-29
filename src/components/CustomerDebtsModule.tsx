import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  FileText,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserPlus,
  WalletCards,
  X,
} from 'lucide-react';
import type {
  Customer,
  CustomerCycle,
  DebtTransaction,
  ERPState,
} from '../types';
import {
  calculateActiveCycleBalance,
  customerLastActivityAt,
  cycleTransactions,
  debtAgeInDays,
  oldestOutstandingDebtDate,
  synchronizeActiveCustomerCycles,
  upsertCustomerPaymentInTreasury,
} from '../domain/customerAccounts';
import { findSimilarParties, type PartyMatch } from '../domain/partyNameMatcher';
import { copySettledImage, openSmartCardStudio } from '../utils/imageExporterUtils';
import { VoiceInputButton } from './VoiceInputButton';

interface CustomerDebtsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: any,
    headers: string[],
    rows: any[][],
    imageType?: 'full' | 'table' | 'card',
    footerMetrics?: any[],
  ) => void;
  searchQuery?: string;
  pendingDeletions?: string[];
  onScheduleDeletion?: (
    type: 'customer' | 'company' | 'merchant' | 'deposit' | 'transaction',
    itemId: string,
    displayName: string,
    executeDeletion: () => void,
  ) => void;
  onCancelDeletion?: (itemId: string) => void;
}

type AccountView = {
  customer: Customer;
  activeCycle?: CustomerCycle;
  balance: number;
  oldestDebtDate: string | null;
  debtAge: number;
  lastActivity: number;
};

type EntryMode = 'debt' | 'partial' | 'full';

const money = (value: number) =>
  `${Math.round(value).toLocaleString('en-US')} د.ل`;

const balanceLabel = (value: number) =>
  value < 0 ? `أمانة ${money(Math.abs(value))}` : money(value);

const uid = (prefix: string) =>
  `${prefix}_${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

const sourceLabel = {
  customer: 'ديون العملاء',
  business: 'الشركات والتجار',
  deposit: 'الأمانات',
};

function cardColor(age: number, balance: number) {
  if (balance <= 0) return 'from-emerald-600 to-emerald-900 border-emerald-400';
  if (age <= 2) return 'from-indigo-700 to-indigo-950 border-indigo-500';
  if (age <= 5) return 'from-amber-500 to-amber-800 border-amber-400';
  if (age <= 10) return 'from-orange-600 to-orange-900 border-orange-500';
  if (age <= 20) return 'from-rose-600 to-rose-950 border-rose-500';
  return 'from-red-700 to-red-950 border-red-500';
}

export default function CustomerDebtsModule({
  state,
  onUpdateState,
  onOpenExporter,
  searchQuery = '',
  onScheduleDeletion,
}: CustomerDebtsModuleProps) {
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [tickerIndex, setTickerIndex] = useState(0);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDebt, setNewDebt] = useState('');
  const [allowSimilarName, setAllowSimilarName] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<Customer | null>(null);

  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [editingTransaction, setEditingTransaction] = useState<DebtTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [deleteTransaction, setDeleteTransaction] = useState<DebtTransaction | null>(null);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const allAccounts = useMemo<AccountView[]>(() => {
    return (state.customers || [])
      .filter((customer) => !customer.isDeleted)
      .map((customer) => {
        const activeCycle = state.cycles.find(
          (cycle) => cycle.customerId === customer.id && cycle.status === 'active',
        );
        const balance = calculateActiveCycleBalance(activeCycle, state.debtTransactions);
        const oldestDebtDate = oldestOutstandingDebtDate(activeCycle, state.debtTransactions);
        return {
          customer,
          activeCycle,
          balance,
          oldestDebtDate,
          debtAge: debtAgeInDays(oldestDebtDate),
          lastActivity: customerLastActivityAt(customer, state.debtTransactions),
        };
      })
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }, [state.customers, state.cycles, state.debtTransactions]);

  const visibleAccounts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ar');
    return allAccounts.filter(
      (account) => !query || account.customer.name.toLocaleLowerCase('ar').includes(query),
    );
  }, [allAccounts, searchQuery]);

  const overdueAccounts = useMemo(
    () => allAccounts
      .filter((account) => account.balance > 0 && account.debtAge >= 2)
      .sort((a, b) => b.debtAge - a.debtAge || b.balance - a.balance),
    [allAccounts],
  );

  useEffect(() => {
    setTickerIndex((current) => overdueAccounts.length ? current % overdueAccounts.length : 0);
    if (overdueAccounts.length <= 1) return;
    const timer = window.setInterval(
      () => setTickerIndex((current) => (current + 1) % overdueAccounts.length),
      4000,
    );
    return () => window.clearInterval(timer);
  }, [overdueAccounts.length]);

  const selectedAccount = allAccounts.find(
    (account) => account.customer.id === selectedCustomerId,
  );

  const activeTransactions = useMemo(
    () => selectedAccount?.activeCycle
      ? cycleTransactions(state.debtTransactions, selectedAccount.activeCycle.id)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      : [],
    [selectedAccount, state.debtTransactions],
  );

  const historicalCycles = useMemo(
    () => selectedCustomerId
      ? state.cycles
          .filter(
            (cycle) =>
              cycle.customerId === selectedCustomerId &&
              cycle.status === 'closed',
          )
          .sort((a, b) =>
            new Date(b.endDate || b.startDate).getTime() -
            new Date(a.endDate || a.startDate).getTime())
      : [],
    [selectedCustomerId, state.cycles],
  );

  const similarParties = useMemo(
    () => findSimilarParties(state, newName),
    [state, newName],
  );

  const totalOutstanding = allAccounts.reduce(
    (total, account) => total + Math.max(account.balance, 0),
    0,
  );

  const toast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3200);
  };

  const commit = (
    nextTransactions: DebtTransaction[],
    nextCycles = state.cycles,
    nextCustomers = state.customers,
    nextTreasury = state.treasuryTransactions || [],
  ) => {
    const nextState = {
      ...state,
      customers: nextCustomers,
      debtTransactions: nextTransactions,
      cycles: synchronizeActiveCustomerCycles(nextCycles, nextTransactions),
      treasuryTransactions: nextTreasury,
    };
    stateRef.current = nextState;
    onUpdateState(nextState);
  };

  const resetCreate = () => {
    setNewName('');
    setNewPhone('');
    setNewDebt('');
    setAllowSimilarName(false);
    setRestoreCandidate(null);
  };

  const createOrRestoreCustomer = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = newName.trim();
    const openingDebt = Number(newDebt) || 0;
    if (!cleanName || openingDebt < 0) return;
    if (similarParties.length && !allowSimilarName && !restoreCandidate) {
      toast('راجع الأسماء المتشابهة أولًا، ثم اختر حسابًا أو أكّد إنشاء حساب جديد.');
      return;
    }
    const now = new Date().toISOString();
    const customerId = restoreCandidate?.id || uid('customer');
    const restoredActiveCycle = restoreCandidate
      ? state.cycles.find(
          (cycle) =>
            cycle.customerId === restoreCandidate.id &&
            cycle.status === 'active',
        )
      : undefined;
    const cycleId = openingDebt > 0
      ? restoredActiveCycle?.id || uid(`cycle_${customerId}`)
      : null;
    const nextCustomers = restoreCandidate
      ? state.customers.map((customer) =>
          customer.id === restoreCandidate.id
            ? {
                ...customer,
                isDeleted: false,
                phone: newPhone.trim() || customer.phone,
                updatedAt: now,
              }
            : customer)
      : [
          ...state.customers,
          {
            id: customerId,
            name: cleanName,
            phone: newPhone.trim(),
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            type: 'customer' as const,
          },
        ];
    const nextCycles = cycleId && !restoredActiveCycle
      ? [
          ...state.cycles,
          {
            id: cycleId,
            customerId,
            startDate: now,
            status: 'active' as const,
            initialBalance: 0,
            currentBalance: openingDebt,
          },
        ]
      : state.cycles;
    const nextTransactions = cycleId
      ? [
          ...state.debtTransactions,
          {
            id: uid('tx_debt'),
            customerId,
            cycleId,
            type: 'debt' as const,
            amount: openingDebt,
            currency: 'د.ل',
            conversionRate: 1,
            date: now,
            referenceNo: uid('DEBT'),
            note: restoreCandidate ? 'دين جديد بعد استرجاع الحساب' : 'الدين الأول عند إنشاء الحساب',
            postedToTreasury: false,
            createdAt: now,
          },
        ]
      : state.debtTransactions;
    commit(nextTransactions, nextCycles, nextCustomers);
    setSelectedCustomerId(customerId);
    setShowCreate(false);
    resetCreate();
    toast(restoreCandidate ? 'تم استرجاع العميل وربطه بتاريخه السابق.' : 'تم إنشاء العميل.');
  };

  const selectPartyMatch = (match: PartyMatch) => {
    if (match.source !== 'customer') {
      toast(`هذا الاسم موجود في قسم ${sourceLabel[match.source]}. يمكنك إنشاء حساب عميل مستقل بعد التأكيد.`);
      return;
    }
    const customer = state.customers.find((item) => item.id === match.id);
    if (!customer) return;
    if (!customer.isDeleted) {
      setShowCreate(false);
      resetCreate();
      setSelectedCustomerId(customer.id);
      return;
    }
    setRestoreCandidate(customer);
    setNewName(customer.name);
    setNewPhone(customer.phone || '');
    setAllowSimilarName(false);
  };

  const addLedgerEntry = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !entryMode) return;
    const now = new Date().toISOString();
    const isPayment = entryMode !== 'debt';
    const value = entryMode === 'full'
      ? selectedAccount.balance
      : Number(entryAmount);
    if (!Number.isFinite(value) || value <= 0) return;
    let cycleId = selectedAccount.activeCycle?.id;
    let nextCycles = [...state.cycles];
    if (!cycleId) {
      if (isPayment) return;
      cycleId = uid(`cycle_${selectedAccount.customer.id}`);
      nextCycles.push({
        id: cycleId,
        customerId: selectedAccount.customer.id,
        startDate: now,
        status: 'active',
        initialBalance: 0,
        currentBalance: 0,
      });
    }

    const transaction: DebtTransaction = {
      id: uid(isPayment ? 'tx_payment' : 'tx_debt'),
      customerId: selectedAccount.customer.id,
      cycleId,
      type: isPayment ? 'payment' : 'debt',
      paymentMode: isPayment
        ? value === selectedAccount.balance ? 'full' : 'partial'
        : undefined,
      amount: value,
      currency: 'د.ل',
      conversionRate: 1,
      date: now,
      referenceNo: uid(isPayment ? 'PAY' : 'DEBT'),
      note: entryNote.trim() || (
        entryMode === 'debt'
          ? 'إضافة دين'
          : entryMode === 'full'
            ? 'تسديد كلي'
            : value > selectedAccount.balance
              ? 'دفع زائد — رصيد أمانة للعميل'
              : 'دفع جزئي'
      ),
      postedToTreasury: isPayment,
      createdAt: now,
    };
    const nextTransactions = [...state.debtTransactions, transaction];
    const nextBalance = calculateActiveCycleBalance(
      nextCycles.find((cycle) => cycle.id === cycleId),
      nextTransactions,
    );
    if (nextBalance === 0) {
      nextCycles = nextCycles.map((cycle) =>
        cycle.id === cycleId
          ? { ...cycle, status: 'closed' as const, currentBalance: 0, endDate: now }
          : cycle,
      );
    }
    const nextCustomers = state.customers.map((customer) =>
      customer.id === selectedAccount.customer.id
        ? { ...customer, updatedAt: now }
        : customer,
    );
    const nextTreasury = isPayment
      ? upsertCustomerPaymentInTreasury(
          state.treasuryTransactions || [],
          transaction,
          selectedAccount.customer.name,
        )
      : state.treasuryTransactions || [];
    commit(nextTransactions, nextCycles, nextCustomers, nextTreasury);
    setEntryMode(null);
    setEntryAmount('');
    setEntryNote('');
    toast(
      isPayment && nextBalance < 0
        ? `تم تسجيل الدفع، وأصبح للعميل أمانة قدرها ${money(Math.abs(nextBalance))}.`
        : 'تم تسجيل الحركة كسطر مستقل وتحديث جميع الأرصدة.',
    );
  };

  const beginEditTransaction = (transaction: DebtTransaction) => {
    if (transaction.cycleId !== selectedAccount?.activeCycle?.id) return;
    setEditingTransaction(transaction);
    setEditAmount(String(transaction.amount));
    setEditNote(transaction.note || '');
    const date = new Date(transaction.date);
    setEditDate(new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString().slice(0, 16));
  };

  const saveTransactionEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingTransaction || !selectedAccount?.activeCycle) return;
    const value = Number(editAmount);
    if (!Number.isFinite(value) || value <= 0 || !editDate) return;
    const now = new Date().toISOString();
    const nextTransactions = state.debtTransactions.map((transaction) =>
      transaction.id === editingTransaction.id
        ? {
            ...transaction,
            amount: value,
            note: editNote.trim(),
            date: new Date(editDate).toISOString(),
            updatedAt: now,
            postedToTreasury: transaction.type === 'payment',
          }
        : transaction,
    );
    const edited = nextTransactions.find((transaction) => transaction.id === editingTransaction.id)!;
    const balance = calculateActiveCycleBalance(selectedAccount.activeCycle, nextTransactions);
    const nextCycles = state.cycles.map((cycle) =>
      cycle.id === selectedAccount.activeCycle?.id
        ? {
            ...cycle,
            currentBalance: balance,
            status: balance === 0 ? 'closed' as const : 'active' as const,
            ...(balance === 0 ? { endDate: now } : { endDate: undefined }),
          }
        : cycle,
    );
    const nextCustomers = state.customers.map((customer) =>
      customer.id === selectedAccount.customer.id ? { ...customer, updatedAt: now } : customer,
    );
    const nextTreasury = upsertCustomerPaymentInTreasury(
      state.treasuryTransactions || [],
      edited,
      selectedAccount.customer.name,
    );
    commit(nextTransactions, nextCycles, nextCustomers, nextTreasury);
    setEditingTransaction(null);
    toast('تم تعديل الحركة وإعادة حساب الرصيد والخزنة.');
  };

  const confirmDeleteTransaction = () => {
    if (!deleteTransaction || !selectedAccount?.activeCycle) return;
    const now = new Date().toISOString();
    const nextTransactions = state.debtTransactions.map((transaction) =>
      transaction.id === deleteTransaction.id
        ? { ...transaction, isDeleted: true, updatedAt: now }
        : transaction,
    );
    const deleted = nextTransactions.find((transaction) => transaction.id === deleteTransaction.id)!;
    const balance = calculateActiveCycleBalance(selectedAccount.activeCycle, nextTransactions);
    const nextCycles = state.cycles.map((cycle) =>
      cycle.id === selectedAccount.activeCycle?.id
        ? { ...cycle, currentBalance: balance }
        : cycle,
    );
    const nextCustomers = state.customers.map((customer) =>
      customer.id === selectedAccount.customer.id ? { ...customer, updatedAt: now } : customer,
    );
    const nextTreasury = upsertCustomerPaymentInTreasury(
      state.treasuryTransactions || [],
      deleted,
      selectedAccount.customer.name,
    );
    commit(nextTransactions, nextCycles, nextCustomers, nextTreasury);
    setDeleteTransaction(null);
    toast('تم مسح الحركة وإعادة حساب الرصيد والخزنة.');
  };

  const saveCustomerEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedAccount || !editName.trim()) return;
    const now = new Date().toISOString();
    const nextCustomers = state.customers.map((customer) => {
      if (customer.id !== selectedAccount.customer.id) return customer;
      const aliases = customer.name === editName.trim()
        ? customer.nameAliases || []
        : [...new Set([...(customer.nameAliases || []), customer.name])];
      return {
        ...customer,
        name: editName.trim(),
        phone: editPhone.trim(),
        nameAliases: aliases,
        updatedAt: now,
      };
    });
    commit(state.debtTransactions, state.cycles, nextCustomers);
    setShowEditCustomer(false);
    toast('تم تعديل بيانات العميل وحفظ الاسم السابق في سجل البحث.');
  };

  const archiveCustomer = (account: AccountView) => {
    const execute = () => {
      const current = stateRef.current;
      const now = new Date().toISOString();
      const nextCustomers = current.customers.map((customer) =>
        customer.id === account.customer.id
          ? { ...customer, isDeleted: true, updatedAt: now }
          : customer,
      );
      onUpdateState({ ...current, customers: nextCustomers });
      setSelectedCustomerId(null);
    };
    if (onScheduleDeletion) {
      onScheduleDeletion('customer', account.customer.id, account.customer.name, execute);
    } else {
      execute();
    }
  };

  const copyCard = async (account: AccountView) => {
    if (account.balance === 0) {
      const success = await copySettledImage(account.customer.name);
      if (success) toast('تم نسخ كارت المخالصة.');
      return;
    }
    openSmartCardStudio({
      type: account.balance < 0 ? 'trust' : 'debt',
      name: account.customer.name,
      amount: Math.abs(account.balance),
      currency: 'د.ل',
    });
  };

  const exportSelected = () => {
    const accounts = allAccounts.filter((account) =>
      selectedForExport.includes(account.customer.id));
    onOpenExporter(
      'كشف ديون العملاء المحددين',
      {
        label1: 'عدد العملاء',
        value1: accounts.length,
        label2: 'إجمالي الديون',
        value2: money(accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0)),
        label3: 'تاريخ الكشف',
        value3: new Date().toLocaleDateString('ar-LY'),
      },
      ['اسم العميل', 'الدين الفعلي'],
      accounts.map((account) => [account.customer.name, balanceLabel(account.balance)]),
    );
    setSelectionMode(false);
    setSelectedForExport([]);
  };

  const exportCustomerLedger = () => {
    if (!selectedAccount) return;
    const rows: any[][] = [];
    const customerCycles = state.cycles
      .filter((cycle) => cycle.customerId === selectedAccount.customer.id)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    customerCycles.forEach((cycle) => {
      let running = cycle.initialBalance || 0;
      cycleTransactions(state.debtTransactions, cycle.id)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((transaction) => {
          running += transaction.type === 'debt' ? transaction.amount : -transaction.amount;
          rows.push([
            cycle.status === 'active' ? 'الدورة الحالية' : 'دورة سابقة',
            new Date(transaction.date).toLocaleString('ar-LY'),
            transaction.note,
            transaction.type === 'debt' ? money(transaction.amount) : '—',
            transaction.type === 'payment' ? money(transaction.amount) : '—',
            balanceLabel(running),
          ]);
        });
    });
    onOpenExporter(
      `السجل التاريخي: ${selectedAccount.customer.name}`,
      {
        label1: 'العميل',
        value1: selectedAccount.customer.name,
        label2: 'عدد الدورات',
        value2: customerCycles.length,
        label3: selectedAccount.balance < 0 ? 'أمانة العميل' : 'الدين الحالي',
        value3: balanceLabel(selectedAccount.balance),
      },
      ['الدورة', 'التاريخ', 'البيان', 'دين مضاف', 'مدفوع', 'الإجمالي'],
      rows,
    );
  };

  const currentTicker = overdueAccounts[tickerIndex];

  return (
    <div dir="rtl" className="space-y-4 text-right">
      {message && (
        <div className="fixed left-1/2 top-5 z-[100] -translate-x-1/2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl">
          {message}
        </div>
      )}

      {!selectionMode ? (
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <TopCard icon={<WalletCards />} title="إجمالي الديون" value={money(totalOutstanding)} />
          <TopCard icon={<UserPlus />} title="إضافة عميل" value="حساب ودين جديد" onClick={() => setShowCreate(true)} />
          <button
            onClick={() => currentTicker && setSelectedCustomerId(currentTicker.customer.id)}
            className="min-h-24 overflow-hidden rounded-2xl border border-indigo-600 bg-gradient-to-l from-indigo-800 to-indigo-950 p-4 text-right text-white shadow-lg transition hover:-translate-y-0.5"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-100">
                <AlertTriangle className="h-4 w-4 text-amber-300" /> تنبيه الديون المتأخرة
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px]">{overdueAccounts.length}</span>
            </div>
            {currentTicker ? (
              <div key={currentTicker.customer.id}>
                <strong className="block truncate text-sm">{currentTicker.customer.name}</strong>
                <div className="mt-1 flex justify-between text-[10px] text-indigo-100">
                  <span>{money(currentTicker.balance)}</span>
                  <span>متأخر {currentTicker.debtAge} يوم</span>
                </div>
              </div>
            ) : (
              <span className="text-xs text-indigo-100">لا توجد ديون تجاوزت يومين</span>
            )}
          </button>
          <TopCard icon={<Send />} title="وضع الإرسال" value="تحديد وتصدير" onClick={() => setSelectionMode(true)} />
        </section>
      ) : (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <div>
            <strong className="text-sm text-indigo-900">وضع الإرسال</strong>
            <p className="text-xs text-indigo-600">تم تحديد {selectedForExport.length} عميل</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setSelectionMode(false); setSelectedForExport([]); }} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-600">إلغاء</button>
            <button disabled={!selectedForExport.length} onClick={exportSelected} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">تصدير المحدد</button>
          </div>
        </section>
      )}

      <section className="max-h-[68vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9">
          {visibleAccounts.map((account) => {
            const selectedForSend = selectedForExport.includes(account.customer.id);
            return (
              <div
                key={account.customer.id}
                onClick={() => {
                  if (selectionMode) {
                    setSelectedForExport((current) =>
                      current.includes(account.customer.id)
                        ? current.filter((id) => id !== account.customer.id)
                        : [...current, account.customer.id]);
                  } else {
                    setSelectedCustomerId(account.customer.id);
                  }
                }}
                className={`relative min-h-28 cursor-pointer rounded-xl border bg-gradient-to-br p-3 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${cardColor(account.debtAge, account.balance)} ${selectedForSend ? 'ring-4 ring-cyan-300' : ''}`}
              >
                <button
                  onClick={(event) => { event.stopPropagation(); archiveCustomer(account); }}
                  className="absolute right-2 top-2 rounded-lg bg-white/15 p-1.5 text-white hover:bg-rose-500"
                  title="نقل إلى سلة المهملات"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(event) => { event.stopPropagation(); copyCard(account); }}
                  className="absolute left-2 top-2 rounded-lg bg-white/15 p-1.5 text-white hover:bg-indigo-500"
                  title="نسخ الكارت"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <div className="flex min-h-24 flex-col items-center justify-center px-4 text-center">
                  <strong className="line-clamp-2 text-xs">{account.customer.name}</strong>
                  <span className="mt-2 text-sm font-black">{balanceLabel(account.balance)}</span>
                  {account.balance > 0 && (
                    <span className="mt-1 text-[9px] text-white/70">
                      {account.debtAge <= 1 ? 'دين جديد' : `${account.debtAge} يوم`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
            <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3">
              <div className="ml-auto rounded-xl bg-slate-100 px-4 py-2">
                <strong className="text-sm text-slate-900">{selectedAccount.customer.name}</strong>
              </div>
              <ActionButton color="rose" onClick={() => { setEntryMode('debt'); setEntryAmount(''); setEntryNote(''); }}><Plus /> إضافة دين</ActionButton>
              <ActionButton color="emerald" disabled={selectedAccount.balance <= 0} onClick={() => { setEntryMode('partial'); setEntryAmount(''); setEntryNote(''); }}><CheckCircle2 /> دفع جزئي</ActionButton>
              <ActionButton color="slate" disabled={selectedAccount.balance <= 0} onClick={() => { setEntryMode('full'); setEntryAmount(String(selectedAccount.balance)); setEntryNote(''); }}><Check /> تسديد كلي</ActionButton>
              <ActionButton color="indigo" onClick={exportCustomerLedger}><FileText /> طباعة السجل</ActionButton>
              <ActionButton color="amber" onClick={() => {
                setEditName(selectedAccount.customer.name);
                setEditPhone(selectedAccount.customer.phone || '');
                setShowEditCustomer(true);
              }}><Pencil /> بيانات العميل</ActionButton>
              <button onClick={() => setSelectedCustomerId(null)} className="mr-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600"><X className="h-4 w-4" /> إغلاق</button>
            </header>

            <main className="overflow-y-auto p-3 sm:p-5">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <h3 className="font-black text-slate-900">الدورة الحالية</h3>
                    <p className="text-[10px] text-slate-500">الحركات الحالية فقط قابلة للتعديل والمسح</p>
                  </div>
                  <strong className={`rounded-xl px-4 py-2 text-white ${selectedAccount.balance < 0 ? 'bg-emerald-700' : 'bg-slate-900'}`}>
                    {balanceLabel(selectedAccount.balance)}
                  </strong>
                </div>
                <LedgerTable
                  transactions={activeTransactions}
                  initialBalance={selectedAccount.activeCycle?.initialBalance || 0}
                  editable
                  onEdit={beginEditTransaction}
                  onDelete={setDeleteTransaction}
                />
              </section>

              <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-3 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-500" />
                  <h3 className="text-sm font-black text-slate-800">السجل التاريخي والأرشيف</h3>
                  <span className="text-[10px] text-slate-400">قراءة وطباعة فقط</span>
                </div>
                <div className="space-y-2">
                  {historicalCycles.map((cycle, index) => (
                    <details key={cycle.id} className="overflow-hidden rounded-xl border border-slate-200" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-50 p-3 text-xs font-bold text-slate-700">
                        <span>دورة من {new Date(cycle.startDate).toLocaleDateString('ar-LY')} إلى {new Date(cycle.endDate || cycle.startDate).toLocaleDateString('ar-LY')}</span>
                        <span className="flex items-center gap-1 text-emerald-700">مغلقة <ChevronDown className="h-4 w-4" /></span>
                      </summary>
                      <LedgerTable
                        transactions={cycleTransactions(state.debtTransactions, cycle.id)
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())}
                        initialBalance={cycle.initialBalance || 0}
                        editable={false}
                      />
                    </details>
                  ))}
                  {!historicalCycles.length && (
                    <div className="p-6 text-center text-xs text-slate-400">لا توجد دورات سابقة لهذا العميل.</div>
                  )}
                </div>
              </section>
            </main>
          </div>
        </div>
      )}

      {showCreate && (
        <Modal title="إضافة عميل جديد" onClose={() => { setShowCreate(false); resetCreate(); }}>
          <form onSubmit={createOrRestoreCustomer} className="space-y-4">
            <Field label="اسم العميل">
              <div className="flex items-center rounded-xl border border-slate-200">
                <input
                  value={newName}
                  onChange={(event) => {
                    setNewName(event.target.value);
                    setAllowSimilarName(false);
                    setRestoreCandidate(null);
                  }}
                  required
                  autoFocus
                  className="w-full p-3 outline-none"
                />
                <VoiceInputButton onResult={(text) => setNewName((value) => value ? `${value} ${text}` : text)} />
              </div>
            </Field>

            {similarParties.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <strong className="mb-2 block text-xs text-amber-900">وجدنا أسماء متشابهة في المنظومة</strong>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {similarParties.map((match) => (
                    <button
                      type="button"
                      key={`${match.source}_${match.id}`}
                      onClick={() => selectPartyMatch(match)}
                      className="flex w-full items-center justify-between rounded-lg bg-white p-2 text-right text-xs hover:bg-amber-100"
                    >
                      <span>
                        <strong className="block">{match.name}</strong>
                        <span className="text-[9px] text-slate-500">{sourceLabel[match.source]} · {match.status === 'active' ? 'نشط' : 'مؤرشف'}</span>
                      </span>
                      <span className="text-[9px] font-bold text-amber-700">{Math.round(match.score * 100)}%</span>
                    </button>
                  ))}
                </div>
                {!restoreCandidate && (
                  <button type="button" onClick={() => setAllowSimilarName(true)} className={`mt-2 w-full rounded-lg py-2 text-[10px] font-black ${allowSimilarName ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                    {allowSimilarName ? 'تم تأكيد إنشاء حساب مستقل' : 'الاسم شخص مختلف — إنشاء حساب جديد'}
                  </button>
                )}
              </div>
            )}

            {restoreCandidate && (
              <div className="rounded-xl bg-indigo-50 p-3 text-xs text-indigo-800">
                سيتم استرجاع حساب <strong>{restoreCandidate.name}</strong> وربط الدين الجديد بسجله التاريخي.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="الهاتف"><input value={newPhone} onChange={(event) => setNewPhone(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3 outline-none" /></Field>
              <Field label="الدين الأول"><input type="number" min="0" step="any" value={newDebt} onChange={(event) => setNewDebt(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3 outline-none" /></Field>
            </div>
            <PrimaryButton>{restoreCandidate ? 'استرجاع الحساب وإضافة الدين' : 'إنشاء الحساب'}</PrimaryButton>
          </form>
        </Modal>
      )}

      {entryMode && selectedAccount && (
        <Modal title={entryMode === 'debt' ? 'إضافة دين' : entryMode === 'full' ? 'تسديد كلي' : 'دفع جزئي'} onClose={() => setEntryMode(null)}>
          <form onSubmit={addLedgerEntry} className="space-y-4">
            {entryMode === 'full' ? (
              <div className="rounded-2xl bg-slate-900 p-5 text-center text-white">
                <span className="block text-xs text-slate-300">قيمة التسديد</span>
                <strong className="text-3xl">{money(selectedAccount.balance)}</strong>
              </div>
            ) : (
              <>
                <Field label="المبلغ"><input type="number" min="0.01" step="any" required autoFocus value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3 outline-none" /></Field>
                {entryMode === 'partial' && Number(entryAmount) > selectedAccount.balance && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                    الزيادة وقدرها {money(Number(entryAmount) - selectedAccount.balance)} ستُسجل أمانة لصالح العميل، وتُخصم تلقائيًا من أي دين جديد.
                  </div>
                )}
              </>
            )}
            <Field label="البيان"><textarea rows={3} value={entryNote} onChange={(event) => setEntryNote(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3 outline-none" /></Field>
            <PrimaryButton>حفظ الحركة كسطر مستقل</PrimaryButton>
          </form>
        </Modal>
      )}

      {editingTransaction && (
        <Modal title="تعديل حركة الدورة الحالية" onClose={() => setEditingTransaction(null)}>
          <form onSubmit={saveTransactionEdit} className="space-y-4">
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">سيؤثر التعديل على رصيد العميل والإجمالي العام والخزنة إن كانت الحركة دفعة.</div>
            <Field label="المبلغ"><input type="number" min="0.01" step="any" required value={editAmount} onChange={(event) => setEditAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3" /></Field>
            <Field label="التاريخ"><input type="datetime-local" required value={editDate} onChange={(event) => setEditDate(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3" /></Field>
            <Field label="البيان"><textarea rows={3} value={editNote} onChange={(event) => setEditNote(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3" /></Field>
            <PrimaryButton>حفظ وإعادة الحساب</PrimaryButton>
          </form>
        </Modal>
      )}

      {deleteTransaction && (
        <Modal title="مسح الحركة" onClose={() => setDeleteTransaction(null)}>
          <p className="mb-4 rounded-xl bg-rose-50 p-4 text-xs leading-6 text-rose-800">سيتم نقل الحركة إلى سلة المهملات وإعادة حساب الكارت والإجمالي والخزنة.</p>
          <button onClick={confirmDeleteTransaction} className="w-full rounded-xl bg-rose-600 py-3 text-sm font-black text-white">تأكيد المسح</button>
        </Modal>
      )}

      {showEditCustomer && selectedAccount && (
        <Modal title="تعديل بيانات العميل" onClose={() => setShowEditCustomer(false)}>
          <form onSubmit={saveCustomerEdit} className="space-y-4">
            <Field label="الاسم"><input required value={editName} onChange={(event) => setEditName(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3" /></Field>
            <Field label="الهاتف"><input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} className="w-full rounded-xl border border-slate-200 p-3" /></Field>
            <PrimaryButton>حفظ البيانات والاسم السابق</PrimaryButton>
          </form>
        </Modal>
      )}
    </div>
  );
}

function TopCard({
  icon,
  title,
  value,
  onClick,
}: {
  icon: React.ReactElement<{ className?: string }>;
  title: string;
  value: string;
  onClick?: () => void;
}) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component onClick={onClick} className="min-h-24 rounded-2xl border border-indigo-600 bg-gradient-to-l from-indigo-800 to-indigo-950 p-4 text-right text-white shadow-lg transition hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-[10px] font-bold text-indigo-200">{title}</span>
          <strong className="mt-2 block text-lg">{value}</strong>
        </div>
        {React.cloneElement(icon, { className: 'h-8 w-8 rounded-xl bg-white/10 p-1.5 text-indigo-200' })}
      </div>
    </Component>
  );
}

function LedgerTable({
  transactions,
  initialBalance,
  editable,
  onEdit,
  onDelete,
}: {
  transactions: DebtTransaction[];
  initialBalance: number;
  editable: boolean;
  onEdit?: (transaction: DebtTransaction) => void;
  onDelete?: (transaction: DebtTransaction) => void;
}) {
  let running = initialBalance;
  return (
    <div className="max-h-[40vh] overflow-auto">
      <table className="erp-ledger-table w-full min-w-[850px] border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
          <tr>
            <th className="p-3 text-right">التسلسل</th>
            <th className="p-3 text-right">التاريخ</th>
            <th className="p-3 text-right">النوع والبيان</th>
            <th className="p-3 text-right">دين مضاف</th>
            <th className="p-3 text-right">مبلغ مدفوع</th>
            <th className="p-3 text-right">الإجمالي</th>
            {editable && <th className="p-3 text-center">تعديل</th>}
            {editable && <th className="p-3 text-center">مسح</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {initialBalance !== 0 && (
            <tr className="erp-ledger-row erp-ledger-opening">
              <td className="p-3">—</td>
              <td className="p-3">—</td>
              <td className="p-3 font-bold text-indigo-700">رصيد افتتاحي مرحّل</td>
              <td className="p-3 font-black text-rose-600">{money(initialBalance)}</td>
              <td className="p-3">—</td>
              <td className="p-3 font-black">{balanceLabel(initialBalance)}</td>
              {editable && <td />}
              {editable && <td />}
            </tr>
          )}
          {transactions.map((transaction, index) => {
            running += transaction.type === 'debt' ? transaction.amount : -transaction.amount;
            return (
              <tr
                key={transaction.id}
                className={`erp-ledger-row ${
                  transaction.type === 'debt'
                    ? 'erp-ledger-negative'
                    : 'erp-ledger-positive'
                }`}
              >
                <td className="p-3 font-bold text-slate-400">{index + 1}</td>
                <td className="whitespace-nowrap p-3 text-slate-600">{new Date(transaction.date).toLocaleString('ar-LY')}</td>
                <td className="max-w-72 p-3">
                  <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${transaction.type === 'debt' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {transaction.type === 'debt'
                      ? 'إضافة دين'
                      : running < 0
                        ? 'دفع زائد — أمانة'
                        : transaction.paymentMode === 'full' || running === 0
                          ? 'تسديد كلي'
                          : 'دفع جزئي'}
                  </span>
                  <span className="block truncate font-semibold text-slate-700">{transaction.note}</span>
                </td>
                <td className="p-3 font-black text-rose-600">{transaction.type === 'debt' ? money(transaction.amount) : '—'}</td>
                <td className="p-3 font-black text-emerald-600">{transaction.type === 'payment' ? money(transaction.amount) : '—'}</td>
                <td className={`p-3 font-black ${running < 0 ? 'text-emerald-700' : 'text-slate-900'}`}>{balanceLabel(running)}</td>
                {editable && (
                  <td className="p-3 text-center">
                    <button onClick={() => onEdit?.(transaction)} className="erp-ledger-action rounded-lg p-2"><Pencil className="h-4 w-4" /></button>
                  </td>
                )}
                {editable && (
                  <td className="p-3 text-center">
                    <button onClick={() => onDelete?.(transaction)} className="erp-ledger-action rounded-lg p-2"><Trash2 className="h-4 w-4" /></button>
                  </td>
                )}
              </tr>
            );
          })}
          {!transactions.length && initialBalance === 0 && (
            <tr><td colSpan={editable ? 8 : 6} className="p-10 text-center text-slate-400">لا توجد حركات في هذه الدورة.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ActionButton({
  children,
  color,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  color: 'rose' | 'emerald' | 'slate' | 'indigo' | 'amber';
  disabled?: boolean;
  onClick: () => void;
}) {
  const colors = {
    rose: 'bg-rose-600 hover:bg-rose-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    slate: 'bg-slate-900 hover:bg-black',
    indigo: 'bg-indigo-600 hover:bg-indigo-700',
    amber: 'bg-amber-500 hover:bg-amber-600',
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35 ${colors[color]} [&_svg]:h-4 [&_svg]:w-4`}>
      {children}
    </button>
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" dir="rtl">
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-black text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg bg-slate-100 p-2 text-slate-500"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-700">
      <CheckCircle2 className="h-4 w-4" /> {children}
    </button>
  );
}
