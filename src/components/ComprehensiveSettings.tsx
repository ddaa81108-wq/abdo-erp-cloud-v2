import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Key, UserRound, Building2, Database, Tag, ArrowRight, Settings,
  Plus, Trash2, Edit3, X, Check, Eye, Save, RotateCcw, AlertTriangle
} from "lucide-react";
import { ERPState, User, UserPermissions, Customer, Company, Merchant } from "../types";

interface Props {
  state: ERPState;
  currentUser: User;
  onUpdateState: (newState: ERPState) => void;
  onUpdateCurrentSession: (updatedUser: User) => void;
}

type SubSection = "employees" | "password" | "customers" | "companies" | "backup" | "sections";

const subSections: { id: SubSection; icon: React.ReactNode; label: string; description: string }[] = [
  { id: "employees", icon: <Users className="w-5 h-5" />, label: "إدارة الموظفين والصلاحيات", description: "إضافة، تعديل، حذف الموظفين والتحكم بصلاحياتهم" },
  { id: "password", icon: <Key className="w-5 h-5" />, label: "تغيير كلمة المرور", description: "تغيير الباسورد الخاص بأي موظف" },
  { id: "customers", icon: <UserRound className="w-5 h-5" />, label: "إدارة العملاء", description: "تعديل أسماء العملاء وحذفهم" },
  { id: "companies", icon: <Building2 className="w-5 h-5" />, label: "إدارة الشركات والتجار", description: "تعديل أسماء الشركات والتجار" },
  { id: "backup", icon: <Database className="w-5 h-5" />, label: "النسخ الاحتياطي", description: "حفظ واستعادة نسخ احتياطية من المنظومة" },
  { id: "sections", icon: <Tag className="w-5 h-5" />, label: "تسمية الأقسام", description: "تغيير أسماء الأقسام في القائمة الجانبية" },
];

const ROLES: { value: User["role"]; label: string }[] = [
  { value: "admin", label: "مدير 👑" },
  { value: "accountant", label: "محاسب 💰" },
  { value: "cashier", label: "كاشير 🏪" },
  { value: "warehouse", label: "أمين مخزن 📦" },
  { value: "assistant", label: "مساعد 🤝" },
];

const PERMISSION_LABELS: { key: keyof UserPermissions; label: string }[] = [
  { key: "canViewDebts", label: "قسم ديون العملاء 👥" },
  { key: "canViewCompanies", label: "حسابات الشركات والتجار 🏭" },
  { key: "canViewTreasury", label: "قسم الخزنة 💰" },
  { key: "canViewPurchases", label: "قسم المشتريات 🛒" },
  { key: "canViewDeposits", label: "قسم الأمانات 🛡️" },
  { key: "canViewBackup", label: "الإعدادات الشاملة ⚙️" },
];

const SECTION_KEYS: { key: string; defaultLabel: string }[] = [
  { key: "debts", defaultLabel: "قسم ديون العملاء 👥" },
  { key: "companies", defaultLabel: "حسابات الشركات والتجار 🏭" },
  { key: "deposits", defaultLabel: "قسم الأمانات 🛡️" },
  { key: "mail_manual", defaultLabel: "المصراوية 🇪🇬" },
  { key: "purchases", defaultLabel: "قسم المشتريات 🛒" },
  { key: "treasury", defaultLabel: "قسم الخزنة 💰" },
  { key: "financial_reports", defaultLabel: "قسم التقارير المالية 📊" },
  { key: "transaction_log", defaultLabel: "سجل المعاملات الشامل 📝" },
  { key: "trash_can", defaultLabel: "سلة المهملات 🗑️" },
  { key: "backup", defaultLabel: "الإعدادات الشاملة ⚙️" },
];

function defaultPermissions(): UserPermissions {
  return {
    canViewDebts: false, canViewCompanies: false, canViewTreasury: false,
    canViewPurchases: false, canViewDeposits: false, canViewArchive: false,
    canViewBackup: false, canViewAdvances: false,
  };
}

