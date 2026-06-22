import React, { useState } from 'react';
import { FileText, Search, Calendar, ArrowRightLeft, ArrowUpRight, ArrowDownLeft, Landmark, ShoppingBag, FolderSymlink, X } from 'lucide-react';
import { ERPState } from '../types';

interface TransactionLogModuleProps {
  state: ERPState;
  onOpenExporter: (section: string, metrics: any, headers: string[], rows: any[][]) => void;
  onUpdateState?: (newState: ERPState) => void;
}

export default function TransactionLogModule({ state, onOpenExporter, onUpdateState }: TransactionLogModuleProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'customer' | 'company' | 'merchant' | 'treasury'>('all');

  const handleDeleteTransaction = (t: any) => {
    if (!onUpdateState) return;

    let newState = { ...state };
    if (t.source === 'customer') {
      newState.debtTransactions = (state.debtTransactions || []).map(tx => tx.id === t.id ? { ...tx, isDeleted: true } : tx);
    } else if (t.source === 'company') {
      newState.companyTransactions = (state.companyTransactions || []).map(tx => tx.id === t.id ? { ...tx, isDeleted: true } : tx);
    } else if (t.source === 'merchant') {
      newState.merchantTransactions = (state.merchantTransactions || []).map(tx => tx.id === t.id ? { ...tx, isDeleted: true } : tx);
    } else if (t.source === 'treasury') {
      newState.treasuryTransactions = (state.treasuryTransactions || []).map(tx => tx.id === t.id ? { ...tx, isDeleted: true } : tx);
    }
    
    onUpdateState(newState);
  };

  // Gather transactions from all modules
  // 1. Customer debt transactions
  const customerTxs = (state.debtTransactions || []).filter(t => !t.isDeleted).map(t => {
    const cust = (state.customers || []).find(c => c.id === t.customerId);
    return {
      id: t.id,
      date: t.date,
      type: t.type === 'debt' ? 'دين للزبون' : 'سداد من زبون',
      isPlus: t.type === 'debt',
      amount: t.amount,
      partyName: cust ? cust.name : 'زبون غير معروف',
      note: t.note || 'بدون تفاصيل',
      refNo: t.referenceNo,
      source: 'customer' as const,
      color: t.type === 'debt' ? 'text-rose-600 bg-rose-50 border-rose-100' : 'text-emerald-700 bg-emerald-50 border-emerald-100'
    };
  });

  // 2. Company transactions
  const companyTxs = (state.companyTransactions || []).filter(t => !t.isDeleted).map(t => {
    const comp = (state.companies || []).find(c => c.id === t.companyId);
    return {
      id: t.id,
      date: t.date,
      type: t.type === 'purchase_invoice' ? 'شراء بالآجل (مستورد)' : 'سداد دفعة للمورد',
      isPlus: t.type === 'purchase_invoice',
      amount: t.amount,
      partyName: comp ? comp.name : 'شركة غير معروفة',
      note: t.note || 'توريد مالي',
      refNo: t.referenceNo,
      source: 'company' as const,
      color: t.type === 'purchase_invoice' ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-blue-700 bg-blue-50 border-blue-105'
    };
  });

  // 3. Merchant transactions
  const merchantTxs = (state.merchantTransactions || []).filter(t => !t.isDeleted).map(t => {
    const merch = (state.merchants || []).find(m => m.id === t.merchantId);
    return {
      id: t.id,
      date: t.date,
      type: t.type === 'debt' ? 'دين إضافي من التاجر' : 'تسوية أو سداد نقدي',
      isPlus: t.type === 'debt',
      amount: t.amount,
      partyName: merch ? merch.name : 'تاجر غير معروف',
      note: t.note || 'قيد تسوية تاجر',
      refNo: t.referenceNo,
      source: 'merchant' as const,
      color: t.type === 'debt' ? 'text-purple-700 bg-purple-50 border-purple-100' : 'text-teal-700 bg-teal-50 border-teal-105'
    };
  });

  // 4. Treasury transactions
  const treasuryTxs = (state.treasuryTransactions || []).filter(t => !t.isDeleted).map(t => {
    const label = t.type === 'in' ? 'مقبوضات واردة للخزينة' : 'مدفوعات منصرفة من الخزينة';
    let party = 'الخزينة العامة';
    if (t.source === 'customer_payment') party = 'تحصيل زبون';
    else if (t.source === 'purchase') party = 'فاتورة شراء سلعة';
    else if (t.source === 'company_payment') party = 'سداد مستحقات شركة';
    else if (t.source === 'manual_deposit') party = 'إيداع صندوف يدوي';
    else if (t.source === 'manual_withdraw') party = 'سحب مصروفات يدوي';
    else if (t.source === 'deposit_escrow') party = 'إيداع أمانة عميل';

    return {
      id: t.id,
      date: t.date,
      type: label,
      isPlus: t.type === 'in',
      amount: t.amount,
      partyName: party,
      note: t.description || 'حركة صندوق مباشر',
      refNo: t.referenceNo,
      source: 'treasury' as const,
      color: t.type === 'in' ? 'text-emerald-700 bg-lime-50' : 'text-slate-700 bg-slate-100'
    };
  });

  // Combine and sort
  const allTxs = [...customerTxs, ...companyTxs, ...merchantTxs, ...treasuryTxs]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter(t => {
      // Source filter
      if (sourceFilter !== 'all' && t.source !== sourceFilter) return false;
      // Search matching
      const matchesSearch = 
        t.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.refNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });

  // Export to Image exporter
  const handleExportClick = () => {
    const headers = ['تاريخ الحركة', 'النوع / التصنيف', 'الطرف المعني', 'القيمة المالية', 'الملاحظات والمرجعية'];
    const rows = allTxs.map(t => [
      new Date(t.date).toLocaleDateString('ar-LY'),
      t.type,
      t.partyName,
      t.amount.toLocaleString() + ' د.ل',
      `${t.note} [${t.refNo}]`
    ]);

    onOpenExporter(
      'تقرير سجل العمليات والحركات الشامل الموحد',
      {
        label1: 'عدد العمليات المفحصونة',
        value1: `${allTxs.length} حركة مسجلة`,
        label2: 'إجمالي الحركات الصادرة والواردة',
        value2: allTxs.reduce((sum, item) => sum + item.amount, 0).toLocaleString() + ' د.ل',
        label3: 'نظام التدقيق المالي',
        value3: 'مطابق للمعايير القياسية'
      },
      headers,
      rows
    );
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      
      {/* 1. Header and quick metrics */}
      <div className="bg-white border rounded-2xl p-4 md:p-6 shadow-xs border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <span>سجل العمليات التاريخي الشامل 📝</span>
          </h2>
          <p className="text-[11px] text-slate-500 mt-1 leading-normal">
            كشف محاسبي مركزي يسرد بالتوقيت الفوري كل حركة تم تسجيلها في دفتر ديون الزبائن، والشركات الموردة، والتجار، والخزينة العامة.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportClick}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-950"
            title="تصدير كرت صورة للسجل الموحد"
          >
            <FolderSymlink className="w-4 h-4" />
            <span>تصدير تقرير العمليات 📸</span>
          </button>
        </div>
      </div>

      {/* 2. Filters & Searches */}
      <div className="bg-white border p-3 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="🔍 ابحث بقيد الحركة، الطرف المعني، الكود المرجعي، أو الملاحظة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-right text-xs pr-9 pl-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold bg-slate-50/60"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>

          {/* Quick source selector filter cards */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto shrink-0 py-0.5">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'customer', label: 'العملاء' },
              { id: 'company', label: 'الشركات' },
              { id: 'merchant', label: 'التجار' },
              { id: 'treasury', label: 'الخزينة' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSourceFilter(tab.id as any)}
                className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all border shrink-0 cursor-pointer ${
                  sourceFilter === tab.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* 3. Consolidated Log Table List */}
      {allTxs.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 text-xs">
          🚫 لم يتم العثور على أي حركات مسجلة تطابق خيارات التصفية أو كلمة البحث الحالية.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-extrabold">
                  <th className="p-3 w-32">تاريخ القيد</th>
                  <th className="p-3 w-40">التصنيف</th>
                  <th className="p-3 w-48">الطرف ذو العلاقة</th>
                  <th className="p-3">تفاصيل المعاملة والبيان</th>
                  <th className="p-3 w-32 text-left">القيمة المالية</th>
                  <th className="p-3 w-16 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allTxs.map((t) => {
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-mono text-[9.5px] text-slate-400">
                        {new Date(t.date).toLocaleDateString('ar-LY')} {new Date(t.date).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block font-sans font-bold text-[9px] px-2 py-0.5 rounded-full border ${t.color}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-extrabold text-slate-900">{t.partyName}</span>
                      </td>
                      <td className="p-3 text-slate-600 leading-relaxed max-w-sm">
                        <div className="font-sans text-xs">{t.note}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">رمز القيد المحاسبي: {t.refNo}</div>
                      </td>
                      <td className="p-3 text-left font-mono shrink-0">
                        <span className={`font-black text-xs ${t.isPlus ? 'text-amber-600' : 'text-emerald-700'}`}>
                          {t.isPlus ? '+' : '-'}{t.amount.toLocaleString()} د.ل
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDeleteTransaction(t)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-1 rounded-md transition-all cursor-pointer hover:scale-105 inline-block"
                          title="مسح ونقل للأرشيف ❌"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 p-3 text-[10px] text-slate-400 text-left border-t border-slate-100 font-mono">
            نهاية كشف سجل العمليات التاريخي الموحد • تم رصد {allTxs.length} معاملة بالكامل.
          </div>
        </div>
      )}

    </div>
  );
}
