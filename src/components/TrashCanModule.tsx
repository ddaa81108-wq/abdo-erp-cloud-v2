import React, { useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle, ShieldCheck, Search, Users, Building, Inbox, Check } from 'lucide-react';
import { ERPState, Customer, Company, CustomerCycle, Merchant } from '../types';
import { upsertCustomerPaymentInTreasury } from '../domain/customerAccounts';

interface TrashCanModuleProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
}

interface TrashRecordTimestamp {
  deletedAt?: string;
  updatedAt?: string;
  createdAt?: string;
  date?: string;
}

const getTrashRecordTime = (record: TrashRecordTimestamp) => {
  const timestamp = record.deletedAt || record.updatedAt || record.createdAt || record.date;
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTrashRecordTime = (timestamp: number) => {
  if (!timestamp) return 'غير مسجل';
  return new Date(timestamp).toLocaleString('ar-LY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function TrashCanModule({ state, onUpdateState }: TrashCanModuleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<
    'all' | 'customers' | 'companies' | 'merchants' | 'transactions'
  >('all');
  
  // State for inline deletion confirmation to bypass window.confirm
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingEmptyTrash, setConfirmingEmptyTrash] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Find all deleted records
  const deletedCustomers = (state.customers || []).filter(c => c.isDeleted);
  const deletedCompanies = (state.companies || []).filter(c => c.isDeleted);
  const deletedMerchants = (state.merchants || []).filter(m => m.isDeleted);
  const deletedDeposits = (state.trustDeposits || []).filter(d => d.isDeleted);
  const deletedPurchases = (state.purchases || []).filter(p => p.merchant && p.isDeleted);
  
  const deletedTxs = [
    ...(state.debtTransactions || []).filter(t => t.isDeleted).map(t => ({ ...t, source: 'customer' as const, name: `عملية ديون للزبون (${t.amount} د.ل)` })),
    ...(state.companyTransactions || []).filter(t => t.isDeleted).map(t => ({ ...t, source: 'company' as const, name: `فاتورة / دفعة مورد (${t.amount} د.ل)` })),
    ...(state.merchantTransactions || []).filter(t => t.isDeleted).map(t => ({ ...t, source: 'merchant' as const, name: `قيد ذمة تاجر (${t.amount} د.ل)` })),
    ...(state.treasuryTransactions || []).filter(t => t.isDeleted).map(t => ({ ...t, source: 'treasury' as const, name: `قيد وحركة خزينة مركزي (${t.amount} د.ل)` })),
    ...deletedPurchases.map(t => ({
      ...t,
      source: 'purchase' as const,
      name: `معاملة مشتريات رقم ${t.seq || '-'} (${t.result || 0} د.ل)`,
    })),
  ];

  const triggerNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4000);
  };

  // Restore Customer
  const handleRestoreCustomer = (custId: string) => {
    const updated = (state.customers || []).map(c => {
      if (c.id === custId) {
        return { ...c, isDeleted: false };
      }
      return c;
    });
    onUpdateState({
      ...state,
      customers: updated
    });
    triggerNotification('تم استرجاع الزبون وحسابه بنجاح لشاشة الديون النشطة! 👍');
  };

  // Permanent Delete Customer
  const handlePermanentDeleteCustomer = (custId: string) => {
    const updatedCusts = (state.customers || []).filter(c => c.id !== custId);
    const updatedCycles = (state.cycles || []).filter(cy => cy.customerId !== custId);
    const customerTransactionIds = new Set(
      (state.debtTransactions || [])
        .filter(t => t.customerId === custId)
        .map(t => t.id),
    );
    const updatedTxs = (state.debtTransactions || []).filter(t => t.customerId !== custId);

    onUpdateState({
      ...state,
      customers: updatedCusts,
      cycles: updatedCycles,
      debtTransactions: updatedTxs,
      treasuryTransactions: (state.treasuryTransactions || []).filter(
        tx => !(tx.source === 'customer_payment' && customerTransactionIds.has(tx.sourceId || '')),
      ),
    });
    setConfirmingDeleteId(null);
    triggerNotification('تم مسح ملف الزبون وحساباته نهائياً من الذاكرة! 🗑️');
  };

  // Restore Company
  const handleRestoreCompany = (compId: string) => {
    const updated = (state.companies || []).map(c => {
      if (c.id === compId) {
        return { ...c, isDeleted: false };
      }
      return c;
    });
    onUpdateState({
      ...state,
      companies: updated
    });
    triggerNotification('تمت استعادة حساب المورد بنجاح لشاشة الشركات! 👍');
  };

  // Permanent Delete Company
  const handlePermanentDeleteCompany = (compId: string) => {
    const updatedComps = (state.companies || []).filter(c => c.id !== compId);
    const updatedTxs = (state.companyTransactions || []).filter(t => t.companyId !== compId);

    onUpdateState({
      ...state,
      companies: updatedComps,
      companyTransactions: updatedTxs
    });
    setConfirmingDeleteId(null);
    triggerNotification('تم مسح وإتلاف ملف شركة التوريد نهائياً بنجاح! 🗑️');
  };

  // Restore Merchant
  const handleRestoreMerchant = (merchId: string) => {
    const updated = (state.merchants || []).map(m => {
      if (m.id === merchId) {
        return { ...m, isDeleted: false };
      }
      return m;
    });
    onUpdateState({
      ...state,
      merchants: updated
    });
    triggerNotification('تم استرجاع حساب التاجر بنجاح لجدول كشوفات أعمال التجار! 👍');
  };

  // Permanent Delete Merchant
  const handlePermanentDeleteMerchant = (merchId: string) => {
    const updatedMerchants = (state.merchants || []).filter(m => m.id !== merchId);
    const updatedMerchantTxs = (state.merchantTransactions || []).filter(t => t.merchantId !== merchId);

    onUpdateState({
      ...state,
      merchants: updatedMerchants,
      merchantTransactions: updatedMerchantTxs
    });
    setConfirmingDeleteId(null);
    triggerNotification('تم مسح وشطب ملف التاجر بالكامل من النظام! 🗑️');
  };

  // Restore Deposit
  const handleRestoreDeposit = (depId: string) => {
    const updated = (state.trustDeposits || []).map(d => {
      if (d.id === depId) {
        return { ...d, isDeleted: false };
      }
      return d;
    });
    onUpdateState({
      ...state,
      trustDeposits: updated
    });
    triggerNotification('تم استرجاع سند الأمانة وتنشيطه بالدورة الحسابية بنجاح! 👍');
  };

  // Permanent Delete Deposit
  const handlePermanentDeleteDeposit = (depId: string) => {
    const deposit = (state.trustDeposits || []).find(d => d.id === depId);
    const trustTransactionIds = new Set(
      (deposit?.history || []).map(transaction => `${depId}:${transaction.id}`),
    );
    const updated = (state.trustDeposits || []).filter(d => d.id !== depId);
    onUpdateState({
      ...state,
      trustDeposits: updated,
      treasuryTransactions: (state.treasuryTransactions || []).filter(
        transaction =>
          !(
            transaction.source === 'deposit_escrow' &&
            trustTransactionIds.has(transaction.sourceId || '')
          ),
      ),
    });
    setConfirmingDeleteId(null);
    triggerNotification('تم مسح وإتلاف حساب الأمانة نهائياً بنجاح! 🗑️');
  };

  // Restore Transaction
  const handleRestoreTransaction = (txItem: any) => {
    let newState = { ...state };
    if (txItem.source === 'customer') {
      const cycle = state.cycles.find(item => item.id === txItem.cycleId);
      if (cycle?.status === 'closed') {
        triggerNotification('الدورة التاريخية مغلقة للقراءة فقط؛ لا يمكن استرجاع حركة داخلها.');
        return;
      }
      newState.debtTransactions = (state.debtTransactions || []).map(tx => tx.id === txItem.id ? { ...tx, isDeleted: false } : tx);
      const restored = newState.debtTransactions.find(tx => tx.id === txItem.id);
      const customer = restored ? state.customers.find(item => item.id === restored.customerId) : undefined;
      if (restored?.type === 'payment') {
        newState.treasuryTransactions = upsertCustomerPaymentInTreasury(
          state.treasuryTransactions || [],
          restored,
          customer?.name || 'عميل',
        );
      }
    } else if (txItem.source === 'company') {
      newState.companyTransactions = (state.companyTransactions || []).map(tx => tx.id === txItem.id ? { ...tx, isDeleted: false } : tx);
    } else if (txItem.source === 'merchant') {
      newState.merchantTransactions = (state.merchantTransactions || []).map(tx => tx.id === txItem.id ? { ...tx, isDeleted: false } : tx);
    } else if (txItem.source === 'treasury') {
      newState.treasuryTransactions = (state.treasuryTransactions || []).map(tx => tx.id === txItem.id ? { ...tx, isDeleted: false } : tx);
    } else if (txItem.source === 'purchase') {
      newState.purchases = (state.purchases || []).map(tx =>
        tx.id === txItem.id
          ? { ...tx, isDeleted: false, deletedAt: undefined, updatedAt: new Date().toISOString() }
          : tx);
      newState.purchaseAuditLog = [
        ...(state.purchaseAuditLog || []),
        {
          id: `purchase_audit_restore_${Date.now()}`,
          purchaseId: txItem.id,
          merchant: txItem.merchant || 'baqy',
          date: txItem.date,
          action: 'restore',
          details: `استرجاع معاملة المشتريات رقم ${txItem.seq || '-'}`,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    onUpdateState(newState);
    triggerNotification('تم استرجاع العملية المحذوفة لسجل العمليات بنجاح! 👍');
  };

  // Permanent Delete Transaction
  const handlePermanentDeleteTransaction = (txItem: any) => {
    let newState = { ...state };
    if (txItem.source === 'customer') {
      newState.debtTransactions = (state.debtTransactions || []).filter(tx => tx.id !== txItem.id);
      newState.treasuryTransactions = (state.treasuryTransactions || []).filter(
        tx => !(tx.source === 'customer_payment' && tx.sourceId === txItem.id),
      );
    } else if (txItem.source === 'company') {
      newState.companyTransactions = (state.companyTransactions || []).filter(tx => tx.id !== txItem.id);
    } else if (txItem.source === 'merchant') {
      newState.merchantTransactions = (state.merchantTransactions || []).filter(tx => tx.id !== txItem.id);
    } else if (txItem.source === 'treasury') {
      newState.treasuryTransactions = (state.treasuryTransactions || []).filter(tx => tx.id !== txItem.id);
    } else if (txItem.source === 'purchase') {
      newState.purchases = (state.purchases || []).filter(tx => tx.id !== txItem.id);
    }
    onUpdateState(newState);
    setConfirmingDeleteId(null);
    triggerNotification('تم مسح وإتلاف العملية نهائياً من سجلات النظام! 🗑️');
  };

  // Empty Entire Trash
  const handleEmptyTrash = () => {
    onUpdateState({
      ...state,
      customers: (state.customers || []).filter(c => !c.isDeleted),
      companies: (state.companies || []).filter(c => !c.isDeleted),
      merchants: (state.merchants || []).filter(m => !m.isDeleted),
      trustDeposits: (state.trustDeposits || []).filter(d => !d.isDeleted),
      debtTransactions: (state.debtTransactions || []).filter(t => !t.isDeleted),
      companyTransactions: (state.companyTransactions || []).filter(t => !t.isDeleted),
      merchantTransactions: (state.merchantTransactions || []).filter(t => !t.isDeleted),
      treasuryTransactions: (state.treasuryTransactions || []).filter(t => !t.isDeleted),
      purchases: (state.purchases || []).filter(t => !t.isDeleted),
    });
    setConfirmingEmptyTrash(false);
    triggerNotification('تم مسح وإفراغ جميع العناصر من سلة المهملات بنجاح! 🗑️');
  };

  // Create unified feed for simple search and tab filtering
  const allTrashItems = [
    ...deletedCustomers.map(c => ({ id: c.id, name: c.name, details: c.phone ? `تلفونه: ${c.phone}` : 'من غير تلفون', type: 'customer' as const, label: 'زبون / عميل 👥', color: 'bg-rose-50 text-rose-700 border-rose-150', sortTime: getTrashRecordTime(c), itemRef: c })),
    ...deletedCompanies.map(c => ({ id: c.id, name: c.name, details: c.contact ? `المسئول عنه: ${c.contact}` : 'من غير تفاصيل اتفاق', type: 'company' as const, label: 'مورد / شركة توريد 🏭', color: 'bg-amber-50 text-amber-700 border-amber-150', sortTime: getTrashRecordTime(c), itemRef: c })),
    ...deletedMerchants.map(m => ({ id: m.id, name: m.name, details: m.contact ? `بيانات التواصل: ${m.contact}` : 'من غير بيانات تواصل', type: 'merchant' as const, label: 'تاجر محذوف 🧾', color: 'bg-orange-50 text-orange-700 border-orange-200', sortTime: getTrashRecordTime(m), itemRef: m })),
    ...deletedDeposits.map(d => ({ id: d.id, name: `أمانة العميل: ${d.customerName}`, details: `مرجع: ${d.referenceNo} | متبقي ليبي: ${d.amountLyd} د.ل | مصري: ${d.amountEgp} ج.م`, type: 'deposit' as const, label: 'سند أمانة جاري 🔒', color: 'bg-indigo-50 text-indigo-700 border-indigo-150', sortTime: getTrashRecordTime(d), itemRef: d })),
    ...deletedTxs.map(t => ({
      id: t.id,
      name: t.name,
      details: t.source === 'purchase'
        ? `${t.type || 'بدون نوع'} | ${new Date(t.date || t.createdAt).toLocaleDateString('ar-LY')}`
        : `المرجع: ${t.referenceNo || 'بدون'} | ${new Date(t.date || t.createdAt).toLocaleDateString('ar-LY')} (${t.note || t.description || 'بدون ملاحظة'})`,
      type: 'transaction' as const,
      label: t.source === 'purchase' ? 'معاملة مشتريات محذوفة 🛒' : 'عملية / قيد ملغي 📝',
      color: t.source === 'purchase' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200',
      sortTime: getTrashRecordTime(t),
      itemRef: t,
    }))
  ].filter(item => {
    // Tab filter
    if (activeTab === 'customers' && item.type !== 'customer') return false;
    if (activeTab === 'companies' && item.type !== 'company') return false;
    if (activeTab === 'merchants' && item.type !== 'merchant') return false;
    if (activeTab === 'transactions' && item.type !== 'transaction') return false;

    // Search query Matching
    return item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.details.toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((first, second) => second.sortTime - first.sortTime);

  return (
    <div className="space-y-4 text-right animate-fadeIn" dir="rtl">
      
      {/* Dynamic Native Success Toast Overlay Alternative */}
      {successMessage && (
        <div className="fixed bottom-6 left-6 z-[60] bg-emerald-600 border border-emerald-500 text-white rounded-xl p-3 px-5 shadow-2xl flex items-center gap-3 animate-slideInLeft">
          <Check className="w-5 h-5 text-white animate-bounce" />
          <span className="text-xs font-extrabold font-sans leading-tight">{successMessage}</span>
        </div>
      )}

      {/* 1. Module info panel */}
      <div className="bg-white border rounded-2xl p-4 md:p-6 shadow-xs border-rose-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600 animate-pulse" />
            <span>سلة المهملات والمحذوفات المؤقتة (الأرشيف المسترجع) 🗑️</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-1 leading-normal">
            هنا هتلاقي كل زبون أو شركة أو تاجر حذفتهم مؤقتاً عشان متحصلش لخبطة في الدفاتر. تقدر ترجع أي حساب فيهم بضغطة زرار واحدة وترجع كل فلوسه وحساباته علطول أو تخلص عليه وتمسحه خالص!
          </p>
        </div>
        <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100/55 flex items-center gap-2 text-xs shrink-0">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="text-[10px] text-rose-950 leading-tight">
            الحسابات هنا مبتتحذفش غير لو دوست بنفسك على "تأكيد المسح النهائي" عشان تحافظ على أرصدتك.
          </div>
        </div>
      </div>

      {/* 2. Top control panel */}
      <div className="bg-white border p-3 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="🔍 دور بالاسم أو التلفون في سلة المحذوفات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-right text-xs pr-9 pl-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold bg-slate-50/65"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>

          {confirmingEmptyTrash ? (
            <div className="flex items-center gap-1.5 shrink-0 bg-rose-50 p-1 rounded-xl border border-rose-200 animate-fadeIn">
              <span className="text-[10px] font-black text-rose-800 px-2">تأكيد الإفراغ نهائياً؟</span>
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer"
              >نعم🚨</button>
              <button
                onClick={() => setConfirmingEmptyTrash(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[10px] rounded-lg transition-all cursor-pointer"
              >إلغاء</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingEmptyTrash(true)}
              disabled={allTrashItems.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 disabled:bg-rose-300 hover:bg-rose-700 text-white font-bold text-[11px] rounded-xl transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed shrink-0"
              title="حذف جميع المهملات"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إفراغ السلة</span>
            </button>
          )}

          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto shrink-0 py-0.5" dir="rtl">
            {[
              { id: 'all', label: 'كل المحذوفات' },
              { id: 'customers', label: 'الزباين المحذوفة' },
              { id: 'companies', label: 'الشركات اللي مسحناها' },
              { id: 'merchants', label: 'التجار المحذوفين' },
              { id: 'transactions', label: 'العمليات الممسوحة' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all border shrink-0 cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 3. Render deleted items as a newest-first ledger */}
      {allTrashItems.length === 0 ? (
        <div className="bg-white border rounded-2xl p-16 text-center text-slate-400">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">سلة الزبالة والمهملات فاضية خالص! 🌟</p>
          <p className="text-[10.5px] text-slate-400 mt-1 leading-normal">
            مفيش أي زبون أو مورد أو تاجر ممسوح في الوقت الحالي. حساباتك ودورتك المحاسبية نضافة 100%.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <div>
              <h3 className="text-xs font-black text-slate-800">سجل العناصر المحذوفة</h3>
              <p className="mt-0.5 text-[10px] font-bold text-slate-500">الأحدث في الأعلى، والأقدم في الأسفل</p>
            </div>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-black text-rose-700">
              {allTrashItems.length} عنصر
            </span>
          </div>

          <div className="max-h-[62vh] overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-right">
              <thead className="sticky top-0 z-10 bg-slate-900 text-white shadow-sm">
                <tr className="text-[10px] font-black">
                  <th className="w-14 px-3 py-2.5 text-center">م</th>
                  <th className="w-40 px-3 py-2.5">تاريخ الحذف</th>
                  <th className="w-44 px-3 py-2.5">القسم</th>
                  <th className="min-w-52 px-3 py-2.5">الاسم / المعاملة</th>
                  <th className="min-w-72 px-3 py-2.5">التفاصيل</th>
                  <th className="w-64 px-3 py-2.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
          {allTrashItems.map((item, index) => {
            const isConfirming = confirmingDeleteId === item.id;
            return (
              <tr
                key={item.id} 
                className="bg-white text-[11px] transition-colors hover:bg-slate-50/80"
              >
                <td className="px-3 py-2.5 text-center font-black text-slate-400">{index + 1}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-600">
                  {formatTrashRecordTime(item.sortTime)}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${item.color}`}>
                    {item.label}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-extrabold text-slate-800">{item.name}</td>
                <td className="px-3 py-2.5 font-mono text-[10.5px] text-slate-500">{item.details}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-center gap-1.5">
                  {isConfirming ? (
                    <div className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 p-1 animate-fadeIn">
                        <button
                          onClick={() => {
                            if (item.type === 'customer') handlePermanentDeleteCustomer(item.id);
                            else if (item.type === 'company') handlePermanentDeleteCompany(item.id);
                            else if (item.type === 'merchant') handlePermanentDeleteMerchant(item.id);
                            else if (item.type === 'deposit') handlePermanentDeleteDeposit(item.id);
                            else if (item.type === 'transaction') handlePermanentDeleteTransaction((item as any).itemRef);
                          }}
                          className="whitespace-nowrap rounded-md bg-rose-600 px-2 py-1 text-[9px] font-black text-white transition-all hover:bg-rose-700 cursor-pointer"
                        >
                          تأكيد المسح النهائي 🚨
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="px-2 py-1 text-[9px] font-bold bg-slate-200 hover:bg-slate-350 text-slate-700 rounded-md transition-all cursor-pointer"
                        >
                          تراجع ✕
                        </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (item.type === 'customer') handleRestoreCustomer(item.id);
                          else if (item.type === 'company') handleRestoreCompany(item.id);
                          else if (item.type === 'merchant') handleRestoreMerchant(item.id);
                          else if (item.type === 'deposit') handleRestoreDeposit(item.id);
                          else if (item.type === 'transaction') handleRestoreTransaction((item as any).itemRef);
                        }}
                        className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-indigo-150 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700 transition-all hover:bg-indigo-100 cursor-pointer"
                        title="استرجاع الملف للمنظومة مباشرة"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>رجع للحسابات النشطة</span>
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(item.id)}
                        className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-rose-150 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600 transition-all hover:bg-rose-100 cursor-pointer"
                        title="حذف القيد وحرقه نهائياً من المتصفح"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>مسح نهائي 🗑️</span>
                      </button>
                    </>
                  )}
                  </div>
                </td>
              </tr>
            );
          })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
