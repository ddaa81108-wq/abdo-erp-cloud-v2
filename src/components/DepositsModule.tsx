import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Calculator,
  CheckCircle2,
  Copy,
  FileText,
  Landmark,
  Minus,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  WalletCards,
  X,
} from 'lucide-react';
import type {
  ERPState,
  TreasuryTransaction,
  TrustDeposit,
  TrustDepositTx,
} from '../types';
import {
  calculateTrustAccountBalances,
  convertLydToEgp,
  synchronizeTrustDeposit,
  trustHistory,
  trustLastActivityAt,
  upsertTrustTransactionInTreasury,
} from '../domain/trustAccounts';
import {
  findSimilarParties,
  normalizeArabicName,
  type PartyMatch,
} from '../domain/partyNameMatcher';
import {
  copySettledImage,
  generateUnifiedSmartCard,
  openSmartCardStudio,
} from '../utils/imageExporterUtils';
import { VoiceInputButton } from './VoiceInputButton';

interface DepositsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: any,
    headers: string[],
    rows: any[][],
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
  deposit: TrustDeposit;
  history: TrustDepositTx[];
  amountLyd: number;
  amountEgp: number;
  lastActivity: number;
};

type ActionMode =
  | 'deposit_lyd'
  | 'withdraw_lyd'
  | 'convert_to_egp'
  | 'deposit_egp'
  | 'withdraw_egp';

