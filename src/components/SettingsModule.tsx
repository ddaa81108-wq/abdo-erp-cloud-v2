import React, { useState } from 'react';
import { Shield, Lock, Save, Users, Check, AlertCircle, RefreshCw, Key, Eye, EyeOff, UserPlus, Trash2, X } from 'lucide-react';
import { User, ERPState, UserPermissions } from '../types';

interface SettingsModuleProps {
  state: ERPState;
  currentUser: User | null;
  onUpdateState: (newState: ERPState) => void;
  onUpdateCurrentSession: (user: User) => void;
}

export default function SettingsModule({ state, currentUser, onUpdateState, onUpdateCurrentSession }: SettingsModuleProps) {
  const isAdmin = currentUser?.role === 'admin';
  
  // Single selected user concept (kept for delegating or detail focus if needed, but table handles all)
  const [selectedUserId, setSelectedUserId] = useState<string>(state.users[0]?.id || '');
  
  // Local password inputs per user
  const [passwordsState, setPasswordsState] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    state.users.forEach(u => {
      map[u.id] = u.password;
    });
    return map;
  });

  // Password visibility states per user
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Form states for creating a new user
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'admin' | 'accountant' | 'cashier' | 'warehouse' | 'assistant'>('accountant');
  const [isRegPasswordShown, setIsRegPasswordShown] = useState(false);

  // Custom modal states to avoid synchronous iframe blocks
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [delegateToDelete, setDelegateToDelete] = useState<string | null>(null);
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState('');

  const delegatesList = state.delegates || [];
  const [newDelegateInput, setNewDelegateInput] = useState('');

  // Helper to trigger custom toast
  const triggerToast = (msg: string) => {
    setShowSuccessToast(msg);
    setTimeout(() => setShowSuccessToast(''), 3500);
  };

  const handleAddDelegate = () => {
    const trimmed = newDelegateInput.trim();
    if (!trimmed) {
      triggerToast('⚠️ الرجاء إدخال اسم المندوب أولاً!');
      return;
    }
    if (delegatesList.includes(trimmed)) {
      triggerToast('⚠️ هذا الاسم مسجل بالفعل كاسم مندوب!');
      return;
    }
    onUpdateState({
      ...state,
      delegates: [...delegatesList, trimmed]
    });
    setNewDelegateInput('');
    triggerToast(`💼 تم إضافة المندوب "${trimmed}" بنجاح.`);
  };

  const executeDeleteDelegate = (name: string) => {
    onUpdateState({
      ...state,
      delegates: delegatesList.filter(d => d !== name)
    });
    setDelegateToDelete(null);
    triggerToast(`🗑️ تم إزالة المندوب "${name}" من النظام.`);
  };

  // Toggle specific permission for a user
  const handleTogglePermission = (userId: string, key: keyof UserPermissions) => {
    if (!isAdmin) {
      triggerToast('⚠️ عذراً! تعديل الصلاحيات مقتصر على مدير النظام فقط.');
      return;
    }

    const updatedUsers = state.users.map(u => {
      if (u.id === userId) {
        // Prevention: cannot disable canViewBackup or others for main admin
        if (u.role === 'admin') {
          return u; 
        }

        const newPerms = {
          ...u.permissions,
          [key]: !u.permissions[key]
        };
        const updated = { ...u, permissions: newPerms };
        
        if (currentUser && u.id === currentUser.id) {
          onUpdateCurrentSession(updated);
        }
        return updated;
      }
      return u;
    });

    onUpdateState({
      ...state,
      users: updatedUsers
    });
    triggerToast('⚙️ تم تحديث مستويات الوصول للموظف بنجاح.');
  };

  // Change user password
  const handleSavePassword = (userId: string) => {
    const rawPass = passwordsState[userId];
    if (!rawPass || !rawPass.trim()) {
      triggerToast('⚠️ كلمة المرور لا يمكن أن تكون فارغة!');
      return;
    }

    const updatedUsers = state.users.map(u => {
      if (u.id === userId) {
        const updated = { ...u, password: rawPass.trim() };
        if (currentUser && u.id === currentUser.id) {
          onUpdateCurrentSession(updated);
        }
        return updated;
      }
      return u;
    });

    onUpdateState({
      ...state,
      users: updatedUsers
    });

    triggerToast('🔒 تم تعيين كلمة المرور الجديدة وتحديث حساب الأمان بنجاح.');
  };

  // Reset users to defaults
  const executeResetUsers = () => {
    const defaultUsersList: User[] = [
      {
        id: 'u_1',
        username: 'abdo',
        name: 'المدير عبدو (المالك)',
        role: 'admin',
        password: 'abdo',
        permissions: {
          canViewDebts: true,
          canViewCompanies: true,
          canViewTreasury: true,
          canViewPurchases: true,
          canViewDeposits: true,
          canViewArchive: true,
          canViewBackup: true,
          canViewAdvances: true
        },
        createdAt: '2026-06-15T00:00:00'
      },
      {
        id: 'u_2',
        username: 'tareq',
        name: 'المحاسب طارق (المالية)',
        role: 'accountant',
        password: '1111',
        permissions: {
          canViewDebts: true,
          canViewCompanies: true,
          canViewTreasury: true,
          canViewPurchases: true,
          canViewDeposits: true,
          canViewArchive: true,
          canViewBackup: false,
          canViewAdvances: true
        },
        createdAt: '2026-06-15T00:00:00'
      },
      {
        id: 'u_3',
        username: 'mohamed',
        name: 'الكاشير محمد (المبيعات)',
        role: 'cashier',
        password: '2222',
        permissions: {
          canViewDebts: true,
          canViewCompanies: false,
          canViewTreasury: true,
          canViewPurchases: false,
          canViewDeposits: true,
          canViewArchive: false,
          canViewBackup: false,
          canViewAdvances: false
        },
        createdAt: '2026-06-15T00:00:00'
      },
      {
        id: 'u_4',
        username: 'ali',
        name: 'أمين المخزن علي (التجهيز)',
        role: 'warehouse',
        password: '3333',
        permissions: {
          canViewDebts: false,
          canViewCompanies: false,
          canViewTreasury: false,
          canViewPurchases: true,
          canViewDeposits: false,
          canViewArchive: true,
          canViewBackup: false,
          canViewAdvances: false
        },
        createdAt: '2026-06-15T00:00:00'
      },
      {
        id: 'u_5',
        username: 'salem',
        name: 'المساعد سالم (المتابعة)',
        role: 'assistant',
        password: '4444',
        permissions: {
          canViewDebts: true,
          canViewCompanies: false,
          canViewTreasury: false,
          canViewPurchases: false,
          canViewDeposits: false,
          canViewArchive: true,
          canViewBackup: false,
          canViewAdvances: false
        },
        createdAt: '2026-06-15T00:00:00'
      }
    ];

    onUpdateState({
      ...state,
      users: defaultUsersList
    });

    // Reset password temp state
    const map: Record<string, string> = {};
    defaultUsersList.forEach(u => {
      map[u.id] = u.password;
    });
    setPasswordsState(map);

    const matchingActive = defaultUsersList.find(u => u.username === currentUser?.username);
    if (matchingActive) {
      onUpdateCurrentSession(matchingActive);
    }

    setShowResetConfirm(false);
    triggerToast('🔄 تم إعادة تهيئة الصلاحيات والحسابات الافتراضية للنسخة الأصلية.');
  };

  // Add / Create Employee Account on Settings UI
  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim() || !regUsername.trim() || !regPassword.trim()) {
      triggerToast('⚠️ يرجى ملء كافة البيانات لإنشاء حساب الموظف الجديد.');
      return;
    }

    const isConflict = state.users.some(
      u => u.username.toLowerCase() === regUsername.trim().toLowerCase()
    );

    if (isConflict) {
      triggerToast('⚠️ اسم المستخدم المحاسبي مسجل سابقاً بالنظام، اختر اسماً آخر.');
      return;
    }

    const presetPermissions = {
      admin: {
        canViewDebts: true,
        canViewCompanies: true,
        canViewTreasury: true,
        canViewPurchases: true,
        canViewDeposits: true,
        canViewArchive: true,
        canViewBackup: true
      },
      accountant: {
        canViewDebts: true,
        canViewCompanies: true,
        canViewTreasury: true,
        canViewPurchases: true,
        canViewDeposits: true,
        canViewArchive: true,
        canViewBackup: false
      },
      cashier: {
        canViewDebts: true,
        canViewCompanies: false,
        canViewTreasury: true,
        canViewPurchases: false,
        canViewDeposits: true,
        canViewArchive: false,
        canViewBackup: false
      },
      warehouse: {
        canViewDebts: false,
        canViewCompanies: false,
        canViewTreasury: false,
        canViewPurchases: true,
        canViewDeposits: false,
        canViewArchive: true,
        canViewBackup: false
      },
      assistant: {
        canViewDebts: true,
        canViewCompanies: false,
        canViewTreasury: false,
        canViewPurchases: false,
        canViewDeposits: false,
        canViewArchive: true,
        canViewBackup: false
      }
    };

    const newUser: User = {
      id: `u_${Date.now()}`,
      username: regUsername.trim().toLowerCase(),
      name: regFullName.trim(),
      role: regRole,
      password: regPassword.trim(),
      permissions: presetPermissions[regRole],
      createdAt: new Date().toISOString()
    };

    const updatedUsers = [...state.users, newUser];

    onUpdateState({
      ...state,
      users: updatedUsers
    });

    // Sync input password state
    setPasswordsState(prev => ({
      ...prev,
      [newUser.id]: newUser.password
    }));

    // Reset fields
    setRegFullName('');
    setRegUsername('');
    setRegPassword('');
    setIsRegPasswordShown(false);

    triggerToast(`👤 تم تسجيل حساب الموظف الجديد "${newUser.name}" بنظام الصلاحيات.`);
  };

  const executeDeleteUser = (id: string) => {
    const usr = state.users.find(u => u.id === id);
    if (!usr) return;

    if (usr.id === currentUser?.id) {
      triggerToast('🚨 خطأ: لا يمكنك حذف الحساب النشط الذي تسجل به دخولك حالياً!');
      setUserToDeleteId(null);
      return;
    }

    if (usr.role === 'admin') {
      triggerToast('🚨 خطأ: لا يمكنك حذف الحساب الإداري الرئيسي لدفتر المالك!');
      setUserToDeleteId(null);
      return;
    }

    const updatedUsers = state.users.filter(u => u.id !== id);
    onUpdateState({
      ...state,
      users: updatedUsers
    });

    setUserToDeleteId(null);
    triggerToast(`🗑️ تم إيقاف وحذف معرّف الموظف (${usr.name}) نهائياً من كشف الصلاحيات.`);
  };

  const permColumns = [
    { key: 'canViewDebts' as const, label: 'ديون' },
    { key: 'canViewCompanies' as const, label: 'شركات' },
    { key: 'canViewTreasury' as const, label: 'خزينة' },
    { key: 'canViewPurchases' as const, label: 'مشتريات' },
    { key: 'canViewDeposits' as const, label: 'ودائع' },
    { key: 'canViewArchive' as const, label: 'أرشيف' },
    { key: 'canViewBackup' as const, label: 'احتياطي' }
  ];

  return (
    <div className="bg-[#e0dfe3] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] p-4 text-right select-none font-sans" dir="rtl">
      
      {/* 2001 Windows-Style Simulated System Bar */}
      <div className="bg-gradient-to-r from-[#0a246a] to-[#a6caf0] text-white px-3 py-1.5 flex items-center justify-between mb-4 shadow-[inset_1px_1px_0px_rgba(255,255,255,0.3)]">
        <h2 className="font-extrabold text-[12.5px] flex items-center gap-2 font-sans">
          <Shield className="w-4 h-4 text-amber-300 shrink-0" />
          <span>منظومة إدارة صلاحيات الموظفين المدمجة - إصدار عام 2001 المعتمد</span>
        </h2>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="bg-[#e0dfe3] hover:bg-[#d0cfe3] text-slate-800 border border-t-white border-l-white border-r-[#808080] border-b-[#808080] text-[10px] font-bold px-2 py-0.5 active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white"
              title="إعادة تعيين الحسابات الافتراضية الخمسة وتصفير التخصيص"
            >
              إعادة تهيئة داتا الأمان
            </button>
          )}
        </div>
      </div>

      {/* Info Warning Bar */}
      {!isAdmin && (
        <div className="bg-[#ffffcc] border border-[#808080] text-amber-900 text-xs p-3 mb-4 leading-relaxed flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold mb-0.5">⚠️ وضع المعاينة المحدودة للموظف: {currentUser?.name}</strong>
            لا تمتلك امتيازات إدارية لتغيير تصاريح زملائك أو تعديل بياناتهم. يعرض لك هذا الجدول نظرة عامة دقيقة عن مستوى وصولك الشخصي الحركي في المنظومة.
          </div>
        </div>
      )}

      {/* SECTION 1: THE UNIFIED INTEGRATED SECURITY TABLE (CLASSIC 2001 DESIGN) */}
      <div className="bg-[#f0f0f0] border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white p-3 mb-6">
        <div className="bg-[#3a6ea5] text-white px-3 py-1 text-xs font-bold mb-2 flex items-center justify-between">
          <span>جدول التحكم المتكامل للشبكة: الحسابات، كلمات المرور، والصلاحيات</span>
          <span className="font-mono text-[10px]">TOTAL SCHEDULERS: {state.users.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[#808080] text-xs text-right bg-white font-sans">
            <thead>
              <tr className="bg-[#e0dfe3] text-slate-800 font-bold border-b border-[#808080]">
                <th className="border border-[#808080] p-1.5 text-center w-8">م</th>
                <th className="border border-[#808080] p-1.5">الاسم والوظيفة ميكانيكياً</th>
                <th className="border border-[#808080] p-1.5 text-center">المعرّف</th>
                <th className="border border-[#808080] p-1.5 w-[205px]">تغيير كلمة المرور المؤمّنة (Password)</th>
                {permColumns.map((col) => (
                  <th key={col.key} className="border border-[#808080] p-1.5 text-center whitespace-nowrap bg-[#d4d0c8]/60 w-[64px]" title={col.label}>
                    {col.label}
                  </th>
                ))}
                <th className="border border-[#808080] p-1.5 text-center w-16">إرسال</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((u, idx) => {
                const isSelected = u.id === selectedUserId;
                const isMe = u.id === currentUser?.id;
                const isUserAdmin = u.role === 'admin';
                const isTargetPassShown = !!visiblePasswords[u.id];
                
                // Allow admin or self to adjust password input
                const canModifyPassword = isAdmin || isMe;
                const showPasswordMask = canModifyPassword;

                return (
                  <tr 
                    key={u.id} 
                    className={`hover:bg-[#f6f6f6] transition-colors ${isMe ? 'bg-indigo-50/40' : ''}`}
                    onClick={() => setSelectedUserId(u.id)}
                  >
                    {/* Index */}
                    <td className="border border-[#808080] p-1 text-center font-mono text-slate-500 font-bold bg-[#e0dfe3]/50">
                      {idx + 1}
                    </td>

                    {/* Employee Name & role info */}
                    <td className="border border-[#808080] p-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <strong className="block text-slate-900">{u.name}</strong>
                          <span className="text-[10px] text-slate-500">{u.role === 'admin' ? '👑 مدير عام' : `🔑 موظف ${u.role}`}</span>
                        </div>
                        {isMe && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.5 border border-indigo-200 font-bold ml-1">
                            أنت
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Username always visible */}
                    <td className="border border-[#808080] p-1.5 text-center font-mono font-bold text-slate-700 bg-slate-50">
                      {u.username}
                    </td>

                    {/* Password change control with eye visibility */}
                    <td className="border border-[#808080] p-1 w-[205px]">
                      {showPasswordMask ? (
                        <div className="flex items-center gap-1">
                          <input
                            type={isTargetPassShown ? 'text' : 'password'}
                            dir="ltr"
                            value={passwordsState[u.id] ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPasswordsState(prev => ({
                                ...prev,
                                [u.id]: val
                              }));
                            }}
                            className="w-full px-1.5 py-0.5 bg-white border border-t-[#808080] border-l-[#808080] border-r-white border-b-white font-mono text-xs font-bold text-slate-800 text-center"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVisiblePasswords(prev => ({
                                ...prev,
                                [u.id]: !prev[u.id]
                              }));
                            }}
                            className="bg-[#e0dfe3] border border-t-white border-l-white border-r-[#808080] border-b-[#808080] p-1 hover:bg-[#d0cfe3] shrink-0"
                            title={isTargetPassShown ? 'تشفير وحجب' : 'إظهار كلمة المرور'}
                          >
                            {isTargetPassShown ? <EyeOff className="w-3 h-3 text-slate-650" /> : <Eye className="w-3 h-3 text-slate-650" />}
                          </button>
                          
                          {/* Save Inline */}
                          {passwordsState[u.id] !== u.password && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSavePassword(u.id);
                              }}
                              className="bg-emerald-600 font-extrabold text-[10px] text-white px-1.5 py-1 border border-t-emerald-400 border-l-emerald-400 border-r-emerald-850 border-b-emerald-850 shadow-sm shrink-0 flex items-center justify-center"
                              title="حفظ الكلمة الجديدة"
                            >
                              <Save className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-slate-400 text-[10.5px] select-none py-1 bg-slate-150/40">
                          🔒 محجوب بالكامل للأمان
                        </div>
                      )}
                    </td>

                    {/* Interactive Checkboxes Grid for permissions */}
                    {permColumns.map((col) => {
                      const hasPerm = u.permissions[col.key];
                      const disabled = !isAdmin || isUserAdmin; // Can't toggle if not admin or if user is main system admin
                      return (
                        <td key={col.key} className="border border-[#808080] p-1.5 text-center bg-[#fdfdfd]">
                          <input
                            type="checkbox"
                            checked={hasPerm}
                            disabled={disabled}
                            onChange={() => handleTogglePermission(u.id, col.key)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 cursor-pointer accent-indigo-600 align-middle disabled:opacity-65"
                          />
                        </td>
                      );
                    })}

                    {/* Actions column */}
                    <td className="border border-[#808080] p-1 text-center bg-[#e0dfe3]/30">
                      {isUserAdmin ? (
                        <span className="text-[10px] text-slate-500 font-bold block">رئيسي</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserToDeleteId(u.id);
                          }}
                          className="bg-[#e0dfe3] border border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-rose-50 text-rose-700 px-1.5 py-0.5 text-[10.5px] rounded-xs disabled:opacity-40"
                          title="إزالة هذا المستخدم كلياً"
                        >
                          حذف
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* NEW USER ACCOUNT ENTRY GATEWAY (2001 FORM WINDOW CONFLICT-FREE) - 5 Cols */}
        <div className="col-span-1 lg:col-span-5 bg-[#f0f0f0] border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white p-3">
          <div className="bg-[#0a246a] text-white px-3 py-1 text-xs font-bold mb-3 flex items-center justify-between">
            <span>➕ إنشاء حساب مستخدم للشبكة المحاسبية</span>
            <span>ADD_USER.EXE</span>
          </div>

          <form onSubmit={handleCreateNewUser} className="space-y-3.5">
            <div>
              <label className="block text-slate-800 text-xs font-bold mb-1">الاسم الكامل للموظف (ثنائي أو ثلاثي) *</label>
              <input
                type="text"
                required
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="مثال: منذر الفيتوري"
                className="w-full px-2.5 py-1.5 bg-white border border-t-[#808080] border-l-[#808080] border-r-white border-b-white text-slate-800 text-xs font-bold focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-800 text-xs font-bold mb-1">اسم الدخول (اسم المستخدم) *</label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="مثال: monther"
                  className="w-full px-2.5 py-1.5 bg-white border border-t-[#808080] border-l-[#808080] border-r-white border-b-white text-slate-800 font-mono text-xs font-bold text-center focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-800 text-xs font-bold mb-1">رمز الدور الافتراضي *</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as any)}
                  className="w-full px-2 py-1 bg-white border border-t-[#808080] border-l-[#808080] border-r-white border-b-white text-slate-800 text-xs font-bold focus:outline-none"
                >
                  <option value="accountant">محاسب</option>
                  <option value="cashier">كاشير</option>
                  <option value="warehouse">أمين مخزن</option>
                  <option value="assistant">مساعد عام</option>
                  <option value="admin">مسؤول رئيسي</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-800 text-xs font-bold mb-1">كلمة مرور الحساب المؤمنة *</label>
              <div className="flex gap-1">
                <input
                  type={isRegPasswordShown ? 'text' : 'password'}
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="أدخل الرمز"
                  className="flex-1 px-2.5 py-1.5 bg-white border border-t-[#808080] border-l-[#808080] border-r-white border-b-white text-slate-800 font-mono text-xs text-center font-bold focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsRegPasswordShown(!isRegPasswordShown)}
                  className="bg-[#e0dfe3] border border-t-white border-l-white border-r-[#808080] border-b-[#808080] px-2 py-1.5 hover:bg-[#d0cfe3] shrink-0"
                  title="عرض/حجب كلمة المرور"
                >
                  {isRegPasswordShown ? <EyeOff className="w-4 h-4 text-slate-700" /> : <Eye className="w-4 h-4 text-slate-700" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 mt-1 block">
                تنبيه: يتم تعيين حزم الصلاحيات تلقائياً، وبعد الإنشاء يمكنك تغييرها لكل تطبيق بالجدول العلوي.
              </span>
            </div>

            <button
              type="submit"
              disabled={!isAdmin}
              className="w-full bg-[#e0dfe3] hover:bg-[#d4d0c8] text-slate-900 border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] font-extrabold py-2 active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white text-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-45"
            >
              <UserPlus className="w-4 h-4" />
              <span>تسجيل وإقحام الموظف بالجدول ✓</span>
            </button>
          </form>
        </div>

        {/* FIELD DELEGATES SECTOR - 7 Cols */}
        <div className="col-span-1 lg:col-span-7 bg-[#f0f0f0] border-2 border-t-[#808080] border-l-[#808080] border-r-white border-b-white p-3">
          <div className="bg-[#0a246a] text-white px-3 py-1 text-xs font-bold mb-3 flex items-center justify-between">
            <span>💼 قائمة مناديب ومحملي الديون الميدانيين</span>
            <span>DELEGATES_MANAGER.EXE</span>
          </div>

          <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
            المناديب والمحصلين هم الأشخاص المسؤولون عن سحب مستحقات الديون بالخارج. يتم استيراد القائمة أدناه تلقائياً لتقارير تصفية وتخفيض ديون الزبائن.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start">
            {/* Input delegate */}
            <div className="sm:col-span-5 space-y-2">
              <label className="block text-xs font-bold text-slate-800">اسم المندوب المطلوب مخصّص:</label>
              <input
                type="text"
                value={newDelegateInput}
                onChange={(e) => setNewDelegateInput(e.target.value)}
                placeholder="مثال: منذر الفيتوري"
                className="w-full px-2.5 py-1.5 bg-white border border-t-[#808080] border-l-[#808080] border-r-white border-b-white text-slate-800 text-xs font-black text-center focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDelegate();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddDelegate}
                className="w-full bg-[#e0dfe3] text-slate-900 border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] font-extrabold py-1 px-2 rounded-xs active:border-t-[#808080] active:border-l-[#808080] active:border-r-white active:border-b-white text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                <span>إضافة لدفتر المندوبية (+)</span>
              </button>
            </div>

            {/* List */}
            <div className="sm:col-span-7 bg-white border border-t-[#808080] border-l-[#808080] border-r-white border-b-white p-2.5 min-h-[125px]">
              <label className="block text-xs font-bold text-slate-700 mb-2 border-b pb-1">المناديب النشطين للتحصيل:</label>
              {delegatesList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto">
                  {delegatesList.map((delegate, index) => (
                    <div
                      key={index}
                      className="bg-slate-50 border border-slate-300 px-2 py-1 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-800 font-sans">{delegate}</span>
                      <button
                        onClick={() => setDelegateToDelete(delegate)}
                        className="text-slate-400 hover:text-rose-700 font-bold p-0.5 font-sans"
                        title="مسح من النظام"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-amber-800 text-[10.5px] font-bold bg-[#fffff2] border border-[#d4d0c8]">
                  ⚠️ دفتر المناديب فارغ، المرجو تسجيل الأسماء.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ⚠️ DIALOGS SECTION DECLARED WITH CUSTOM MODALS INSTEAD OF BLOCKED BROWSER DIALOGS */}

      {/* Confirm RESET Users Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-[#e0dfe3] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] p-4 max-w-sm w-full shadow-2xl relative text-right">
            <div className="bg-gradient-to-r from-[#0a246a] to-[#a6caf0] text-white px-2 py-1 text-xs font-bold mb-3 flex items-center gap-1">
              <span>تأكيد تهيئة الداتا الإفتراضية</span>
            </div>
            <p className="text-xs text-slate-800 mb-4 leading-relaxed font-bold">
              هل أنت واثق من رغبتك في إعادة ضبط مستخدمي النظام وصلاحياتهم الفردية إلى وضع المصنع الأصلي والافتراضي؟ <br />
              <strong className="text-rose-700">(سيؤدي ذلك لتصفير أي تخصيص وحذف أي حساب موظف تم إضافته مؤخراً!)</strong>
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={executeResetUsers}
                className="bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold px-3 py-1.5 border border-t-rose-500 border-l-rose-500 border-r-rose-900 border-b-rose-900"
              >
                تحديث واستعادة الافتراضي ✓
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="bg-[#e0dfe3] border border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#d0cfe3] text-xs font-bold px-3 py-1.5"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Delegate Modal */}
      {delegateToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-[#e0dfe3] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] p-4 max-w-sm w-full shadow-2xl relative text-right">
            <div className="bg-gradient-to-r from-[#0a246a] to-[#a6caf0] text-white px-2 py-1 text-xs font-bold mb-3 flex items-center gap-1">
              <span>تأكيد حذف المندوب</span>
            </div>
            <p className="text-xs text-slate-800 mb-4 leading-relaxed">
              هل أنت متأكد من مسح المندوب الميداني <strong className="text-slate-900 font-sans">[{delegateToDelete}]</strong> من منظومة التحصيل تماماً؟
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => executeDeleteDelegate(delegateToDelete)}
                className="bg-rose-700 text-white text-xs font-bold px-3 py-1.5 border border-t-rose-500 border-l-rose-500 border-r-rose-900 border-b-rose-900"
              >
                نعم، إزالة المندوب
              </button>
              <button
                type="button"
                onClick={() => setDelegateToDelete(null)}
                className="bg-[#e0dfe3] border border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#d0cfe3] text-xs font-bold px-3 py-1.5"
              >
                تراجع وإلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Employee Account Modal */}
      {userToDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]" dir="rtl">
          <div className="bg-[#e0dfe3] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] p-4 max-w-sm w-full shadow-2xl relative text-right">
            <div className="bg-gradient-to-r from-[#0a246a] to-[#a6caf0] text-white px-2 py-1 text-xs font-bold mb-3 flex items-center gap-1">
              <span>تأكيد إقصاء الموظف</span>
            </div>
            <p className="text-xs text-slate-800 mb-4 leading-relaxed">
              هل أنت متأكد من حذف الحساب الحركي للموظف <strong className="text-slate-900">({state.users.find(u => u.id === userToDeleteId)?.name})</strong>؟ سيتم إغلاق تصاريحه وحجب وصوله نهائياً عن التطبيقات.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => executeDeleteUser(userToDeleteId)}
                className="bg-rose-700 text-white text-xs font-bold px-3 py-1.5 border border-t-rose-500 border-l-rose-500 border-r-rose-900 border-b-rose-900"
              >
                نعم، حجب وحذف الحساب
              </button>
              <button
                type="button"
                onClick={() => setUserToDeleteId(null)}
                className="bg-[#e0dfe3] border border-t-white border-l-white border-r-[#808080] border-b-[#808080] hover:bg-[#d0cfe3] text-xs font-bold px-3 py-1.5"
              >
                إلغاء الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Simulated 2001 Windows Task Message Dialog for general Alerts */}
      {showSuccessToast && (
        <div className="fixed bottom-4 left-4 max-w-sm bg-[#e0dfe3] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] p-3 z-[99999] shadow-2xl text-right animate-slide-up" dir="rtl">
          <div className="bg-gradient-to-r from-[#0a246a] to-[#a6caf0] text-white px-2 py-0.5 text-[11px] font-sans font-bold flex items-center justify-between mb-2">
            <span>تحديث في النظام المحاسبي</span>
            <button onClick={() => setShowSuccessToast('')}>✕</button>
          </div>
          <div className="text-xs font-bold text-slate-800 leading-normal flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-700 text-white text-[10px] font-black flex items-center justify-center shrink-0">✓</div>
            <span>{showSuccessToast}</span>
          </div>
        </div>
      )}

    </div>
  );
}
