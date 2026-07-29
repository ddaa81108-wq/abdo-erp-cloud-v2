import React, { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  CircleDollarSign,
  FileText,
  HandCoins,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import type { Company, CompanyTransaction, ERPState } from '../types';
import {
  businessLastActivityAt,
  calculateBusinessSummary,
  synchronizeBusinessBalances,
  transactionKind,
  upsertBusinessPaymentInTreasury,
} from '../domain/businessAccounts';
import { VoiceInputButton } from './VoiceInputButton';
import { findSimilarParties, type PartyMatch } from '../domain/partyNameMatcher';
import { openSmartCardStudio } from '../utils/imageExporterUtils';

interface CompaniesModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: any,
    headers?: string[],
    rows?: any[][],
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

type EntryAction = 'debt' | 'partial' | 'full';

const money = (value: number) =>
  `${Math.round(value).toLocaleString('en-US')} د.ل`;

const localDateTime = (value: string) =>
  new Date(value).toLocaleString('ar-LY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function CompaniesModule({
  state,
  onUpdateState,
  onOpenExporter,
  searchQuery = '',
  onScheduleDeletion,
}: CompaniesModuleProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [accountType, setAccountType] = useState<'company' | 'merchant'>('company');
  const [openingBalance, setOpeningBalance] = useState('');
  const [entryAction, setEntryAction] = useState<EntryAction | null>(null);
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [editing, setEditing] = useState<CompanyTransaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editDate, setEditDate] = useState('');
  const [deleteTransaction, setDeleteTransaction] = useState<CompanyTransaction | null>(null);
  const [showQuickExport, setShowQuickExport] = useState(false);
  const [allowSimilarName, setAllowSimilarName] = useState(false);
  const [message, setMessage] = useState('');

  const transactions = state.companyTransactions || [];
  const activeAccounts = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ar');
    return (state.companies || [])
      .filter((account) => !account.isDeleted)
      .filter((account) => !query || account.name.toLocaleLowerCase('ar').includes(query))
      .map((account) => ({
        ...account,
        balance: calculateBusinessSummary(transactions, account.id).finalBalance,
      }))
      .sort(
        (a, b) =>
          businessLastActivityAt(b, transactions)
          - businessLastActivityAt(a, transactions)
          || a.name.localeCompare(b.name, 'ar'),
      );
  }, [state.companies, transactions, searchQuery]);

  const selected = selectedId
    ? state.companies.find((account) => account.id === selectedId && !account.isDeleted) || null
    : null;
  const selectedTransactions = useMemo(
    () => transactions
      .filter((transaction) => transaction.companyId === selectedId && !transaction.isDeleted)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [transactions, selectedId],
  );
  const selectedSummary = selected
    ? calculateBusinessSummary(transactions, selected.id)
    : null;
  const similarParties = useMemo(
    () => findSimilarParties(state, name),
    [state, name],
  );

  const commitLedger = (
    nextTransactions: CompanyTransaction[],
    nextCompanies = state.companies,
    nextTreasuryTransactions = state.treasuryTransactions || [],
  ) => {
    onUpdateState({
      ...state,
      companies: synchronizeBusinessBalances(nextCompanies, nextTransactions),
      companyTransactions: nextTransactions,
      treasuryTransactions: nextTreasuryTransactions,
      merchants: [],
      merchantTransactions: [],
    });
  };

  const nextReference = () =>
    `BUS-${new Date().getFullYear()}-${String(transactions.length + 1).padStart(6, '0')}`;

  const showToast = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(''), 3000);
  };

  const createAccount = (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    const duplicate = state.companies.find(
      (account) =>
        !account.isDeleted &&
        account.name.trim().toLocaleLowerCase('ar') === cleanName.toLocaleLowerCase('ar'),
    );
    if (duplicate) {
      setSelectedId(duplicate.id);
      setShowCreate(false);
      showToast('هذا الاسم مسجل بالفعل؛ تم فتح حسابه الحالي.');
      return;
    }
    if (similarParties.length && !allowSimilarName) {
      showToast('راجع الأسماء المتشابهة أولًا أو أكّد أن هذا حساب مستقل.');
      return;
    }

    const now = new Date().toISOString();
    const id = `business_${Date.now()}`;
    const value = Number(openingBalance) || 0;
    const newAccount: Company = {
      id,
      name: cleanName,
      contact: contact.trim(),
      accountType,
      balance: 0,
      previousBalance: 0,
      newDebt: 0,
      paymentToday: 0,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };
    const nextTransactions = [...transactions];
    if (value > 0) {
      nextTransactions.push({
        id: `tx_opening_${id}`,
        companyId: id,
        type: 'purchase_invoice',
        entryKind: 'opening_balance',
        amount: value,
        currency: 'د.ل',
        date: now,
        referenceNo: nextReference(),
        note: 'رصيد افتتاحي',
        postedToTreasury: false,
        createdAt: now,
      });
    }
    commitLedger(nextTransactions, [...state.companies, newAccount]);
    setSelectedId(id);
    setShowCreate(false);
    setName('');
    setContact('');
    setOpeningBalance('');
    setAllowSimilarName(false);
    showToast('تم إنشاء الحساب وإضافته إلى السجل الموحد.');
  };

  const selectSimilarParty = (match: PartyMatch) => {
    if (match.source !== 'business') {
      showToast(`هذا الاسم موجود في ${match.source === 'customer' ? 'ديون العملاء' : 'الأمانات'}.`);
      return;
    }
    const account = state.companies.find((item) => item.id === match.id);
    if (!account) return;
    if (!account.isDeleted) {
      setSelectedId(account.id);
      setShowCreate(false);
      setName('');
      return;
    }
    const now = new Date().toISOString();
    const value = Number(openingBalance) || 0;
    const nextTransactions = [...transactions];
    if (value > 0) {
      nextTransactions.push({
        id: `tx_restore_${account.id}_${Date.now()}`,
        companyId: account.id,
        type: 'purchase_invoice',
        entryKind: 'debt',
        amount: value,
        currency: 'د.ل',
        date: now,
        referenceNo: nextReference(),
        note: 'دين جديد بعد استرجاع الحساب',
        postedToTreasury: false,
        createdAt: now,
      });
    }
    commitLedger(
      nextTransactions,
      state.companies.map((item) =>
        item.id === account.id
          ? { ...item, isDeleted: false, updatedAt: now }
          : item),
    );
    setSelectedId(account.id);
    setShowCreate(false);
    setName('');
    setOpeningBalance('');
    setAllowSimilarName(false);
    showToast('تم استرجاع الحساب وربطه بسجله السابق.');
  };

  const addEntry = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !entryAction || !selectedSummary) return;
    const isFull = entryAction === 'full';
    const value = isFull ? selectedSummary.finalBalance : Number(entryAmount);
    if (!Number.isFinite(value) || value <= 0) return;
    if (entryAction === 'partial' && value > selectedSummary.finalBalance) {
      showToast('الدفعة الجزئية لا يمكن أن تتجاوز الدين الفعلي.');
      return;
    }
    const now = new Date().toISOString();
    const isPayment = entryAction !== 'debt';
    const nextTransaction: CompanyTransaction = {
      id: `tx_business_${Date.now()}`,
      companyId: selected.id,
      type: isPayment ? 'payment' : 'purchase_invoice',
      entryKind: isPayment ? 'payment' : 'debt',
      paymentMode: isFull ? 'full' : isPayment ? 'partial' : undefined,
      amount: value,
      currency: 'د.ل',
      date: now,
      referenceNo: nextReference(),
      note: entryNote.trim() || (
        entryAction === 'debt'
          ? 'إضافة دين'
          : entryAction === 'full'
            ? 'تسديد كلي'
            : 'دفع جزئي'
      ),
      postedToTreasury: isPayment,
      createdAt: now,
    };
    const nextTreasuryTransactions = isPayment
      ? upsertBusinessPaymentInTreasury(
          state.treasuryTransactions || [],
          nextTransaction,
          selected.name,
        )
      : state.treasuryTransactions || [];
    commitLedger(
      [...transactions, nextTransaction],
      state.companies.map((account) =>
        account.id === selected.id ? { ...account, updatedAt: now } : account),
      nextTreasuryTransactions,
    );
    setEntryAction(null);
    setEntryAmount('');
    setEntryNote('');
    showToast(isFull ? 'تم تسجيل التسديد الكلي.' : 'تم تسجيل الحركة وإعادة حساب الدين.');
  };

  const beginEdit = (transaction: CompanyTransaction) => {
    setEditing(transaction);
    setEditAmount(String(transaction.amount));
    setEditNote(transaction.note || '');
    const parsed = new Date(transaction.date);
    setEditDate(new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 16));
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const value = Number(editAmount);
    if (!Number.isFinite(value) || value <= 0 || !editDate) return;
    const now = new Date().toISOString();
    const nextTransactions = transactions.map((transaction) =>
      transaction.id === editing.id
        ? {
            ...transaction,
            amount: value,
            note: editNote.trim(),
            date: new Date(editDate).toISOString(),
            updatedAt: now,
          }
        : transaction,
    );
    const editedTransaction = nextTransactions.find((transaction) => transaction.id === editing.id)!;
    const nextTreasuryTransactions = upsertBusinessPaymentInTreasury(
      state.treasuryTransactions || [],
      editedTransaction,
      selected?.name || 'حساب شركة أو تاجر',
    );
    commitLedger(
      nextTransactions,
      state.companies.map((account) =>
        account.id === editing.companyId ? { ...account, updatedAt: now } : account),
      nextTreasuryTransactions,
    );
    setEditing(null);
    showToast('تم تعديل الحركة وإعادة حساب الناتج النهائي.');
  };

  const confirmDeleteTransaction = () => {
    if (!deleteTransaction) return;
    const target = deleteTransaction;
    const execute = () => {
      const now = new Date().toISOString();
      const nextTransactions = state.companyTransactions.map((transaction) =>
        transaction.id === target.id
          ? { ...transaction, isDeleted: true, updatedAt: now }
          : transaction,
      );
      const deletedPayment = nextTransactions.find((transaction) => transaction.id === target.id)!;
      const nextTreasuryTransactions = upsertBusinessPaymentInTreasury(
        state.treasuryTransactions || [],
        deletedPayment,
        selected?.name || 'حساب شركة أو تاجر',
      );
      commitLedger(
        nextTransactions,
        state.companies.map((account) =>
          account.id === target.companyId ? { ...account, updatedAt: now } : account),
        nextTreasuryTransactions,
      );
      setDeleteTransaction(null);
      showToast('تم حذف الحركة وإعادة حساب الناتج النهائي.');
    };
    if (onScheduleDeletion) {
      onScheduleDeletion('transaction', target.id, `حركة ${target.referenceNo}`, execute);
      setDeleteTransaction(null);
    } else {
      execute();
    }
  };

  const archiveAccount = (account: Company) => {
    const execute = () => {
      const nextCompanies = state.companies.map((item) =>
        item.id === account.id ? { ...item, isDeleted: true } : item,
      );
      commitLedger(transactions, nextCompanies);
      setSelectedId(null);
    };
    if (onScheduleDeletion) {
      onScheduleDeletion(
        account.accountType === 'merchant' ? 'merchant' : 'company',
        account.id,
        account.name,
        execute,
      );
    } else {
      execute();
    }
  };

  const copyBusinessCard = (account: Company) => {
    const summary = calculateBusinessSummary(transactions, account.id);
    openSmartCardStudio({
      type: 'companies',
      name: account.name,
      amount: summary.finalBalance,
      currency: 'د.ل',
      acctype: account.accountType === 'merchant' ? 'merchant' : 'company',
    });
  };

  const exportLedger = () => {
    if (!selected || !selectedSummary) return;
    let running = 0;
    const rows = selectedTransactions.map((transaction, index) => {
      const kind = transactionKind(transaction);
      running += kind === 'payment' ? -transaction.amount : transaction.amount;
      return [
        index + 1,
        localDateTime(transaction.date),
        transaction.note,
        kind === 'payment' ? '-' : money(transaction.amount),
        kind === 'payment' ? money(transaction.amount) : '-',
        money(running),
      ];
    });
    onOpenExporter(
      `السجل العام: ${selected.name}`,
      {
        label1: 'نوع الحساب',
        value1: selected.accountType === 'merchant' ? 'تاجر' : 'شركة',
        label2: 'عدد المعاملات',
        value2: selectedTransactions.length,
        label3: 'الدين الفعلي',
        value3: money(selectedSummary.finalBalance),
      },
      ['التسلسل', 'التاريخ', 'البيان', 'دين مضاف', 'مدفوع', 'الإجمالي'],
      rows,
      'table',
    );
  };

  const exportAccountsSummary = (type: 'company' | 'merchant') => {
    const accounts = activeAccounts
      .filter((account) => account.accountType === type && account.balance > 0)
      .sort((a, b) => b.balance - a.balance);
    onOpenExporter(
      type === 'company' ? 'كشف ديون الشركات' : 'كشف ديون التجار',
      {
        label1: 'نوع الكشف',
        value1: type === 'company' ? 'الشركات فقط' : 'التجار فقط',
        label2: 'عدد الحسابات المدينة',
        value2: accounts.length,
        label3: 'إجمالي الدين الفعلي',
        value3: money(accounts.reduce((sum, account) => sum + account.balance, 0)),
      },
      [type === 'company' ? 'اسم الشركة' : 'اسم التاجر', 'الدين الفعلي'],
      accounts.map((account) => [account.name, money(account.balance)]),
      'table',
    );
    setShowQuickExport(false);
  };

  const totalActiveDebt = activeAccounts.reduce((total, account) => total + account.balance, 0);

  return (
    <div dir="rtl" className="space-y-5 text-right">
      {message && (
        <div className="fixed top-5 left-1/2 z-[90] -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-2xl">
          {message}
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="min-h-24 rounded-2xl bg-gradient-to-l from-indigo-800 to-indigo-950 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-indigo-200">إجمالي مستحقات الشركات والتجار</span>
              <strong className="mt-2 block text-2xl text-white">{money(totalActiveDebt)}</strong>
            </div>
            <WalletCards className="h-8 w-8 text-indigo-300" />
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="min-h-24 rounded-2xl bg-gradient-to-l from-indigo-800 to-indigo-950 p-4 text-right text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-indigo-200">إضافة عميل جديد</span>
              <strong className="mt-2 block text-lg">شركة أو تاجر</strong>
            </div>
            <Plus className="h-8 w-8 rounded-xl bg-white/10 p-1.5 text-indigo-200" />
          </div>
        </button>
        <button
          onClick={() => setShowQuickExport(true)}
          className="min-h-24 rounded-2xl bg-gradient-to-l from-indigo-800 to-indigo-950 p-4 text-right text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-[10px] font-bold text-indigo-200">تصدير كشف حساب</span>
              <strong className="mt-2 block text-lg">الشركات أو التجار</strong>
            </div>
            <FileText className="h-8 w-8 rounded-xl bg-white/10 p-1.5 text-indigo-200" />
          </div>
        </button>
      </section>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          readOnly
          value={searchQuery}
          placeholder="استخدم البحث العام للبحث عن شركة أو تاجر"
          className="w-full bg-transparent py-3 text-sm outline-none"
        />
      </div>

      {activeAccounts.length ? (
        <div className="max-h-[58vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-9">
          {activeAccounts.map((account) => (
            <article
              key={account.id}
              className="group relative min-h-24 rounded-xl border border-indigo-500 bg-gradient-to-br from-indigo-700 to-indigo-950 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="absolute left-1.5 top-1.5 z-10 flex gap-1">
                <button
                  type="button"
                  onClick={() => copyBusinessCard(account)}
                  className="rounded-lg bg-white/15 p-1.5 text-white hover:bg-white/30"
                  title="نسخ كارت الدين إلى منظومة الكروت الذكية"
                  aria-label={`نسخ كارت ${account.name}`}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => archiveAccount(account)}
                  className="rounded-lg bg-rose-500/85 p-1.5 text-white hover:bg-rose-600"
                  title="نقل الحساب إلى سلة المهملات"
                  aria-label={`نقل ${account.name} إلى سلة المهملات`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(account.id)}
                className="min-h-24 w-full rounded-xl p-3 text-right"
              >
                <div className="mb-4 flex items-start justify-between gap-1">
                  <strong className="line-clamp-2 text-[11px]">{account.name}</strong>
                  <span className="shrink-0 rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold">
                    {account.accountType === 'merchant' ? 'تاجر' : 'شركة'}
                  </span>
                </div>
                <span className="block text-[10px] text-white/65">الدين الفعلي</span>
                <span className="text-sm font-black">{money(account.balance)}</span>
              </button>
            </article>
          ))}
        </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          لا توجد حسابات مطابقة.
        </div>
      )}

      {selected && selectedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[96vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-[#f8fafc] shadow-2xl">
            <header className="border-b border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="ml-auto min-w-52 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
                  <div className="flex items-center gap-2">
                    {selected.accountType === 'merchant'
                      ? <Store className="h-5 w-5 text-indigo-600" />
                      : <Building2 className="h-5 w-5 text-indigo-600" />}
                    <strong className="text-sm text-slate-900">{selected.name}</strong>
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700">
                      {selected.accountType === 'merchant' ? 'تاجر' : 'شركة'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setEntryAction('debt')}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-700"
                >
                  <Plus className="h-4 w-4" /> إضافة دين
                </button>
                <button
                  onClick={() => setEntryAction('partial')}
                  disabled={selectedSummary.finalBalance <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <HandCoins className="h-4 w-4" /> دفع جزئي
                </button>
                <button
                  onClick={() => setEntryAction('full')}
                  disabled={selectedSummary.finalBalance <= 0}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check className="h-4 w-4" /> تسديد كلي
                </button>
                <button
                  onClick={exportLedger}
                  className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700 hover:bg-indigo-100"
                >
                  <FileText className="h-4 w-4" /> طباعة كشف السجل
                </button>
                <button
                  onClick={() => setSelectedId(null)}
                  className="mr-auto flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" /> إغلاق
                </button>
              </div>
            </header>

            <main className="overflow-y-auto p-3 sm:p-5">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <h3 className="font-black text-slate-900">السجل العام / الأرشيف</h3>
                    <p className="text-[10px] text-slate-500">كل حركة تغيّر الناتج النهائي مباشرةً</p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {selectedTransactions.length} معاملة
                  </span>
                </div>
                <div className="max-h-[48vh] overflow-auto">
                  <table className="record-ledger-table business-ledger-table w-full min-w-[880px] border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
                      <tr>
                        <th className="p-3 text-right">التسلسل</th>
                        <th className="p-3 text-right">التاريخ</th>
                        <th className="p-3 text-right">البيان</th>
                        <th className="p-3 text-right">دين مضاف</th>
                        <th className="p-3 text-right">مدفوع</th>
                        <th className="p-3 text-right">الإجمالي الكلي</th>
                        <th className="p-3 text-center">تعديل</th>
                        <th className="p-3 text-center">مسح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        let running = 0;
                        return selectedTransactions.map((transaction, index) => {
                          const kind = transactionKind(transaction);
                          running += kind === 'payment'
                            ? -transaction.amount
                            : transaction.amount;
                          return (
                            <tr
                              key={transaction.id}
                              className={`ledger-row ${
                                kind === 'payment'
                                  ? 'ledger-payment'
                                  : kind === 'opening_balance'
                                    ? 'ledger-opening'
                                    : 'ledger-debt'
                              } border-r-4 transition-colors hover:bg-slate-50 ${
                                kind === 'payment'
                                  ? 'border-r-emerald-400 bg-emerald-50/35'
                                  : kind === 'opening_balance'
                                    ? 'border-r-indigo-400 bg-indigo-50/35'
                                    : 'border-r-rose-400 bg-rose-50/35'
                              }`}
                            >
                              <td className="p-3 font-bold text-slate-400">{index + 1}</td>
                              <td className="whitespace-nowrap p-3 text-slate-600">{localDateTime(transaction.date)}</td>
                              <td className="max-w-72 p-3">
                                <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                                  kind === 'payment'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : kind === 'opening_balance'
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {kind === 'payment'
                                    ? transaction.paymentMode === 'full' ? 'تسديد كلي' : 'دفع جزئي'
                                    : kind === 'opening_balance' ? 'دين قديم' : 'إضافة دين'}
                                </span>
                                <span className="block truncate font-semibold text-slate-700">{transaction.note}</span>
                              </td>
                              <td className="p-3 font-black text-rose-600">
                                {kind === 'payment' ? '—' : money(transaction.amount)}
                              </td>
                              <td className="p-3 font-black text-emerald-600">
                                {kind === 'payment' ? money(transaction.amount) : '—'}
                              </td>
                              <td className="p-3 font-black text-slate-900">{money(running)}</td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => beginEdit(transaction)}
                                  className="rounded-lg bg-amber-50 p-2 text-amber-700 hover:bg-amber-100"
                                  title="تعديل الحركة"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => setDeleteTransaction(transaction)}
                                  className="rounded-lg bg-rose-50 p-2 text-rose-700 hover:bg-rose-100"
                                  title="مسح الحركة"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                      {!selectedTransactions.length && (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-slate-400">
                            لا توجد معاملات في السجل حتى الآن.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <SummaryCard label="الرصيد قبل معاملات اليوم" value={selectedSummary.balanceBeforeToday} color="indigo" />
                <SummaryCard label="ديون مضافة اليوم" value={selectedSummary.debtAddedToday} color="rose" />
                <SummaryCard label="مدفوعات اليوم" value={selectedSummary.paymentsToday} color="emerald" />
                <SummaryCard label="الرصيد الحالي" value={selectedSummary.finalBalance} color="slate" strong />
              </section>

            </main>
          </div>
        </div>
      )}

      {showCreate && (
        <Modal title="إضافة شركة أو تاجر" onClose={() => setShowCreate(false)}>
          <form onSubmit={createAccount} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {(['company', 'merchant'] as const).map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setAccountType(type)}
                  className={`rounded-lg py-2.5 text-xs font-black ${
                    accountType === type ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {type === 'company' ? 'شركة' : 'تاجر'}
                </button>
              ))}
            </div>
            <Field label="الاسم">
              <div className="flex items-center rounded-xl border border-slate-200 bg-white">
                <input value={name} onChange={(e) => { setName(e.target.value); setAllowSimilarName(false); }} required autoFocus className="w-full p-3 outline-none" />
                <VoiceInputButton onResult={setName} />
              </div>
            </Field>
            {similarParties.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <strong className="mb-2 block text-xs text-amber-900">أسماء متشابهة في المنظومة</strong>
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {similarParties.map((match) => (
                    <button type="button" key={`${match.source}_${match.id}`} onClick={() => selectSimilarParty(match)} className="flex w-full justify-between rounded-lg bg-white p-2 text-right text-xs hover:bg-amber-100">
                      <span><strong className="block">{match.name}</strong><span className="text-[9px] text-slate-500">{match.source === 'business' ? 'الشركات والتجار' : match.source === 'customer' ? 'ديون العملاء' : 'الأمانات'} · {match.status === 'active' ? 'نشط' : 'مؤرشف'}</span></span>
                      <span className="text-[9px] font-bold text-amber-700">{Math.round(match.score * 100)}%</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setAllowSimilarName(true)} className={`mt-2 w-full rounded-lg py-2 text-[10px] font-black text-white ${allowSimilarName ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                  {allowSimilarName ? 'تم تأكيد الحساب المستقل' : 'هذا حساب مختلف — متابعة الإنشاء'}
                </button>
              </div>
            )}
            <Field label="رقم الهاتف أو وسيلة التواصل">
              <input value={contact} onChange={(e) => setContact(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-500" />
            </Field>
            <Field label="الدين القديم عند فتح الحساب">
              <input type="number" min="0" step="any" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-500" />
            </Field>
            <PrimaryButton>إنشاء الحساب</PrimaryButton>
          </form>
        </Modal>
      )}

      {showQuickExport && (
        <Modal title="تصدير كشف الديون المختصر" onClose={() => setShowQuickExport(false)}>
          <p className="mb-4 text-xs leading-6 text-slate-500">
            يحتوي الكشف على الاسم والدين الفعلي فقط، ولا يعرض تفاصيل المعاملات.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => exportAccountsSummary('company')} className="rounded-2xl bg-indigo-600 p-5 text-center font-black text-white hover:bg-indigo-700">
              <Building2 className="mx-auto mb-2 h-7 w-7" />
              الشركات فقط
            </button>
            <button onClick={() => exportAccountsSummary('merchant')} className="rounded-2xl bg-indigo-600 p-5 text-center font-black text-white hover:bg-indigo-700">
              <Store className="mx-auto mb-2 h-7 w-7" />
              التجار فقط
            </button>
          </div>
        </Modal>
      )}

      {entryAction && selectedSummary && (
        <Modal
          title={entryAction === 'debt' ? 'إضافة دين' : entryAction === 'full' ? 'تسديد كلي' : 'دفع جزئي'}
          onClose={() => setEntryAction(null)}
        >
          <form onSubmit={addEntry} className="space-y-4">
            {entryAction === 'full' ? (
              <div className="rounded-2xl bg-slate-900 p-5 text-center text-white">
                <span className="block text-xs text-slate-300">قيمة التسديد الكامل</span>
                <strong className="text-3xl">{money(selectedSummary.finalBalance)}</strong>
              </div>
            ) : (
              <Field label="المبلغ">
                <input type="number" min="0.01" step="any" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} required autoFocus className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-500" />
              </Field>
            )}
            <Field label="البيان">
              <textarea value={entryNote} onChange={(e) => setEntryNote(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-500" />
            </Field>
            <PrimaryButton>{entryAction === 'full' ? 'تأكيد التسديد الكلي' : 'حفظ الحركة'}</PrimaryButton>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="تعديل الحركة" onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">
              تعديل هذه الحركة سيعيد حساب جميع الأرصدة والناتج النهائي تلقائيًا.
            </div>
            <Field label="المبلغ">
              <input type="number" min="0.01" step="any" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} required className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-500" />
            </Field>
            <Field label="التاريخ والوقت">
              <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} required className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-500" />
            </Field>
            <Field label="البيان">
              <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-500" />
            </Field>
            <PrimaryButton>حفظ التعديل وإعادة الحساب</PrimaryButton>
          </form>
        </Modal>
      )}

      {deleteTransaction && (
        <Modal title="تأكيد مسح الحركة" onClose={() => setDeleteTransaction(null)}>
          <div className="space-y-4">
            <div className="rounded-xl bg-rose-50 p-4 text-sm leading-7 text-rose-800">
              سيتم نقل الحركة إلى سلة المهملات، ثم إعادة حساب الناتج النهائي وكل الأرقام الظاهرة.
            </div>
            <button onClick={confirmDeleteTransaction} className="w-full rounded-xl bg-rose-600 py-3 text-sm font-black text-white hover:bg-rose-700">
              مسح الحركة وإعادة الحساب
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  strong = false,
}: {
  label: string;
  value: number;
  color: 'indigo' | 'rose' | 'emerald' | 'slate';
  strong?: boolean;
}) {
  const colors = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    slate: 'border-slate-800 bg-slate-900 text-white',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]} ${strong ? 'shadow-lg' : ''}`}>
      <span className="mb-2 block text-[10px] font-bold opacity-70">{label}</span>
      <strong className="text-lg sm:text-2xl">{money(value)}</strong>
    </div>
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
      <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-black text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
            <X className="h-4 w-4" />
          </button>
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
      <CircleDollarSign className="h-4 w-4" />
      {children}
    </button>
  );
}
