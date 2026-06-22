import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, HelpCircle, ChevronRight, Play, RefreshCw, Layers } from 'lucide-react';
import { ERPState, Customer, CustomerCycle, DebtTransaction, Company, CompanyTransaction, Merchant, MerchantTransaction, TrustDeposit } from '../types';

interface ExcelImporterProps {
  state: ERPState;
  onImportComplete: (newState: ERPState) => void;
  onClose?: () => void;
}

export default function ExcelImporter({ state, onImportComplete, onClose }: ExcelImporterProps) {
  const [fileData, setFileData] = useState<any[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<{
    nameCol: string;
    debtCol: string;
    paidCol: string;
    currencyCol: string;
    dateCol: string;
    sectionCol: string;
  }>({
    nameCol: '',
    debtCol: '',
    paidCol: '',
    currencyCol: '',
    dateCol: '',
    sectionCol: '',
  });

  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [parsingErrors, setParsingErrors] = useState<string[]>([]);
  const [duplicateMode, setDuplicateMode] = useState<'merge' | 'skip'>('merge'); 
  const [report, setReport] = useState<{
    addedCount: number;
    mergedCount: number;
    errorCount: number;
    show: boolean;
  } | null>(null);

  const [targetModule, setTargetModule] = useState<'debts' | 'companies' | 'merchants' | 'deposits'>('debts');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Read file and parse headers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setReport(null);
    setParsingErrors([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Read sheet as raw row structures (array of arrays)
        const rawJson = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rawJson.length === 0) {
          setParsingErrors(['الملف المختار فارغ ولا يحتوي على صفوف بيانات.']);
          return;
        }

        // Extract first row as headers, rest as content rows
        const fileHeaders = (rawJson[0] as string[]).map(h => String(h || '').trim());
        const dataRows = rawJson.slice(1) as any[][];

        setHeaders(fileHeaders);
        setFileData(dataRows);

        // Try smart auto-mapping of Arabic headers
        const autoMappings = {
          nameCol: '',
          debtCol: '',
          paidCol: '',
          currencyCol: '',
          dateCol: '',
          sectionCol: '',
        };

        fileHeaders.forEach(header => {
          const text = header.toLowerCase();
          if (text.includes('الاسم') || text.includes('الزبون') || text.includes('name') || text.includes('عميل') || text.includes('شرك') || text.includes('تاجر') || text.includes('مورد') || text.includes('مودع')) {
            autoMappings.nameCol = header;
          } else if (text.includes('الدين') || text.includes('المطلوب') || text.includes('debt') || text.includes('سعر') || text.includes('قيمة') || text.includes('رصيد') || text.includes('مبلغ')) {
            autoMappings.debtCol = header;
          } else if (text.includes('المدفوع') || text.includes('سداد') || text.includes('paid') || text.includes('دفعة') || text.includes('واصل')) {
            autoMappings.paidCol = header;
          } else if (text.includes('عملة') || text.includes('currency')) {
            autoMappings.currencyCol = header;
          } else if (text.includes('تاريخ') || text.includes('date') || text.includes('وقت')) {
            autoMappings.dateCol = header;
          } else if (text.includes('قسم') || text.includes('section') || text.includes('نوع')) {
            autoMappings.sectionCol = header;
          }
        });

        setMappings(autoMappings);
        showPreview(dataRows, fileHeaders, autoMappings);

      } catch (err) {
        setParsingErrors(['حدث عطل أثناء فك تشفير مستحضر الإكسل المختار. تأكد من تمديد الملف الصحيح.']);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Convert raw row lists to dynamic mapped object list representation
  const showPreview = (
    rows: any[][], 
    hdrs: string[], 
    m: typeof mappings
  ) => {
    if (!rows || rows.length === 0) return;

    const mappedPreview = rows.slice(0, 10).map((row, idx) => {
      const obj: any = { _rowId: idx + 1 };
      hdrs.forEach((h, colIdx) => {
        obj[h] = row[colIdx];
      });
      return obj;
    });

    setPreviewRows(mappedPreview);
  };

  const handleMapChange = (key: keyof typeof mappings, val: string) => {
    const updated = { ...mappings, [key]: val };
    setMappings(updated);
    if (fileData) {
      showPreview(fileData, headers, updated);
    }
  };

  // 3. Process complete Import into Database!
  const executeImport = () => {
    if (!fileData) {
      setParsingErrors(['يرجى اختيار ملف الإكسل أولاً.']);
      alert('حدث خطأ: يرجى اختيار ملف الإكسل أولاً.');
      return;
    }
    if (!mappings.nameCol) {
      setParsingErrors(['يرجى تحديد "اسم العميل/الشركة/المودع" من القائمة المنسدلة لإتمام عملية الاستيراد بنجاح.']);
      alert('خطأ: يرجى تحديد العمود الخاص بالاسم من قائمة المطابقة أولاً.');
      return;
    }
    
    setParsingErrors([]); // clear previous errors

    // Check for duplicates in the Excel file itself
    const importedNames = new Set<string>();
    const duplicatesInFile: string[] = [];
    fileData.forEach((row) => {
      const record: any = {};
      headers.forEach((h, idx) => { record[h] = row[idx]; });
      const rawName = String(record[mappings.nameCol] || '').trim();
      if (rawName) {
        if (importedNames.has(rawName)) {
          duplicatesInFile.push(rawName);
        }
        importedNames.add(rawName);
      }
    });

    if (duplicatesInFile.length > 0) {
      const uniqueDups = Array.from(new Set(duplicatesInFile));
      alert(`تنبيه: تم العثور على أسماء مكررة داخل ملف الإكسل نفسه (${uniqueDups.length} إسم مكرر). يرجى توحيد المبالغ في صف واحد لكل عميل لمنع الازدواجية.\n\nأمثلة: ${uniqueDups.slice(0, 3).join(', ')}`);
      return; // Stop import
    }

    let addedCount = 0;
    let mergedCount = 0;
    let errorCount = 0;

    const newState: ERPState = JSON.parse(JSON.stringify(state));
    newState.customers = newState.customers || [];
    newState.cycles = newState.cycles || [];
    newState.debtTransactions = newState.debtTransactions || [];
    newState.companies = newState.companies || [];
    newState.companyTransactions = newState.companyTransactions || [];
    newState.merchants = newState.merchants || [];
    newState.merchantTransactions = newState.merchantTransactions || [];
    newState.trustDeposits = newState.trustDeposits || [];
    newState.purchases = newState.purchases || [];

    let lastRefNum = 450;

    fileData.forEach((row, rowIndex) => {
      const record: any = {};
      headers.forEach((h, idx) => {
        record[h] = row[idx];
      });

      const rawName = String(record[mappings.nameCol] || '').trim();
      if (!rawName) {
        errorCount++;
        return; // skip empty rows
      }

      const rawDebt = mappings.debtCol ? parseFloat(record[mappings.debtCol]) : 0;
      const rawPaid = mappings.paidCol ? parseFloat(record[mappings.paidCol]) : 0;
      const debtAmount = isNaN(rawDebt) ? 0 : rawDebt;
      const paidAmount = isNaN(rawPaid) ? 0 : rawPaid;
      const balanceAmount = debtAmount - paidAmount;

      const currency = mappings.currencyCol ? String(record[mappings.currencyCol] || 'د.ل').trim() : 'د.ل';
      const dateStr = mappings.dateCol ? String(record[mappings.dateCol] || '').trim() : new Date().toISOString();
      const section = mappings.sectionCol ? String(record[mappings.sectionCol] || '').trim() : '';
      
      const noteStr = section ? `استيراد إكسل ذكي - قسم (${section})` : `استيراد إكسل ذكي`;

      if (targetModule === 'debts') {
        const existingCust = newState.customers.find(
          c => c.name.trim().toLowerCase() === rawName.toLowerCase()
        );
        let targetCustId = '';
        
        if (existingCust) {
          if (duplicateMode === 'merge') {
            targetCustId = existingCust.id;
            mergedCount++;
          } else {
            // skip mode
            return;
          }
        } else {
          const newCustId = `cust_imp_${Date.now()}_${rowIndex}`;
          targetCustId = newCustId;
          addedCount++;
          newState.customers.push({
            id: newCustId,
            name: rawName,
            phone: '',
            createdAt: dateStr || new Date().toISOString()
          });
        }

        let activeCycle = newState.cycles.find(cy => cy.customerId === targetCustId && cy.status === 'active');
        if (!activeCycle) {
          const newCycleId = `cycle_${targetCustId}_imported_${Date.now()}_${rowIndex}`;
          activeCycle = {
            id: newCycleId,
            customerId: targetCustId,
            startDate: dateStr || new Date().toISOString(),
            status: 'active',
            initialBalance: 0,
            currentBalance: 0
          };
          newState.cycles.push(activeCycle);
        }

        if (debtAmount > 0) {
          lastRefNum++;
          newState.debtTransactions.push({
            id: `tx_imp_d_${Date.now()}_${rowIndex}_${lastRefNum}`,
            customerId: targetCustId,
            cycleId: activeCycle.id,
            type: 'debt',
            amount: debtAmount,
            currency: currency,
            conversionRate: 1.0,
            date: dateStr || new Date().toISOString(),
            referenceNo: `TX-2026-000${lastRefNum}`,
            note: `${noteStr} - دين سابق`,
            postedToTreasury: true,
            createdAt: new Date().toISOString()
          });
        }

        if (paidAmount > 0) {
          lastRefNum++;
          newState.debtTransactions.push({
            id: `tx_imp_p_${Date.now()}_${rowIndex}_${lastRefNum}`,
            customerId: targetCustId,
            cycleId: activeCycle.id,
            type: 'payment',
            amount: paidAmount,
            currency: currency,
            conversionRate: 1.0,
            date: dateStr || new Date().toISOString(),
            referenceNo: `TX-2026-000${lastRefNum}`,
            note: `${noteStr} - سداد دفعة`,
            postedToTreasury: true,
            createdAt: new Date().toISOString()
          });
        }
        
        const cyTxs = newState.debtTransactions.filter(t => t.cycleId === activeCycle!.id);
        const currentBal = cyTxs.reduce((sum, t) => t.type === 'debt' ? sum + t.amount : sum - t.amount, 0);
        activeCycle.currentBalance = currentBal;
        if (currentBal <= 0) {
          activeCycle.status = 'closed';
          activeCycle.endDate = dateStr || new Date().toISOString();
        }

      } else if (targetModule === 'companies') {
        const existingComp = newState.companies.find(
          c => c.name.trim().toLowerCase() === rawName.toLowerCase()
        );
        let targetCompId = '';
        
        if (existingComp) {
          if (duplicateMode === 'merge') {
            targetCompId = existingComp.id;
            mergedCount++;
            existingComp.balance += balanceAmount;
          } else {
            return;
          }
        } else {
          targetCompId = `comp_imp_${Date.now()}_${rowIndex}`;
          addedCount++;
          newState.companies.push({
            id: targetCompId,
            name: rawName,
            balance: balanceAmount,
            createdAt: dateStr || new Date().toISOString()
          });
        }

        if (debtAmount > 0) {
          lastRefNum++;
          newState.companyTransactions.push({
            id: `tx_comp_d_${Date.now()}_${rowIndex}_${lastRefNum}`,
            companyId: targetCompId,
            type: 'purchase_invoice',
            amount: debtAmount,
            currency: currency,
            date: dateStr || new Date().toISOString(),
            referenceNo: `TX-COMP-000${lastRefNum}`,
            note: noteStr,
            postedToTreasury: true,
            createdAt: new Date().toISOString()
          });
        }
        if (paidAmount > 0) {
          lastRefNum++;
          newState.companyTransactions.push({
            id: `tx_comp_p_${Date.now()}_${rowIndex}_${lastRefNum}`,
            companyId: targetCompId,
            type: 'payment',
            amount: paidAmount,
            currency: currency,
            date: dateStr || new Date().toISOString(),
            referenceNo: `TX-COMP-000${lastRefNum}`,
            note: noteStr,
            postedToTreasury: true,
            createdAt: new Date().toISOString()
          });
        }
      } else if (targetModule === 'merchants') {
        const existingMerch = newState.merchants.find(
          m => m.name.trim().toLowerCase() === rawName.toLowerCase()
        );
        let targetMerchId = '';
        
        if (existingMerch) {
          if (duplicateMode === 'merge') {
            targetMerchId = existingMerch.id;
            mergedCount++;
            existingMerch.balance += balanceAmount;
          } else {
            return;
          }
        } else {
          targetMerchId = `mer_imp_${Date.now()}_${rowIndex}`;
          addedCount++;
          newState.merchants.push({
            id: targetMerchId,
            name: rawName,
            balance: balanceAmount,
            previousBalance: debtAmount > 0 ? debtAmount : 0,
            newDebt: 0,
            paymentToday: 0,
            createdAt: dateStr || new Date().toISOString()
          });
        }

        if (debtAmount > 0) {
          lastRefNum++;
          newState.merchantTransactions.push({
            id: `tx_mer_d_${Date.now()}_${rowIndex}_${lastRefNum}`,
            merchantId: targetMerchId,
            type: 'debt',
            amount: debtAmount,
            currency: currency,
            date: dateStr || new Date().toISOString(),
            referenceNo: `TX-MER-000${lastRefNum}`,
            note: noteStr,
            postedToTreasury: true,
            createdAt: new Date().toISOString()
          });
        }
        if (paidAmount > 0) {
          lastRefNum++;
          newState.merchantTransactions.push({
            id: `tx_mer_p_${Date.now()}_${rowIndex}_${lastRefNum}`,
            merchantId: targetMerchId,
            type: 'payment',
            amount: paidAmount,
            currency: currency,
            date: dateStr || new Date().toISOString(),
            referenceNo: `TX-MER-000${lastRefNum}`,
            note: noteStr,
            postedToTreasury: true,
            createdAt: new Date().toISOString()
          });
        }
      } else if (targetModule === 'deposits') {
        const depositAmt = debtAmount > 0 ? debtAmount : (paidAmount > 0 ? paidAmount : balanceAmount);
        
        // Find existing ACTIVE deposit by the same name
        const existingDeposit = newState.trustDeposits.find(
          d => d.customerName.trim().toLowerCase() === rawName.toLowerCase() && d.status === 'held'
        );

        if (existingDeposit) {
          if (duplicateMode === 'merge') {
            mergedCount++;
            if (currency === 'ج.م') {
              existingDeposit.amountEgp = (existingDeposit.amountEgp || 0) + depositAmt;
            } else {
              existingDeposit.amountLyd = (existingDeposit.amountLyd || 0) + depositAmt;
              existingDeposit.amount = Math.max(existingDeposit.amount || 0, existingDeposit.amountLyd);
            }
          } else {
            return;
          }
        } else {
          addedCount++;
          newState.trustDeposits.push({
            id: `dep_imp_${Date.now()}_${rowIndex}`,
            customerName: rawName,
            amount: depositAmt,
            amountLyd: currency === 'د.ل' ? depositAmt : 0,
            amountEgp: currency === 'ج.م' ? depositAmt : 0,
            currency: currency,
            date: dateStr || new Date().toISOString(),
            referenceNo: `TX-DEP-000${lastRefNum++}`,
            status: 'held',
            note: noteStr,
            createdAt: dateStr || new Date().toISOString()
          });
        }
      }
    });

    onImportComplete(newState);

    setReport({
      addedCount,
      mergedCount,
      errorCount,
      show: true
    });

    // Alert the user upon success and auto-close modal 
    alert(`تم بنجاح استيراد ${addedCount + mergedCount} سجل. سيتم إغلاق النافذة تحديث البيانات...`);
    setTimeout(() => {
      if (document.getElementById('close-excel-modal')) {
        document.getElementById('close-excel-modal')?.click();
      } else if (onClose) {
        onClose();
      }
    }, 1500);
  };

  return (
    <div className="bg-white border text-right border-slate-200 rounded-xl shadow-sm p-4 max-w-4xl mx-auto my-4 transition-all" dir="rtl">
      {/* Title */}
      <div className="flex items-center justify-between border-b pb-3 mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-emerald-600 animate-pulse" />
          <h2 className="font-bold text-sm text-slate-900">📊 محرك استيراد ملفات الإكسل الذكي (Import Sheet)</h2>
        </div>
        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-bold font-mono">XLSX, XLS, CSV</span>
      </div>

      {parsingErrors.map((err, i) => (
        <div key={i} className="bg-rose-50 border border-rose-100 p-2.5 rounded text-rose-800 text-xs font-semibold mb-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{err}</span>
        </div>
      ))}

      {/* TARGET MODULE SELECTOR */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-right">
        <label className="block text-slate-800 font-black mb-3 text-sm bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-600" />
          <span>تسألني المنظومة: الاستيراد هذا لأي قسم في المنظومة؟</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'debts', label: 'قسم ديون العملاء', icon: '👥' },
            { id: 'merchants', label: 'قسم ديون التجار', icon: '💼' },
            { id: 'companies', label: 'قسم ديون الشركات', icon: '🏭' },
            { id: 'deposits', label: 'قسم الأمانات', icon: '🔒' }
          ].map(mod => (
            <label key={mod.id} className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition ${targetModule === mod.id ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-sm ring-1 ring-indigo-400' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <input 
                type="radio" 
                name="targetModule" 
                value={mod.id} 
                checked={targetModule === mod.id} 
                onChange={() => setTargetModule(mod.id as any)}
                className="hidden"
              />
              <span className="text-lg">{mod.icon}</span>
              <span className="font-extrabold text-xs">{mod.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* STEP 1: Upload input */}
      <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-lg p-5 bg-slate-50/50 hover:bg-slate-50 text-center transition-all">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx, .xls, .csv"
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center gap-2">
          <Upload className="w-8 h-8 text-slate-400" />
          <div className="text-xs">
            <span 
              onClick={() => fileInputRef.current?.click()}
              className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer underline"
            >
              انقر لرفع ملف الإكسل
            </span>
            <span className="text-slate-500"> أو قم بسحبه وإفلاته هنا</span>
          </div>
          <p className="text-[10px] text-slate-400">يدعم امتداد xlsx, xls, csv مع الاكتشاف التلقائي الذكي للأعمدة</p>
          {fileName && (
            <div className="mt-2 bg-emerald-50 text-emerald-800 border-emerald-100 border px-3 py-1 rounded-full text-xs font-bold leading-normal flex items-center gap-1.5 font-mono">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>الملف النشط: {fileName}</span>
            </div>
          )}
        </div>
      </div>

      {/* STEP 2: Smart Mapping & Options */}
      {fileData && (
        <div className="mt-4 border-t pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-lg border">
            {/* Columns Mapping Section */}
            <div>
              <h3 className="font-bold text-xs text-slate-800 mb-2.5 flex items-center gap-1">
                <Layers className="w-4.5 h-4.5 text-indigo-600" />
                <span>المطابقة الذكية لأعمدة الملف (Smart Mapping):</span>
              </h3>
              
              <div className="space-y-2 text-xs">
                {/* Name Mapping (Required) */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600 font-semibold">
                    {targetModule === 'companies' ? 'اسم الشركة / المورد (الاسم) *' : 
                     targetModule === 'merchants' ? 'اسم التاجر (الاسم) *' : 
                     targetModule === 'deposits' ? 'اسم المودع (الاسم) *' : 
                     'اسم العميل (الاسم) *'}
                  </span>
                  <select
                    value={mappings.nameCol}
                    onChange={(e) => handleMapChange('nameCol', e.target.value)}
                    className="p-1 text-xs border rounded bg-white w-48 focus:outline-none"
                  >
                    <option value="">-- اختر العمود --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Debt Mapping */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">
                    {targetModule === 'deposits' ? 'قيمة الوديعة / الأمانة' : 'قيمة الدين (شغل جديد / الفاتورة)'}
                  </span>
                  <select
                    value={mappings.debtCol}
                    onChange={(e) => handleMapChange('debtCol', e.target.value)}
                    className="p-1 text-xs border rounded bg-white w-48 focus:outline-none"
                  >
                    <option value="">-- غير مدرج --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Paid Mapping */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">المبلغ المدفوع (المسدد / الواصل)</span>
                  <select
                    value={mappings.paidCol}
                    onChange={(e) => handleMapChange('paidCol', e.target.value)}
                    className="p-1 text-xs border rounded bg-white w-48 focus:outline-none"
                  >
                    <option value="">-- غير مدرج --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Currency Mapping */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">رمز العملة (مثال: د.ل)</span>
                  <select
                    value={mappings.currencyCol}
                    onChange={(e) => handleMapChange('currencyCol', e.target.value)}
                    className="p-1 text-xs border rounded bg-white w-48 focus:outline-none"
                  >
                    <option value="">-- تفضيل افتراضي (د.ل) --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Date Mapping */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">تاريخ القيد</span>
                  <select
                    value={mappings.dateCol}
                    onChange={(e) => handleMapChange('dateCol', e.target.value)}
                    className="p-1 text-xs border rounded bg-white w-48 focus:outline-none"
                  >
                    <option value="">-- تاريخ اللحظة الحالية --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Strategic duplicate policy selection */}
            <div className="flex flex-col justify-between border-r pr-4">
              <div>
                <h3 className="font-bold text-xs text-slate-800 mb-2">🛡️ سياسة كشف الأسماء المكررة:</h3>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                  إذا اكتشف النظام اسماً مطابقاً لحساب مدرج مسبقاً، كيف تفضل جدولة الحركات المستوردة مع هذا الحساب؟
                </p>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="dupMode"
                      checked={duplicateMode === 'merge'}
                      onChange={() => setDuplicateMode('merge')}
                      className="text-indigo-600"
                    />
                    <div>
                      <span className="font-bold block">دمج مع العميل القديم (دمج ذكي)</span>
                      <span className="text-[9px] text-slate-500 block">يقوم بإلحاق دين/سداد جديد بنفس الحساب الحالي دون تفريغ التاريخ.</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="radio"
                      name="dupMode"
                      checked={duplicateMode === 'skip'}
                      onChange={() => setDuplicateMode('skip')}
                      className="text-indigo-600"
                    />
                    <div>
                      <span className="font-bold block">تخطي المكرر وتجاهله (للمحافظة على الأرصدة)</span>
                      <span className="text-[9px] text-slate-500 block">إذا وجد الاسم مسبقاً سيتجاهل الرصيد المرفق به في الملف ويمنع تكرار الاسم.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={executeImport}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>تثبيت استيراد الخلايا الآن</span>
                </button>
              </div>
            </div>
          </div>

          {/* Mapped file visualization (First 5 rows) */}
          <div>
            <span className="font-bold text-xs text-slate-700 block mb-1.5">👁️ معاينة فورية أولية للـ 5 أسطر الأولى بالملف:</span>
            <div className="overflow-x-auto border rounded-lg bg-white">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-100 text-slate-700 border-b">
                  <tr>
                    <th className="p-2 border font-mono"># رقعة</th>
                    <th className="p-2 border">الاسم (Mapped)</th>
                    <th className="p-2 border">شغل جديد (Mapped)</th>
                    <th className="p-2 border">المدفوع (Mapped)</th>
                    <th className="p-2 border font-mono">العملة (Mapped)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, 5).map((row) => (
                    <tr key={row._rowId} className="hover:bg-slate-50 border-b font-mono text-slate-600">
                      <td className="p-2 border">{row._rowId}</td>
                      <td className="p-2 border font-sans font-semibold text-slate-900">{mappings.nameCol ? row[mappings.nameCol] : '--'}</td>
                      <td className="p-2 border font-bold text-rose-600">{mappings.debtCol ? Number(row[mappings.debtCol] || 0).toLocaleString() : '0'}</td>
                      <td className="p-2 border font-bold text-emerald-700">{mappings.paidCol ? Number(row[mappings.paidCol] || 0).toLocaleString() : '0'}</td>
                      <td className="p-2 border text-center">{mappings.currencyCol ? row[mappings.currencyCol] : 'د.ل'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT STATUS */}
      {report && report.show && (
        <div className="mt-4 p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl">
          <h3 className="text-emerald-900 font-bold text-xs flex items-center gap-1.5 mb-2">
            <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
            <span>نجاح معالجة الملف واستخلاص الإحصائيات:</span>
          </h3>
          <p className="text-xs text-slate-600 leading-normal mb-3">
            تم بنجاح تحليل كافة الصفوف في ورقة الإكسل المصدقة؛ وتم دمج الأرصدة وإدراج العمليات تبعاً لضوابط ERP V2 الخاصة بالأرشيف والخزنية.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center" dir="rtl">
            <div className="bg-white border border-emerald-100 p-2.5 rounded-lg">
              <span className="block text-slate-500 text-[10px] mb-0.5">تمت إضافة حسابات جديدة</span>
              <span className="font-mono text-amber-700 font-bold text-lg">{report.addedCount}</span>
            </div>
            <div className="bg-white border border-emerald-100 p-2.5 rounded-lg">
              <span className="block text-slate-500 text-[10px] mb-0.5">تم تطابق لحسابات موجودة</span>
              <span className="font-mono text-emerald-700 font-bold text-lg">{report.mergedCount}</span>
            </div>
            <div className="bg-white border border-emerald-100 p-2.5 rounded-lg">
              <span className="block text-slate-500 text-[10px] mb-0.5">صفوف متجاهلة / فارغة</span>
              <span className="font-mono text-slate-500 font-bold text-lg">{report.errorCount}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setFileData(null);
                setFileName('');
                setReport(null);
                if (onClose) onClose();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-all"
            >
              تم وموافقة ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
