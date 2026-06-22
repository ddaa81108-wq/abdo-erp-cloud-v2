import React, { useState, useRef } from 'react';
import { Database, Download, Upload, RotateCcw, Save, Trash, ShieldAlert, Sparkles, CheckCircle } from 'lucide-react';
import { ERPState, BackupPoint } from '../types';

interface BackupCenterProps {
  state: ERPState;
  onRestoreState: (newState: ERPState) => void;
  onSaveBackupPoint: (name: string, description: string) => void;
  onDeleteBackupPoint: (id: string) => void;
}

export default function BackupCenter({
  state,
  onRestoreState,
  onSaveBackupPoint,
  onDeleteBackupPoint
}: BackupCenterProps) {
  const [pointName, setPointName] = useState('');
  const [pointDesc, setPointDesc] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmRestorePoint, setConfirmRestorePoint] = useState<BackupPoint | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // 1. Export state to JSON file
  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(state, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `ABDO_ERP_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      showStatus('success', 'تم تصدير نسخة احتياطية كاملة بصيغة JSON بنجاح! احتفظ بالملف بأمان.');
    } catch (e) {
      showStatus('error', 'حدث خطأ غير متوقع أثناء توليد ملف النسخة الاحتياطية.');
    }
  };

  // 2. Import state from JSON file
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = event.target.files;
    
    if (!files || files.length === 0) return;
    
    fileReader.onload = (e) => {
      try {
        const fileContent = e.target?.result as string;
        const parsedState = JSON.parse(fileContent);
        
        // Basic schema verification
        if (parsedState.customers && parsedState.cycles && parsedState.debtTransactions && parsedState.treasuryTransactions) {
          onRestoreState(parsedState);
          showStatus('success', 'تم استيراد قاعدة البيانات بنجاح واسترجاع كافة حركة الخزينة والديون والمشتريات القديمة!');
        } else {
          showStatus('error', 'صيغة ملف النسخ المفدمة غير متوافقة مع متطلبات نظام ABDO ERP V2.');
        }
      } catch (err) {
        showStatus('error', 'فشل في قراءة ملف الـ JSON. تأكد من سلامة الملف وخلوه من التلف.');
      }
    };
    
    fileReader.readAsText(files[0]);
  };

  // 3. Save internal restore checkpoint
  const handleAddNewPoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointName.trim()) {
      showStatus('error', 'يرجى كتابة اسم تعريفي لنقطة الاسترجاع الزمنية.');
      return;
    }
    
    onSaveBackupPoint(pointName, pointDesc);
    setPointName('');
    setPointDesc('');
    showStatus('success', `تم حفظ نقطة زمنية جديدة بنجاح في ذاكرة النظام المحلية.`);
  };

  return (
    <div className="bg-white border text-right border-slate-200 rounded-xl shadow-sm p-5 max-w-4xl mx-auto my-4" dir="rtl">
      <div className="flex items-center justify-between border-b pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-indigo-600 animate-pulse" />
          <h2 className="font-bold text-sm text-slate-900">📦 مركز النسخ الاحتياطي والاسترجاع الزمني</h2>
        </div>
        <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
          آمن وسرّي 100%
        </span>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-xs font-semibold mb-4 leading-relaxed flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200 border' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-4.5 h-4.5 text-emerald-600" /> : <ShieldAlert className="w-4.5 h-4.5 text-rose-600" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Primary Row: Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Export Box */}
        <div className="border border-indigo-100 bg-indigo-50/20 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-xs text-indigo-900 mb-1">📤 تصدير نسخة احتياطية محلية</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
              يقوم هذا الإجراء بحفظ كافة حسابات العملاء، الديون الحالية، سجلات المنشآت والمشتريات وتفاصيل حركة الخزينة في ملف واحد مشفر بصيغة JSON على جهازك للرجوع إليه وقتما تشاء.
            </p>
          </div>
          <button
            onClick={handleExportJSON}
            className="w-fit self-end bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-100"
          >
            <Download className="w-4 h-4" />
            <span>تصدير ملف النسخة الاحتياطية (.json)</span>
          </button>
        </div>

        {/* Import Box */}
        <div className="border border-slate-200 bg-slate-50/40 p-4 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-xs text-slate-800 mb-1">📥 استيراد نسخة احتياطية تامة</h3>
            <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
              تحذير: سيقوم استيراد ملف جديد باستبدال كامل قواعد البيانات الحالية واستعادة البيانات بالملف المختار بالكامل. يرجى التأكد من تصدير النسخة المفعلة الحالية لتجنب فقدان أي تعديلات.
            </p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportJSON}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-fit bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold py-2 px-4 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>استرداد من ملف (.json)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Point In Time Restore Settings */}
      <div className="border-t pt-5">
        <h3 className="font-bold text-xs text-slate-800 mb-3 flex items-center gap-1">
          <RotateCcw className="w-4.5 h-4.5 text-indigo-600" />
          <span>⏰ نقاط الاسترجاع الزمنية الفورية (حفظ اللقطات)</span>
        </h3>

        <form onSubmit={handleAddNewPoint} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 bg-slate-50 p-3.5 rounded-lg border">
          <div className="col-span-1">
            <label className="block text-[10px] text-slate-500 font-bold mb-1">اسم اللقطة الزمنية *</label>
            <input
              type="text"
              value={pointName}
              onChange={(e) => setPointName(e.target.value)}
              placeholder="مثال: لقطة ما قبل جرد أسبوعي"
              className="w-full text-right p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="col-span-1 sm:col-span-2 flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 font-bold mb-1">ملاحظات توضيحية إضافية</label>
              <input
                type="text"
                value={pointDesc}
                onChange={(e) => setPointDesc(e.target.value)}
                placeholder="تفاصيل التغيرات أو سبب النسخ الاحتياطي"
                className="w-full text-right p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center gap-1 h-[34px] transition-all"
            >
              <Save className="w-4 h-4" />
              <span>حفظ لقطة داتا</span>
            </button>
          </div>
        </form>

        {/* Existing Backup Points List */}
        <div className="space-y-2 max-h-[170px] overflow-y-auto pr-1">
          {state.backupPoints.length === 0 ? (
            <p className="text-center text-[11px] text-slate-400 py-4 italic">لا توجد أي لقطات استعادة زمنية مسبقة، قم بإنشاء أولى نقاطك الآن.</p>
          ) : (
            state.backupPoints.map((point) => (
              <div
                key={point.id}
                className="bg-white border hover:border-slate-300 rounded p-2.5 flex items-center justify-between text-[11px] transition-all font-mono"
              >
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="font-sans font-bold text-slate-800 text-xs">{point.name}</span>
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-mono">
                      {new Date(point.date).toLocaleString('ar-LY')}
                    </span>
                  </div>
                  {point.description && <p className="text-[10px] text-slate-500 font-sans mt-0.5">{point.description}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConfirmRestorePoint(point)}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold py-1 px-2.5 rounded flex items-center gap-0.5 transition-all"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>استرجاع الآن</span>
                  </button>
                  <button
                    onClick={() => onDeleteBackupPoint(point.id)}
                    className="text-rose-600 hover:text-white hover:bg-rose-500 p-1 rounded transition-all"
                    title="حذف اللقطة"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Custom Confirmation Modal for Backup Restore */}
      {confirmRestorePoint && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4 shadow-2xl" dir="rtl">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] p-5 text-right font-sans">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2.5 mb-3">
              <span className="text-amber-400 text-lg">⚠️</span>
              <h4 className="font-extrabold text-slate-200 text-xs">تأكيد استعادة النسخة الاحتياطية</h4>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
              هل أنت واثق من رغبتك في استعادة البيانات للنقطة الزمنية <strong className="text-amber-400 font-bold">"{confirmRestorePoint.name}"</strong>؟ <br />
              <span className="text-rose-400 font-semibold">تنبيه: سيتم استبدال وتجاوز كامل المعاملات والعمليات الحالية بالنظام فوراً!</span>
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(confirmRestorePoint.dataJson);
                    onRestoreState(parsed);
                    showStatus('success', `تمت تصفية واستعادة قاعدة البيانات لحالة: [${confirmRestorePoint.name}] بنجاح.`);
                  } catch (e) {
                    showStatus('error', 'فشلت عملية البناء والاسترداد نظراً لتنسيق تالف.');
                  }
                  setConfirmRestorePoint(null);
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 rounded-lg text-[10px] transition cursor-pointer"
              >
                تأكيد الاسترجاع والمسح
              </button>
              <button
                type="button"
                onClick={() => setConfirmRestorePoint(null)}
                className="flex-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold py-2 rounded-lg text-[10px] transition cursor-pointer"
              >
                إلغاء الأمر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
