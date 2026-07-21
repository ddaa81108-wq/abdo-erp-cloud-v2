import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User as UserType } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (user: UserType) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    console.log('🔐 Starting login process...');

    try {
      // 1. Firebase Authentication
      console.log(' Attempting auth with:', emailInput);
      const userCredential = await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
      const fbUser = userCredential.user;
      console.log('✅ Auth successful! UID:', fbUser.uid);

      // 2. Check Firestore
      console.log('🔍 Checking Firestore for user document...');
      const userDocRef = doc(db, "users", fbUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        console.log('✅ User document found!');
        const customUser = userDocSnap.data() as UserType;
        onLoginSuccess(customUser);
      } else {
        console.log('⚠️ User document NOT found. Creating new document...');
        
        // 3. Create user document
        const newUser: UserType = {
          id: fbUser.uid,
          username: fbUser.email || emailInput,
          email: fbUser.email || emailInput,
          role: "admin",
          createdAt: new Date().toISOString(),
        };
        
        console.log('💾 Writing to Firestore:', newUser);
        await setDoc(userDocRef, newUser);
        console.log('✅ User document created successfully!');
        
        onLoginSuccess(newUser);
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      let msg = 'حدث خطأ أثناء تسجيل الدخول.';
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (error.code === 'permission-denied') {
        msg = 'خطأ في الصلاحيات. تأكد من قواعد الأمان في Firebase.';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'خطأ في الاتصال بالإنترنت.';
      }
      
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .royal-login-body { margin: 0; padding: 0; min-height: 100vh; display: flex; justify-content: center; align-items: center; background-color: #0a0a0a; background-image: radial-gradient(circle at 15% 50%, rgba(212, 175, 55, 0.05), transparent 30%), radial-gradient(circle at 85% 30%, rgba(212, 175, 55, 0.03), transparent 30%); font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: rtl; }
        .royal-glass-card { width: 420px; padding: 50px 40px; background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8); display: flex; flex-direction: column; align-items: center; position: relative; overflow: hidden; width: 90%; max-width: 420px; }
        .royal-glass-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.6), transparent); }
        .brand-title { color: #d4af37; font-size: 34pt; font-weight: 900; margin: 0; letter-spacing: 1px; text-shadow: 0 5px 15px rgba(0,0,0,0.6); text-align: center; line-height: 1.2; }
        .version-badge { color: #666; font-size: 12pt; font-weight: bold; letter-spacing: 4px; margin-top: 5px; margin-bottom: 45px; }
        .input-group { width: 100%; margin-bottom: 25px; }
        .input-group input { width: 100%; padding: 18px 20px; font-size: 15pt; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.03); border-radius: 12px; color: #fff; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; transition: all 0.3s ease; }
        .input-group input:focus { outline: none; border-color: #d4af37; background: rgba(0, 0, 0, 0.7); box-shadow: 0 0 15px rgba(212, 175, 55, 0.15); }
        .input-group input::placeholder { color: #444; }
        .login-btn { width: 100%; padding: 18px; font-size: 18pt; font-weight: bold; color: #0a0a0a; background: linear-gradient(135deg, #fceabb 0%, #d4af37 100%); border: none; border-radius: 12px; cursor: pointer; margin-top: 15px; box-shadow: 0 10px 20px rgba(212, 175, 55, 0.2); font-family: 'Segoe UI', Tahoma, Arial, sans-serif; transition: all 0.2s ease; }
        .login-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 15px 25px rgba(212, 175, 55, 0.35); }
        .login-btn:active:not(:disabled) { transform: translateY(2px); }
        .login-btn:disabled { opacity: 0.7; cursor: not-allowed; }
      `}</style>
      <div className="royal-login-body">
        <form onSubmit={handleLoginSubmit} className="royal-glass-card">
          <h1 className="brand-title">المنظومة الملكية</h1>
          <div className="version-badge">SECURE V23</div>

          {errorMessage && (
            <div style={{ color: '#ff6b6b', marginBottom: '20px', fontSize: '12pt', textAlign: 'center', background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,0,0,0.2)', width: '100%' }}>
              {errorMessage}
            </div>
          )}

          <div className="input-group">
            <input 
              type="email" 
              placeholder="البريد الإلكتروني" 
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="input-group">
            <input 
              type="password" 
              placeholder="كلمة المرور" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'جاري التحقق...' : 'دخول المنظومة'}
          </button>
        </form>
      </div>
    </>
  );
}