const uid = (prefix: string) =>
  `${prefix}_${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

const referenceNo = () =>
  `TRUST-${new Date().getFullYear()}-${uid('').replace(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase()}`;

const money = (value: number, currency: 'lyd' | 'egp') =>
  `${Math.round(Math.abs(value)).toLocaleString('en-US')} ${currency === 'lyd' ? 'د.ل' : 'ج.م'}`;

const signedBalance = (value: number, currency: 'lyd' | 'egp') =>
  value < 0
    ? `دين على العميل ${money(value, currency)}`
    : `أمانة ${currency === 'lyd' ? 'ليبي' : 'مصري'} ${money(value, currency)}`;

const netMoney = (value: number, currency: 'lyd' | 'egp') =>
  `${value < 0 ? '-' : ''}${money(value, currency)}`;

const transactionLabel: Record<TrustDepositTx['type'], string> = {
  deposit_lyd: 'إيداع ليبي',
  withdraw_lyd: 'سحب ليبي',
  convert_to_egp: 'تحويل ليبي إلى مصري',
  deposit_egp: 'إيداع مصري',
  withdraw_egp: 'سحب مصري',
};

function cardColor(amountLyd: number, amountEgp: number) {
  if (amountLyd < 0 || amountEgp < 0) {
    return 'border-rose-500 bg-rose-700';
  }
  if (amountLyd !== 0 && amountEgp !== 0) {
    return 'border-violet-500 bg-violet-700';
  }
  if (amountEgp !== 0) return 'border-emerald-500 bg-emerald-700';
  if (amountLyd !== 0) return 'border-indigo-500 bg-indigo-700';
  return 'border-slate-500 bg-slate-700';
}

export default function DepositsModule({
  state,
  onUpdateState,
  searchQuery = '',
  pendingDeletions = [],
  onScheduleDeletion,
}: DepositsModuleProps) {
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState<'lyd' | 'egp'>('lyd');
  const [newNote, setNewNote] = useState('');
  const [allowSimilarName, setAllowSimilarName] = useState(false);

  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [actionAmount, setActionAmount] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [conversionLyd, setConversionLyd] = useState('');
  const [conversionRate, setConversionRate] = useState('');

  const [editing, setEditing] = useState<TrustDepositTx | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [deleting, setDeleting] = useState<TrustDepositTx | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [showCalculator, setShowCalculator] = useState(false);
  const [calcLeft, setCalcLeft] = useState('');
  const [calcRight, setCalcRight] = useState('');
  const [calcOperator, setCalcOperator] = useState<'add' | 'subtract' | 'multiply' | 'divide'>('multiply');

  const accounts = useMemo<AccountView[]>(() =>
    (state.trustDeposits || [])
      .filter((deposit) => !deposit.isDeleted)
      .map((deposit) => {
        const history = trustHistory(deposit);
        const balance = calculateTrustAccountBalances(history);
        return {
          deposit,
          history,
          ...balance,
          lastActivity: trustLastActivityAt(deposit),
        };
      })
      .sort((a, b) => b.lastActivity - a.lastActivity),
  [state.trustDeposits]);

  const visibleAccounts = useMemo(() => {
    const query = normalizeArabicName(searchQuery);
    return accounts.filter((account) =>
      !query ||
      normalizeArabicName(account.deposit.customerName).includes(query) ||
      (account.deposit.nameAliases || []).some((alias) =>
        normalizeArabicName(alias).includes(query)));
  }, [accounts, searchQuery]);

  const selected = accounts.find((account) => account.deposit.id === selectedId);
  const similarParties = useMemo(
    () => findSimilarParties(state, newName),
    [state, newName],
  );
  const totalLyd = accounts.reduce(
    (sum, account) => sum + Math.max(account.amountLyd, 0),
    0,
  );
  const totalEgp = accounts.reduce(
    (sum, account) => sum + account.amountEgp,
    0,
  );

  const toast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const commit = (
    deposits: TrustDeposit[],
    treasuryTransactions: TreasuryTransaction[] = state.treasuryTransactions || [],
  ) => {
    const synchronized = deposits.map(synchronizeTrustDeposit);
    const nextState = {
      ...state,
      trustDeposits: synchronized,
      treasuryTransactions,
    };
    stateRef.current = nextState;
    onUpdateState(nextState);
  };

  const resetAction = () => {
    setActionMode(null);
    setActionAmount('');
    setActionNote('');
    setConversionLyd('');
    setConversionRate('');
  };

  const resetCreate = () => {
    setNewName('');
    setNewAmount('');
    setNewCurrency('lyd');
    setNewNote('');
    setAllowSimilarName(false);
  };

  const createAccount = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    const amount = Number(newAmount);
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      toast('أدخل اسمًا ومبلغ أمانة أكبر من صفر.');
      return;
    }
    if (similarParties.length && !allowSimilarName) {
      toast('راجع الأسماء المتشابهة أو أكّد إنشاء حساب مستقل.');
      return;
    }
    const now = new Date().toISOString();
    const depositId = uid('trust');
    const transaction: TrustDepositTx = {
      id: uid('trust_tx'),
      type: newCurrency === 'lyd' ? 'deposit_lyd' : 'deposit_egp',
      amountLyd: newCurrency === 'lyd' ? amount : 0,
      amountEgp: newCurrency === 'egp' ? amount : 0,
      date: now,
      note: newNote.trim() || `إيداع أمانة أولي ${newCurrency === 'lyd' ? 'بالليبي' : 'بالمصري'}`,
      referenceNo: referenceNo(),
      createdAt: now,
    };
    const deposit: TrustDeposit = {
      id: depositId,
      customerName: name,
      amount: 0,
      amountLyd: 0,
      amountEgp: 0,
      currency: 'متعدد',
      date: now,
      referenceNo: referenceNo(),
      status: 'held',
      note: newNote.trim() || 'حساب أمانة',
      createdAt: now,
      updatedAt: now,
      history: [transaction],
    };
    const synchronized = synchronizeTrustDeposit(deposit);
    const treasury = upsertTrustTransactionInTreasury(
      state.treasuryTransactions || [],
      transaction,
      name,
      depositId,
    );
    commit([...state.trustDeposits, synchronized], treasury);
    setSelectedId(depositId);
    setShowCreate(false);
    resetCreate();
    toast('تم إنشاء حساب الأمانة وتسجيل الحركة.');
  };

  const chooseSimilarParty = (match: PartyMatch) => {
    if (match.source === 'deposit' && match.status === 'active') {
      setSelectedId(match.id);
      setShowCreate(false);
      resetCreate();
      return;
    }
    toast(`الاسم موجود في ${match.source === 'customer' ? 'ديون العملاء' : match.source === 'business' ? 'الشركات والتجار' : 'الأرشيف'}.`);
  };

  const saveAction = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !actionMode) return;
    const now = new Date().toISOString();
    let transaction: TrustDepositTx;
    if (actionMode === 'convert_to_egp') {
      const lydAmount = Number(conversionLyd);
      const rate = Number(conversionRate);
      if (!Number.isFinite(lydAmount) || lydAmount <= 0 || !Number.isFinite(rate) || rate <= 0) {
        toast('أدخل مبلغ التحويل وسعر الصرف بصورة صحيحة.');
        return;
      }
      transaction = {
        id: uid('trust_tx'),
        type: 'convert_to_egp',
        amountLyd: lydAmount,
        amountEgp: convertLydToEgp(lydAmount, rate),
        rate,
        date: now,
        note: actionNote.trim() || `تحويل من الليبي إلى المصري بالقسمة على سعر ${rate}`,
        referenceNo: referenceNo(),
        createdAt: now,
      };
    } else {
      const amount = Number(actionAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast('أدخل مبلغًا أكبر من صفر.');
        return;
      }
      transaction = {
        id: uid('trust_tx'),
        type: actionMode,
        amountLyd: actionMode.endsWith('lyd') ? amount : 0,
        amountEgp: actionMode.endsWith('egp') ? amount : 0,
        date: now,
        note: actionNote.trim() || transactionLabel[actionMode],
        referenceNo: referenceNo(),
        createdAt: now,
      };
    }
    const updatedDeposit = synchronizeTrustDeposit({
      ...selected.deposit,
      status: 'held',
      updatedAt: now,
      history: [...selected.history, transaction],
    });
    const deposits = state.trustDeposits.map((deposit) =>
      deposit.id === selected.deposit.id ? updatedDeposit : deposit);
    const treasury = upsertTrustTransactionInTreasury(
      state.treasuryTransactions || [],
      transaction,
      selected.deposit.customerName,
      selected.deposit.id,
    );
    commit(deposits, treasury);
    resetAction();
    const balance = calculateTrustAccountBalances(updatedDeposit.history || []);
    toast(
      balance.amountLyd < 0 || balance.amountEgp < 0
        ? 'تم التسجيل. الرصيد السالب ظاهر كدين على صاحب الأمانة.'
        : 'تم تسجيل الحركة وتحديث جميع الإجماليات.',
    );
  };

  const beginEdit = (transaction: TrustDepositTx) => {
    setEditing(transaction);
    setEditAmount(String(
      transaction.type === 'deposit_egp' || transaction.type === 'withdraw_egp'
        ? transaction.amountEgp
        : transaction.amountLyd,
    ));
    setEditRate(String(transaction.rate || 1));
    const date = new Date(transaction.date);
    setEditDate(new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString().slice(0, 16));
    setEditNote(transaction.note);
  };

  const saveEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !editing) return;
    const amount = Number(editAmount);
    const rate = Number(editRate);
    if (!Number.isFinite(amount) || amount <= 0 || !editDate) return;
    if (editing.type === 'convert_to_egp' && (!Number.isFinite(rate) || rate <= 0)) return;
    const updatedAt = new Date().toISOString();
    const updated: TrustDepositTx = {
      ...editing,
      amountLyd: editing.type === 'deposit_egp' || editing.type === 'withdraw_egp' ? 0 : amount,
      amountEgp: editing.type === 'convert_to_egp'
        ? convertLydToEgp(amount, rate)
        : editing.type === 'deposit_egp' || editing.type === 'withdraw_egp'
          ? amount
          : 0,
      rate: editing.type === 'convert_to_egp' ? rate : editing.rate,
      date: new Date(editDate).toISOString(),
      note: editNote.trim(),
      updatedAt,
    };
    const nextDeposit = synchronizeTrustDeposit({
      ...selected.deposit,
      updatedAt,
      history: selected.history.map((transaction) =>
        transaction.id === editing.id ? updated : transaction),
    });
    const deposits = state.trustDeposits.map((deposit) =>
      deposit.id === selected.deposit.id ? nextDeposit : deposit);
    const treasury = upsertTrustTransactionInTreasury(
      state.treasuryTransactions || [],
      updated,
      selected.deposit.customerName,
      selected.deposit.id,
    );
    commit(deposits, treasury);
    setEditing(null);
    toast('تم تعديل الحركة وإعادة حساب الكارت والخزنة.');
  };

  const confirmDeleteTransaction = () => {
    if (!selected || !deleting) return;
    const updatedAt = new Date().toISOString();
    const deleted = { ...deleting, isDeleted: true, updatedAt };
    const nextDeposit = synchronizeTrustDeposit({
      ...selected.deposit,
      updatedAt,
      history: selected.history.map((transaction) =>
        transaction.id === deleting.id ? deleted : transaction),
    });
    const deposits = state.trustDeposits.map((deposit) =>
      deposit.id === selected.deposit.id ? nextDeposit : deposit);
    const treasury = upsertTrustTransactionInTreasury(
      state.treasuryTransactions || [],
      deleted,
      selected.deposit.customerName,
      selected.deposit.id,
    );
    commit(deposits, treasury);
    setDeleting(null);
    toast('تم مسح الحركة وإعادة حساب جميع الأرصدة.');
  };

  const deleteAccount = (account: AccountView) => {
    const execute = () => {
      const current = stateRef.current;
      const updatedAt = new Date().toISOString();
      const deposits = current.trustDeposits.map((deposit) =>
        deposit.id === account.deposit.id
          ? { ...deposit, isDeleted: true, updatedAt }
          : deposit);
      const transactionIds = new Set(
        account.history.map((transaction) =>
          `${account.deposit.id}:${transaction.id}`),
      );
      const treasury = (current.treasuryTransactions || []).map((transaction) =>
        transaction.source === 'deposit_escrow' &&
        transactionIds.has(transaction.sourceId || '')
          ? { ...transaction, isDeleted: true }
          : transaction);
      onUpdateState({ ...current, trustDeposits: deposits, treasuryTransactions: treasury });
      setSelectedId(null);
    };
    if (onScheduleDeletion) {
      onScheduleDeletion('deposit', account.deposit.id, account.deposit.customerName, execute);
    } else {
      execute();
    }
  };

  const copyCard = async (account: AccountView) => {
    if (account.amountLyd === 0 && account.amountEgp === 0) {
      if (await copySettledImage(account.deposit.customerName)) toast('تم نسخ كارت المخالصة.');
      return;
    }
    if (account.amountLyd !== 0 && account.amountEgp !== 0) {
      const success = await generateUnifiedSmartCard(
        account.deposit.customerName,
        account.amountLyd,
        'trust_dual',
        undefined,
        'د.ل',
        account.amountEgp,
        'ج.م',
      );
      toast(success ? 'تم نسخ كارت الأمانة بالعملتين.' : 'تعذر نسخ الكارت.');
      return;
    }
    const isEgp = account.amountEgp !== 0;
    const value = isEgp ? account.amountEgp : account.amountLyd;
    openSmartCardStudio({
      type: value < 0 ? 'debt' : 'trust',
      name: account.deposit.customerName,
      amount: Math.abs(value),
      currency: isEgp ? 'ج.م' : 'د.ل',
    });
  };

  const ledgerRows = (account: AccountView) => {
    let amountLyd = 0;
    let amountEgp = 0;
    return account.history
      .filter((transaction) => !transaction.isDeleted)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((transaction, index) => {
        const balance = calculateTrustAccountBalances(
          account.history
            .filter((item) => !item.isDeleted)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, index + 1),
        );
        amountLyd = balance.amountLyd;
        amountEgp = balance.amountEgp;
        return { transaction, amountLyd, amountEgp, index };
      });
  };

  const exportLedgerPdf = async () => {
    if (!printRef.current || !selected) return;
    setGeneratingPdf(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imageWidth = pageWidth - margin * 2;
      const pageContentHeight = pageHeight - margin * 2;
      const sliceHeightPixels = Math.floor(
        pageContentHeight * canvas.width / imageWidth,
      );
      let offset = 0;
      let pageIndex = 0;
      while (offset < canvas.height) {
        const currentSliceHeight = Math.min(
          sliceHeightPixels,
          canvas.height - offset,
        );
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = currentSliceHeight;
        const context = pageCanvas.getContext('2d');
        context?.drawImage(
          canvas,
          0,
          offset,
          canvas.width,
          currentSliceHeight,
          0,
          0,
          canvas.width,
          currentSliceHeight,
        );
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL('image/png'),
          'PNG',
          margin,
          margin,
          imageWidth,
          currentSliceHeight * imageWidth / canvas.width,
        );
        offset += currentSliceHeight;
        pageIndex += 1;
      }
      pdf.save(`trust-ledger-${selected.deposit.customerName}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast('تم تصدير سجل الأمانة PDF.');
    } catch {
      toast('تعذر إنشاء ملف PDF. حاول مرة أخرى.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const calcResult = (() => {
    const left = Number(calcLeft) || 0;
    const right = Number(calcRight) || 0;
    if (calcOperator === 'add') return left + right;
    if (calcOperator === 'subtract') return left - right;
    if (calcOperator === 'divide') return right === 0 ? 0 : left / right;
    return left * right;
  })();

  return (
    <div dir="rtl" className="space-y-4 text-right">
      {message && (
        <div className="fixed left-1/2 top-5 z-[120] -translate-x-1/2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl">
          {message}
        </div>
      )}

      <section className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <TopCard icon={<Landmark />} title="إجمالي الأمانات الليبية" value={money(totalLyd, 'lyd')} />
        <TopCard icon={<WalletCards />} title="صافي الأمانات المصرية" value={netMoney(totalEgp, 'egp')} />
        <TopCard icon={<UserPlus />} title="إضافة صاحب أمانة" value="حساب وسجل جديد" onClick={() => setShowCreate(true)} />
      </section>

      <section className="max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9">
          {visibleAccounts.map((account) => (
            <div
              key={account.deposit.id}
              onClick={() => setSelectedId(account.deposit.id)}
              className={`relative min-h-32 cursor-pointer rounded-xl border p-3 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${cardColor(account.amountLyd, account.amountEgp)} ${pendingDeletions.includes(account.deposit.id) ? 'opacity-45' : ''}`}
            >
              <button
                onClick={(event) => { event.stopPropagation(); deleteAccount(account); }}
                className="absolute right-2 top-2 rounded-lg bg-white/15 p-1.5 hover:bg-rose-950"
                title="نقل إلى سلة المهملات"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(event) => { event.stopPropagation(); copyCard(account); }}
                className="absolute left-2 top-2 rounded-lg bg-white/15 p-1.5 hover:bg-slate-950"
                title="نسخ الكارت"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <div className="flex min-h-28 flex-col items-center justify-center px-3 text-center">
                <strong className="line-clamp-2 text-xs">{account.deposit.customerName}</strong>
                {account.amountLyd !== 0 && (
                  <span className="mt-2 text-[11px] font-black">{signedBalance(account.amountLyd, 'lyd')}</span>
                )}
                {account.amountEgp !== 0 && (
                  <span className="mt-1 text-[11px] font-black">{signedBalance(account.amountEgp, 'egp')}</span>
                )}
                {account.amountLyd === 0 && account.amountEgp === 0 && (
                  <span className="mt-2 text-[11px] font-bold text-white/80">تمت التصفية</span>
                )}
              </div>
            </div>
          ))}
          {!visibleAccounts.length && (
            <div className="col-span-full p-12 text-center text-xs text-slate-400">لا توجد حسابات أمانات مطابقة.</div>
          )}
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm">
          <div className="flex max-h-[96vh] w-full max-w-[1500px] flex-col overflow-hidden rounded-3xl bg-slate-50 shadow-2xl">
            <header className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-white p-3 sm:grid-cols-4 xl:grid-cols-8">
              <ToolbarLabel>{selected.deposit.customerName}</ToolbarLabel>
              <ToolbarButton color="indigo" onClick={() => { resetAction(); setActionMode('deposit_lyd'); }}><Plus /> إيداع ليبي</ToolbarButton>
              <ToolbarButton color="rose" onClick={() => { resetAction(); setActionMode('withdraw_lyd'); }}><Minus /> سحب ليبي</ToolbarButton>
              <ToolbarButton color="slate" onClick={() => setShowPrint(true)}><FileText /> طباعة سجل الأمانة</ToolbarButton>
              <ToolbarButton color="violet" onClick={() => { resetAction(); setActionMode('convert_to_egp'); }}><Calculator /> تحويل إلى مصري</ToolbarButton>
              <ToolbarButton color="emerald" onClick={() => { resetAction(); setActionMode('deposit_egp'); }}><Plus /> إيداع مصري</ToolbarButton>
              <ToolbarButton color="amber" onClick={() => { resetAction(); setActionMode('withdraw_egp'); }}><Minus /> سحب مصري</ToolbarButton>
              <button onClick={() => { setSelectedId(null); resetAction(); }} className="flex w-full items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-black text-slate-600"><X className="h-4 w-4" /> إغلاق النافذة</button>
            </header>

            <main className="overflow-y-auto p-3 sm:p-5">
              <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(selected.amountLyd !== 0 || selected.amountEgp === 0) && (
                  <BalanceCard label="إجمالي الأمانة بالليبي" value={signedBalance(selected.amountLyd, 'lyd')} negative={selected.amountLyd < 0} />
                )}
                {(selected.amountEgp !== 0 || selected.amountLyd === 0) && (
                  <BalanceCard label="إجمالي الأمانة بالمصري" value={signedBalance(selected.amountEgp, 'egp')} negative={selected.amountEgp < 0} />
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h3 className="font-black text-slate-900">السجل العام للأمانة</h3>
                  <p className="text-[10px] text-slate-500">السجل هو مصدر الإجماليات الداخلية والكارت الخارجي والخزنة الليبية.</p>
                </div>
                <TrustLedger
                  rows={ledgerRows(selected)}
                  totalLyd={selected.amountLyd}
                  totalEgp={selected.amountEgp}
                  onEdit={beginEdit}
                  onDelete={setDeleting}
                />
              </section>
            </main>
          </div>
        </div>
      )}

      {showCreate && (
        <Modal title="إضافة صاحب أمانة جديد" onClose={() => { setShowCreate(false); resetCreate(); }}>
          <form onSubmit={createAccount} className="space-y-4">
            <Field label="اسم صاحب الأمانة">
              <div className="flex overflow-hidden rounded-xl border border-slate-200">
                <input required autoFocus value={newName} onChange={(event) => { setNewName(event.target.value); setAllowSimilarName(false); }} className="w-full p-3 outline-none" />
                <VoiceInputButton onResult={(text) => setNewName((value) => value ? `${value} ${text}` : text)} />
              </div>
            </Field>
            {similarParties.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <strong className="mb-2 block text-xs text-amber-900">أسماء متشابهة في المنظومة</strong>
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {similarParties.map((match) => (
                    <button type="button" key={`${match.source}_${match.id}`} onClick={() => chooseSimilarParty(match)} className="flex w-full justify-between rounded-lg bg-white p-2 text-right text-xs">
                      <span>{match.name} · {match.status === 'active' ? 'نشط' : 'مؤرشف'}</span>
                      <span>{Math.round(match.score * 100)}%</span>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setAllowSimilarName(true)} className={`mt-2 w-full rounded-lg py-2 text-[10px] font-black text-white ${allowSimilarName ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                  {allowSimilarName ? 'تم تأكيد الحساب المستقل' : 'هذا شخص مختلف — إنشاء حساب مستقل'}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="العملة">
                <select value={newCurrency} onChange={(event) => setNewCurrency(event.target.value as 'lyd' | 'egp')} className="w-full rounded-xl border p-3">
                  <option value="lyd">دينار ليبي</option>
                  <option value="egp">جنيه مصري</option>
                </select>
              </Field>
              <Field label="قيمة الأمانة"><input type="number" min="0.01" step="any" required value={newAmount} onChange={(event) => setNewAmount(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
            </div>
            <Field label="البيان"><textarea rows={3} value={newNote} onChange={(event) => setNewNote(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
            <PrimaryButton>إنشاء الحساب وتسجيل الإيداع</PrimaryButton>
          </form>
        </Modal>
      )}

      {actionMode && selected && (
        <Modal title={transactionLabel[actionMode]} onClose={resetAction}>
          <form onSubmit={saveAction} className="space-y-4">
            {actionMode === 'convert_to_egp' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="المبلغ الليبي"><input type="number" min="0.01" step="any" required value={conversionLyd} onChange={(event) => setConversionLyd(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
                  <Field label="سعر الصرف"><input type="number" min="0.0001" step="any" required value={conversionRate} onChange={(event) => setConversionRate(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
                </div>
                {Number(conversionLyd) > 0 && Number(conversionRate) > 0 && (
                  <div className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-black text-emerald-800">
                    {money(Number(conversionLyd), 'lyd')} ÷ {Number(conversionRate).toLocaleString('en-US')} =
                    {' '}{money(convertLydToEgp(Number(conversionLyd), Number(conversionRate)), 'egp')}
                  </div>
                )}
              </>
            ) : (
              <Field label="المبلغ"><input type="number" min="0.01" step="any" required autoFocus value={actionAmount} onChange={(event) => setActionAmount(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
            )}
            {(actionMode === 'withdraw_lyd' || actionMode === 'withdraw_egp') && Number(actionAmount) > (actionMode === 'withdraw_lyd' ? selected.amountLyd : selected.amountEgp) && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
                السحب أكبر من الأمانة، وسيظهر الفرق كدين على صاحب الأمانة.
              </div>
            )}
            <Field label="البيان"><textarea rows={3} value={actionNote} onChange={(event) => setActionNote(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
            <PrimaryButton>حفظ الحركة وإعادة الحساب</PrimaryButton>
          </form>
        </Modal>
      )}

      {showPrint && selected && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md" dir="rtl">
          <div className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <strong className="text-sm text-slate-900">سجل أمانة: {selected.deposit.customerName}</strong>
              <button onClick={() => setShowPrint(false)} className="rounded-lg bg-slate-100 p-2 text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-auto p-3">
              <PrintableLedger ref={printRef} account={selected} rows={ledgerRows(selected)} />
            </div>
            <div className="border-t border-slate-200 p-3">
              <button disabled={generatingPdf} onClick={exportLedgerPdf} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white disabled:opacity-50">
                <FileText className="h-4 w-4" />
                {generatingPdf ? 'جاري تجهيز PDF...' : 'تصدير السجل PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <Modal title="تعديل حركة الأمانة" onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">التعديل سيغيّر السجل والكارت والإجماليات وقيد الخزنة الليبي المرتبط.</div>
            <Field label={editing.type === 'convert_to_egp' ? 'المبلغ الليبي المحول' : 'المبلغ'}><input type="number" min="0.01" step="any" required value={editAmount} onChange={(event) => setEditAmount(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
            {editing.type === 'convert_to_egp' && <Field label="سعر الصرف"><input type="number" min="0.0001" step="any" required value={editRate} onChange={(event) => setEditRate(event.target.value)} className="w-full rounded-xl border p-3" /></Field>}
            <Field label="التاريخ"><input type="datetime-local" required value={editDate} onChange={(event) => setEditDate(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
            <Field label="البيان"><textarea rows={3} value={editNote} onChange={(event) => setEditNote(event.target.value)} className="w-full rounded-xl border p-3" /></Field>
            <PrimaryButton>حفظ التعديل</PrimaryButton>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="مسح حركة الأمانة" onClose={() => setDeleting(null)}>
          <p className="mb-4 rounded-xl bg-rose-50 p-4 text-xs leading-6 text-rose-800">سيتم إلغاء الحركة وإعادة حساب جميع الأرصدة وقيد الخزنة المرتبط.</p>
          <button onClick={confirmDeleteTransaction} className="w-full rounded-xl bg-rose-600 py-3 text-sm font-black text-white">تأكيد المسح</button>
        </Modal>
      )}

      <div className="fixed bottom-6 left-6 z-[80]">
        {showCalculator && (
          <div className="mb-3 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><strong className="text-xs">حاسبة الأمانات</strong><button onClick={() => setShowCalculator(false)}><X className="h-4 w-4" /></button></div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
              <input type="number" step="any" value={calcLeft} onChange={(event) => setCalcLeft(event.target.value)} className="min-w-0 rounded-lg border p-2 text-center text-xs" />
              <select value={calcOperator} onChange={(event) => setCalcOperator(event.target.value as typeof calcOperator)} className="rounded-lg border p-2 text-xs"><option value="multiply">×</option><option value="divide">÷</option><option value="add">+</option><option value="subtract">−</option></select>
              <input type="number" step="any" value={calcRight} onChange={(event) => setCalcRight(event.target.value)} className="min-w-0 rounded-lg border p-2 text-center text-xs" />
            </div>
            <div className="mt-3 rounded-xl bg-slate-900 p-3 text-center font-mono font-black text-white">{calcResult.toLocaleString('en-US')}</div>
          </div>
        )}
        <button onClick={() => setShowCalculator((value) => !value)} className="rounded-full bg-slate-900 p-3.5 text-white shadow-xl"><Calculator className="h-5 w-5" /></button>
      </div>
    </div>
  );
}

function TrustLedger({
  rows,
  totalLyd,
  totalEgp,
  onEdit,
  onDelete,
}: {
  rows: Array<{ transaction: TrustDepositTx; amountLyd: number; amountEgp: number; index: number }>;
  totalLyd: number;
  totalEgp: number;
  onEdit: (transaction: TrustDepositTx) => void;
  onDelete: (transaction: TrustDepositTx) => void;
}) {
  return (
    <div className="max-h-[55vh] overflow-auto">
      <table className="w-full min-w-[1250px] text-xs">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
          <tr>
            <th className="p-3">#</th><th className="p-3">التاريخ</th><th className="p-3">الحركة والبيان</th>
            <th className="p-3">إيداع ليبي</th><th className="p-3">سحب ليبي</th>
            <th className="p-3">إيداع مصري</th><th className="p-3">سحب مصري</th>
            <th className="p-3">الإجمالي الليبي</th><th className="p-3">الإجمالي المصري</th>
            <th className="p-3 text-center">تعديل</th><th className="p-3 text-center">مسح</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(({ transaction, amountLyd, amountEgp, index }) => (
            <tr key={transaction.id} className="hover:bg-slate-50">
              <td className="p-3 font-bold text-slate-400">{index + 1}</td>
              <td className="whitespace-nowrap p-3">{new Date(transaction.date).toLocaleString('ar-LY')}</td>
              <td className="max-w-72 p-3"><strong className="block">{transactionLabel[transaction.type]}</strong><span className="block truncate text-[10px] text-slate-500">{transaction.note}</span></td>
              <td className="p-3 font-black text-indigo-600">{transaction.type === 'deposit_lyd' ? money(transaction.amountLyd, 'lyd') : '—'}</td>
              <td className="p-3 font-black text-rose-600">{transaction.type === 'withdraw_lyd' || transaction.type === 'convert_to_egp' ? money(transaction.amountLyd, 'lyd') : '—'}</td>
              <td className="p-3 font-black text-emerald-600">{transaction.type === 'deposit_egp' || transaction.type === 'convert_to_egp' ? money(transaction.amountEgp, 'egp') : '—'}</td>
              <td className="p-3 font-black text-amber-600">{transaction.type === 'withdraw_egp' ? money(transaction.amountEgp, 'egp') : '—'}</td>
              <td className={`p-3 font-black ${amountLyd < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{signedBalance(amountLyd, 'lyd')}</td>
              <td className={`p-3 font-black ${amountEgp < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{signedBalance(amountEgp, 'egp')}</td>
              <td className="p-3 text-center"><button onClick={() => onEdit(transaction)} className="rounded-lg bg-amber-50 p-2 text-amber-700"><Pencil className="h-4 w-4" /></button></td>
              <td className="p-3 text-center"><button onClick={() => onDelete(transaction)} className="rounded-lg bg-rose-50 p-2 text-rose-700"><Trash2 className="h-4 w-4" /></button></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={11} className="p-10 text-center text-slate-400">لا توجد حركات مسجلة.</td></tr>}
        </tbody>
        <tfoot className="sticky bottom-0 border-t-2 border-indigo-300 bg-indigo-50">
          <tr>
            <td colSpan={7} className="p-3 text-left font-black text-indigo-900">الإجمالي النهائي</td>
            <td className={`p-3 font-black ${totalLyd < 0 ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-900'}`}>{signedBalance(totalLyd, 'lyd')}</td>
            <td className={`p-3 font-black ${totalEgp < 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-900'}`}>{signedBalance(totalEgp, 'egp')}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const PrintableLedger = React.forwardRef<
  HTMLDivElement,
  {
    account: AccountView;
    rows: Array<{ transaction: TrustDepositTx; amountLyd: number; amountEgp: number; index: number }>;
  }
>(({ account, rows }, ref) => (
  <div ref={ref} className="min-w-[900px] bg-white p-6 text-slate-950" dir="rtl">
    <div className="mb-5 flex items-end justify-between border-b-2 border-slate-900 pb-3">
      <div>
        <h2 className="text-xl font-black">سجل معاملات الأمانة</h2>
        <p className="mt-1 text-sm font-bold">{account.deposit.customerName}</p>
      </div>
      <span className="text-[10px] text-slate-500">تاريخ الطباعة: {new Date().toLocaleString('ar-LY')}</span>
    </div>
    <table className="w-full border-collapse text-[11px]">
      <thead className="bg-slate-900 text-white">
        <tr>
          <th className="border p-2">#</th><th className="border p-2">التاريخ</th>
          <th className="border p-2">الحركة</th><th className="border p-2">البيان</th>
          <th className="border p-2">الحركة الليبية</th><th className="border p-2">الحركة المصرية</th>
          <th className="border p-2">رصيد الليبي</th><th className="border p-2">رصيد المصري</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ transaction, amountLyd, amountEgp, index }) => {
          const lydEffect = transaction.type === 'deposit_lyd'
            ? `+ ${money(transaction.amountLyd, 'lyd')}`
            : transaction.type === 'withdraw_lyd' || transaction.type === 'convert_to_egp'
              ? `- ${money(transaction.amountLyd, 'lyd')}`
              : '—';
          const egpEffect = transaction.type === 'deposit_egp' || transaction.type === 'convert_to_egp'
            ? `+ ${money(transaction.amountEgp, 'egp')}`
            : transaction.type === 'withdraw_egp'
              ? `- ${money(transaction.amountEgp, 'egp')}`
              : '—';
          return (
            <tr key={transaction.id} className="even:bg-slate-50">
              <td className="border p-2 text-center">{index + 1}</td>
              <td className="whitespace-nowrap border p-2">{new Date(transaction.date).toLocaleString('ar-LY')}</td>
              <td className="border p-2 font-bold">{transactionLabel[transaction.type]}</td>
              <td className="border p-2">{transaction.note}</td>
              <td className="border p-2 text-center font-bold">{lydEffect}</td>
              <td className="border p-2 text-center font-bold">{egpEffect}</td>
              <td className="border p-2 text-center font-black">{netMoney(amountLyd, 'lyd')}</td>
              <td className="border p-2 text-center font-black">{netMoney(amountEgp, 'egp')}</td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-900 font-black">
          <td colSpan={6} className="border p-3 text-left">الإجمالي النهائي</td>
          <td className={`border p-3 text-center ${account.amountLyd < 0 ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-900'}`}>{netMoney(account.amountLyd, 'lyd')}</td>
          <td className={`border p-3 text-center ${account.amountEgp < 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-900'}`}>{netMoney(account.amountEgp, 'egp')}</td>
        </tr>
      </tfoot>
    </table>
  </div>
));
PrintableLedger.displayName = 'PrintableLedger';

function TopCard({ icon, title, value, onClick }: { icon: React.ReactElement; title: string; value: string; onClick?: () => void }) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component onClick={onClick} className="min-h-24 rounded-2xl border border-indigo-600 bg-indigo-800 p-4 text-right text-white shadow-lg transition hover:-translate-y-0.5">
      <div className="flex items-center justify-between"><div><span className="block text-[10px] font-bold text-indigo-200">{title}</span><strong className="mt-2 block text-lg">{value}</strong></div>{React.cloneElement(icon, { className: 'h-8 w-8 rounded-xl bg-white/10 p-1.5' })}</div>
    </Component>
  );
}

function BalanceCard({ label, value, negative }: { label: string; value: string; negative: boolean }) {
  return <div className={`rounded-xl border p-3 ${negative ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-indigo-200 bg-indigo-50 text-indigo-900'}`}><span className="block text-[9px] font-bold opacity-70">{label}</span><strong className="mt-1 block text-base">{value}</strong></div>;
}

function ToolbarLabel({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2.5 text-center text-xs font-black text-white">{children}</div>;
}

function ToolbarButton({ children, color, onClick }: { children: React.ReactNode; color: 'indigo' | 'rose' | 'slate' | 'emerald' | 'amber' | 'violet'; onClick: () => void }) {
  const colors = { indigo: 'bg-indigo-600', rose: 'bg-rose-600', slate: 'bg-slate-700', emerald: 'bg-emerald-600', amber: 'bg-amber-600', violet: 'bg-violet-600' };
  return <button onClick={onClick} className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-black text-white ${colors[color]} [&_svg]:h-4 [&_svg]:w-4`}>{children}</button>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" dir="rtl"><div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-3"><h3 className="font-black">{title}</h3><button onClick={onClose} className="rounded-lg bg-slate-100 p-2"><X className="h-4 w-4" /></button></div>{children}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>;
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-black text-white"><CheckCircle2 className="h-4 w-4" />{children}</button>;
}
