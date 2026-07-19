import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserType, ERPState } from '../types';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Crown, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';

interface LoginScreenProps {
  state: ERPState;
  onUpdateState: (newState: ERPState) => void;
  onLoginSuccess: (user: UserType) => void;
}

export default function LoginScreen({ state, onUpdateState, onLoginSuccess }: LoginScreenProps) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoggingIn(true);

    try {
      if (!auth) {
        setErrorMessage('خطأ في تهيئة المصادقة. الرجاء تحديث الصفحة.');
        setIsLoggingIn(false);
        return;
      }

      const email = emailInput.trim().toLowerCase();
      const password = passwordInput.trim();

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const targetUser = state.users.find(
        u => u.email?.toLowerCase() === firebaseUser.email?.toLowerCase()
      );

      if (targetUser) {
        onLoginSuccess(targetUser);
        return;
      }

      // Bootstrap: المالك يقدر يدخل حتى لو الإيميل مش مضاف في النظام
      const OWNER_EMAIL = 'ddaa81108@gmail.com';
      if (firebaseUser.email?.toLowerCase() === OWNER_EMAIL) {
        const updatedUsers = state.users.map(u => {
          if (u.id === 'u_1' && !u.email) {
            return { ...u, email: firebaseUser.email! };
          }
          return u;
        });
        const updatedState = { ...state, users: updatedUsers };
        onUpdateState(updatedState);
        const adminUser = updatedUsers.find(u => u.email?.toLowerCase() === OWNER_EMAIL);
        if (adminUser) {
          onLoginSuccess(adminUser);
          return;
        }
      }

      setErrorMessage('الحساب ده مش مسجل في المنظومة. تواصل مع المدير علشان يضيفك للنظام.');
    } catch (error: any) {
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        setErrorMessage('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('صيغة البريد الإلكتروني غير صحيحة.');
      } else if (error.code === 'auth/too-many-requests') {
        setErrorMessage('محاولات كثيرة جداً. الرجاء الانتظار ثم المحاولة مرة أخرى.');
      } else {
        setErrorMessage('حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى.');
      }
    } finally {
      setIsLoggingIn(false);
    }
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
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="p-4 bg-red-50 border-r-4 border-red-500 text-red-700 text-sm font-bold rounded-l"
                >
                  {errorMessage}
                </motion.div>
              )}
            </AnimatePresence>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">البريد الإلكتروني</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-5 py-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
                  placeholder="أدخل البريد الإلكتروني"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                  <Mail size={20} />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required
                  dir="ltr"
                  className="w-full px-5 py-4 pl-12 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-slate-800"
                  placeholder="أدخل كلمة المرور"
                  style={{ letterSpacing: showPassword ? '0' : '3px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-emerald-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all transform hover:-translate-y-0.5 active:translate-y-0 mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
            >
              {isLoggingIn && <Sparkles size={20} className="animate-spin" />}
              {isLoggingIn ? 'جاري الدخول...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>

        {/* الجانب الأيسر: الشكل الجمالي */}
        <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative p-12 items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 opacity-95 z-0"></div>
          
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500 rounded-full blur-[100px] opacity-20 transform translate-x-1/4 -translate-y-1/4"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600 rounded-full blur-[120px] opacity-20 transform -translate-x-1/3 translate-y-1/3"></div>
          
          <div className="relative z-10 text-center text-white max-w-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-24 h-24 mx-auto bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 flex items-center justify-center mb-8 shadow-2xl"
            >
              <Crown className="w-12 h-12 text-emerald-400" />
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-black mb-4 leading-snug"
            >
              بوابة النظام والمحاسبة
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-emerald-100/70 text-lg leading-relaxed font-medium"
            >
              حماية تامة، تحكم متقدم، وتقارير فورية.
            </motion.p>
          </div>
        </div>

      </div>
    </div>
  );
}
