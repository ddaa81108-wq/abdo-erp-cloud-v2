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
    <>
      <style>{`
        .royal-login-body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #0a0a0a; 
            background-image:
                radial-gradient(circle at 15% 50%, rgba(212, 175, 55, 0.05), transparent 30%),
                radial-gradient(circle at 85% 30%, rgba(212, 175, 55, 0.03), transparent 30%);
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            direction: rtl;
        }

        .royal-glass-card {
            width: 420px;
            padding: 50px 40px;
            background: rgba(255, 255, 255, 0.02);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 24px;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            overflow: hidden;
            width: 90%;
            max-width: 420px;
        }

        .royal-glass-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(212, 175, 55, 0.6), transparent);
        }

        .brand-title {
            color: #d4af37;
            fontSize: 34pt;
            font-weight: 900;
            margin: 0;
            letter-spacing: 1px;
            text-shadow: 0 5px 15px rgba(0,0,0,0.6);
            text-align: center;
            line-height: 1.2;
        }

        .version-badge {
            color: #666;
            font-size: 12pt;
            font-weight: bold;
            letter-spacing: 4px;
            margin-top: 5px;
            margin-bottom: 45px;
        }

        .input-group {
            width: 100%;
            margin-bottom: 25px;
        }

        .input-group input {
            width: 100%;
            padding: 18px 20px;
            font-size: 15pt;
            background: rgba(0, 0, 0, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            color: #fff;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            transition: all 0.3s ease;
        }

        .input-group input:focus {
            outline: none;
            border-color: #d4af37;
            background: rgba(0, 0, 0, 0.7);
            box-shadow: 0 0 15px rgba(212, 175, 55, 0.15);
        }

        .input-group input::placeholder {
            color: #444;
        }

        .login-btn {
            width: 100%;
            padding: 18px;
            font-size: 18pt;
            font-weight: bold;
            color: #0a0a0a;
            background: linear-gradient(135deg, #fceabb 0%, #d4af37 100%);
            border: none;
            border-radius: 12px;
            cursor: pointer;
            margin-top: 15px;
            box-shadow: 0 10px 20px rgba(212, 175, 55, 0.2);
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            transition: all 0.2s ease;
        }

        .login-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 25px rgba(212, 175, 55, 0.35);
        }
        
        .login-btn:active {
            transform: translateY(2px);
        }
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
              type="text" 
              placeholder="اسم المستخدم" 
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <input 
              type="password" 
              placeholder="كلمة المرور" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-btn">دخول المنظومة</button>
        </form>
      </div>
    </>
  );
}
