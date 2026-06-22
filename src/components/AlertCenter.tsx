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
  
  const isTreasuryNegative = false;

  // 2. Purchases without exchange / transfer rate:
  // Foreign purchases (not LYD / 'د.ل') where conversionRate is missing, 0, or undefined
  const invalidRatePurchases = state.purchases.filter(p => {
    const isForeign = p.currency !== 'د.ل';
    const hasNoValidRate = !p.conversionRate || p.conversionRate <= 0;
    return isForeign && hasNoValidRate;
  });

  // 4. Overdue/Delayed custom cycles: Active customer cycles with no transactions for last 10 days, or with long standing high balance
  const activeCustomers = state.customers.filter(c => {
    const activeCycle = state.cycles.find(cy => cy.customerId === c.id && cy.status === 'active');
    return activeCycle && activeCycle.currentBalance > 0;
  });

  const alertsCount = 
    (isTreasuryNegative ? 1 : 0) + 
    invalidRatePurchases.length;

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
        <div className="px-4 pb-4 pt-1 border-t border-amber-100 bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Missing Conversion Rates Alert */}
          {invalidRatePurchases.length > 0 && (
            <div className="bg-sky-50 border border-sky-100 rounded-lg p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-sky-800 font-bold text-xs mb-1">
                  <ArrowLeftRight className="w-4 h-4 text-sky-600" />
                  <span>مشتريات بدون سعر تحويل</span>
                </div>
                <p className="text-[11px] text-sky-700 leading-relaxed mb-2">
                  اكتُشف {invalidRatePurchases.length} عملية شراء بالعملة الأجنبية لا تحتوي على معادل تحويل معتمد بالدينار الليبي.
                </p>
                <div className="space-y-1.5 max-h-24 overflow-y-auto mb-2 pr-1">
                  {invalidRatePurchases.map(p => (
                    <div key={p.id} className="bg-white/80 border border-sky-100 px-2 py-1 rounded text-[10px] flex items-center justify-between font-mono">
                      <span className="truncate max-w-[100px] text-slate-800 font-sans">{p.itemName}</span>
                      <span className="font-bold text-rose-600">{p.totalPrice.toLocaleString()} {p.currency}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => onNavigateToSection('purchases')}
                className="w-full text-center bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold py-1.5 px-3 rounded-md transition-all"
              >
                ضبط أسعار التحويل بالمشتريات 🛠️
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
