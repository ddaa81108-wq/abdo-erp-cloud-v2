import React, { useState } from 'react';
import { Landmark, ArrowRightLeft, Shield, AlertCircle, Plus, Trash2, Search, Coins, RefreshCw, FileText, ChevronDown, ChevronUp, CheckCircle, UserCheck, Receipt, DollarSign, Image, X } from 'lucide-react';
import { ERPState, TrustDeposit, TrustDepositTx, TreasuryTransaction } from '../types';

interface DepositsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (section: string, metrics: any, headers: string[], rows: any[][]) => void;
}

export default function DepositsModule({ state, onUpdateState, onOpenExporter }: DepositsModuleProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  // Form states for ADD NEW CUSTOMER
  const [newCustName, setNewCustName] = useState('');
  const [newInitialLyd, setNewInitialLyd] = useState('');
  const [newNote, setNewNote] = useState('');

  // Expand states for each card config
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

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
    const lydVal = parseFloat(newInitialLyd);

    if (!name || isNaN(lydVal) || lydVal <= 0) {
      alert('الرجاء إدخال اسم العميل وقيمة أمانة صحيحة أكبر من صفر بالدينار الليبي.');
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

    const newDeposit: TrustDeposit = {
      id: newId,
      customerName: name,
      amount: lydVal,
      amountLyd: lydVal,
      amountEgp: 0,
      currency: 'د.ل',
      date: nowStr,
      referenceNo: refNo,
      status: 'held',
      note: newNote || 'إيداع أمانة نقدية بالصندوق',
      createdAt: nowStr,
      history: [
        {
          id: `sub_${Date.now()}_1`,
          type: 'deposit_lyd',
          amountLyd: lydVal,
          amountEgp: 0,
          date: nowStr,
          note: newNote || 'إيداع أمانة نقدية بالصندوق'
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
    setNewInitialLyd('');
    setNewNote('');
    alert(`تم تسجيل أمانة جديدة للعميل ${name} بنجاح بقيمة ${lydVal.toLocaleString()} د.ل وترحيلها للخزينة.`);
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
    alert(`تمت إضافة قيمة ${amount.toLocaleString()} د.ل لحساب العميل وترحيل الوارد للخزينة.`);
  };

  // 3. TRANSACTION: WITHDRAW/REFUND LYD (سحب نقدي بالليبي)
  const handleWithdrawLydCustody = (id: string) => {
    const amount = parseFloat(actionAmountLyd);
    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    const currentLyd = getAmountLyd(dep);

    if (isNaN(amount) || amount <= 0 || amount > currentLyd) {
      alert(`القيمة غير صحيحة أو تتخطى الرصيد المتاح الحالي بالدينار الليبي وهو ${currentLyd.toLocaleString()} د.ل.`);
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
      status: isNowCleared ? 'refunded' : 'held', // auto clear if all balances are zero!
      history: [...currentHistory, newSubTx],
      note: actionNote || dep.note
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
    if (isNowCleared) {
      alert(`تم صرف مبلغ ${amount.toLocaleString()} د.ل بنجاح. تم تصفية رصيد العميل للمطابقة وسيقوم النظام بنقله للأرشيف المكتمل.`);
      setExpandedCardId(null);
    } else {
      alert(`تم صرف مبلغ ${amount.toLocaleString()} د.ل نقداً بنجاح وتم فصمها من الخزينة.`);
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
    if (lydAmount > currentLyd) {
      alert(`لا يمتلك العميل رصيد كافٍ بالدينار الليبي لإتمام التحويل. الرصيد الحالي: ${currentLyd.toLocaleString()} د.ل`);
      return;
    }

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
      status: isNowCleared ? 'refunded' : 'held',
      history: [...currentHistory, newSubTx]
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
    alert(`نجاح العملية:
- تم خصم ${lydAmount.toLocaleString()} د.ل من أمانة العميل.
- تم قيد رصيد جديد بمقدار ${calculatedEgp.toLocaleString()} جنيه مصري للمودع.
- تم خصم القيمة الليبية المستبدلة من الخزينة الرئيسية بالسالب لتسوية تحويل العملات.`);
  };

  // 5. TRANSACTION: WITHDRAW EGYPTIAN POUNDS (سحب أمانة مصري)
  const handleWithdrawEgpCustody = (id: string) => {
    const amountEgpToWithdraw = parseFloat(actionAmountEgp);
    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    const currentEgp = getAmountEgp(dep);
    const currentLyd = getAmountLyd(dep);

    if (isNaN(amountEgpToWithdraw) || amountEgpToWithdraw <= 0 || amountEgpToWithdraw > currentEgp) {
      alert(`القيمة غير صحيحة أو تتخطى الرصيد المتاح حالياً بالجنيه المصري وهو ${currentEgp.toLocaleString()} جنيه.`);
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
      status: isNowCleared ? 'refunded' : 'held',
      history: [...currentHistory, newSubTx]
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
    if (isNowCleared) {
      alert(`تم تسليم وصرف ${amountEgpToWithdraw.toLocaleString()} جنيه مصري للعميل. تم تصفية حساب الأمانة بالكامل ونقله للأرشيف.`);
      setExpandedCardId(null);
    } else {
      alert(`تم تسليم وصرف ${amountEgpToWithdraw.toLocaleString()} جنيه مصري للعميل بنجاح.`);
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
    alert(`تم إيداع مبلغ ${amount.toLocaleString()} جنيه كأمانة مصرية للعميل بنجاح.`);
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
      if (amountLydVal > currentLyd) {
        alert(`رصيد العميل بالدينار الليبي غير كافٍ. المتاح: ${currentLyd.toLocaleString()} د.ل`);
        return;
      }
      updatedLyd = currentLyd - amountLydVal;
      noteDetails = `خصماً من أمانة الليبي: حوالة بمبلغ ${amountLydVal.toLocaleString()} د.ل داخل مصر`;
    } else {
      if (amountEgpVal > currentEgp) {
        alert(`رصيد العميل بالجنيه المصري غير كافٍ. المتاح: ${currentEgp.toLocaleString()} ج.م`);
        return;
      }
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
      status: isNowCleared ? 'refunded' : 'held',
      history: [...getHistory(dep), newSubTx]
    };

    onUpdateState({
      ...state,
      trustDeposits: updatedDeposits
    });

    resetActionForm();
    alert(`نجاح العملية: تم إرسال وقيد وتأكيد الحوالة الداخلية لمصر وخصمها من أمانة العميل بنجاح.`);
  };

  // 6. TRANSACTION: APPLY ESCROW TO SETTLE CUSTOMER DEBT (مقاصة ديون العميل)
  const handleReleaseToDebtWithLyd = (id: string) => {
    const amount = parseFloat(actionAmountLyd);
    const depIndex = state.trustDeposits.findIndex(d => d.id === id);
    if (depIndex === -1) return;

    const dep = state.trustDeposits[depIndex];
    const currentLyd = getAmountLyd(dep);

    if (isNaN(amount) || amount <= 0 || amount > currentLyd) {
      alert(`القيمة غير صحيحة أو تتجاوز الرصيد بالليبي المتاح وهو ${currentLyd.toLocaleString()} د.ل.`);
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
    updatedCycles[activeCycleIndex] = {
      ...activeCycle,
      currentBalance: newBalance,
      status: newBalance === 0 ? 'closed' : 'active',
      endDate: newBalance === 0 ? nowStr : undefined
    };

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
      status: isNowCleared ? 'refunded' : 'held',
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
      alert(`نجاح: تم تسوية ونقل ${amount.toLocaleString()} د.ل كدفعة سداد معتمدة لصالح ملف ديون العميل: ${dep.customerName} وتصفير الأمانة بذكاء!`);
      setExpandedCardId(null);
    } else {
      alert(`نجاح: تم ترحيل ومقاصة مبلغ ${amount.toLocaleString()} د.ل من الأمانة لسداد ديون العميل.`);
    }
  };

  // Direct complete delete - upgraded to soft delete to trash can without confirm trigger
  const handleDeleteDeposit = (id: string) => {
    executeDeleteDeposit(id);
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

  const resetActionForm = () => {
    setActionType(null);
    setActionAmountLyd('');
    setActionAmountEgp('');
    setActionExchangeRate('1.0');
    setActionNote('');
    setActionTargetId('');
  };

  // Generate Image-Report inside the card for WhatsApp sharing
  const handleExportSingleDepositDraft = (d: TrustDeposit) => {
    const headers = ['تاريخ الحركة', 'نوع الحركة والمجال', 'تأثير ليبي د.ل', 'تأثير مصري جنيه', 'البيان والتفاصيل'];
    
    const historyList = getHistory(d);
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
    const activeDeposits = state.trustDeposits.filter(d => !d.isDeleted && d.status === 'held' && (getAmountLyd(d) > 0 || getAmountEgp(d) > 0));
    
    const rows = activeDeposits.map(d => [
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
        value3: `${activeDeposits.length} حسابات`
      },
      headers,
      rows
    );
  };

  // Filter calculations
  const activeHeldDeposits = state.trustDeposits.filter(d => 
    !d.isDeleted &&
    d.status === 'held' && 
    (getAmountLyd(d) > 0 || getAmountEgp(d) > 0) &&
    (d.customerName.toLowerCase().includes(filterQuery.toLowerCase()) || d.referenceNo.toLowerCase().includes(filterQuery.toLowerCase()))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const archivedDeposits = state.trustDeposits.filter(d => 
    !d.isDeleted &&
    (d.status === 'refunded' || d.status === 'released_to_debt' || (getAmountLyd(d) === 0 && getAmountEgp(d) === 0)) &&
    (d.customerName.toLowerCase().includes(filterQuery.toLowerCase()) || d.referenceNo.toLowerCase().includes(filterQuery.toLowerCase()))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Aggregate totals
  const aggregateHeldLyd = state.trustDeposits
    .filter(d => !d.isDeleted && d.status === 'held')
    .reduce((sum, d) => sum + getAmountLyd(d), 0);

  const aggregateHeldEgp = state.trustDeposits
    .filter(d => !d.isDeleted && d.status === 'held')
    .reduce((sum, d) => sum + getAmountEgp(d), 0);


  return (
    <div className="space-y-6 text-right" dir="rtl">

      {/* TOP HEADER SUMMARY BAR */}
      <div className="bg-slate-900 text-white rounded-xl p-4 border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row items-stretch justify-between gap-4">
          
          {/* Main Totals Section */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* LYD Totals Card - counts as liability on treasury */}
            <div className="bg-slate-950 border-2 border-indigo-600/60 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
              <div className="absolute top-2 left-2 text-indigo-500 opacity-20">
                <Landmark className="w-12 h-12" />
              </div>
              <div>
                <span className="text-slate-400 font-extrabold text-[11px] block mb-1">🔒 إجمالي الأمانات (بالدينار الليبي)</span>
                <span className="font-mono text-2xl font-black text-indigo-400 block tracking-wider">
                  {aggregateHeldLyd.toLocaleString()} <span className="text-xs font-bold text-slate-300">د.ل</span>
                </span>
                <p className="text-[9.5px] text-slate-400 mt-1 font-semibold">
                  * يتم ترحيلها وقيدها بالسالب وتخصم مع المطلوبات المالية
                </p>
              </div>
            </div>

            {/* EGP Totals Card */}
            <div className="bg-slate-950 border-2 border-emerald-600/60 rounded-xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
              <div className="absolute top-2 left-2 text-emerald-500 opacity-20">
                <Coins className="w-12 h-12" />
              </div>
              <div>
                <span className="text-slate-400 font-extrabold text-[11px] block mb-1">🇪🇬 إجمالي الأمانات (بالجنيه المصري)</span>
                <span className="font-mono text-2xl font-black text-emerald-400 block tracking-wider">
                  {aggregateHeldEgp.toLocaleString()} <span className="text-xs font-bold text-slate-300">جنيه</span>
                </span>
                <p className="text-[9.5px] text-emerald-500 mt-1 font-semibold">
                  * رصيد الأمانات المحول مصري ومسجل بالصندوق الجاري
                </p>
              </div>
            </div>

          </div>

          {/* Quick ADD CUSTOMER CARD as explicitly requested side-by-side with totals */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 w-full lg:max-w-md shrink-0 shadow-lg text-right">
            <h4 className="text-xs font-black text-white border-b border-slate-800 pb-1.5 mb-2.5 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span>➕ فتح حساب أمانة لعميل جديد</span>
            </h4>

            <form onSubmit={handleCreateCustomerDeposit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold mb-1">اسم المودع المعتمد *</label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder="مثال: أكرم بوعجيله"
                    className="w-full text-right p-2 bg-slate-900 border border-slate-800 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] font-bold mb-1">قيمة الأمانة (بالليبي) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newInitialLyd}
                    onChange={(e) => setNewInitialLyd(e.target.value)}
                    placeholder="مثال: 5000"
                    className="w-full text-right p-2 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-yellow-400 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-[10px] font-bold mb-1">طبيعة الحجز للدفاتر (البيان)</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="مثال: أمانة حجز دفعة لشبكة جبل نفوسة"
                  className="w-full text-right p-2 bg-slate-900 border border-slate-800 rounded text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 rounded transition cursor-pointer flex items-center justify-center gap-1 shadow"
              >
                <Plus className="w-4 h-4" />
                <span>ترحيل وتسجيل العميل بالخزينة 🔒</span>
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* TOOLBAR SEARCH & REPORTS */}
      <div className="bg-white border rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm border-slate-100">
        <div className="relative w-full sm:max-w-md">
          <input
            type="text"
            placeholder="🔎 ابحث عن أمانة باسم المودع أو رقم المستند..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full text-right pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
        </div>

        <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={handleExportAllActiveImage}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>طباعة وتصدير جميع أمانات اليوم 📸</span>
          </button>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeHeldDeposits.map(d => {
              const customerLyd = getAmountLyd(d);
              const customerEgp = getAmountEgp(d);
              const isExpanded = expandedCardId === d.id;

              return (
                <div 
                  key={d.id} 
                  className={`bg-white border-y border-l transition-all duration-300 rounded-xl overflow-hidden font-sans border-slate-200 hover:border-indigo-400 border-r-4 ${(customerLyd > 0 || customerEgp > 0) ? 'border-r-amber-500' : 'border-r-emerald-500'} ${
                    isExpanded ? 'ring-2 ring-indigo-500/10 shadow-lg' : 'shadow-sm'
                  }`}
                >
                  {/* CARD CARD BODY */}
                  <div className="p-4">
                    
                    {/* Header info */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDeposit(d.id);
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1 rounded-md transition-all cursor-pointer shrink-0 hover:scale-105"
                            title="حذف ونقل للأرشيف ❌"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <div className="w-2 h-2 rounded-full bg-indigo-600" />
                          <h4 className="font-extrabold text-slate-900 text-sm">{d.customerName}</h4>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                          مستند: {d.referenceNo} • {new Date(d.date).toLocaleDateString('ar-LY')}
                        </span>
                      </div>

                      <div className="text-left">
                        {/* Display Libyan Dinar custody */}
                        <div className="font-mono text-sm font-black text-slate-900 block">
                          {customerLyd.toLocaleString()} <span className="text-[10px] text-slate-400">د.ل</span>
                        </div>
                        {/* ONLY DISPLAY Egyptian pound if defined and greater than zero */}
                        {customerEgp > 0 && (
                          <div className="font-mono text-xs font-black text-emerald-600 block mt-0.5">
                            {customerEgp.toLocaleString()} <span className="text-[9px] text-emerald-500 font-bold">جنيه مصري</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Brief Note */}
                    <div className="bg-slate-50 rounded-lg p-2.5 mb-3">
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        &quot;{d.note}&quot;
                      </p>
                    </div>

                    {/* Outer quick overview of assets */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                      <div className="flex gap-2">
                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-black">
                          🇱🇾 {customerLyd.toLocaleString()} د.ل
                        </span>
                        {customerEgp > 0 ? (
                          <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black">
                            🇪🇬 {customerEgp.toLocaleString()} ج.م
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold text-[10px]">
                            رصيد مصري مصفر
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setExpandedCardId(isExpanded ? null : d.id);
                          resetActionForm();
                        }}
                        className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                      >
                        <span>إجراء عمليات المعاملات</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                  </div>

                  {/* EXPANDABLE WORKSPACE DRAWER */}
                  {isExpanded && (
                    <div className="bg-slate-50 border-t border-slate-100 p-4 space-y-4">
                      
                      {/* Sub-Actions Tabs bar */}
                      <div className="grid grid-cols-3 sm:grid-cols-7 gap-1 text-center bg-slate-200/50 p-1 rounded-lg">
                        <button
                          type="button"
                          onClick={() => { resetActionForm(); setActionType('deposit'); }}
                          className={`py-1.5 text-[10.5px] font-bold rounded cursor-pointer transition ${actionType === 'deposit' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'}`}
                        >
                          ➕ إيداع ليبي
                        </button>
                        <button
                          type="button"
                          onClick={() => { resetActionForm(); setActionType('withdraw'); }}
                          className={`py-1.5 text-[10.5px] font-bold rounded cursor-pointer transition ${actionType === 'withdraw' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'}`}
                        >
                          💸 سحب ليبي
                        </button>
                        <button
                          type="button"
                          onClick={() => { resetActionForm(); setActionType('deposit_egp'); }}
                          className={`py-1.5 text-[10.5px] font-bold rounded cursor-pointer transition ${actionType === 'deposit_egp' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'}`}
                        >
                          🇪🇬 إيداع مصري
                        </button>
                        <button
                          type="button"
                          onClick={() => { resetActionForm(); setActionType('withdraw_egp'); }}
                          className={`py-1.5 text-[10.5px] font-bold rounded cursor-pointer transition ${actionType === 'withdraw_egp' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'}`}
                          disabled={customerEgp <= 0}
                          title={customerEgp <= 0 ? 'لا يوجد رصيد مصري حالياً للتحكم' : ''}
                        >
                          🇪🇬 سحب مصري
                        </button>
                        <button
                          type="button"
                          onClick={() => { resetActionForm(); setActionType('convert'); }}
                          className={`py-1.5 text-[10.5px] font-bold rounded cursor-pointer transition ${actionType === 'convert' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'}`}
                        >
                          🔄 تحويل مصري
                        </button>
                        <button
                          type="button"
                          onClick={() => { resetActionForm(); setActionType('transfer_egypt'); }}
                          className={`py-1.5 text-[10.5px] font-bold rounded cursor-pointer transition ${actionType === 'transfer_egypt' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'}`}
                        >
                          ✈️ حوالة لمصر
                        </button>
                        <button
                          type="button"
                          onClick={() => { resetActionForm(); setActionType('settlement'); }}
                          className={`py-1.5 text-[10.5px] font-bold rounded cursor-pointer transition ${actionType === 'settlement' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-700 hover:bg-white/50'}`}
                        >
                          🤝 مقاصة ديون
                        </button>
                      </div>

                      {/* WORKSPACE OPERATIONS CONTAINER */}
                      {actionType && (
                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs animate-fade">
                          <h5 className="text-[11px] font-black text-slate-800 mb-2 border-b pb-1.5 flex items-center justify-between">
                            <span>
                              {actionType === 'deposit' && 'إيداع إضافي بالدينار الليبي لحساب الأمانة'}
                              {actionType === 'withdraw' && 'سحب واسترجاع نقدي بالدينار الليبي'}
                              {actionType === 'deposit_egp' && 'إيداع نقدي مباشر بالجنيه المصري'}
                              {actionType === 'convert' && 'معادلة تحويل جزء من الأمانة بالليبي إلى أمانة مصري'}
                              {actionType === 'withdraw_egp' && 'سحب واسترداد نقدي بالجنيه المصري'}
                              {actionType === 'transfer_egypt' && 'إرسال حوالة مباشرة لمصر (خصماً من الأمانة)'}
                              {actionType === 'settlement' && 'مقاصة وتحويل الأمانة لتسديد ديون الدورة النشطة'}
                            </span>
                            <button onClick={() => setActionType(null)} className="text-[10px] text-rose-500 font-bold hover:underline">إغلاق</button>
                          </h5>

                          <div className="space-y-3">
                            {/* Standard inputs switcher */}
                            {actionType === 'deposit' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">مبلغ الإيداع د.ل *</label>
                                  <input
                                    type="number"
                                    required
                                    value={actionAmountLyd}
                                    onChange={(e) => setActionAmountLyd(e.target.value)}
                                    placeholder="مثال: 1500"
                                    className="w-full text-right p-2 border rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">البيان/شرح الاستلام</label>
                                  <input
                                    type="text"
                                    value={actionNote}
                                    onChange={(e) => setActionNote(e.target.value)}
                                    placeholder="إيداع إضافي نقدي لزيادة الأمانة بالخزينة"
                                    className="w-full text-right p-2 border rounded text-xs"
                                  />
                                </div>
                              </div>
                            )}

                            {actionType === 'withdraw' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">مبلغ السحب د.ل *</label>
                                  <input
                                    type="number"
                                    required
                                    value={actionAmountLyd}
                                    onChange={(e) => setActionAmountLyd(e.target.value)}
                                    placeholder={`الحد الأقصى: ${customerLyd}`}
                                    className="w-full text-right p-2 border rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">البيان/السبب للإثبات</label>
                                  <input
                                    type="text"
                                    value={actionNote}
                                    onChange={(e) => setActionNote(e.target.value)}
                                    placeholder="استرجاع جزء من وديعة الأمانة"
                                    className="w-full text-right p-2 border rounded text-xs"
                                  />
                                </div>
                              </div>
                            )}

                            {actionType === 'deposit_egp' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="block text-[10px] font-bold text-emerald-600 mb-1">قيمة الإيداع بالجنيه المصري *</label>
                                  <input
                                    type="number"
                                    required
                                    value={actionAmountEgp}
                                    onChange={(e) => setActionAmountEgp(e.target.value)}
                                    placeholder="أدخل القيمة بالمصري ج.م..."
                                    className="w-full text-right p-2 border rounded font-mono text-xs text-emerald-600 font-bold bg-emerald-50/10"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">البيان/شرح الاستلام</label>
                                  <input
                                    type="text"
                                    value={actionNote}
                                    onChange={(e) => setActionNote(e.target.value)}
                                    placeholder="إيداع نقدي مباشر بالأمانة بالمصري"
                                    className="w-full text-right p-2 border rounded text-xs"
                                  />
                                </div>
                              </div>
                            )}

                            {/* DYNAMIC CONVERTER AS REQUESTED IN LITERAL ALIGNMENT */}
                            {actionType === 'convert' && (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <label className="block text-[10px] font-bold text-indigo-600 mb-1">القيمة المراد تحويلها (من رصيد الليبي) *</label>
                                    <input
                                      type="number"
                                      required
                                      value={actionAmountLyd}
                                      onChange={(e) => setActionAmountLyd(e.target.value)}
                                      placeholder={`الحد الأقصى: ${customerLyd} د.ل`}
                                      className="w-full text-right p-2 border rounded font-mono text-xs text-indigo-600 font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-emerald-600 mb-1">سعر صرف اليوم (الدينار كم جنيه؟) *</label>
                                    <input
                                      type="number"
                                      step="any"
                                      required
                                      value={actionExchangeRate}
                                      onChange={(e) => setActionExchangeRate(e.target.value)}
                                      placeholder="مثلاً: 10.0"
                                      className="w-full text-right p-2 border border-emerald-300 rounded font-mono text-xs text-emerald-600 font-bold bg-emerald-50/20"
                                    />
                                  </div>
                                </div>

                                {/* Dynamic calculations box */}
                                {parseFloat(actionAmountLyd) > 0 && parseFloat(actionExchangeRate) > 0 && (
                                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-right">
                                    <span className="text-[10px] text-indigo-600 font-extrabold block">📐 معادلة الاحتساب المباشرة للمستند:</span>
                                    <div className="mt-1 font-mono text-xs text-indigo-900 flex items-center justify-between">
                                      <span>
                                        {parseFloat(actionAmountLyd).toLocaleString()} د.ل × {parseFloat(actionExchangeRate).toLocaleString()} = 
                                      </span>
                                      <span className="font-black text-sm text-emerald-600 bg-white px-2 py-0.5 rounded shadow-xs">
                                        {(parseFloat(actionAmountLyd) * parseFloat(actionExchangeRate)).toLocaleString()} جنيه مصري
                                      </span>
                                    </div>
                                    <p className="text-[9.5px] text-slate-500 mt-2 font-semibold">
                                      * سينزل المبلغ المحول من وديعة الليبي، وتقيد بالخزينة بقيمة سالبة، ويضاف المكافئ بالمصري كأمانة جديدة للزبون
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {actionType === 'withdraw_egp' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="block text-[10px] font-bold text-emerald-600 mb-1">المبلغ المراد سحبه بالجنيه المصري *</label>
                                  <input
                                    type="number"
                                    required
                                    value={actionAmountEgp}
                                    onChange={(e) => setActionAmountEgp(e.target.value)}
                                    placeholder={`الرصيد المتاح: ${customerEgp} جنيه`}
                                    className="w-full text-right p-2 border rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">شرح وبيان السحب</label>
                                  <input
                                    type="text"
                                    value={actionNote}
                                    onChange={(e) => setActionNote(e.target.value)}
                                    placeholder="سحب واسترداد من أمانة المصري"
                                    className="w-full text-right p-2 border rounded text-xs"
                                  />
                                </div>
                              </div>
                            )}

                            {actionType === 'transfer_egypt' && (
                              <div className="space-y-3">
                                <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-800 text-right">
                                  💡 يمكنك خصم الحوالة من رصيد الأمانة بالليبي د.ل (وسيتم تسجيل حركة بالخزينة) أو مباشرة من رصيد الأمانة المصري الجاري.
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">الخصم من رصيد الأمانة بالليبي (د.ل)</label>
                                    <input
                                      type="number"
                                      value={actionAmountLyd}
                                      onChange={(e) => {
                                        setActionAmountLyd(e.target.value);
                                        setActionAmountEgp(''); // clear opponent
                                      }}
                                      placeholder={`الرصيد المتاح: ${customerLyd} د.ل`}
                                      className="w-full text-right p-2 border rounded font-mono text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-emerald-600 mb-1">الخصم من رصيد الأمانة بالمصري (جنيه)</label>
                                    <input
                                      type="number"
                                      value={actionAmountEgp}
                                      onChange={(e) => {
                                        setActionAmountEgp(e.target.value);
                                        setActionAmountLyd(''); // clear opponent
                                      }}
                                      placeholder={`الرصيد المتاح: ${customerEgp} جنيه`}
                                      className="w-full text-right p-2 border rounded font-mono text-xs text-emerald-600 font-bold bg-emerald-50/10"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">تفاصيل الحوالة (اسم المستلم بمصر ورقم Vodafone Cash أو التفاصيل) *</label>
                                  <input
                                    type="text"
                                    required
                                    value={actionNote}
                                    onChange={(e) => setActionNote(e.target.value)}
                                    placeholder="مثال: حوالة باسم صلاح أحمد - فودافون كاش 010xxxxxxxx"
                                    className="w-full text-right p-2 border rounded text-xs"
                                  />
                                </div>
                              </div>
                            )}

                            {actionType === 'settlement' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">القيمة المراد ترحيلها لديون الزبون د.ل *</label>
                                  <input
                                    type="number"
                                    required
                                    value={actionAmountLyd}
                                    onChange={(e) => setActionAmountLyd(e.target.value)}
                                    placeholder={`الحد الأقصى: ${customerLyd}`}
                                    className="w-full text-right p-2 border rounded font-mono text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1">ملاحظة المقاصة</label>
                                  <input
                                    type="text"
                                    value={actionNote}
                                    onChange={(e) => setActionNote(e.target.value)}
                                    placeholder="سداد حساب تحت التسوية لملف الديون الجاري"
                                    className="w-full text-right p-2 border rounded text-xs"
                                  />
                                </div>
                              </div>
                            )}

                            {/* General confirm action trigger */}
                            <div className="flex justify-end gap-1.5 pt-2 border-t text-xs">
                              <button
                                type="button"
                                onClick={() => {
                                  if (actionType === 'deposit') handleAddLydCustody(d.id);
                                  if (actionType === 'withdraw') handleWithdrawLydCustody(d.id);
                                  if (actionType === 'deposit_egp') handleDepositEgpCustody(d.id);
                                  if (actionType === 'convert') handleConvertToEgpCustody(d.id);
                                  if (actionType === 'withdraw_egp') handleWithdrawEgpCustody(d.id);
                                  if (actionType === 'transfer_egypt') handleTransferToEgypt(d.id);
                                  if (actionType === 'settlement') handleReleaseToDebtWithLyd(d.id);
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-1.5 rounded cursor-pointer transition shadow-xs"
                              >
                                تأكيد وقيد العملية بالمنظومة
                              </button>
                            </div>

                          </div>
                        </div>
                      )}

                      {/* DETAILED TRANSACTION LOG / ARCHIVE FOR CUSTOMER */}
                      <div className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 text-right">
                        <div className="flex items-center justify-between border-b pb-1.5 mb-2">
                          <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                            <span>الأرشيف ودفتر قيود العميل: {d.customerName}</span>
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => handleExportSingleDepositDraft(d)}
                            className="bg-purple-50 hover:bg-purple-150 border-purple-200 border text-purple-700 text-[10px] font-black px-2.5 py-1 rounded flex items-center gap-0.5"
                          >
                            <Image className="w-3 h-3" />
                            <span>تصدير كارت الواتساب 📸</span>
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-[10.5px] text-right font-sans relative">
                            <thead>
                              <tr className="border-b border-slate-300 text-slate-500">
                                <th className="pb-1">التاريخ</th>
                                <th className="pb-1">الحركة</th>
                                <th className="pb-1 text-center">أمانة ليبي (د.ل)</th>
                                <th className="pb-1 text-center">أمانة مصري (جنيه)</th>
                                <th className="pb-1 pr-2">البيان والتفاصيل</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getHistory(d).map(tx => (
                                <tr key={tx.id} className="border-b border-slate-200 hover:bg-slate-200/40 text-slate-700">
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
                                  <td className="py-1 pr-2 text-slate-500 max-w-[150px] truncate" title={tx.note}>{tx.note}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CLOSED / CLEARED CUSTOMERS ARCHIVES SECTION */}
      <div className="bg-slate-100 border border-slate-200/70 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <h4 className="font-extrabold text-slate-900 text-xs">📦 أرشيف ودفتر الأمانات المسواة تاريخياً</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">الحسابات التي تم تصفيتها وترجيعها بالكامل والتي لا تشغل مساحة على شاشتك الجارية.</p>
          </div>
          
          <button
            onClick={() => setShowArchive(!showArchive)}
            className="bg-white border border-slate-350 hover:bg-slate-50 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <span>{showArchive ? 'إخفاء الأرشيف' : 'عرض السجلات المكتملة'}</span>
            {showArchive ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showArchive && (
          <div className="mt-4 space-y-3 animate-fade">
            {archivedDeposits.length === 0 ? (
              <div className="bg-white text-center rounded-lg p-6 text-slate-400 text-xs">
                لا توجد حسابات أمانة مصفّرة تاريخياً مسجلة حتى الآن.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {archivedDeposits.map(d => (
                  <div key={d.id} className="bg-white border border-dashed rounded-lg p-3 text-right text-xs relative opacity-75 hover:opacity-100 transition-opacity">
                    <div className="flex justify-between items-center border-b pb-1.5 mb-1.5">
                      <div>
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-bold inline-block ml-1">✓ مصفر مكتمل</span>
                        <strong className="text-slate-800">{d.customerName}</strong>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{d.referenceNo}</span>
                    </div>
                    <p className="text-slate-500 text-[11px] mb-2 font-serif">&quot;{d.note}&quot;</p>
                    
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-400">تاريخ المعاملة: {new Date(d.date).toLocaleDateString('ar-LY')}</span>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleExportSingleDepositDraft(d)}
                          className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-bold hover:underline"
                        >
                          تصدير كشف تاريخي
                        </button>
                        <button
                          onClick={() => handleDeleteDeposit(d.id)}
                          className="text-rose-500 hover:text-rose-700 p-0.5"
                          title="مسح من الأرشيف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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

    </div>
  );
}
