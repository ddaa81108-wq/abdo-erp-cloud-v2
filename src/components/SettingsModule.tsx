import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import type { ERPState, User, UserPermissions } from '../types';
import { createFirebaseUserAccount, db } from '../firebase';
import { normalizeLoginIdentifier } from '../utils/authUtils';
import {
  DENIED_PERMISSIONS,
  FULL_PERMISSIONS,
  resolvePermissions,
} from '../utils/permissions';
import {
  estimateStorageHealth,
  formatStorageBytes,
  type StorageHealthLevel,
} from '../services/storageHealth';

interface SettingsModuleProps {
  state: ERPState;
  currentUser: User | null;
  onUpdateState: (newState: ERPState) => void;
  onUpdateCurrentSession: (user: User) => void;
}

const permissionColumns: Array<{
  key: keyof UserPermissions;
  label: string;
}> = [
  { key: 'canViewDebts', label: 'ديون العملاء' },
  { key: 'canViewCompanies', label: 'الشركات والتجار' },
  { key: 'canViewDeposits', label: 'الأمانات' },
  { key: 'canViewMailManual', label: 'المصراوية' },
  { key: 'canViewPurchases', label: 'المشتريات' },
  { key: 'canViewTreasury', label: 'الخزينة' },
  { key: 'canViewFinancialReports', label: 'التقارير المالية' },
  { key: 'canViewTrash', label: 'سلة المهملات' },
  { key: 'canUseSmartCards', label: 'استخدام الكروت الذكية' },
  { key: 'canViewBackup', label: 'النسخ الاحتياطي' },
  { key: 'canImportExcel', label: 'استيراد Excel' },
  { key: 'canExportExcel', label: 'تصدير Excel' },
];

const roleLabels: Record<User['role'], string> = {
  admin: 'مدير النظام',
  accountant: 'محاسب',
  cashier: 'كاشير',
  warehouse: 'أمين مخزن',
  assistant: 'مساعد',
};

const rolePresets: Record<User['role'], UserPermissions> = {
  admin: FULL_PERMISSIONS,
  accountant: {
    ...DENIED_PERMISSIONS,
    canViewDebts: true,
    canViewCompanies: true,
    canViewDeposits: true,
    canViewPurchases: true,
    canViewArchive: true,
  },
  cashier: {
    ...DENIED_PERMISSIONS,
    canViewDebts: true,
    canViewDeposits: true,
  },
  warehouse: {
    ...DENIED_PERMISSIONS,
    canViewPurchases: true,
    canViewArchive: true,
  },
  assistant: {
    ...DENIED_PERMISSIONS,
    canViewDebts: true,
    canViewArchive: true,
  },
};

const isRole = (value: unknown): value is User['role'] =>
  ['admin', 'accountant', 'cashier', 'warehouse', 'assistant'].includes(
    String(value),
  );

const storageLabels: Partial<Record<keyof ERPState, string>> = {
  customers: 'حسابات العملاء',
  cycles: 'دورات ديون العملاء',
  debtTransactions: 'معاملات ديون العملاء',
  companies: 'الشركات والتجار',
  companyTransactions: 'معاملات الشركات والتجار',
  merchants: 'التجار القدامى',
  merchantTransactions: 'معاملات التجار القديمة',
  treasuryTransactions: 'معاملات الخزينة',
  purchases: 'سجل المشتريات',
  purchaseAccounts: 'حسابات المشتريات',
  purchaseAuditLog: 'تدقيق المشتريات',
  trustDeposits: 'حسابات الأمانات',
  safeAudits: 'تدقيق الخزينة',
  backupPoints: 'فهرس النسخ الاحتياطية',
  users: 'المستخدمون',
  egyptianCashRecords: 'سجل المصراوية',
  financialReportRates: 'أسعار تقارير المالية',
  financialReportSnapshots: 'التقارير المالية اليومية',
  notesAndReminders: 'الملاحظات والتنبيهات',
  delegates: 'المندوبون',
};

