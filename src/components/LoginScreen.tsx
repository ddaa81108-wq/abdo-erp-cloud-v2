import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserType, ERPState } from '../types';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Crown, Mail, Lock, ArrowLeft, Eye, EyeOff, Sparkles } from 'lucide-react';

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
        backgroundColor: '#050508',
        backgroundImage: `
          radial-gradient(ellipse at 20% 50%, rgba(212, 175, 55, 0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 20%, rgba(212, 175, 55, 0.03) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(212, 175, 55, 0.02) 0%, transparent 50%)
        `,
        fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
        direction: 'rtl',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Animated background elements */}
      <div style={{
        position: 'absolute', top: '10%', left: '5%',
        width: '300px', height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)',
        animation: 'float 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', bottom: '15%', right: '8%',
        width: '250px', height: '250px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%)',
        animation: 'float 10s ease-in-out infinite reverse',
      }} />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          width: '90%',
          maxWidth: '440px',
          padding: '48px 36px',
          background: 'rgba(15, 15, 20, 0.7)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(212, 175, 55, 0.15)',
          borderRadius: '28px',
          boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 0 80px rgba(212,175,55,0.05), inset 0 1px 0 rgba(255,255,255,0.03)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative' as const,
          overflow: 'hidden',
        }}
      >
        {/* Top golden line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5), rgba(212,175,55,0.8), rgba(212,175,55,0.5), transparent)',
        }} />

        {/* Corner diamonds */}
        <div style={{ position: 'absolute', top: '12px', right: '12px', width: '8px', height: '8px', border: '1px solid rgba(212,175,55,0.3)', transform: 'rotate(45deg)' }} />
        <div style={{ position: 'absolute', top: '12px', left: '12px', width: '8px', height: '8px', border: '1px solid rgba(212,175,55,0.3)', transform: 'rotate(45deg)' }} />

        {/* Islamic greeting */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #d4af37 0%, #f0d060 30%, #d4af37 50%, #f0d060 70%, #d4af37 100%)',
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontSize: '18px',
            fontWeight: 900,
            textAlign: 'center',
            letterSpacing: '1px',
            animation: 'shimmer 3s linear infinite',
          }}
        >
          لا إله إلا الله محمد رسول الله
        </motion.div>

        {/* Crown */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4, type: 'spring' }}
          style={{
            width: '56px', height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.05))',
            border: '1px solid rgba(212,175,55,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '18px',
            boxShadow: '0 8px 30px rgba(212,175,55,0.1)',
          }}
        >
          <Crown style={{ width: '28px', height: '28px', color: '#d4af37', filter: 'drop-shadow(0 2px 6px rgba(212,175,55,0.4))' }} />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          style={{
            color: '#d4af37',
            fontSize: '30px',
            fontWeight: 900,
            margin: '0 0 2px',
            textShadow: '0 4px 15px rgba(0,0,0,0.6), 0 0 40px rgba(212,175,55,0.15)',
            textAlign: 'center',
            letterSpacing: '1px',
          }}
        >
          المنظومة الملكية
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          style={{
            color: '#555',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '5px',
            marginBottom: '35px',
            textTransform: 'uppercase' as const,
          }}
        >
          ERP ROYAL SYSTEM
        </motion.p>

        {/* Error message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                borderRadius: '12px',
                marginBottom: '20px',
                color: '#fca5a5',
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              ⚠️ {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Email field */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.0 }}
          style={{ width: '100%', marginBottom: '18px', position: 'relative' as const }}
        >
          <div style={{
            position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
            color: '#555', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const,
            zIndex: 1,
          }}>
            <Mail style={{ width: '18px', height: '18px' }} />
          </div>
          <input
            type="text"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="البريد الإلكتروني"
            required
            dir="ltr"
            style={{
              width: '100%',
              padding: '17px 48px',
              fontSize: '15px',
              fontWeight: 600,
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px',
              color: '#e5e5e5',
              outline: 'none',
              boxSizing: 'border-box' as const,
              fontFamily: 'inherit',
              transition: 'all 0.3s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(212,175,55,0.5)';
              e.target.style.boxShadow = '0 0 20px rgba(212,175,55,0.08)';
              e.target.style.background = 'rgba(0,0,0,0.6)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255,255,255,0.06)';
              e.target.style.boxShadow = 'none';
              e.target.style.background = 'rgba(0,0,0,0.45)';
            }}
          />
        </motion.div>

        {/* Password field */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.15 }}
          style={{ width: '100%', marginBottom: '8px', position: 'relative' as const }}
        >
          <div style={{
            position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
            color: '#555', display: 'flex', alignItems: 'center', pointerEvents: 'none' as const,
            zIndex: 1,
          }}>
            <Lock style={{ width: '18px', height: '18px' }} />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="كلمة المرور"
            required
            dir="ltr"
            style={{
              width: '100%',
              padding: '17px 48px',
              fontSize: '15px',
              fontWeight: 600,
              background: 'rgba(0,0,0,0.45)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '14px',
              color: '#e5e5e5',
              outline: 'none',
              boxSizing: 'border-box' as const,
              fontFamily: 'inherit',
              transition: 'all 0.3s',
              letterSpacing: showPassword ? '0' : '3px',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(212,175,55,0.5)';
              e.target.style.boxShadow = '0 0 20px rgba(212,175,55,0.08)';
              e.target.style.background = 'rgba(0,0,0,0.6)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255,255,255,0.06)';
              e.target.style.boxShadow = 'none';
              e.target.style.background = 'rgba(0,0,0,0.45)';
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px',
              color: '#555', display: 'flex', alignItems: 'center',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#d4af37')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}
          >
            {showPassword ? <EyeOff style={{ width: '18px', height: '18px' }} /> : <Eye style={{ width: '18px', height: '18px' }} />}
          </button>
        </motion.div>

        {/* Login button */}
        <motion.button
          type="submit"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          disabled={isLoggingIn}
          onClick={handleLoginSubmit}
          style={{
            width: '100%',
            padding: '18px',
            fontSize: '17px',
            fontWeight: 900,
            color: '#0a0a0a',
            background: 'linear-gradient(135deg, #f0d060, #d4af37, #b8960f)',
            border: 'none',
            borderRadius: '14px',
            cursor: isLoggingIn ? 'wait' : 'pointer',
            marginTop: '22px',
            boxShadow: '0 12px 30px rgba(212,175,55,0.2), 0 0 30px rgba(212,175,55,0.05)',
            fontFamily: 'inherit',
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
              e.currentTarget.style.boxShadow = '0 18px 40px rgba(212,175,55,0.35), 0 0 50px rgba(212,175,55,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(212,175,55,0.2), 0 0 30px rgba(212,175,55,0.05)';
          }}
        >
          {/* Shine effect */}
          <div style={{
            position: 'absolute', top: 0, left: '-100%', width: '100%', height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            animation: isLoggingIn ? 'none' : 'shimmer 2s infinite',
          }} />
          <Sparkles style={{ width: '18px', height: '18px', animation: isLoggingIn ? 'spin 1s linear infinite' : 'none' }} />
          <span>{isLoggingIn ? 'جاري الدخول...' : 'دخول'}</span>
        </motion.button>

        {/* Bottom decorations */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          marginTop: '28px', opacity: 0.4,
        }}>
          <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, transparent, #d4af37)' }} />
          <div style={{ width: '4px', height: '4px', background: '#d4af37', borderRadius: '50%' }} />
          <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, #d4af37, transparent)' }} />
        </div>
      </motion.div>
    </div>
  );
}
