import React, { useState, useEffect } from 'react';
import { Search, UserCheck, Inbox, Landmark, ShoppingBag, FolderArchive, ArrowUpRight, History, Store } from 'lucide-react';
import { ERPState } from '../types';

interface GlobalSearchProps {
  state: ERPState;
  searchQuery: string;
  onNavigateToItem: (section: string, filterText: string) => void;
  onClose?: () => void;
}

export default function GlobalSearch({ state, searchQuery, onNavigateToItem, onClose }: GlobalSearchProps) {
  const [results, setResults] = useState<{
    customers: any[];
    companies: any[];
    merchants: any[];
    trusts: any[];
    archive: any[];
    treasury: any[];
    purchases: any[];
  }>({
    customers: [],
    companies: [],
    merchants: [],
    trusts: [],
    archive: [],
    treasury: [],
    purchases: [],
  });

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults({ customers: [], companies: [], merchants: [], trusts: [], archive: [], treasury: [], purchases: [] });
      return;
    }

    const q = searchQuery.toLowerCase();

    // 1. Search Active Customers
    const activeCusts = state.customers.filter(c => {
      // Find active cycle for customer
      const hasActiveCycle = state.cycles.some(cy => cy.customerId === c.id && cy.status === 'active');
      return hasActiveCycle && c.name.toLowerCase().includes(q);
    }).map(c => {
      const activeCycle = state.cycles.find(cy => cy.customerId === c.id && cy.status === 'active');
      return { ...c, activeBalance: activeCycle?.currentBalance || 0 };
    });

    // 2. Search Companies / Suppliers
    const foundCompanies = state.companies.filter(c => 
      c.name.toLowerCase().includes(q) || (c.contact && c.contact.includes(q))
    );

    // 2b. Search Merchants
    const foundMerchants = (state.merchants || []).filter(m => 
      m.name.toLowerCase().includes(q) || (m.contact && m.contact.includes(q))
    );

    // 2c. Search Trusts / Deposits
    const foundTrusts = (state.trustDeposits || []).filter(t => 
      t.status === 'held' && (t.customerName.toLowerCase().includes(q) || t.referenceNo.toLowerCase().includes(q))
    );

    // 3. Search Archive / Closed accounts or old fully resolved cycles
    // Ahmad's closed cycles or any customer cycle that is 'closed' where the query matches customer name
    const foundArchives = state.cycles.filter(cy => cy.status === 'closed').map(cy => {
      const parentCustomer = state.customers.find(c => c.id === cy.customerId);
      return { ...cy, customerName: parentCustomer?.name || 'عميل مجهول' };
    }).filter(cy => cy.customerName.toLowerCase().includes(q));

    // 4. Removed logic

    // 5. Search Purchases ledger
    const foundPurchases = state.purchases.filter(p => 
      p.itemName.toLowerCase().includes(q) || p.referenceNo.toLowerCase().includes(q)
    );

    setResults({
      customers: activeCusts,
      companies: foundCompanies,
      merchants: foundMerchants,
      trusts: foundTrusts,
      archive: foundArchives,
      treasury: [],
      purchases: foundPurchases
    });
  }, [searchQuery, state]);

  const totalResults = 
    results.customers.length + 
    results.companies.length + 
    results.merchants.length + 
    results.trusts.length + 
    results.archive.length + 
    results.purchases.length;

  return (
    <div className="bg-white border text-right border-slate-200 shadow-2xl rounded-xl overflow-hidden p-4 w-full transition-all">
      {searchQuery.trim() === '' ? (
        <div className="text-center py-8 text-slate-400">
          <p className="text-xs mb-1">اكتب أي اسم (مثلاً: أحمد، محول، السلام) للبدء في تصفية الفهرس العام للبيانات</p>
          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded">رمز حماية وسرية البيانات مفعل ✓</span>
        </div>
      ) : (
        <div className="space-y-4 max-h-[380px] overflow-y-auto" dir="rtl">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs font-semibold text-slate-800">نتائج البحث الإجمالية: {totalResults} عنصر</span>
            {onClose && (
              <button onClick={onClose} className="text-[10px] text-rose-500 hover:text-rose-700 bg-rose-50 px-2 py-0.5 rounded">إغلاق وتصفير ✕</button>
            )}
          </div>

          {totalResults === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              لا توجد أي سجلات مطابقة للمصطلح &quot;{searchQuery}&quot; في قواعد البيانات النشطة أو المؤرشفة.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Customers Row */}
              {results.customers.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <h4 className="flex items-center gap-1.5 text-amber-800 font-bold text-xs mb-2">
                    <UserCheck className="w-4 h-4 text-amber-600" />
                    <span>ديون العملاء (نشطين الحساب)</span>
                  </h4>
                  <div className="space-y-1">
                    {results.customers.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => onNavigateToItem('debts', c.name)}
                        className="flex items-center justify-between text-[11px] bg-white hover:bg-amber-50 border p-1.5 rounded cursor-pointer transition-all"
                      >
                        <span className="font-semibold text-slate-900">{c.name}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-rose-600 font-bold">{Math.round(c.activeBalance || 0).toLocaleString("en-US")} د.ل</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Companies Row */}
              {results.companies.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <h4 className="flex items-center gap-1.5 text-indigo-800 font-bold text-xs mb-2">
                    <Inbox className="w-4 h-4 text-indigo-600" />
                    <span>الشركات والموردين</span>
                  </h4>
                  <div className="space-y-1">
                    {results.companies.map(c => (
                      <div 
                        key={c.id}
                        onClick={() => onNavigateToItem('companies', c.name)}
                        className="flex items-center justify-between text-[11px] bg-white hover:bg-indigo-50 border p-1.5 rounded cursor-pointer transition-all"
                      >
                        <span className="font-semibold text-slate-900">{c.name}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-amber-700 font-bold">{Math.round(c.balance || 0).toLocaleString("en-US")} د.ل</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Merchants Row */}
              {results.merchants && results.merchants.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <h4 className="flex items-center gap-1.5 text-purple-800 font-bold text-xs mb-2">
                    <Store className="w-4 h-4 text-purple-600" />
                    <span>التجار والموردين الفرعيين</span>
                  </h4>
                  <div className="space-y-1">
                    {results.merchants.slice(0, 4).map(m => (
                      <div 
                        key={m.id}
                        onClick={() => onNavigateToItem('merchants', m.name)}
                        className="flex items-center justify-between text-[11px] bg-white hover:bg-purple-50 border p-1.5 rounded cursor-pointer transition-all"
                      >
                        <span className="font-semibold text-slate-900">{m.name}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-purple-700 font-bold">{Math.round(m.balance || 0).toLocaleString('en-US')} د.ل</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trusts Row */}
              {results.trusts && results.trusts.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <h4 className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs mb-2">
                    <Landmark className="w-4 h-4 text-emerald-600" />
                    <span>الأمانات والودائع الجارية</span>
                  </h4>
                  <div className="space-y-1">
                    {results.trusts.slice(0, 4).map(t => {
                       const lyd = Math.round(t.amountLyd !== undefined ? t.amountLyd : t.amount);
                       const egp = Math.round(t.amountEgp !== undefined ? t.amountEgp : 0);
                       return (
                      <div 
                        key={t.id}
                        onClick={() => onNavigateToItem('deposits', t.customerName)}
                        className="flex flex-col text-[11px] bg-white hover:bg-emerald-50 border p-1.5 rounded cursor-pointer transition-all font-mono"
                      >
                        <span className="font-semibold text-slate-900 mb-1">{t.customerName}</span>
                        <div className="flex items-center justify-between">
                          {lyd !== 0 && <span className="text-emerald-700 font-bold">{lyd.toLocaleString('en-US')} د.ل</span>}
                          {egp !== 0 && <span className="text-blue-600 font-bold">{egp.toLocaleString('en-US')} ج.م</span>}
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              )}

              {/* Closed Archive Row */}
              {results.archive.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg col-span-1 md:col-span-2">
                  <h4 className="flex items-center gap-1.5 text-zinc-700 font-bold text-xs mb-2">
                    <FolderArchive className="w-4 h-4 text-zinc-500" />
                    <span>الأرشيف والمستندات المغلقة (دورة تصفير)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {results.archive.map(cy => (
                      <div 
                        key={cy.id}
                        onClick={() => onNavigateToItem('archive', cy.customerName)}
                        className="flex items-center justify-between text-[11px] bg-white hover:bg-zinc-100 border p-2 rounded cursor-pointer transition-all font-mono"
                      >
                        <div className="flex flex-col text-right">
                          <span className="font-sans font-semibold text-slate-900">{cy.customerName}</span>
                          <span className="text-[9px] text-zinc-400">تاريخ الإغلاق: {new Date(cy.endDate || '').toLocaleDateString('en-US')}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">مغلق ومسدد</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Purchases Row */}
              {results.purchases.length > 0 && (
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                  <h4 className="flex items-center gap-1.5 text-blue-800 font-bold text-xs mb-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600" />
                    <span>كشوفات المشتريات اليومية</span>
                  </h4>
                  <div className="space-y-1">
                    {results.purchases.slice(0, 4).map(p => (
                      <div 
                        key={p.id}
                        onClick={() => onNavigateToItem('purchases', p.itemName)}
                        className="text-[11px] bg-white hover:bg-blue-50 border p-1.5 rounded cursor-pointer transition-all text-right font-mono"
                      >
                        <div className="flex justify-between font-sans">
                          <span className="font-semibold text-slate-800 truncate max-w-[150px]">{p.itemName}</span>
                          <span className="text-blue-700 font-bold">
                            {Math.round(p.totalPrice).toLocaleString('en-US')} {p.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                          <span>الكمية: {p.quantity} × {p.unitPrice}</span>
                          <span>{p.referenceNo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
