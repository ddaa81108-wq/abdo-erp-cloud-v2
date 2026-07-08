import React, { useState } from 'react';
import { Landmark, ArrowRightLeft, Shield, CircleAlert as AlertCircle, Plus, Trash2, Search, Coins, RefreshCw, FileText, ChevronDown, ChevronUp, CircleCheck as CheckCircle, UserCheck, Receipt, DollarSign, Image, X, Copy, Calculator, Minus, CircleCheck as CheckCircle2 } from 'lucide-react';
import { ERPState, TrustDeposit, TrustDepositTx, TreasuryTransaction } from '../types';
import { copySettledImage, generateUnifiedSmartCard, openSmartCardStudio } from "../utils/imageExporterUtils";
import { VoiceInputButton } from "./VoiceInputButton";

interface DepositsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (section: string, metrics: any, headers: string[], rows: any[][]) => void;
  // Global undo deletion system
  pendingDeletions?: string[];
  onScheduleDeletion?: (
    type: 'customer' | 'company' | 'merchant' | 'deposit' | 'transaction',
    itemId: string,
    displayName: string,
    executeDeletion: () => void
  ) => void;
  onCancelDeletion?: (itemId: string) => void;
}

export default function DepositsModule({
  state,
  onUpdateState,
  onOpenExporter,
  pendingDeletions = [],
  onScheduleDeletion,
  onCancelDeletion,
}: DepositsModuleProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  // Floating Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcRows, setCalcRows] = useState<{ id: string; value: string; price: string; operator: "multiply" | "divide" | "add" | "subtract" }[]>([
    { id: '1', value: '', price: '', operator: 'multiply' }
  ]);
  const [calcCopied, setCalcCopied] = useState(false);

  // Floating Calculator Logic
  const handleAddCalcRow = () => {
    setCalcRows(prevRows => [...prevRows, { id: Math.random().toString(), value: '', price: '', operator: 'multiply' }]);
  };

  const handleUpdateCalcRow = (id: string, field: string, val: string) => {
    setCalcRows(prevRows => prevRows.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const handleRemoveCalcRow = (id: string) => {
    setCalcRows(prevRows => prevRows.filter(r => r.id !== id));
  };

  const calculateRowResult = (row: typeof calcRows[0]) => {
    const v = parseFloat(row.value) || 0;
    const p = parseFloat(row.price) || 0;
    
    if (v === 0 && p === 0) return 0;
    
    let result = 0;
    switch (row.operator) {
      case 'multiply': result = v * p; break;
      case 'divide': result = p !== 0 ? v / p : 0; break;
      case 'add': result = v + p; break;
      case 'subtract': result = v - p; break;
    }
    return Math.round(result);
  };

  const totalCalcResult = calcRows.reduce((acc, row) => acc + calculateRowResult(row), 0);

  const handleCopyCalcResult = () => {
    navigator.clipboard.writeText(totalCalcResult.toString());
    setCalcCopied(true);
    setTimeout(() => setCalcCopied(false), 2000);
  };

  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  React.useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Expand states for each card config
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // New Customer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newInitialAmount, setNewInitialAmount] = useState('');
  const [newCurrency, setNewCurrency] = useState<'lyd' | 'egp'>('lyd');
  const [newNote, setNewNote] = useState('');

  // Confirmation state for deleting/archiving a deposit card
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Inline forms state - linked to specific customer card ID
  const [actionType, setActionType] = useState<'deposit' | 'withdraw' | 'convert' | 'withdraw_egp' | 'settlement' | 'deposit_egp' | 'transfer_egypt' | null>(null);
  const [actionAmountLyd, setActionAmountLyd] = useState('');
  const [actionAmountEgp, setActionAmountEgp] = useState('');
  const [actionExchangeRate, setActionExchangeRate] = useState('1.0'); // default Egyptian Pound rate
  const [actionNote, setActionNote] = useState('');
  const [actionTargetId, setActionTargetId] = useState('');

  const generateReferenceNo = () => {
    const totalTxsCount = state.debtTransactions.length + state.companyTransactions.length + 50;
    const padding = String(totalTxsCount + 121).padStart(6, '0');
    return `TX-2026-${padding}`;
  };

  // Safe fallback getters for historic or incomplete models
  const getAmountLyd = (d: TrustDeposit) => d.amountLyd !== undefined ? d.amountLyd : d.amount;
  const getAmountEgp = (d: TrustDeposit) => d.amountEgp !== undefined ? d.amountEgp : 0;
  
  const getHistory = (d: TrustDeposit): TrustDepositTx[] => {
    if (d.history && d.history.length > 0) return d.history;
    return [
      {
        id: `tx_sub_init_${d.id}`,
        type: 'deposit_lyd',
        amountLyd: d.amount,
        amountEgp: 0,
        date: d.date || new Date().toISOString(),
        note: d.note || 'إيداع أمانة بالدفاتر لأول مرة'
      }
    ];
  };

  // 1. ADD NEW Escrow Customer
  const handleCreateCustomerDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustName.trim();
    const amountVal = Math.floor(parseFloat(newInitialAmount));

    if (!name || isNaN(amountVal)) {
      alert('الرجاء إدخال اسم العميل وقيمة الأمانة بشكل صحيح.');
      return;
    }
    
    // Check for duplicates
    const isDuplicate = state.trustDeposits.some(
      d => !d.isDeleted && d.status === 'held' && d.customerName.trim().toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      alert(`الاسم "${name}" موجود مسبقاً في قسم الأمانات المفتوحة. يرجى البحث عنه وإضافة الرصيد إليه مباشرة بدلاً من تكرار الاسم.`);
      return;
    }

    const refNo = generateReferenceNo();
    const nowStr = new Date().toISOString();
    const newId = `dep_${Date.now()}`;

    const isLyd = newCurrency === 'lyd';

    const newDeposit: TrustDeposit = {
      id: newId,
      customerName: name,
      amount: isLyd ? amountVal : 0,
      amountLyd: isLyd ? amountVal : 0,
      amountEgp: isLyd ? 0 : amountVal,
      currency: 'د.ل',
      date: nowStr,
      referenceNo: refNo,
      status: 'held',
      note: newNote || 'إيداع أمانة بالصندوق',
      createdAt: nowStr,
      history: [
        {
          id: `sub_${Date.now()}_1`,
          type: isLyd ? 'deposit_lyd' : 'deposit_egp',
          amountLyd: isLyd ? amountVal : 0,
          amountEgp: isLyd ? 0 : amountVal,
          date: nowStr,
          note: newNote || 'إيداع أمانة بالصندوق'
        }
      ]
    };

    const updatedDeposits = [...state.trustDeposits];
    updatedDeposits.push(newDeposit);

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    // Reset inputs
    setNewCustName('');
    setNewInitialAmount('');
    setNewCurrency('lyd');
    setNewNote('');
    setIsAddModalOpen(false);
  };

  // 2. TRANSACTION: DEPOSIT LYD (زيادة أمانة بالليبي)
  const handleAddLydCustody = (id: string) => {
    const amount = parseFloat(actionAmountLyd);
    if (isNaN(amount) || amount <= 0) {
      alert('يرجى إدخال قيمة صحيحة للإيداع.');
      return;
    }

    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    if (dep.status !== 'held') return;

    const nowStr = new Date().toISOString();
    const refNo = generateReferenceNo();
    const currentLyd = getAmountLyd(dep);
    const currentEgp = getAmountEgp(dep);
    const currentHistory = getHistory(dep);

    const updatedLyd = currentLyd + amount;
    const updatedTotal = updatedLyd;

    const newSubTx: TrustDepositTx = {
      id: `sub_${Date.now()}`,
      type: 'deposit_lyd',
      amountLyd: amount,
      amountEgp: 0,
      date: nowStr,
      note: actionNote || 'زيادة وإيداع رصيد أمانة بالدينار الليبي'
    };

    // Reflect on customer
    const updatedDeposits = [...state.trustDeposits];
    updatedDeposits[depIndex] = {
      ...dep,
      amount: updatedTotal,
      amountLyd: updatedLyd,
      history: [...currentHistory, newSubTx],
      note: actionNote || dep.note
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    // Reset action state
    resetActionForm();
  };

  // 3. TRANSACTION: WITHDRAW/REFUND LYD (سحب نقدي بالليبي)
  const handleWithdrawLydCustody = (id: string) => {
    const amount = parseFloat(actionAmountLyd);
    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    const currentLyd = getAmountLyd(dep);

    if (isNaN(amount) || amount <= 0) {
      alert(`القيمة غير صحيحة.`);
      return;
    }

    const nowStr = new Date().toISOString();
    const refNo = generateReferenceNo();
    const currentEgp = getAmountEgp(dep);
    const currentHistory = getHistory(dep);

    const updatedLyd = currentLyd - amount;
    const updatedTotal = updatedLyd;
    const isNowCleared = updatedLyd === 0 && currentEgp === 0;

    const newSubTx: TrustDepositTx = {
      id: `sub_${Date.now()}`,
      type: 'withdraw_lyd',
      amountLyd: amount,
      amountEgp: 0,
      date: nowStr,
      note: actionNote || 'سحب واسترداد نقدي من الأمانة بالليبي'
    };

    // Reflect on customer
    const updatedDeposits = [...state.trustDeposits];
    updatedDeposits[depIndex] = {
      ...dep,
      amount: updatedTotal,
      amountLyd: updatedLyd,
      status: 'held', // auto clear disabled to keep card visible
      history: [...currentHistory, newSubTx],
      note: actionNote || dep.note
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
    if (isNowCleared) {
      setExpandedCardId(null);
    }
  };

  // 4. TRANSACTION: CONVERT PART OF DEPOSIT TO EGYPTIAN POUNDS (تحويل جزء للمصري مع الصرف اليومي)
  const handleConvertToEgpCustody = (id: string) => {
    const lydAmount = parseFloat(actionAmountLyd);
    const rate = parseFloat(actionExchangeRate);

    if (isNaN(lydAmount) || lydAmount <= 0 || isNaN(rate) || rate <= 0) {
      alert('يرجى إدخال قيمة تحويل (بالدينار الليبي) وسعر صرف اليوم بشكل رصين.');
      return;
    }

    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    if (dep.status !== 'held') return;

    const currentLyd = getAmountLyd(dep);

    const calculatedEgp = lydAmount * rate;
    const nowStr = new Date().toISOString();
    const refNo = generateReferenceNo();

    const currentEgp = getAmountEgp(dep);
    const currentHistory = getHistory(dep);

    const updatedLyd = currentLyd - lydAmount;
    const updatedEgp = currentEgp + calculatedEgp;
    const isNowCleared = updatedLyd === 0 && updatedEgp === 0;

    const newSubTx: TrustDepositTx = {
      id: `sub_${Date.now()}`,
      type: 'convert_to_egp',
      amountLyd: lydAmount,
      amountEgp: calculatedEgp,
      rate: rate,
      date: nowStr,
      note: actionNote || `تحويل مبلغ ${lydAmount.toLocaleString()} د.ل إلى مصري بسعر صرف ${rate}`
    };

    // Reflect on customer
    const updatedDeposits = [...state.trustDeposits];
    updatedDeposits[depIndex] = {
      ...dep,
      amount: updatedLyd,
      amountLyd: updatedLyd,
      amountEgp: updatedEgp,
      status: 'held',
      history: [...currentHistory, newSubTx]
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
  };

  // 5. TRANSACTION: WITHDRAW EGYPTIAN POUNDS (سحب أمانة مصري)
  const handleWithdrawEgpCustody = (id: string) => {
    const amountEgpToWithdraw = parseFloat(actionAmountEgp);
    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    const currentEgp = getAmountEgp(dep);
    const currentLyd = getAmountLyd(dep);

    if (isNaN(amountEgpToWithdraw) || amountEgpToWithdraw <= 0) {
      alert(`القيمة غير صحيحة.`);
      return;
    }

    const nowStr = new Date().toISOString();
    const currentHistory = getHistory(dep);

    const updatedEgp = currentEgp - amountEgpToWithdraw;
    const isNowCleared = currentLyd === 0 && updatedEgp === 0;

    const newSubTx: TrustDepositTx = {
      id: `sub_${Date.now()}`,
      type: 'withdraw_egp',
      amountLyd: 0,
      amountEgp: amountEgpToWithdraw,
      date: nowStr,
      note: actionNote || 'سحب واسترداد نقدي من الأمانة بالجنيه المصري باليد'
    };

    // Reflect on customer
    const updatedDeposits = [...state.trustDeposits];
    updatedDeposits[depIndex] = {
      ...dep,
      amountEgp: updatedEgp,
      status: 'held',
      history: [...currentHistory, newSubTx]
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
    if (isNowCleared) {
      setExpandedCardId(null);
    }
  };

  // 5.1 TRANSACTION: DEPOSIT EGYPTIAN POUNDS (إيداع أمانة بالجنيه المصري مباشرة)
  const handleDepositEgpCustody = (id: string) => {
    const amount = parseFloat(actionAmountEgp);
    if (isNaN(amount) || amount <= 0) {
      alert('يرجى إدخال قيمة صحيحة للإيداع بالجنيه المصري.');
      return;
    }

    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    if (dep.status !== 'held') return;

    const nowStr = new Date().toISOString();
    const currentEgp = getAmountEgp(dep);
    const currentHistory = getHistory(dep);

    const updatedEgp = currentEgp + amount;

    const newSubTx: TrustDepositTx = {
      id: `sub_${Date.now()}`,
      type: 'deposit_egp',
      amountLyd: 0,
      amountEgp: amount,
      date: nowStr,
      note: actionNote || 'إيداع أمانة نقدية بالجنيه المصري بالصندوق'
    };

    // Reflect on customer
    const updatedDeposits = [...state.trustDeposits];
    updatedDeposits[depIndex] = {
      ...dep,
      amountEgp: updatedEgp,
      status: 'held',
      history: [...currentHistory, newSubTx]
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
  };

  // 5.2 TRANSACTION: TRANSFER TO EGYPT (حوالة مرسلة داخل مصر خصماً من الأمانة)
  const handleTransferToEgypt = (id: string) => {
    const amountLydVal = parseFloat(actionAmountLyd) || 0;
    const amountEgpVal = parseFloat(actionAmountEgp) || 0;
    
    if (amountLydVal <= 0 && amountEgpVal <= 0) {
      alert('يرجى إدخال قيمة صحيحة للتحويل (بالدينار الليبي أو الجنيه المصري).');
      return;
    }

    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    if (dep.status !== 'held') return;

    const currentLyd = getAmountLyd(dep);
    const currentEgp = getAmountEgp(dep);
    const nowStr = new Date().toISOString();
    const refNo = generateReferenceNo();

    let updatedLyd = currentLyd;
    let updatedEgp = currentEgp;
    let noteDetails = '';

    if (amountLydVal > 0) {
      updatedLyd = currentLyd - amountLydVal;
      noteDetails = `خصماً من أمانة الليبي: حوالة بمبلغ ${amountLydVal.toLocaleString()} د.ل داخل مصر`;
    } else {
      updatedEgp = currentEgp - amountEgpVal;
      noteDetails = `خصماً من أمانة المصري: حوالة بمبلغ ${amountEgpVal.toLocaleString()} جنيه داخل مصر`;
    }

    const isNowCleared = updatedLyd === 0 && updatedEgp === 0;

    const newSubTx: TrustDepositTx = {
      id: `sub_${Date.now()}`,
      type: amountLydVal > 0 ? 'withdraw_lyd' : 'withdraw_egp',
      amountLyd: amountLydVal,
      amountEgp: amountEgpVal,
      date: nowStr,
      note: actionNote || noteDetails
    };

    // Reflect on customer
    const updatedDeposits = [...state.trustDeposits];
    updatedDeposits[depIndex] = {
      ...dep,
      amount: updatedLyd,
      amountLyd: updatedLyd,
      amountEgp: updatedEgp,
      status: 'held',
      history: [...getHistory(dep), newSubTx]
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
  };

  // 6. TRANSACTION: APPLY ESCROW TO SETTLE CUSTOMER DEBT (مقاصة ديون العميل)
  const handleReleaseToDebtWithLyd = (id: string) => {
    const amount = parseFloat(actionAmountLyd);
    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    const currentLyd = getAmountLyd(dep);

    if (isNaN(amount) || amount <= 0) {
      alert(`القيمة غير صحيحة.`);
      return;
    }

    // Check if customer exists in client roster
    const matchedCust = state.customers.find(
      c => c.name.trim().toLowerCase() === dep.customerName.trim().toLowerCase()
    );

    if (!matchedCust) {
      alert(`تنبيه: لم نعثر على ملف عميل نشط يطابق تماماً ك الاسم "${dep.customerName}". يرجى تسجيل العميل أولاً في قسم ديون العملاء بنفس هذا الاسم لإجراء الترحيل والمقاصة بالدورة الحسابية.`);
      return;
    }

    // Retrieve customer's active cycle
    const activeCycleIndex = state.cycles.findIndex(
      cy => cy.customerId === matchedCust.id && cy.status === 'active'
    );

    if (activeCycleIndex === -1) {
      alert('العميل المستهدف لا يمتلك حالياً أي دورة ديون حسابية نشطة. يرجى تهيئته أولاً لتنزيل الخصم وتوزيع القيمة.');
      return;
    }

    const activeCycle = state.cycles[activeCycleIndex];
    const txId = `tx_dep_release_${Date.now()}`;
    const refNo = generateReferenceNo();
    const nowStr = new Date().toISOString();

    // Create a payment transaction for customer using the deposit
    const newTx: any = {
      id: txId,
      customerId: matchedCust.id,
      cycleId: activeCycle.id,
      type: 'payment',
      amount: amount,
      currency: 'د.ل',
      conversionRate: 1.0,
      date: nowStr,
      referenceNo: refNo,
      note: `تسوية مقاصة بالترحيل من الأمانة بمرجع ${dep.referenceNo}`,
      postedToTreasury: true, // it was already registered in treasury before when we accepted the deposit!
      createdAt: nowStr
    };

    // Resettle customer balance
    const updatedCycles = [...state.cycles];
    const newBalance = activeCycle.currentBalance - amount;
    const cyUpdate: any = {
      ...activeCycle,
      currentBalance: newBalance,
      status: newBalance === 0 ? 'closed' : 'active',
    };
    if (newBalance === 0) cyUpdate.endDate = nowStr;
    else delete cyUpdate.endDate;
    
    updatedCycles[activeCycleIndex] = cyUpdate;

    // Reflect on customer custody
    const currentEgp = getAmountEgp(dep);
    const updatedLyd = currentLyd - amount;
    const isNowCleared = updatedLyd === 0 && currentEgp === 0;

    const newSubTx: TrustDepositTx = {
      id: `sub_${Date.now()}`,
      type: 'withdraw_lyd',
      amountLyd: amount,
      amountEgp: 0,
      date: nowStr,
      note: actionNote || `تحويل ومقاصة لصالح دورة الديون النشطة بمستند ${refNo}`
    };

    const updatedDeposits = [...state.trustDeposits];
    updatedDeposits[depIndex] = {
      ...dep,
      amount: updatedLyd,
      amountLyd: updatedLyd,
      status: 'held',
      history: [...getHistory(dep), newSubTx]
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits,
      cycles: updatedCycles,
      debtTransactions: [...state.debtTransactions, newTx]
    });

    resetActionForm();
    if (isNowCleared) {
      setExpandedCardId(null);
    }
  };

  // Direct complete delete - upgraded to soft delete to trash can without confirm trigger
  const handleDeleteDeposit = (id: string) => {
    const deposit = state.trustDeposits.find(d => d.id === id);
    const displayName = deposit ? deposit.customerName : "أمانة";

    if (onScheduleDeletion) {
      onScheduleDeletion('deposit', id, displayName, () => {
        executeDeleteDeposit(id);
      });
    } else {
      executeDeleteDeposit(id);
    }
  };

  const executeDeleteDeposit = (id: string) => {
    const updated = state.trustDeposits.map(d => {
      if (d.id === id) {
        return { ...d, isDeleted: true };
      }
      return d;
    });
    onUpdateState({
      ...state,
      trustDeposits: updated
    });
    setDeleteConfirmId(null);
  };

  // حذف عملية مفردة من أرشيف الأمانة
  const handleDeleteArchiveTx = (depositId: string, txId: string) => {
    const deposit = state.trustDeposits.find(d => d.id === depositId);
    if (!deposit) return;
    if (!deposit.history || deposit.history.length === 0) return;

    // إزالة العملية من السجل
    const updatedHistory = deposit.history.filter(tx => tx.id !== txId);

    // إعادة حساب الأرصدة من السجل المتبقي
    let newLyd = 0;
    let newEgp = 0;
    updatedHistory.forEach(tx => {
      if (tx.type === 'deposit_lyd') newLyd += tx.amountLyd;
      else if (tx.type === 'withdraw_lyd') newLyd -= tx.amountLyd;
      else if (tx.type === 'convert_to_egp') { newLyd -= tx.amountLyd; newEgp += tx.amountEgp; }
      else if (tx.type === 'withdraw_egp') newEgp -= tx.amountEgp;
      else if (tx.type === 'deposit_egp') newEgp += tx.amountEgp;
      else if (tx.type === 'transfer_egypt') newLyd -= tx.amountLyd;
      else if (tx.type === 'settlement') newLyd -= tx.amountLyd;
    });

    const updatedDeposits = state.trustDeposits.map(d => {
      if (d.id === depositId) {
        return {
          ...d,
          amount: newLyd,
          amountLyd: newLyd,
          amountEgp: newEgp,
          history: updatedHistory.length > 0 ? updatedHistory : undefined,
        };
      }
      return d;
    });

    onUpdateState({ ...state, trustDeposits: updatedDeposits });
    setShowSuccessToast("🗑️ تم حذف العملية وتحديث الرصيد.");
  };

  const resetActionForm = () => {
    setActionType(null);
    setActionAmountLyd('');
    setActionAmountEgp('');
    setActionExchangeRate('1.0');
    setActionNote('');
    setActionTargetId('');
  };

  const handleCloseExpandedCard = () => {
    setExpandedCardId(null);
    resetActionForm();
  };

  const handleToggleExpandedCard = (cardId: string, isExpanded: boolean) => {
    if (isExpanded) {
      handleCloseExpandedCard();
      return;
    }

    setExpandedCardId(cardId);
    resetActionForm();
  };

  const handleModalBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    handleCloseExpandedCard();
  };

  // Generate Image-Report inside the card for WhatsApp sharing
  const handleExportSingleDepositDraft = (d: TrustDeposit) => {
    const headers = ['تاريخ الحركة', 'نوع الحركة والمجال', 'تأثير ليبي د.ل', 'تأثير مصري جنيه', 'البيان والتفاصيل'];
    
    const historyList = [...getHistory(d)].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const rows = historyList.map(tx => {
      let typeText = '';
      if (tx.type === 'deposit_lyd') typeText = '➕ إيداع ليبي';
      else if (tx.type === 'withdraw_lyd') typeText = '💸 استرداد ليبي';
      else if (tx.type === 'convert_to_egp') typeText = '🔁 تحويل مصري';
      else if (tx.type === 'withdraw_egp') typeText = '🇪🇬 سحب مصري';
      else if (tx.type === 'deposit_egp') typeText = '➕ إيداع مصري';

      return [
        new Date(tx.date).toLocaleDateString('ar-LY'),
        typeText,
        tx.amountLyd > 0 ? `${tx.amountLyd.toLocaleString()} د.ل` : '-',
        tx.amountEgp > 0 ? `${tx.amountEgp.toLocaleString()} جنيه` : '-',
        tx.note
      ];
    });

    const statusText = d.status === 'held' ? '🔒 حساب نشط معلق' : '✓ حساب مصفر مستوفى بالكامل';

    onOpenExporter(
      `كشف حساب أمانة - العميل: ${d.customerName}`,
      {
        label1: 'رصيد الأمانة بالليبي د.ل',
        value1: `${getAmountLyd(d).toLocaleString()} د.ل`,
        label2: 'رصيد الأمانة بالمصري ج.م',
        value2: `${getAmountEgp(d).toLocaleString()} جنيه`,
        label3: 'الوضعية والظرف الحالي',
        value3: statusText
      },
      headers,
      rows
    );
  };

  // Full master export of all ACTIVE deposits
  const handleExportAllActiveImage = () => {
    const headers = ['مستند الأمانة', 'صاحب الأمانة', 'تاريخ الفتح', 'الأمانة بالليبي', 'الأمانة بالمصري', 'ملاحظات وتفاصيل'];
    
    const rows = activeHeldDeposits.map(d => [
      d.referenceNo,
      d.customerName,
      new Date(d.date).toLocaleDateString('ar-LY'),
      `${getAmountLyd(d).toLocaleString()} د.ل`,
      getAmountEgp(d) > 0 ? `${getAmountEgp(d).toLocaleString()} جنيه` : '-',
      d.note || 'لا يوجد'
    ]);

    onOpenExporter(
      'صحيفة الأمانات والودائع الجارية النشطة بالمنظومة',
      {
        label1: 'إجمالي الأمانات بالليبي',
        value1: `${aggregateHeldLyd.toLocaleString()} د.ل`,
        label2: 'إجمالي الأمانات بالمصري',
        value2: `${aggregateHeldEgp.toLocaleString()} جنيه`,
        label3: 'عدد الحسابات المفتوحة',
        value3: `${activeHeldDeposits.length} حسابات`
      },
      headers,
      rows
    );
  };

  // Filter calculations
  const activeHeldDeposits = state.trustDeposits.filter(d => 
    !d.isDeleted &&
    d.status === 'held'
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const expandedDeposit = activeHeldDeposits.find(d => d.id === expandedCardId) ?? null;
  const expandedDepositLyd = expandedDeposit ? getAmountLyd(expandedDeposit) : 0;
  const expandedDepositEgp = expandedDeposit ? getAmountEgp(expandedDeposit) : 0;

  const archivedDeposits = state.trustDeposits.filter(d => 
    !d.isDeleted &&
    (d.status === 'refunded' || d.status === 'released_to_debt' || (getAmountLyd(d) === 0 && getAmountEgp(d) === 0))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Aggregate totals
  const aggregateHeldLyd = state.trustDeposits
    .filter(d => !d.isDeleted && d.status === 'held')
    .reduce((sum, d) => sum + getAmountLyd(d), 0);

  const aggregateHeldEgp = state.trustDeposits
    .filter(d => !d.isDeleted && d.status === 'held')
    .reduce((sum, d) => sum + getAmountEgp(d), 0);

  const handleCopyDepositImage = async (d: TrustDeposit) => {
    const lyd = Math.round(getAmountLyd(d));
    const egp = Math.round(getAmountEgp(d));

    // الأمانة بعملتين لا يوجد لها قسم مقابل في منظومة الكروت الذكية بعد، تُنسخ بالطريقة القديمة
    if (lyd !== 0 && egp !== 0) {
      try {
        const success = await generateUnifiedSmartCard(d.customerName, lyd, "trust_dual", undefined, "د.ل", egp, "ج.م");
        if (success) {
          setShowSuccessToast("تم نسخ صورة الأمانة بنجاح 📋");
          setTimeout(() => setShowSuccessToast(null), 3000);
        } else {
          alert("حدث خطأ أثناء حفظ الصورة في الحافظة.");
        }
      } catch (err) {
        console.error("Failed to copy image", err);
        alert("حدث خطأ أثناء حفظ الصورة في الحافظة.");
      }
      return;
    }

    const isEgp = egp !== 0;
    openSmartCardStudio({
      type: "trust",
      name: d.customerName,
      amount: Math.abs(isEgp ? egp : lyd),
      currency: isEgp ? "ج.م" : "د.ل",
    });
    setShowSuccessToast("تم فتح منظومة الكروت الذكية 👑");
    setTimeout(() => setShowSuccessToast(null), 3000);
  };


  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-10 fade-in duration-300">
          <CheckCircle className="w-5 h-5" />
          <span className="font-bold">{showSuccessToast}</span>
        </div>
      )}

      {/* TOP HEADER SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* LYD Totals Card - counts as liability on treasury */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Landmark className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-extrabold text-sm tracking-wide">
                🔒 إجمالي الأمانات (بالدينار الليبي)
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <Landmark className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-auto">
              <span className="font-mono text-3xl font-black text-white tracking-widest drop-shadow-md block mb-1">
                {aggregateHeldLyd.toLocaleString()} <span className="text-lg font-bold text-slate-300">د.ل</span>
              </span>
              <p className="text-[10px] text-slate-400 font-semibold">
                * يتم ترحيلها وقيدها بالسالب وتخصم مع المطلوبات المالية
              </p>
            </div>
          </div>
        </div>

        {/* EGP Totals Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Coins className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white font-extrabold text-sm tracking-wide">
                🇪🇬 إجمالي الأمانات (بالجنيه المصري)
              </span>
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                <Coins className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="mt-auto">
              <span className="font-mono text-3xl font-black text-white tracking-widest drop-shadow-md block mb-1">
                {aggregateHeldEgp.toLocaleString()} <span className="text-lg font-bold text-slate-300">جنيه</span>
              </span>
              <p className="text-[10px] text-slate-400 font-semibold">
                * رصيد الأمانات المحول مصري ومسجل بالصندوق الجاري
              </p>
            </div>
          </div>
        </div>

        {/* ADD CUSTOMER BUTTON */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 rounded-2xl p-5 shadow-2xl relative overflow-hidden group cursor-pointer transition-all flex items-center justify-center gap-3 text-right"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Plus className="w-24 h-24 text-white" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md text-white">
              <Plus className="w-7 h-7" />
            </div>
            <span className="text-white font-extrabold text-xl tracking-wide">إضافة عميل أمانة جديد</span>
          </div>
        </button>

      </div>

      {/* ACTIVE CARDS LISTING GRID */}
      <div>
        <h3 className="font-extrabold text-slate-900 text-sm mb-3 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>الأمانات والودائع الجارية الفعالة حالياً ({activeHeldDeposits.length})</span>
        </h3>

        {activeHeldDeposits.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 border-dashed text-center rounded-xl p-12 text-slate-500 text-xs">
            لا توجد أمانات سارية أو حسابات مودعة نشطة حالياً مطابقة لشروط البحث.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {activeHeldDeposits.map(d => {
              const customerLyd = getAmountLyd(d);
              const customerEgp = getAmountEgp(d);
              const isExpanded = expandedCardId === d.id;

              return (
                <div
                  key={d.id}
                  onClick={(e) => {
                    if ((e.target as Element).closest("button")) return;
                    handleToggleExpandedCard(d.id, isExpanded);
                  }}
                  className={`${(Number(customerLyd) === 0 && Number(customerEgp) === 0) ? 'bg-emerald-600 border-emerald-400 ring-2 ring-emerald-300 ring-offset-1 text-white' : 'bg-indigo-600 border-indigo-500 text-white'} border rounded-xl p-2 cursor-pointer transition-all hover:scale-[1.02] shadow-md group min-h-[72px] relative text-center overflow-visible`}
                >
                  {/* CARD TILE BODY */}
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                    <Landmark className="w-12 h-12 text-white" />
                  </div>
                  <div className="flex items-center justify-between mb-1 relative z-10">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleCopyDepositImage(d); }}
                        className="bg-white/10 hover:bg-white/30 text-white p-1 rounded-md transition-all cursor-pointer"
                        title="نسخ كارت الصورة 📸"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteDeposit(d.id); }}
                        className="bg-white/10 hover:bg-rose-500/80 text-white p-1 rounded-md transition-all cursor-pointer"
                        title="حذف وأرشفة ❌"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-extrabold text-white text-[11px] mb-1 w-full truncate px-1 drop-shadow-sm">{d.customerName}</h4>
                  <div className="flex flex-col items-center">
                    <span className={`font-mono text-sm font-black ${customerLyd < 0 ? 'text-rose-100' : 'text-white'}`}>
                      {Math.round(customerLyd).toLocaleString('en-US')} د.ل
                    </span>
                    {customerEgp !== 0 && (
                      <span className={`font-mono text-xs font-black mt-1 ${customerEgp < 0 ? 'text-rose-100' : 'text-white'}`}>
                        {Math.round(customerEgp).toLocaleString('en-US')} ج.م
                      </span>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {expandedDeposit && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto cursor-default"
          onClick={handleModalBackdropClick}
        >
          <div
            className="relative w-full max-w-4xl bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col max-h-[95vh] my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* رأس البطاقة: معلومات + أزرار في صف واحد */}
            <div className={`border-t-[6px] rounded-t-2xl px-5 pt-4 pb-3 ${(expandedDepositLyd > 0 || expandedDepositEgp > 0) ? 'border-amber-500' : 'border-emerald-500'}`}>
              {/* الصف الأول: اسم العميل + الأرصدة */}
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-extrabold text-slate-900 text-base">{expandedDeposit.customerName}</h4>
                <div className="flex items-center gap-4 text-left">
                  <div className="font-mono text-base font-black text-slate-900">
                    {Math.round(expandedDepositLyd).toLocaleString('en-US')} <span className="text-[11px] text-slate-400">د.ل</span>
                  </div>
                  {expandedDepositEgp !== 0 && (
                    <div className="font-mono text-sm font-black text-emerald-600">
                      {Math.round(expandedDepositEgp).toLocaleString('en-US')} <span className="text-[10px] text-emerald-500">ج.م</span>
                    </div>
                  )}
                </div>
              </div>

              {/* الصف الثاني: جميع الأزرار في صف واحد */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex flex-row-reverse items-center gap-1.5">
                  {/* أقصى اليسار */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCloseExpandedCard(); }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                  >
                    ✕ إغلاق
                  </button>
                  <span className="w-px h-6 bg-slate-200 mx-1" />
                  {/* الوسط: إيداع ليبي + سحب ليبي + طباعة PDF */}
                  <button
                    onClick={(e) => { e.stopPropagation(); resetActionForm(); setActionType('deposit'); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap"
                  >
                    ➕ إيداع ليبي
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); resetActionForm(); setActionType('withdraw'); }}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap"
                  >
                    💸 سحب ليبي
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExportSingleDepositDraft(expandedDeposit); }}
                    className="bg-slate-700 hover:bg-slate-800 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap"
                  >
                    🖨️ طباعة PDF
                  </button>
                  <span className="w-px h-6 bg-slate-200 mx-1" />
                  {/* أقصى اليمين: إيداع مصري + سحب مصري + تحويل مصري */}
                  <button
                    onClick={(e) => { e.stopPropagation(); resetActionForm(); setActionType('deposit_egp'); }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap"
                  >
                    🇪🇬 إيداع مصري
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); resetActionForm(); setActionType('withdraw_egp'); }}
                    className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap"
                  >
                    🇪🇬 سحب مصري
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); resetActionForm(); setActionType('convert'); }}
                    className="bg-purple-500 hover:bg-purple-600 text-white font-extrabold text-[11px] px-3 py-1.5 rounded-lg transition shadow-sm whitespace-nowrap"
                  >
                    🔄 تحويل مصري
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 font-mono shrink-0">
                  {expandedDeposit.referenceNo}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 custom-scrollbar rounded-b-2xl">
              {actionType && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs animate-fade">
                  <h5 className="text-[11px] font-black text-slate-800 mb-2 border-b pb-1.5 flex items-center justify-between">
                    <span>
                      {actionType === 'deposit' && 'إيداع إضافي بالدينار الليبي لحساب الأمانة'}
                      {actionType === 'withdraw' && 'سحب واسترجاع نقدي بالدينار الليبي'}
                      {actionType === 'deposit_egp' && 'إيداع نقدي مباشر بالجنيه المصري'}
                      {actionType === 'convert' && 'معادلة تحويل جزء من الأمانة بالليبي إلى أمانة مصري'}
                      {actionType === 'withdraw_egp' && 'سحب واسترداد نقدي بالجنيه المصري'}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); setActionType(null); }} className="text-[10px] text-rose-500 font-bold hover:underline">إغلاق</button>
                  </h5>

                  <div className="space-y-3">
                    {actionType === 'deposit' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">مبلغ الإيداع د.ل *</label>
                          <input type="number" required value={actionAmountLyd} onChange={(e) => setActionAmountLyd(e.target.value)} placeholder="مثال: 1500" className="w-full text-right p-2 border rounded font-mono text-xs" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">البيان/شرح الاستلام</label>
                          <input type="text" value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="إيداع إضافي نقدي لزيادة الأمانة بالخزينة" className="w-full text-right p-2 border rounded text-xs" />
                        </div>
                      </div>
                    )}

                    {actionType === 'withdraw' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">مبلغ السحب د.ل *</label>
                          <input type="number" required value={actionAmountLyd} onChange={(e) => setActionAmountLyd(e.target.value)} placeholder={`الرصيد المتاح: ${expandedDepositLyd}`} className="w-full text-right p-2 border rounded font-mono text-xs" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">البيان/السبب للإثبات</label>
                          <input type="text" value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="استرجاع جزء من وديعة الأمانة" className="w-full text-right p-2 border rounded text-xs" />
                        </div>
                      </div>
                    )}

                    {actionType === 'deposit_egp' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-600 mb-1">قيمة الإيداع بالجنيه المصري *</label>
                          <input type="number" required value={actionAmountEgp} onChange={(e) => setActionAmountEgp(e.target.value)} placeholder="أدخل القيمة بالمصري ج.م..." className="w-full text-right p-2 border rounded font-mono text-xs text-emerald-600 font-bold bg-emerald-50/10" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">البيان/شرح الاستلام</label>
                          <input type="text" value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="إيداع نقدي مباشر بالأمانة بالمصري" className="w-full text-right p-2 border rounded text-xs" />
                        </div>
                      </div>
                    )}

                    {actionType === 'convert' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-indigo-600 mb-1">القيمة المراد تحويلها (من رصيد الليبي) *</label>
                            <input type="number" required value={actionAmountLyd} onChange={(e) => setActionAmountLyd(e.target.value)} placeholder={`الرصيد المتاح: ${expandedDepositLyd} د.ل`} className="w-full text-right p-2 border rounded font-mono text-xs text-indigo-600 font-bold" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-600 mb-1">سعر صرف اليوم (الدينار كم جنيه؟) *</label>
                            <input type="number" step="1" required value={actionExchangeRate} onChange={(e) => setActionExchangeRate(e.target.value)} placeholder="مثلاً: 10.0" className="w-full text-right p-2 border border-emerald-300 rounded font-mono text-xs text-emerald-600 font-bold bg-emerald-50/20" />
                          </div>
                        </div>
                        {parseFloat(actionAmountLyd) > 0 && parseFloat(actionExchangeRate) > 0 && (
                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-right">
                            <span className="text-[10px] text-indigo-600 font-extrabold block">📐 معادلة الاحتساب المباشرة للمستند:</span>
                            <div className="mt-1 font-mono text-xs text-indigo-900 flex items-center justify-between">
                              <span>{parseFloat(actionAmountLyd).toLocaleString()} د.ل × {parseFloat(actionExchangeRate).toLocaleString()} = </span>
                              <span className="font-black text-sm text-emerald-600 bg-white px-2 py-0.5 rounded shadow-xs">{(parseFloat(actionAmountLyd) * parseFloat(actionExchangeRate)).toLocaleString()} جنيه مصري</span>
                            </div>
                            <p className="text-[9.5px] text-slate-500 mt-2 font-semibold">* سينزل المبلغ المحول من وديعة الليبي، وتقيد بالخزينة بقيمة سالبة، ويضاف المكافئ بالمصري كأمانة جديدة للزبون</p>
                          </div>
                        )}
                      </div>
                    )}

                    {actionType === 'withdraw_egp' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-600 mb-1">المبلغ المراد سحبه بالجنيه المصري *</label>
                          <input type="number" required value={actionAmountEgp} onChange={(e) => setActionAmountEgp(e.target.value)} placeholder={`الرصيد المتاح: ${expandedDepositEgp} جنيه`} className="w-full text-right p-2 border rounded font-mono text-xs" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">شرح وبيان السحب</label>
                          <input type="text" value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="سحب واسترداد من أمانة المصري" className="w-full text-right p-2 border rounded text-xs" />
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-1.5 pt-2 border-t text-xs">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (actionType === 'deposit') handleAddLydCustody(expandedDeposit.id);
                          if (actionType === 'withdraw') handleWithdrawLydCustody(expandedDeposit.id);
                          if (actionType === 'deposit_egp') handleDepositEgpCustody(expandedDeposit.id);
                          if (actionType === 'convert') handleConvertToEgpCustody(expandedDeposit.id);
                          if (actionType === 'withdraw_egp') handleWithdrawEgpCustody(expandedDeposit.id);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded cursor-pointer transition shadow-xs"
                      >
                        تأكيد وقيد العملية بالمنظومة
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 text-right">
                <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                  <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                    <span>أرشيف العمليات ({getHistory(expandedDeposit).length})</span>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[10.5px] text-right font-sans relative">
                    <thead>
                      <tr className="border-b border-slate-300 text-slate-500">
                        <th className="pb-1">التاريخ</th>
                        <th className="pb-1">الحركة</th>
                        <th className="pb-1 text-center">ليبي (د.ل)</th>
                        <th className="pb-1 text-center">مصري (ج.م)</th>
                        <th className="pb-1 pr-2">البيان</th>
                        <th className="pb-1 text-center w-8">حذف</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...getHistory(expandedDeposit)].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                        <tr key={tx.id} className="border-b border-slate-200 hover:bg-slate-200/40 text-slate-700 group">
                          <td className="py-1 font-mono text-slate-500">{new Date(tx.date).toLocaleDateString('ar-LY')}</td>
                          <td className="py-1 font-semibold text-slate-900">
                            {tx.type === 'deposit_lyd' && <span className="text-blue-600">➕ إيداع د.ل</span>}
                            {tx.type === 'withdraw_lyd' && <span className="text-orange-500">💸 رد د.ل</span>}
                            {tx.type === 'convert_to_egp' && <span className="text-purple-600">🔁 تحويل مصري</span>}
                            {tx.type === 'withdraw_egp' && <span className="text-emerald-600">🇪🇬 سحب ج.م</span>}
                            {tx.type === 'deposit_egp' && <span className="text-emerald-500">➕ إيداع ج.م</span>}
                          </td>
                          <td className="py-1 font-mono text-center font-bold text-slate-800">
                            {tx.amountLyd > 0 ? `${tx.amountLyd.toLocaleString()} د.ل` : '-'}
                          </td>
                          <td className="py-1 font-mono text-center font-bold text-emerald-700">
                            {tx.amountEgp > 0 ? `${tx.amountEgp.toLocaleString()} ج.م` : '-'}
                          </td>
                          <td className="py-1 pr-2 text-slate-500 max-w-[100px] truncate" title={tx.note}>{tx.note}</td>
                          <td className="py-1 text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteArchiveTx(expandedDeposit.id, tx.id); }}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-0.5 rounded transition-all cursor-pointer"
                              title="حذف هذه العملية"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD CUSTOMER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-md w-full shadow-2xl relative text-right">
            <h3 className="font-extrabold text-slate-900 text-lg mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <span>إضافة حساب أمانة جديد ➕</span>
            </h3>

            <form onSubmit={handleCreateCustomerDeposit} className="space-y-4">
              <div>
                <label className="block text-slate-500 text-[11px] font-bold mb-1.5">اسم المودع المعتمد *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="مثال: أكرم بوعجيله"
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <VoiceInputButton onResult={(text) => setNewCustName(prev => (prev ? prev + ' ' + text : text))} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-[11px] font-bold mb-1.5">العملة المودعة *</label>
                <select
                  value={newCurrency}
                  onChange={(e) => setNewCurrency(e.target.value as 'lyd' | 'egp')}
                  className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-bold text-slate-700"
                >
                  <option value="lyd">دينار ليبي (د.ل)</option>
                  <option value="egp">جنيه مصري (ج.م)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-500 text-[11px] font-bold mb-1.5">القيمة المودعة *</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={newInitialAmount}
                  onChange={(e) => setNewInitialAmount(e.target.value)}
                  placeholder="مثال: 5000"
                  className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-indigo-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 text-[11px] font-bold mb-1.5">طبيعة الحجز (البيان)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="اختياري: مثال دفعة كذا"
                    className="w-full text-right pr-9 p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  />
                  <div className="absolute right-1.5 top-1.5">
                    <VoiceInputButton onResult={(text) => setNewNote(prev => (prev ? prev + ' ' + text : text))} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>تأكيد الإضافة والتسجيل ✔️</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for deleting/archiving an item (No native window.confirm to bypass iframe restrictions) */}
      {deleteConfirmId && (() => {
        const itemToConfirm = state.trustDeposits.find(d => d.id === deleteConfirmId);
        return (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-fade-in" dir="rtl">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl relative text-right">
              <h3 className="font-extrabold text-slate-900 text-base mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>ترحيب بمسح حساب الأمانة 🗑️</span>
              </h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                هل أنت متأكد من رغبتك في أرشفة ومسح حساب الأمانة هذا للزبون <strong className="text-slate-800">{itemToConfirm?.customerName || ''}</strong> ونقله لسلة المهملات بشكل آمن؟
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => executeDeleteDeposit(deleteConfirmId)}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
                >
                  نعم، تأكيد المسح والأرشفة 📁
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-4 rounded-xl transition cursor-pointer"
                >
                  إلغاء التراجع
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Calculator Component */}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col items-start gap-4">
        {showCalculator && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-[320px] md:w-[380px] flex flex-col transform origin-bottom-left transition-all animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                مسودة حاسبة تجار
              </h3>
              <button
                onClick={() => setShowCalculator(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="max-h-[250px] overflow-y-auto pr-1 space-y-2 mb-3 custom-scrollbar">
                {calcRows.map((row, index) => (
                  <div key={row.id} className="flex items-center gap-2 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                    {/* Result (Readonly) */}
                    <div className="flex-1">
                      <input
                        type="text"
                        readOnly
                        dir="ltr"
                        value={calculateRowResult(row).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        className="w-full text-center bg-transparent border-none text-[11px] font-bold font-mono text-indigo-700 focus:outline-none"
                      />
                    </div>
                    
                    {/* Equals Sign */}
                    <span className="text-slate-400 text-xs font-black">=</span>
                    
                    {/* Price */}
                    <div className="w-[70px]">
                      <input
                        type="number"
                        step="any"
                        dir="ltr"
                        lang="en"
                        data-arrow-nav="true"
                        placeholder="السعر"
                        value={row.price}
                        onChange={(e) => handleUpdateCalcRow(row.id, 'price', e.target.value)}
                        className="w-full text-center p-1.5 border border-slate-200 rounded text-xs font-bold font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>

                    {/* Operator */}
                    <div className="grid grid-cols-2 gap-0.5 w-[42px]">
                      <button
                        onClick={() => handleUpdateCalcRow(row.id, 'operator', 'multiply')}
                        className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === 'multiply' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="ضرب"
                      >
                        ×
                      </button>
                      <button
                        onClick={() => handleUpdateCalcRow(row.id, 'operator', 'divide')}
                        className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === 'divide' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="قسمة"
                      >
                        ÷
                      </button>
                      <button
                        onClick={() => handleUpdateCalcRow(row.id, 'operator', 'add')}
                        className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === 'add' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="جمع"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleUpdateCalcRow(row.id, 'operator', 'subtract')}
                        className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition ${row.operator === 'subtract' ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-slate-400 hover:bg-slate-200'}`}
                        title="طرح"
                      >
                        -
                      </button>
                    </div>

                    {/* Value */}
                    <div className="w-[70px]">
                      <input
                        type="number"
                        step="any"
                        dir="ltr"
                        lang="en"
                        data-arrow-nav="true"
                        placeholder="القيمة"
                        value={row.value}
                        onChange={(e) => handleUpdateCalcRow(row.id, 'value', e.target.value)}
                        className="w-full text-center p-1.5 border border-slate-200 rounded text-xs font-bold font-mono bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>

                    {/* Remove Row Button */}
                    <button
                      onClick={() => handleRemoveCalcRow(row.id)}
                      className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Row Button */}
              <button
                onClick={handleAddCalcRow}
                className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 mb-4"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة صف جديد
              </button>

              {/* Total Footer */}
              <div className="bg-slate-900 rounded-xl p-3 flex items-center justify-between">
                <div className="flex flex-col items-start gap-1">
                  <span className="text-slate-400 text-[10px] font-bold">الناتج الإجمالي</span>
                  <span className="text-white font-mono font-black text-sm" dir="ltr">
                    {Math.round(totalCalcResult).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
                <button
                  onClick={handleCopyCalcResult}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                >
                  {calcCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {calcCopied ? "تم النسخ" : "نسخ الناتج"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Button */}
        <button
          onClick={() => setShowCalculator(!showCalculator)}
          className={`${showCalculator ? 'bg-indigo-600 text-white shadow-indigo-500/25' : 'bg-slate-900 text-white shadow-[0_8px_30px_rgb(0,0,0,0.15)]'} hover:scale-105 p-3.5 rounded-full shadow-lg transition-all flex items-center justify-center relative group self-start`}
          title="مسودة حاسبة تجار"
        >
          <Calculator className="w-5 h-5" />
          {!showCalculator && (
            <span className="absolute left-full ml-3 bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none shadow-lg">
              مسودة حاسبة تجار
            </span>
          )}
        </button>
      </div>

    </div>
  );
}
