import React, { useState } from 'react';
import { Landmark, ArrowRightLeft, Shield, AlertCircle, Plus, Trash2, Search, Coins, RefreshCw, FileText, ChevronDown, ChevronUp, CheckCircle, UserCheck, Receipt, DollarSign, Image, X, Copy } from 'lucide-react';
import { ERPState, TrustDeposit, TrustDepositTx, TreasuryTransaction } from '../types';
import html2canvas from 'html2canvas';
import { copySettledImage } from "../utils/imageExporterUtils";

interface DepositsModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (section: string, metrics: any, headers: string[], rows: any[][]) => void;
}

export default function DepositsModule({ state, onUpdateState, onOpenExporter }: DepositsModuleProps) {
  const [filterQuery, setFilterQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

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
    alert(`تمت إضافة قيمة ${amount.toLocaleString()} د.ل لحساب العميل وترحيل الوارد للخزينة.`);
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
    alert(`نجاح العملية: تم إرسال وقيد وتأكيد الحوالة الداخلية لمصر وخصمها من أمانة العميل بنجاح.`);
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
    d.status === 'held'
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
    try {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "0px";
      container.style.top = "0px";
      container.style.zIndex = "-9999";
      container.style.opacity = "1";
      container.style.width = "480px";
      container.style.padding = "40px";
      container.style.backgroundColor = "#0f172a";
      container.style.direction = "rtl";
      container.style.fontFamily = "'Tajawal', 'Inter', system-ui, sans-serif";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
      container.style.border = "none";
      
      const lyd = Math.round(getAmountLyd(d));
      const egp = Math.round(getAmountEgp(d));
      
      const neonColor = '#10b981';
      const neonGlow = 'rgba(16, 185, 129, 0.4)';
      const softGlow = 'rgba(16, 185, 129, 0.15)';
      const neumorphicBg = 'linear-gradient(145deg, #1e293b, #0f172a)';

      let amountHtml = '';
      if (lyd !== 0 && egp !== 0) {
        amountHtml = `
          <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid ${neonColor}; border-radius: 16px; padding: 24px; display: flex; align-items: center; justify-content: center; gap: 16px; box-shadow: inset 0 0 20px ${softGlow}, 0 0 30px ${neonGlow}; backdrop-filter: blur(10px);">
              <span style="font-size: 38px; font-weight: 900; color: ${neonColor}; font-family: monospace; letter-spacing: -1px; text-shadow: 0 0 20px ${neonColor};" dir="ltr">${lyd.toLocaleString("en-US")}</span>
              <span style="font-size: 20px; font-weight: 900; color: ${neonColor}; text-shadow: 0 0 10px ${neonColor};">د.ل</span>
            </div>
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #3b82f6; border-radius: 16px; padding: 24px; display: flex; align-items: center; justify-content: center; gap: 16px; box-shadow: inset 0 0 20px rgba(59,130,246,0.15), 0 0 30px rgba(59,130,246,0.4); backdrop-filter: blur(10px);">
              <span style="font-size: 38px; font-weight: 900; color: #3b82f6; font-family: monospace; letter-spacing: -1px; text-shadow: 0 0 20px #3b82f6;" dir="ltr">${egp.toLocaleString("en-US")}</span>
              <span style="font-size: 20px; font-weight: 900; color: #3b82f6; text-shadow: 0 0 10px #3b82f6;">ج.م</span>
            </div>
          </div>
        `;
      } else if (egp !== 0) {
        amountHtml = `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #3b82f6; border-radius: 16px; padding: 32px; display: flex; align-items: center; justify-content: center; gap: 16px; box-shadow: inset 0 0 20px rgba(59,130,246,0.15), 0 0 30px rgba(59,130,246,0.4); backdrop-filter: blur(10px); width: 100%;">
            <span style="font-size: 42px; font-weight: 900; color: #3b82f6; font-family: monospace; letter-spacing: -1px; text-shadow: 0 0 20px #3b82f6;" dir="ltr">${egp.toLocaleString("en-US")}</span>
            <span style="font-size: 24px; font-weight: 900; color: #3b82f6; text-shadow: 0 0 10px #3b82f6;">ج.م</span>
          </div>
        `;
      } else {
        amountHtml = `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid ${neonColor}; border-radius: 16px; padding: 32px; display: flex; align-items: center; justify-content: center; gap: 16px; box-shadow: inset 0 0 20px ${softGlow}, 0 0 30px ${neonGlow}; backdrop-filter: blur(10px); width: 100%;">
            <span style="font-size: 42px; font-weight: 900; color: ${neonColor}; font-family: monospace; letter-spacing: -1px; text-shadow: 0 0 20px ${neonColor};" dir="ltr">${lyd.toLocaleString("en-US")}</span>
            <span style="font-size: 24px; font-weight: 900; color: ${neonColor}; text-shadow: 0 0 10px ${neonColor};">د.ل</span>
          </div>
        `;
      }

      container.innerHTML = `
        <div dir="rtl" style="direction: rtl; background: ${neumorphicBg}; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 40px; width: 100%; box-shadow: 20px 20px 60px #0a0f1c, -20px -20px 60px #141f38;">
          <div style="text-align: center; margin-bottom: 32px; border-bottom: 2px solid rgba(255,255,255,0.05); padding-bottom: 24px;">
            <h2 style="font-size: 32px; font-weight: 900; color: #ffffff; margin: 0; white-space: pre-wrap; word-break: break-word; text-shadow: 0 2px 10px rgba(255,255,255,0.2);">${d.customerName}</h2>
          </div>
          
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 18px; font-weight: 800; color: #94a3b8;">
              إجمالي الأمانات لكم:
            </span>
          </div>
          
          ${amountHtml}

          <div style="margin-top: 40px; text-align: center; color: #64748b; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; text-shadow: 0 1px 2px rgba(0,0,0,0.5);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 2px rgba(148,163,184,0.5));"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            تم الإصدار من المنظومة
          </div>
        </div>
      `;
      
      document.body.appendChild(container);
      
      await new Promise((resolve) => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#0f172a',
        useCORS: true,
      });
      
      document.body.removeChild(container);
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setShowSuccessToast("تم نسخ صورة الأمانة بنجاح 📋");
            setTimeout(() => setShowSuccessToast(null), 3000);
          } catch (clipErr) {
            console.error("Clipboard write error:", clipErr);
            alert("حدث خطأ أثناء حفظ الصورة في الحافظة.");
          }
        }
      }, 'image/png');
    } catch (err) {
      console.error("Failed to copy image", err);
      alert("حدث خطأ أثناء نسخ الصورة.");
    }
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

          {/* ADD CUSTOMER BUTTON */}
          <div className="flex flex-col justify-center items-center w-full lg:max-w-xs shrink-0">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm py-4 px-6 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg w-full h-full min-h-[100px]"
            >
              <Plus className="w-6 h-6" />
              <span>إضافة عميل أمانة جديد</span>
            </button>
          </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {activeHeldDeposits.map(d => {
              const customerLyd = getAmountLyd(d);
              const customerEgp = getAmountEgp(d);
              const isExpanded = expandedCardId === d.id;

              return (
                <div 
                  key={d.id} 
                  onClick={() => {
                    setExpandedCardId(isExpanded ? null : d.id);
                    if (!isExpanded) resetActionForm();
                  }}
                  className={`bg-white border-y border-l border-r-4 border-slate-200 p-3 rounded-xl cursor-pointer transition-all flex flex-col items-center justify-center shadow-xs hover:shadow-md group min-h-[90px] relative text-center ${(Number(customerLyd) === 0 && Number(customerEgp) === 0) ? 'border-r-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-300' : (customerLyd < 0 || customerEgp < 0) ? 'border-r-rose-500' : 'border-r-indigo-500'}`}
                >
                  {/* CARD TILE BODY */}
                  <h4 className="font-black text-slate-900 text-base mb-1.5 w-full truncate px-1">{d.customerName}</h4>
                  <div className="flex flex-col items-center">
                    <span className={`font-mono text-lg font-black ${customerLyd < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
                      {Math.round(customerLyd).toLocaleString('en-US')} د.ل
                    </span>
                    {customerEgp !== 0 && (
                      <span className={`font-mono text-base font-black mt-1 ${customerEgp < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {Math.round(customerEgp).toLocaleString('en-US')} ج.م
                      </span>
                    )}
                  </div>

                  {/* EXPANDABLE WORKSPACE DRAWER AS MODAL */}
                  {isExpanded && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto cursor-default">
                      <div 
                        className="relative w-full max-w-4xl bg-white border border-slate-200 shadow-2xl rounded-2xl flex flex-col max-h-[95vh] my-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        
                        {/* THE EXACT OLD CARD DESIGN HEADER */}
                        <div className={`border-t-[6px] rounded-t-2xl px-5 pt-5 pb-4 ${(customerLyd > 0 || customerEgp > 0) ? 'border-amber-500' : 'border-emerald-500'}`}>
                          <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-3">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDeposit(d.id);
                                  }}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1.5 rounded-md transition-all cursor-pointer shrink-0 hover:scale-105"
                                  title="حذف ونقل للأرشيف ❌"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleExportSingleDepositDraft(d);
                                  }}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-1.5 rounded-md transition-all cursor-pointer shrink-0 hover:scale-105"
                                  title="طباعة سجل الأمانة الكامل 🖨️"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <div className="w-2 h-2 rounded-full bg-indigo-600 mr-1" />
                                <h4 className="font-extrabold text-slate-900 text-base">{d.customerName}</h4>
                              </div>
                              <div className="flex gap-2 items-center mt-3">
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (Number(customerLyd) === 0 && Number(customerEgp) === 0) {
                                      const success = await copySettledImage(d.customerName);
                                      if (success) {
                                        alert("تم نسخ كارت المخالصة بنجاح 📋");
                                      }
                                    } else {
                                      handleCopyDepositImage(d);
                                    }
                                  }}
                                  className={`p-2 px-4 rounded-xl transition-all cursor-pointer flex items-center gap-2 text-xs font-bold shadow-md text-white ${Number(customerLyd) === 0 && Number(customerEgp) === 0 ? 'bg-emerald-600 hover:bg-emerald-700 border border-emerald-500' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}
                                  title={Number(customerLyd) === 0 && Number(customerEgp) === 0 ? "نسخ كارت المخالصة 📋" : "نسخ كارت الصورة 📸"}
                                >
                                  <Copy className="w-4 h-4" />
                                  {Number(customerLyd) === 0 && Number(customerEgp) === 0 ? "نسخ كارت المخالصة" : "نسخ كارت الصورة"}
                                </button>
                              </div>
                              <span className="text-xs text-slate-500 block mt-2 font-mono">
                                مستند: {d.referenceNo} • {new Date(d.date).toLocaleDateString('en-US')}
                              </span>
                            </div>

                            <div className="text-left">
                              <div className="font-mono text-base font-black text-slate-900 block">
                                {Math.round(customerLyd).toLocaleString('en-US')} <span className="text-[11px] text-slate-400">د.ل</span>
                              </div>
                              {customerEgp !== 0 && (
                                <div className="font-mono text-sm font-black text-emerald-600 block mt-0.5">
                                  {Math.round(customerEgp).toLocaleString('en-US')} <span className="text-[10px] text-emerald-500 font-bold">جنيه مصري</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-50 rounded-lg p-3 mb-3">
                            <p className="text-xs text-slate-600 leading-relaxed font-medium">
                              &quot;{d.note}&quot;
                            </p>
                          </div>

                          <div className="flex items-center justify-between mt-2">
                            <div className="flex gap-2">
                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-black text-xs">
                                🇱🇾 {customerLyd.toLocaleString('en-US')} د.ل
                              </span>
                              {customerEgp !== 0 ? (
                                <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-black text-xs">
                                  🇪🇬 {customerEgp.toLocaleString('en-US')} ج.م
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-semibold text-[11px]">
                                  رصيد مصري مصفر
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setExpandedCardId(null);
                                resetActionForm();
                              }}
                              className="text-xs font-black text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <span>إغلاق النافذة</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* OLD WORKSPACE DRAWER CONTENT */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 custom-scrollbar rounded-b-2xl">
                      
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
                                    placeholder={`الرصيد المتاح: ${customerLyd}`}
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
                                      placeholder={`الرصيد المتاح: ${customerLyd} د.ل`}
                                      className="w-full text-right p-2 border rounded font-mono text-xs text-indigo-600 font-bold"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-emerald-600 mb-1">سعر صرف اليوم (الدينار كم جنيه؟) *</label>
                                    <input
                                      type="number"
                                      step="1"
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
                                    placeholder={`الرصيد المتاح: ${customerLyd}`}
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
                    </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

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
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="مثال: أكرم بوعجيله"
                  className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
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
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="اختياري: مثال دفعة كذا"
                  className="w-full text-right p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />
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

    </div>
  );
}