const storageLevelUi: Record<StorageHealthLevel, {
  label: string;
  badge: string;
  bar: string;
}> = {
  safe: {
    label: 'آمن',
    badge: 'bg-emerald-50 text-emerald-800',
    bar: 'bg-emerald-500',
  },
  warning: {
    label: 'يحتاج متابعة',
    badge: 'bg-amber-50 text-amber-800',
    bar: 'bg-amber-500',
  },
  critical: {
    label: 'قريب من الحد',
    badge: 'bg-rose-50 text-rose-800',
    bar: 'bg-rose-600',
  },
};

export default function SettingsModule({
  state,
  currentUser,
  onUpdateState,
  onUpdateCurrentSession,
}: SettingsModuleProps) {
  const isAdmin = currentUser?.role === 'admin';
  const reconciledRef = useRef(false);
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<User['role']>('accountant');
  const [creating, setCreating] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userToDisable, setUserToDisable] = useState<User | null>(null);
  const [message, setMessage] = useState('');

  const activeUsers = useMemo(
    () =>
      (state.users || [])
        .filter((user) => user.isActive !== false)
        .sort((left, right) => {
          if (left.role === 'admin' && right.role !== 'admin') return -1;
          if (right.role === 'admin' && left.role !== 'admin') return 1;
          return left.name.localeCompare(right.name, 'ar');
        }),
    [state.users],
  );
  const storageHealth = useMemo(
    () => estimateStorageHealth(state),
    [state],
  );

  const toast = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3200);
  };

  // Firestore user profiles are the source of truth for active login accounts.
  useEffect(() => {
    if (!isAdmin || reconciledRef.current) return;
    reconciledRef.current = true;

    const reconcileActiveUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const existingById = new Map(
          (state.users || []).map((user) => [user.id, user]),
        );
        const syncedUsers = snapshot.docs
          .map((userDoc): User | null => {
            const data = userDoc.data() as any;
            if (
              data.isActive === false
              || data.role === 'pending'
              || !isRole(data.role)
            ) return null;
            const existing = existingById.get(userDoc.id);
            return {
              id: userDoc.id,
              username:
                data.username
                || data.email
                || existing?.username
                || 'مستخدم',
              email: data.email || existing?.email,
              name:
                data.name
                || data.username
                || data.email
                || existing?.name
                || 'مستخدم',
              role: data.role,
              password: '',
              permissions: resolvePermissions(
                data.role,
                data.permissions || existing?.permissions,
              ),
              createdAt:
                data.createdAt
                || existing?.createdAt
                || new Date().toISOString(),
              isActive: true,
            };
          })
          .filter((user): user is User => Boolean(user));

        const ordered = syncedUsers.sort((left, right) =>
          left.id.localeCompare(right.id));
        const currentOrdered = [...(state.users || [])]
          .filter((user) => user.isActive !== false)
          .map((user) => ({ ...user, password: '' }))
          .sort((left, right) => left.id.localeCompare(right.id));

        if (JSON.stringify(ordered) !== JSON.stringify(currentOrdered)) {
          onUpdateState({ ...state, users: ordered });
        }
      } catch (error) {
        console.error('Failed to load active Firebase users:', error);
        toast('تعذر تحديث قائمة الحسابات من Firebase؛ تم الإبقاء على القائمة الحالية.');
      } finally {
        setLoadingUsers(false);
      }
    };

    void reconcileActiveUsers();
  }, [isAdmin]);

  const togglePermission = async (
    user: User,
    key: keyof UserPermissions,
  ) => {
    if (!isAdmin || user.role === 'admin') return;
    const permissions = {
      ...user.permissions,
      [key]: !user.permissions[key],
    };
    try {
      await setDoc(doc(db, 'users', user.id), { permissions }, { merge: true });
      const users = state.users.map((item) =>
        item.id === user.id ? { ...item, permissions } : item);
      onUpdateState({ ...state, users });
      if (currentUser?.id === user.id) {
        onUpdateCurrentSession({ ...user, permissions });
      }
      toast('تم حفظ الصلاحيات وتفعيلها على حساب الموظف.');
    } catch (error) {
      console.error('Failed to update permissions:', error);
      toast('تعذر حفظ الصلاحيات. تحقق من الاتصال وحاول مرة أخرى.');
    }
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = fullName.trim();
    const cleanIdentifier = identifier.trim();
    const cleanPassword = password.trim();
    if (!isAdmin || !cleanName || !cleanIdentifier || cleanPassword.length < 6) {
      toast('أدخل الاسم واسم الدخول أو البريد وكلمة مرور لا تقل عن 6 خانات.');
      return;
    }

    const loginEmail = normalizeLoginIdentifier(cleanIdentifier);
    const duplicate = activeUsers.some(
      (user) =>
        user.username.toLocaleLowerCase('ar')
          === cleanIdentifier.toLocaleLowerCase('ar')
        || user.email?.toLowerCase() === loginEmail,
    );
    if (duplicate) {
      toast('اسم الدخول أو البريد مستخدم بالفعل.');
      return;
    }

    setCreating(true);
    try {
      const newUser = await createFirebaseUserAccount(
        cleanIdentifier,
        cleanPassword,
        {
          username: cleanIdentifier.toLocaleLowerCase('ar'),
          name: cleanName,
          role,
          permissions: rolePresets[role],
          createdAt: new Date().toISOString(),
          isActive: true,
        },
      );
      onUpdateState({
        ...state,
        users: [...activeUsers, { ...newUser, isActive: true }],
      });
      setFullName('');
      setIdentifier('');
      setPassword('');
      setRole('accountant');
      toast(`تم إنشاء وتفعيل حساب ${newUser.name} بنجاح.`);
    } catch (error: any) {
      console.error('Failed to create Firebase user:', error);
      const text =
        error?.code === 'auth/email-already-in-use'
          ? 'البريد أو اسم الدخول مستخدم بالفعل.'
          : error?.code === 'auth/invalid-email'
            ? 'صيغة البريد الإلكتروني غير صحيحة.'
            : error?.code === 'auth/weak-password'
              ? 'كلمة المرور ضعيفة.'
              : 'تعذر إنشاء الحساب. تحقق من الاتصال ثم حاول مرة أخرى.';
      toast(text);
    } finally {
      setCreating(false);
    }
  };

  const disableUser = async () => {
    if (!userToDisable || !isAdmin) return;
    if (userToDisable.id === currentUser?.id) {
      toast('لا يمكن إيقاف الحساب الذي تعمل به الآن.');
      setUserToDisable(null);
      return;
    }
    const otherAdmins = activeUsers.filter(
      (user) => user.role === 'admin' && user.id !== userToDisable.id,
    );
    if (userToDisable.role === 'admin' && otherAdmins.length === 0) {
      toast('لا يمكن إيقاف آخر مدير نشط في المنظومة.');
      setUserToDisable(null);
      return;
    }

    try {
      await setDoc(
        doc(db, 'users', userToDisable.id),
        { isActive: false },
        { merge: true },
      );
      onUpdateState({
        ...state,
        users: state.users.filter((user) => user.id !== userToDisable.id),
      });
      toast(`تم إيقاف حساب ${userToDisable.name} ومنع تسجيل الدخول.`);
      setUserToDisable(null);
    } catch (error) {
      console.error('Failed to disable user:', error);
      toast('تعذر إيقاف الحساب. حاول مرة أخرى.');
    }
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      {message && (
        <div className="fixed right-5 top-20 z-[130] rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-2xl">
          {message}
        </div>
      )}

      <header className="flex flex-col gap-3 rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
            <Shield className="h-6 w-6 text-emerald-700" />
            صلاحيات الموظفين
          </h2>
          <p className="mt-1 text-[11px] font-bold text-slate-500">
            الحسابات النشطة المتزامنة مع Firebase فقط، مع تحكم المدير في جميع الصلاحيات.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-emerald-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <strong className="block text-sm">{activeUsers.length} حساب نشط</strong>
            <span className="text-[9px] font-bold">
              {loadingUsers ? 'جاري التحقق من Firebase...' : 'تم التحقق من الحسابات'}
            </span>
          </div>
        </div>
      </header>

      {isAdmin && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Database className="h-5 w-5 text-indigo-700" />
                مراقبة أحجام بيانات Firebase
              </h3>
              <p className="mt-1 text-[10px] font-bold text-slate-500">
                فحص تقديري للقراءة فقط؛ لا يغير البيانات أو المزامنة أو الصلاحيات.
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 self-start rounded-xl px-3 py-2 text-xs font-black ${storageLevelUi[storageHealth.overallLevel].badge}`}>
              {storageHealth.overallLevel === 'safe'
                ? <CheckCircle2 className="h-4 w-4" />
                : <AlertTriangle className="h-4 w-4" />}
              الحالة العامة: {storageLevelUi[storageHealth.overallLevel].label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
            <article className={`rounded-2xl border p-4 ${storageHealth.backupLevel === 'safe' ? 'border-emerald-200 bg-emerald-50/60' : storageHealth.backupLevel === 'warning' ? 'border-amber-200 bg-amber-50/60' : 'border-rose-200 bg-rose-50/60'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <HardDrive className="h-4 w-4" />
                  النسخة الاحتياطية الكاملة
                </span>
                <span className={`rounded-lg px-2 py-1 text-[9px] font-black ${storageLevelUi[storageHealth.backupLevel].badge}`}>
                  {storageLevelUi[storageHealth.backupLevel].label}
                </span>
              </div>
              <strong className="mt-4 block font-mono text-2xl text-slate-950">
                {formatStorageBytes(storageHealth.backupEstimatedBytes)}
              </strong>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className={`h-full rounded-full ${storageLevelUi[storageHealth.backupLevel].bar}`}
                  style={{ width: `${storageHealth.backupUsagePercent}%` }}
                />
              </div>
              <span className="mt-2 block text-[9px] font-bold text-slate-500">
                {storageHealth.backupUsagePercent.toFixed(1)}% من الحد الأقصى التقريبي للمستند
              </span>
            </article>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-[1fr_80px_110px_75px] bg-slate-900 px-3 py-2 text-[9px] font-black text-white">
                <span>أكبر الشرائح</span>
                <span className="text-center">السجلات</span>
                <span className="text-center">الحجم</span>
                <span className="text-center">الحالة</span>
              </div>
              {storageHealth.chunks.slice(0, 8).map((chunk) => (
                <div key={chunk.documentId} className="grid grid-cols-[1fr_80px_110px_75px] items-center border-t border-slate-100 px-3 py-2 text-[10px]">
                  <div className="min-w-0">
                    <strong className="block truncate text-slate-800">
                      {storageLabels[chunk.key] || String(chunk.key)}
                    </strong>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${storageLevelUi[chunk.level].bar}`}
                        style={{ width: `${chunk.usagePercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-center font-mono font-black text-slate-600">{chunk.itemCount.toLocaleString('en-US')}</span>
                  <span className="text-center font-mono font-black text-slate-700">{formatStorageBytes(chunk.estimatedBytes)}</span>
                  <span className={`mx-auto rounded-lg px-2 py-1 text-[8px] font-black ${storageLevelUi[chunk.level].badge}`}>
                    {storageLevelUi[chunk.level].label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Users className="h-5 w-5 text-indigo-700" />
            الموظفون النشطون وصلاحياتهم
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1450px] w-full border-collapse text-[10px]">
            <thead className="sticky top-0 z-20 bg-slate-900 text-white">
              <tr>
                <th className="p-2">الموظف</th>
                <th className="p-2">اسم الدخول / البريد</th>
                <th className="p-2">الدور</th>
                {permissionColumns.map((permission) => (
                  <th key={permission.key} className="min-w-[78px] p-2 text-center">
                    {permission.label}
                  </th>
                ))}
                <th className="p-2">إيقاف</th>
              </tr>
            </thead>
            <tbody>
              {activeUsers.map((user) => (
                <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-2">
                    <strong className="block text-xs text-slate-900">{user.name}</strong>
                    <span className="text-[9px] font-bold text-emerald-600">● نشط ومتزامن</span>
                  </td>
                  <td className="p-2 font-mono text-[10px] text-slate-600">
                    {user.email || user.username}
                  </td>
                  <td className="p-2 text-center">
                    <span className="rounded-lg bg-indigo-50 px-2 py-1 font-black text-indigo-800">
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  {permissionColumns.map((permission) => (
                    <td key={permission.key} className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={
                          user.role === 'admin'
                          || user.permissions[permission.key] === true
                        }
                        disabled={!isAdmin || user.role === 'admin'}
                        onChange={() => void togglePermission(user, permission.key)}
                        className="h-4 w-4 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-65"
                      />
                    </td>
                  ))}
                  <td className="p-2 text-center">
                    {user.id === currentUser?.id ? (
                      <span className="text-[9px] font-black text-slate-400">الحساب الحالي</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setUserToDisable(user)}
                        className="rounded-lg bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100"
                        title="إيقاف الحساب ومنع دخوله"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loadingUsers && activeUsers.length === 0 && (
                <tr>
                  <td colSpan={permissionColumns.length + 4} className="p-10 text-center font-bold text-slate-400">
                    لا توجد حسابات نشطة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <UserPlus className="h-5 w-5 text-emerald-700" />
            إضافة موظف جديد
          </h3>
          <p className="mt-1 text-[10px] font-bold text-slate-500">
            يقبل بريدًا إلكترونيًا حقيقيًا أو اسم دخول عاديًا، ويتم إنشاء حساب Firebase وصلاحياته معًا.
          </p>
        </div>
        <form onSubmit={createUser} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="اسم الموظف">
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold outline-none focus:border-emerald-500"
              placeholder="الاسم الكامل"
            />
          </Field>
          <Field label="البريد أو اسم الدخول">
            <div className="relative">
              <Mail className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-3 pr-9 text-xs font-bold outline-none focus:border-emerald-500"
                placeholder="name أو name@example.com"
                dir="ltr"
              />
            </div>
          </Field>
          <Field label="كلمة المرور">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold outline-none focus:border-emerald-500"
              placeholder="6 خانات على الأقل"
              dir="ltr"
            />
          </Field>
          <Field label="الدور المبدئي">
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as User['role'])}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold outline-none focus:border-emerald-500"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!isAdmin || creating}
              className="w-full rounded-xl bg-emerald-700 py-2.5 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {creating ? 'جاري إنشاء الحساب...' : 'إنشاء وتفعيل الحساب'}
            </button>
          </div>
        </form>
      </section>

      {userToDisable && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <section className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <header className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-black text-slate-900">إيقاف حساب الموظف</h3>
              <button
                type="button"
                onClick={() => setUserToDisable(null)}
                className="rounded-lg bg-slate-100 p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            <p className="mb-4 text-sm font-bold leading-7 text-slate-700">
              سيتم إيقاف حساب <strong>{userToDisable.name}</strong> ومنع تسجيل دخوله، دون المساس بالمعاملات التي نفذها سابقًا.
            </p>
            <button
              type="button"
              onClick={() => void disableUser()}
              className="w-full rounded-xl bg-rose-700 py-3 text-sm font-black text-white"
            >
              تأكيد إيقاف الحساب
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black text-slate-700">{label}</span>
      {children}
    </label>
  );
}
