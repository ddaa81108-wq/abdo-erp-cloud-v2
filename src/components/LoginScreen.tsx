import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, UserPlus, Lock, Eye, EyeOff, ShieldCheck, User } from 'lucide-react';
import { User as UserType, ERPState } from '../types';

interface LoginScreenProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onLoginSuccess: (user: UserType) => void;
}

export default function LoginScreen({ state, onUpdateState, onLoginSuccess }: LoginScreenProps) {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Dynamic login execution
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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-right" dir="rtl">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-[#0f172a] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10"
      >
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 shadow-inner">
              <ShieldCheck className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          
          <h1 className="text-2xl font-black text-center text-white mb-2">النظام المحاسبي المتكامل</h1>
          <p className="text-center text-slate-400 text-sm mb-8">الرجاء تسجيل الدخول للمتابعة</p>

          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold text-center"
            >
              {errorMessage}
            </motion.div>
          )}

          <form
            onSubmit={handleLoginSubmit}
            className="space-y-5"
          >
                <div>
                  <label className="block text-slate-300 text-xs font-bold mb-2">اسم المستخدم</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 right-0 pr-4 flex items-center">
                      <User className="w-4 h-4 text-slate-500" />
                    </span>
                    <input
                      type="text"
                      required
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="أدخل اسم المستخدم"
                      className="w-full pr-11 pl-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/80 transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-xs font-bold mb-2">كلمة المرور</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <Lock className="w-4 h-4 text-slate-500" />
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="أدخل كلمة المرور"
                        className="w-full pr-11 pl-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-indigo-500/80 transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-indigo-500/30 font-mono text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition-colors flex items-center justify-center shrink-0"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <LogIn className="w-5 h-5" />
                    <span>تسجيل الدخول</span>
                  </button>
                </div>
              </form>
        </div>
      </motion.div>
    </div>
  );
}