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

      const authUser: UserType = {
        id: firebaseUser.uid,
        username: firebaseUser.email || '',
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || firebaseUser.email || '',
        role: 'admin',
        password: '',
        permissions: {
          canViewDebts: true,
          canViewCompanies: true,
          canViewTreasury: true,
          canViewPurchases: true,
          canViewDeposits: true,
          canViewArchive: true,
          canViewBackup: true,
          canViewAdvances: true,
        },
        createdAt: new Date().toISOString(),
      };

      onLoginSuccess(authUser);
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
    <div
      style={{
        margin: 0,
        padding: 0,
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#060609',
        fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
        direction: 'rtl',
        overflow: 'hidden',
        position: 'relative' as const,
      }}
    >
      {/* Import Cairo font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
        
        @keyframes subtleFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .login-input::placeholder {
          color: #3a3a3a;
          font-weight: 600;
        }
        .login-input:focus::placeholder {
          color: #4a4a4a;
        }
      `}</style>

      {/* Subtle ambient background glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: '900px', height: '900px',
        background: 'radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 50%)',
        pointerEvents: 'none',
      }} />

      {/* Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{
          width: '90%',
          maxWidth: '440px',
          position: 'relative' as const,
        }}
      >
        {/* Card */}
        <div style={{
          background: '#0d0d14',
          borderRadius: '24px',
          padding: '52px 42px 44px',
          border: '1px solid rgba(212,175,55,0.18)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.9), 0 0 100px rgba(212,175,55,0.03)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}>
          {/* Top accent line */}
          <div style={{
            position: 'absolute', top: 0, left: '40px', right: '40px', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), transparent)',
          }} />

          {/* Islamic Greeting */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            style={{
              fontSize: '22px',
              fontWeight: 900,
              color: '#d4af37',
              textAlign: 'center',
              marginBottom: '28px',
              fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
              textShadow: '0 2px 8px rgba(0,0,0,0.6), 0 0 30px rgba(212,175,55,0.12)',
              lineHeight: 1.8,
            }}
          >
            لا إله إلا الله<br />محمد رسول الله
          </motion.div>

          {/* Crown */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.4, type: 'spring', stiffness: 140 }}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #1a1a22, #0d0d14)',
              border: '1.5px solid rgba(212,175,55,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
            }}
          >
            <Crown style={{ width: '28px', height: '28px', color: '#d4af37' }} />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{
              color: '#d4af37',
              fontSize: '32px',
              fontWeight: 900,
              margin: '0 0 0',
              fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            المنظومة الملكية
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            style={{
              color: '#4a4a4a',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '5px',
              margin: '6px 0 36px 0',
              textTransform: 'uppercase' as const,
              fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
            }}
          >
            ROYAL ERP SYSTEM
          </motion.p>

          {/* Error */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                style={{
                  width: '100%',
                  padding: '11px 16px',
                  background: 'rgba(180, 30, 30, 0.12)',
                  border: '1px solid rgba(220, 38, 38, 0.25)',
                  borderRadius: '10px',
                  marginBottom: '20px',
                  color: '#fca5a5',
                  fontSize: '13px',
                  fontWeight: 600,
                  textAlign: 'center',
                  fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                }}
              >
                {errorMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            style={{ width: '100%', marginBottom: '14px', position: 'relative' as const }}
          >
            <div style={{
              position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)',
              color: '#4a4a4a', pointerEvents: 'none' as const, zIndex: 1,
              display: 'flex',
            }}>
              <Mail size={18} />
            </div>
            <input
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="البريد الإلكتروني"
              required
              dir="ltr"
              className="login-input"
              style={{
                width: '100%',
                padding: '16px 48px',
                fontSize: '15px',
                fontWeight: 600,
                background: '#08080f',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                color: '#e8e8e8',
                outline: 'none',
                boxSizing: 'border-box' as const,
                fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                transition: 'all 0.25s',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(212,175,55,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(212,175,55,0.06)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.06)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </motion.div>

          {/* Password */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
            style={{ width: '100%', marginBottom: '8px', position: 'relative' as const }}
          >
            <div style={{
              position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)',
              color: '#4a4a4a', pointerEvents: 'none' as const, zIndex: 1,
              display: 'flex',
            }}>
              <Lock size={18} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="كلمة المرور"
              required
              dir="ltr"
              className="login-input"
              style={{
                width: '100%',
                padding: '16px 48px',
                fontSize: '15px',
                fontWeight: 600,
                background: '#08080f',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                color: '#e8e8e8',
                outline: 'none',
                boxSizing: 'border-box' as const,
                fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                transition: 'all 0.25s',
                letterSpacing: showPassword ? '0' : '3px',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(212,175,55,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(212,175,55,0.06)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.06)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px',
                color: '#4a4a4a', display: 'flex', alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#d4af37')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#4a4a4a')}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </motion.div>

          {/* Login Button */}
          <motion.button
            type="submit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            disabled={isLoggingIn}
            onClick={handleLoginSubmit}
            style={{
              width: '100%',
              padding: '17px',
              fontSize: '17px',
              fontWeight: 900,
              color: '#08080f',
              background: 'linear-gradient(135deg, #e8c547, #d4af37, #b8960f)',
              border: 'none',
              borderRadius: '12px',
              cursor: isLoggingIn ? 'wait' : 'pointer',
              marginTop: '20px',
              boxShadow: '0 8px 30px rgba(212,175,55,0.25)',
              fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.25s',
              position: 'relative' as const,
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              if (!isLoggingIn) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 14px 40px rgba(212,175,55,0.35)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(212,175,55,0.25)';
            }}
          >
            <Sparkles size={18} style={{ animation: isLoggingIn ? 'spin 1s linear infinite' : 'none' }} />
            {isLoggingIn ? 'جاري الدخول...' : 'دخــــول'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
