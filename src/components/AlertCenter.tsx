import React, { useState } from 'react';
import { AlertTriangle, Bell, CheckCircle, Flame, ShieldAlert, Sparkles, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { ERPState, DebtTransaction, PurchaseRecord } from '../types';

interface AlertCenterProps {
  state: ERPState;
  onNavigateToSection: (section: string) => void;
  onPostPurchaseToTreasury?: (purchaseId: string) => void;
}

export default function AlertCenter({
  state,
  onNavigateToSection,
  onPostPurchaseToTreasury
}: AlertCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Compute Warnings Dynamically:
  
  // 1. Negative Treasury Balance
  const treasuryBalance = state.treasuryTransactions?.reduce((sum, tx) => {
    return sum + (tx.type === 'in' ? tx.amount : -tx.amount);
  }, 0) || 0;
  const isTreasuryNegative = treasuryBalance < 0;

  // 2. Purchases without exchange / transfer rate:
  const invalidRatePurchases = state.purchases.filter(p => {
    const isForeign = p.currency !== 'د.ل';
    const hasNoValidRate = !p.conversionRate || p.conversionRate <= 0;
    return isForeign && hasNoValidRate;
  });

  // 3. Overdue client payments (Active clients with debts)
  const overdueClients = state.customers.filter(c => {
    const activeCycle = state.cycles.find(cy => cy.customerId === c.id && cy.status === 'active');
    return activeCycle && activeCycle.currentBalance > 0;
  });

  // 4. Un-posted treasury collections
  const unpostedCollectionsCount = 
    (state.debtTransactions?.filter(tx => !tx.postedToTreasury).length || 0) +
    (state.companyTransactions?.filter(tx => !tx.postedToTreasury).length || 0) +
    (state.merchantTransactions?.filter(tx => !tx.postedToTreasury).length || 0) +
    (state.purchases?.filter(p => !p.postedToTreasury).length || 0);

  const alertsCount = 
    (isTreasuryNegative ? 1 : 0) + 
    invalidRatePurchases.length + 
    overdueClients.length + 
    (unpostedCollectionsCount > 0 ? 1 : 0);

  if (alertsCount === 0 && !isTreasuryNegative) {
    return (
      <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border-b border-emerald-100 px-4 py-2.5 text-xs font-medium">
        <CheckCircle className="w-4 h-4 text-emerald-600 animate-pulse" />
        <span>جميع الفحوصات المحاسبية سليمة: الخزينة متزنة ومكتملة الترحيل.</span>
      </div>
    );
  }

  return (
    <div className="border-b border-amber-100 bg-amber-50/70 transition-all">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-amber-100/50 select-none"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-mono text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center animate-bounce">
              {alertsCount}
            </span>
            <Bell className="w-5 h-5 text-amber-700 animate-swing" />
          </div>
          <div className="text-right">
            <h4 className="font-semibold text-xs text-amber-900">🔔 مركز التنبيهات المحاسبية الذكي</h4>
            <p className="text-[10px] text-amber-700 font-mono">
              بانتظار الإجراء المعجل: {alertsCount} إخطارات تم اكتشافها تلقائياً
            </p>
          </div>
        </div>

        <button className="text-[11px] font-semibold text-amber-800 bg-amber-200/60 hover:bg-amber-200 px-2.5 py-1 rounded-md transition-all">
          {isOpen ? 'إخفاء الإخطارات التفصيلية ▲' : 'عرض التفاصيل المحاسبية ▼'}
        </button>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 border-t border-amber-100 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* 1. Negative Treasury Balance Alert */}
          {isTreasuryNegative && (
            <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-rose-800 font-bold text-xs mb-1">
                  <Flame className="w-4 h-4 text-rose-600 animate-pulse" />
                  <span>عجز بالخزينة الرئيسية</span>
                </div>
                <p className="text-[11px] text-rose-700 leading-relaxed mb-2">
                  رصيد الخزينة الحالي بالسالب (عجز). يجب مراجعة المدفوعات والواردات لتسوية هذا الخلل المحاسبي الفادح.
                </p>
                <div className="bg-white/80 border border-rose-100 px-2 py-1.5 rounded text-center font-mono font-black text-rose-600 mb-2">
                  {treasuryBalance.toLocaleString()} د.ل
                </div>
              </div>
              <button 
                onClick={() => onNavigateToSection('treasury')}
                className="w-full text-center bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-md transition-all"
              >
                مراجعة الخزينة 💰
              </button>
            </div>
          )}

          {/* 2. Overdue Client Payments Alert */}
          {overdueClients.length > 0 && (
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-orange-800 font-bold text-xs mb-1">
                  <AlertTriangle className="w-4 h-4 text-orange-600" />
                  <span>ديون عملاء نشطة</span>
                </div>
                <p className="text-[11px] text-orange-700 leading-relaxed mb-2">
                  يوجد {overdueClients.length} عميل لديهم ذمم مالية مفتوحة وديون مستحقة السداد.
                </p>
                <div className="space-y-1.5 max-h-24 overflow-y-auto mb-2 pr-1 custom-scrollbar">
                  {overdueClients.slice(0, 5).map(c => {
                    const cycle = state.cycles.find(cy => cy.customerId === c.id && cy.status === 'active');
                    return (
                      <div key={c.id} className="bg-white/80 border border-orange-100 px-2 py-1 rounded text-[10px] flex items-center justify-between font-mono">
                        <span className="truncate max-w-[90px] text-slate-800 font-sans">{c.name}</span>
                        <span className="font-bold text-orange-600">{cycle?.currentBalance.toLocaleString()} د.ل</span>
                      </div>
                    );
                  })}
                  {overdueClients.length > 5 && (
                    <div className="text-center text-[9px] text-orange-500 font-bold">+ {overdueClients.length - 5} آخرين</div>
                  )}
                </div>
              </div>
              <button 
                onClick={() => onNavigateToSection('debts')}
                className="w-full text-center bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold py-1.5 px-3 rounded-md transition-all"
              >
                مطالبة العملاء 👥
              </button>
            </div>
          )}

          {/* 3. Missing Conversion Rates Alert */}
          {invalidRatePurchases.length > 0 && (
            <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-sky-800 font-bold text-xs mb-1">
                  <ArrowLeftRight className="w-4 h-4 text-sky-600" />
                  <span>مشتريات بدون سعر تحويل</span>
                </div>
                <p className="text-[11px] text-sky-700 leading-relaxed mb-2">
                  اكتُشف {invalidRatePurchases.length} عملية شراء بالعملة الأجنبية لا تحتوي على معادل تحويل.
                </p>
                <div className="space-y-1.5 max-h-24 overflow-y-auto mb-2 pr-1 custom-scrollbar">
                  {invalidRatePurchases.map(p => (
                    <div key={p.id} className="bg-white/80 border border-sky-100 px-2 py-1 rounded text-[10px] flex items-center justify-between font-mono">
                      <span className="truncate max-w-[90px] text-slate-800 font-sans">{p.itemName}</span>
                      <span className="font-bold text-sky-600">{p.totalPrice.toLocaleString()} {p.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => onNavigateToSection('purchases')}
                className="w-full text-center bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-md transition-all"
              >
                ضبط المشتريات 🛠️
              </button>
            </div>
          )}

          {/* 4. Un-posted Treasury Collections Alert */}
          {unpostedCollectionsCount > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-violet-800 font-bold text-xs mb-1">
                  <ShieldAlert className="w-4 h-4 text-violet-600" />
                  <span>معاملات غير مرحلة للخزينة</span>
                </div>
                <p className="text-[11px] text-violet-700 leading-relaxed mb-2">
                  يوجد {unpostedCollectionsCount} حركة مالية (سداد/شراء/دين) غير مرحلة وتؤثر على دقة الخزينة.
                </p>
                <div className="bg-white/80 border border-violet-100 px-2 py-2 rounded text-center text-[10px] font-bold text-violet-800 mb-2">
                  الرجاء مراجعة سجل المعاملات أو الأقسام المختلفة لاعتماد الترحيل.
                </div>
              </div>
              <button 
                onClick={() => onNavigateToSection('transaction_log')}
                className="w-full text-center bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-md transition-all"
              >
                مراجعة السجل الشامل 📝
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
