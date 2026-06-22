import React from 'react';
import { Landmark, ShieldAlert } from 'lucide-react';

export default function FinancialReportsModule() {
  return (
    <div className="flex items-center justify-center h-[70vh] bg-transparent animate-fadeIn" dir="rtl">
      <div className="max-w-xl w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-sm text-center flex flex-col items-center">
        <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-2xl mb-4 border border-slate-100 shadow-inner">
          <Landmark className="w-8 h-8 text-slate-400" />
        </div>
        
        <h2 className="text-xl font-black text-slate-800 mb-2">تم تصفير وإقفال مركز التقارير المالية</h2>
        <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
          بناءً على طلب الإدارة للنموذج المحاسبي الجديد، تم تصفير وإلغاء مركز التقارير. 
          لقد تم نقل كافة جداول الإجماليات والقيم ليتم عرضها فقط في 
          <strong className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mx-1">قسم الخزنة</strong>.
        </p>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 w-full text-right flex gap-3 text-emerald-800">
          <ShieldAlert className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-black mb-1">قواعد السيولة المُطبقة:</h4>
            <ul className="text-[11px] space-y-1 list-disc list-inside">
              <li>الخزنة صفرت من أي قيم سابقة.</li>
              <li>أي قسم به جدول إجمالي (فيه قيمة)، هذه القيمة هي التي تظل بالخزينة فقط.</li>
              <li>أي قسم ما فيه إجمالي، خلاص تمام.</li>
              <li>أي قسم يمتلك إجمالي قيمة نهائية، ينزل في الخزينة طول بشكل ديناميكي.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
