import React, { useState } from 'react';
import { User as UserType, ERPState } from '../types';

interface LoginScreenProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onLoginSuccess: (user: UserType) => void;
}

export default function LoginScreen({ state, onUpdateState, onLoginSuccess }: LoginScreenProps) {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const targetUser = state.users.find(
      u => u.username.toLowerCase() === usernameInput.trim().toLowerCase()
    );

    if (!targetUser) {
      setErrorMessage('المستخدم غير موجود. الرجاء التحقق من البيانات.');
      return;
    }

    if (targetUser.password !== passwordInput.trim()) {
      setErrorMessage('كلمة المرور غير صحيحة.');
      return;
    }

    onLoginSuccess(targetUser);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
      <div className="flex w-full max-w-5xl bg-white shadow-2xl rounded-3xl overflow-hidden min-h-[600px] m-4">
        
        {/* الجانب الأيمن: نموذج الدخول */}
        <div className="w-full lg:w-1/2 p-12 sm:p-16 flex flex-col justify-center relative">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">المنظومة الملكية</h1>
            <p className="text-slate-500 font-medium">مرحباً بك مجدداً، يرجى تسجيل الدخول</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-4 bg-red-50 border-r-4 border-red-500 text-red-700 text-sm font-bold rounded-l">
                {errorMessage}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم</label>
              <input 
                type="text" 
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
                placeholder="أدخل اسم المستخدم"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
                placeholder="أدخل كلمة المرور"
              />
            </div>

            <button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all transform hover:-translate-y-0.5 active:translate-y-0 mt-4"
            >
              تسجيل الدخول
            </button>
          </form>
        </div>

        {/* الجانب الأيسر: الشكل الجمالي */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative p-12 items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 opacity-95 z-0"></div>
          
          {/* تأثيرات إضاءة هندسية (Abstract Geometric Glow) */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500 rounded-full blur-[100px] opacity-20 transform translate-x-1/4 -translate-y-1/4"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600 rounded-full blur-[120px] opacity-20 transform -translate-x-1/3 translate-y-1/3"></div>
          
          {/* محتوى الجانب الأيسر */}
          <div className="relative z-10 text-center text-white max-w-md">
            <div className="w-24 h-24 mx-auto bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 flex items-center justify-center mb-8 shadow-2xl">
              <svg className="w-12 h-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
            </div>
            <h2 className="text-4xl font-black mb-4 leading-snug">بوابة النظام والمحاسبة</h2>
            <p className="text-emerald-100/70 text-lg leading-relaxed font-medium">
              حماية تامة، تحكم متقدم، وتقارير فورية.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}