// ════════════════ 1. EMPLOYEE MANAGEMENT ════════════════
function EmployeeManagement({ state, currentUser, onUpdateState, onUpdateCurrentSession }: Props) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<User["role"]>("cashier");
  const [formPermissions, setFormPermissions] = useState<UserPermissions>(defaultPermissions());
  const [formError, setFormError] = useState("");
  const users = state.users || [];

  const resetForm = () => { setFormName(""); setFormUsername(""); setFormPassword(""); setFormRole("cashier"); setFormPermissions(defaultPermissions()); setFormError(""); };

  const handleAdd = () => { setEditingUserId(null); resetForm(); setShowAddForm(true); };
  const handleEdit = (user: User) => { setEditingUserId(user.id); setFormName(user.name); setFormUsername(user.username); setFormPassword(""); setFormRole(user.role); setFormPermissions({ ...user.permissions }); setFormError(""); setShowAddForm(true); };
  const handleCancel = () => { setShowAddForm(false); setEditingUserId(null); resetForm(); };

  const handleSave = () => {
    if (!formName.trim()) { setFormError("الاسم مطلوب"); return; }
    if (!formUsername.trim()) { setFormError("اسم المستخدم مطلوب"); return; }
    if (!editingUserId && !formPassword.trim()) { setFormError("كلمة المرور مطلوبة"); return; }
    const duplicate = users.find(u => u.username === formUsername.trim() && u.id !== editingUserId);
    if (duplicate) { setFormError("اسم المستخدم موجود بالفعل"); return; }

    let updatedUsers: User[];
    if (editingUserId) {
      updatedUsers = users.map(u => u.id === editingUserId ? { ...u, name: formName.trim(), username: formUsername.trim(), role: formRole, permissions: { ...formPermissions }, ...(formPassword.trim() ? { password: formPassword.trim() } : {}) } : u);
    } else {
      updatedUsers = [...users, { id: `u_${Date.now()}`, username: formUsername.trim(), name: formName.trim(), role: formRole, permissions: { ...formPermissions }, createdAt: new Date().toISOString() }];
    }
    onUpdateState({ ...state, users: updatedUsers });
    if (editingUserId === currentUser.id) { const u = updatedUsers.find(x => x.id === currentUser.id); if (u) onUpdateCurrentSession(u); }
    handleCancel();
  };

  const handleDelete = (userId: string) => {
    if (userId === currentUser.id) { alert("لا يمكن حذف المستخدم الحالي!"); return; }
    if (users.length <= 1) { alert("يجب وجود مستخدم واحد على الأقل!"); return; }
    const name = users.find(u => u.id === userId)?.name || "المستخدم";
    if (confirm(`هل أنت متأكد من حذف "${name}"؟`)) onUpdateState({ ...state, users: users.filter(u => u.id !== userId) });
  };

  const togglePermission = (key: keyof UserPermissions) => setFormPermissions(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-slate-200 flex items-center gap-2"><Users className="w-4 h-4 text-amber-400" /><span>الموظفون ({users.length})</span></h3>
        <button onClick={handleAdd} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-md"><Plus className="w-4 h-4" /><span>إضافة موظف</span></button>
      </div>
      <div className="space-y-2 mb-6">
        {users.map(user => (
          <div key={user.id} className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-all group">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black ${user.role === "admin" ? "bg-amber-500/20 text-amber-400" : user.role === "accountant" ? "bg-blue-500/20 text-blue-400" : user.role === "cashier" ? "bg-emerald-500/20 text-emerald-400" : user.role === "warehouse" ? "bg-purple-500/20 text-purple-400" : "bg-slate-500/20 text-slate-400"}`}>{user.name.charAt(0)}</div>
              <div><p className="text-sm font-bold text-slate-200">{user.name}</p><p className="text-[10px] text-slate-500">@{user.username} · {ROLES.find(r => r.value === user.role)?.label}</p></div>
              {user.id === currentUser.id && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">أنت</span>}
            </div>
            <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleEdit(user)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all cursor-pointer" title="تعديل"><Edit3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(user.id)} className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-all cursor-pointer" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-slate-900/90 border border-slate-700 rounded-2xl p-5">
            <h4 className="text-sm font-black text-slate-200 mb-4 flex items-center gap-2">{editingUserId ? <Edit3 className="w-4 h-4 text-amber-400" /> : <Plus className="w-4 h-4 text-emerald-400" />}<span>{editingUserId ? "تعديل موظف" : "إضافة موظف جديد"}</span></h4>
            {formError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mb-4 text-xs font-bold text-red-400">⚠️ {formError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5">الاسم الكامل</label><input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="مثال: أحمد محمد" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all" dir="rtl" /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5">اسم المستخدم</label><input type="text" value={formUsername} onChange={e => setFormUsername(e.target.value)} placeholder="مثال: ahmed" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all" dir="ltr" /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5">{editingUserId ? "كلمة المرور (اترك فارغاً للاحتفاظ بالقديمة)" : "كلمة المرور"}</label><input type="text" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder={editingUserId ? "••••••••" : "كلمة مرور قوية"} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all" dir="ltr" /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5">الدور الوظيفي</label><select value={formRole} onChange={e => setFormRole(e.target.value as User["role"])} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-amber-500/50 transition-all cursor-pointer" dir="rtl">{ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
            </div>
            <div className="mb-5"><h5 className="text-xs font-black text-amber-400 mb-3 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /><span>صلاحيات الموظف:</span></h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {PERMISSION_LABELS.map(perm => (
                  <button key={perm.key} onClick={() => togglePermission(perm.key)} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${formPermissions[perm.key] ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400" : "bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-400 hover:border-slate-600"}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center text-[9px] transition-all ${formPermissions[perm.key] ? "bg-emerald-500/30 text-emerald-300" : "bg-slate-700 text-slate-500"}`}>{formPermissions[perm.key] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}</div><span>{perm.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end border-t border-slate-800 pt-4">
              <button onClick={handleCancel} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs transition-all cursor-pointer">إلغاء</button>
              <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer active:scale-95 shadow-lg shadow-amber-500/20">{editingUserId ? "حفظ التعديلات ✓" : "إضافة الموظف ✓"}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════ 2. PASSWORD CHANGE ════════════════
function PasswordChange({ state, currentUser, onUpdateState, onUpdateCurrentSession }: Props) {
  const [selectedUserId, setSelectedUserId] = useState(currentUser.id);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const users = state.users || [];

  const handleChange = () => {
    if (!newPassword.trim()) { setMessage("كلمة المرور مطلوبة"); setMessageType("error"); return; }
    if (newPassword.length < 3) { setMessage("كلمة المرور قصيرة جداً"); setMessageType("error"); return; }
    if (newPassword !== confirmPassword) { setMessage("كلمة المرور غير متطابقة"); setMessageType("error"); return; }
    const updatedUsers = users.map(u => u.id === selectedUserId ? { ...u } : u);
    onUpdateState({ ...state, users: updatedUsers });
    if (selectedUserId === currentUser.id) { const u = updatedUsers.find(x => x.id === currentUser.id); if (u) onUpdateCurrentSession(u); }
    setMessage(`✅ تم تغيير كلمة المرور لـ "${users.find(u => u.id === selectedUserId)?.name}" بنجاح`);
    setMessageType("success");
    setNewPassword(""); setConfirmPassword("");
  };

  return (
    <div>
      <h3 className="text-sm font-black text-slate-200 mb-5 flex items-center gap-2"><Key className="w-4 h-4 text-amber-400" /><span>تغيير كلمة المرور</span></h3>
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 max-w-lg">
        {message && <div className={`rounded-xl px-4 py-2.5 mb-4 text-xs font-bold ${messageType === "success" ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>{message}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5">اختر الموظف</label>
            <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-amber-500/50 transition-all cursor-pointer" dir="rtl">
              {users.map(u => <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5">كلمة المرور الجديدة</label>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="ادخل كلمة المرور الجديدة" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all" dir="ltr" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1.5">تأكيد كلمة المرور</label>
            <input type="text" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="أعد كتابة كلمة المرور" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all" dir="ltr" />
          </div>
          <button onClick={handleChange} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition-all cursor-pointer active:scale-[0.98] shadow-lg shadow-amber-500/20"><Save className="w-4 h-4" /><span>حفظ كلمة المرور الجديدة</span></button>
        </div>
      </div>
    </div>
  );
}

// ════════════════ 3. CUSTOMER MANAGEMENT ════════════════
function CustomerManagement({ state, onUpdateState }: { state: ERPState; onUpdateState: (s: ERPState) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");
  const customers = state.customers || [];

  const activeCustomers = customers.filter(c => !c.isDeleted);
  const filtered = activeCustomers.filter(c => search ? c.name.includes(search) : true);

  const startEdit = (c: Customer) => { setEditingId(c.id); setEditName(c.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(""); };
  const saveEdit = (c: Customer) => {
    if (!editName.trim()) return;
    onUpdateState({ ...state, customers: state.customers.map(x => x.id === c.id ? { ...x, name: editName.trim(), updatedAt: new Date().toISOString() } : x) });
    cancelEdit();
  };
  const handleDelete = (c: Customer) => {
    if (confirm(`هل أنت متأكد من حذف "${c.name}"؟\n(سينتقل لسلة المهملات)`)) {
      onUpdateState({ ...state, customers: state.customers.map(x => x.id === c.id ? { ...x, isDeleted: true, updatedAt: new Date().toISOString() } : x) });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-slate-200 flex items-center gap-2"><UserRound className="w-4 h-4 text-amber-400" /><span>العملاء ({activeCustomers.length})</span></h3>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث..." className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-48 transition-all" dir="rtl" />
      </div>
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
        {filtered.map(c => (
          <div key={c.id} className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-2.5 hover:border-slate-700 transition-all group">
            {editingId === c.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 bg-slate-800 border border-amber-500/50 rounded-lg px-3 py-1.5 text-sm text-white font-bold focus:outline-none" dir="rtl" autoFocus />
                <button onClick={() => saveEdit(c)} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 transition-all cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold text-slate-200">{c.name}</span>
                  {c.phone && <span className="text-[10px] text-slate-500">{c.phone}</span>}
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(c)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all cursor-pointer" title="تعديل الاسم"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(c)} className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-all cursor-pointer" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 text-xs py-6">لا يوجد عملاء{search ? " مطابقين للبحث" : ""}</p>}
      </div>
    </div>
  );
}

// ════════════════ 4. COMPANY & MERCHANT MANAGEMENT ════════════════
function CompanyManagement({ state, onUpdateState }: { state: ERPState; onUpdateState: (s: ERPState) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"company" | "merchant">("company");
  const [search, setSearch] = useState("");

  const companies: (Company & { __type: "company" })[] = (state.companies || []).filter(c => !c.isDeleted).map(c => ({ ...c, __type: "company" as const }));
  const merchants: (Merchant & { __type: "merchant" })[] = (state.merchants || []).filter(m => !m.isDeleted).map(m => ({ ...m, __type: "merchant" as const }));
  const all = [...companies, ...merchants];
  const filtered = all.filter(e => search ? e.name.includes(search) : true);

  const startEdit = (e: typeof all[0]) => { setEditingId(e.id); setEditName(e.name); setEditType(e.__type); };
  const cancelEdit = () => { setEditingId(null); setEditName(""); };
  const saveEdit = () => {
    if (!editName.trim()) return;
    if (editType === "company") {
      onUpdateState({ ...state, companies: state.companies.map(x => x.id === editingId ? { ...x, name: editName.trim() } : x) });
    } else {
      onUpdateState({ ...state, merchants: state.merchants.map(x => x.id === editingId ? { ...x, name: editName.trim() } : x) });
    }
    cancelEdit();
  };
  const handleDelete = (e: typeof all[0]) => {
    if (confirm(`هل أنت متأكد من حذف "${e.name}"؟`)) {
      if (e.__type === "company") onUpdateState({ ...state, companies: state.companies.map(x => x.id === e.id ? { ...x, isDeleted: true } : x) });
      else onUpdateState({ ...state, merchants: state.merchants.map(x => x.id === e.id ? { ...x, isDeleted: true } : x) });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-slate-200 flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-400" /><span>الشركات والتجار ({all.length})</span></h3>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث..." className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-48 transition-all" dir="rtl" />
      </div>
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
        {filtered.map(e => (
          <div key={e.id} className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-2.5 hover:border-slate-700 transition-all group">
            {editingId === e.id ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="text" value={editName} onChange={ev => setEditName(ev.target.value)} className="flex-1 bg-slate-800 border border-amber-500/50 rounded-lg px-3 py-1.5 text-sm text-white font-bold focus:outline-none" dir="rtl" autoFocus />
                <button onClick={saveEdit} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 transition-all cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${e.__type === "company" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>{e.__type === "company" ? "شركة" : "تاجر"}</span>
                  <span className="text-sm font-bold text-slate-200">{e.name}</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(e)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all cursor-pointer" title="تعديل"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(e)} className="p-2 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-all cursor-pointer" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 text-xs py-6">لا توجد شركات أو تجار{search ? " مطابقين للبحث" : ""}</p>}
      </div>
    </div>
  );
}

// ════════════════ 5. BACKUP & RESTORE ════════════════
function BackupSection({ state, onUpdateState }: { state: ERPState; onUpdateState: (s: ERPState) => void }) {
  const [backupName, setBackupName] = useState("");
  const [backupDesc, setBackupDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const backups = state.backupPoints || [];

  const handleSave = () => {
    if (!backupName.trim()) return;
    const point = { id: `point_${Date.now()}`, name: backupName.trim(), date: new Date().toISOString(), description: backupDesc.trim(), dataJson: JSON.stringify(state) };
    onUpdateState({ ...state, backupPoints: [...backups, point] });
    setBackupName(""); setBackupDesc(""); setShowCreate(false);
  };

  const handleRestore = (dataJson: string, name: string) => {
    if (confirm(`⚠️ هل أنت متأكد من استعادة النسخة "${name}"؟\nسيتم استبدال جميع البيانات الحالية!`)) {
      try {
        const restored = JSON.parse(dataJson) as ERPState;
        onUpdateState(restored);
        alert("✅ تم استعادة النسخة الاحتياطية بنجاح! سيتم تحديث الصفحة.");
        setTimeout(() => window.location.reload(), 1000);
      } catch { alert("❌ فشل في استعادة النسخة الاحتياطية."); }
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه النسخة الاحتياطية؟")) onUpdateState({ ...state, backupPoints: backups.filter(p => p.id !== id) });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-black text-slate-200 flex items-center gap-2"><Database className="w-4 h-4 text-amber-400" /><span>النسخ الاحتياطية ({backups.length})</span></h3>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-md"><Plus className="w-4 h-4" /><span>حفظ نسخة جديدة</span></button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-slate-900/90 border border-slate-700 rounded-2xl p-5 mb-4">
            <h4 className="text-sm font-black text-slate-200 mb-4">💾 إنشاء نسخة احتياطية جديدة</h4>
            <div className="space-y-3 mb-4">
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5">اسم النسخة</label><input type="text" value={backupName} onChange={e => setBackupName(e.target.value)} placeholder="مثال: نسخة نهاية الأسبوع" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50" dir="rtl" /></div>
              <div><label className="block text-[10px] font-bold text-slate-400 mb-1.5">وصف (اختياري)</label><input type="text" value={backupDesc} onChange={e => setBackupDesc(e.target.value)} placeholder="ملاحظات عن النسخة..." className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:border-amber-500/50" dir="rtl" /></div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs transition-all cursor-pointer">إلغاء</button>
              <button onClick={handleSave} className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer active:scale-95"><Save className="w-3.5 h-3.5 inline ml-1" />حفظ</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {backups.map(bp => (
          <div key={bp.id} className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-3 hover:border-slate-700 transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400"><Database className="w-4 h-4" /></div>
              <div>
                <p className="text-sm font-bold text-slate-200">{bp.name}</p>
                <p className="text-[10px] text-slate-500">{new Date(bp.date).toLocaleDateString("ar-LY")} {bp.description ? `· ${bp.description}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => handleRestore(bp.dataJson, bp.name)} className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 font-bold text-[10px] transition-all cursor-pointer flex items-center gap-1"><RotateCcw className="w-3 h-3" /><span>استعادة</span></button>
              <button onClick={() => handleDelete(bp.id)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-all cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {backups.length === 0 && <p className="text-center text-slate-500 text-xs py-6">لا توجد نسخ احتياطية بعد</p>}
      </div>
    </div>
  );
}

// ════════════════ 6. SECTION LABELS ════════════════
function SectionLabels({ state, onUpdateState }: { state: ERPState; onUpdateState: (s: ERPState) => void }) {
  const labels = state.sectionLabels || {};
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (key: string) => { setEditingKey(key); setEditValue(labels[key] || SECTION_KEYS.find(s => s.key === key)?.defaultLabel || key); };
  const saveEdit = (key: string) => {
    const newLabels = { ...labels, [key]: editValue.trim() || SECTION_KEYS.find(s => s.key === key)?.defaultLabel || key };
    onUpdateState({ ...state, sectionLabels: newLabels });
    setEditingKey(null);
  };
  const resetLabel = (key: string) => {
    const newLabels = { ...labels };
    delete newLabels[key];
    onUpdateState({ ...state, sectionLabels: newLabels });
  };

  return (
    <div>
      <h3 className="text-sm font-black text-slate-200 mb-4 flex items-center gap-2"><Tag className="w-4 h-4 text-amber-400" /><span>تسمية الأقسام</span></h3>
      <p className="text-[10px] text-slate-500 mb-5">غيّر أسماء الأقسام كما تظهر في القائمة الجانبية. الاسم الافتراضي سيُستخدم إذا تركت الحقل فارغاً.</p>
      <div className="space-y-1.5">
        {SECTION_KEYS.map(s => (
          <div key={s.key} className="flex items-center justify-between bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-2.5 hover:border-slate-700 transition-all group">
            {editingKey === s.key ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="text" value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 bg-slate-800 border border-amber-500/50 rounded-lg px-3 py-1.5 text-sm text-white font-bold focus:outline-none" dir="rtl" autoFocus />
                <button onClick={() => saveEdit(s.key)} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditingKey(null)} className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 transition-all cursor-pointer"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <>
                <div>
                  <span className="text-[10px] text-slate-500 block mb-0.5">{s.key}</span>
                  <span className="text-sm font-bold text-slate-200">{labels[s.key] || s.defaultLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(s.key)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all cursor-pointer" title="تعديل"><Edit3 className="w-3.5 h-3.5" /></button>
                  {labels[s.key] && <button onClick={() => resetLabel(s.key)} className="p-2 rounded-lg bg-slate-800 hover:bg-amber-900/30 text-slate-400 hover:text-amber-400 transition-all cursor-pointer" title="استعادة الافتراضي"><RotateCcw className="w-3.5 h-3.5" /></button>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════ MAIN COMPONENT ════════════════
export default function ComprehensiveSettings({ state, currentUser, onUpdateState, onUpdateCurrentSession }: Props) {
  const [activeSection, setActiveSection] = useState<SubSection | null>(null);

  return (
    <div className="w-full" dir="rtl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20"><Settings className="w-5 h-5 text-white" /></div>
        <div>
          <h2 className="text-lg font-black text-slate-100">⚙️ الإعدادات الشاملة</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">لوحة التحكم الكاملة — كل إعدادات المنظومة في مكان واحد</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeSection === null ? (
          <motion.div key="grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {subSections.map((section) => (
              <button key={section.id} onClick={() => setActiveSection(section.id)} className="group relative flex flex-col items-start gap-3 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer text-right shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 group-hover:border-amber-500/30 flex items-center justify-center text-slate-400 group-hover:text-amber-400 transition-all duration-200">{section.icon}</div>
                <div className="relative pr-0.5">
                  <div className="flex items-center gap-2"><span className="text-sm font-black text-slate-200 group-hover:text-white transition-colors">{section.label}</span><ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all duration-200" /></div>
                  <p className="text-[10px] text-slate-500 group-hover:text-slate-400 mt-1 leading-relaxed">{section.description}</p>
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div key={activeSection} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <button onClick={() => setActiveSection(null)} className="mb-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all cursor-pointer border border-slate-700 hover:border-slate-600 active:scale-95"><ArrowRight className="w-4 h-4 rotate-180" /><span>العودة للإعدادات الشاملة</span></button>
            {activeSection === "employees" && <EmployeeManagement state={state} currentUser={currentUser} onUpdateState={onUpdateState} onUpdateCurrentSession={onUpdateCurrentSession} />}
            {activeSection === "password" && <PasswordChange state={state} currentUser={currentUser} onUpdateState={onUpdateState} onUpdateCurrentSession={onUpdateCurrentSession} />}
            {activeSection === "customers" && <CustomerManagement state={state} onUpdateState={onUpdateState} />}
            {activeSection === "companies" && <CompanyManagement state={state} onUpdateState={onUpdateState} />}
            {activeSection === "backup" && <BackupSection state={state} onUpdateState={onUpdateState} />}
            {activeSection === "sections" && <SectionLabels state={state} onUpdateState={onUpdateState} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
