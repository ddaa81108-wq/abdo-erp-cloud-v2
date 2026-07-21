import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from "xlsx";
import { Landmark, UserCheck, Inbox, FolderArchive, ShoppingBag, ShieldCheck, Database, Search, FileDown, CircleAlert as AlertCircle, FileSpreadsheet, Bell, Info, LogOut, Settings, Shield, X, Menu } from "lucide-react";
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

import {
  ERPState,
  INITIAL_ERP_STATE,
  DebtTransaction,
  Customer,
  CustomerCycle,
  PurchaseRecord,
  User,
} from "./types";
import { db, auth } from "./firebase";

// Import subcomponents
import AlertCenter from "./components/AlertCenter";
import { VoiceInputButton } from "./components/VoiceInputButton";
import GlobalSearch from "./components/GlobalSearch";
import BackupCenter from "./components/BackupCenter";
import ExcelImporter from "./components/ExcelImporter";
import ImageExporter from "./components/ImageExporter";
import LoginScreen from "./components/LoginScreen";
import SettingsModule from "./components/SettingsModule";
import { copyCustomCardImage } from "./utils/imageExporterUtils";

// Import modules
import CustomerDebtsModule from "./components/CustomerDebtsModule";
import CompaniesModule from "./components/CompaniesModule";
import TreasuryModule from "./components/TreasuryModule";
import PurchasesModule from "./components/PurchasesModule";
import DepositsModule from "./components/DepositsModule";
import AdvancesModule from "./components/AdvancesModule";
import MerchantsModule from "./components/MerchantsModule";
import TransactionLogModule from "./components/TransactionLogModule";
import TrashCanModule from "./components/TrashCanModule";
import MailManualModule from "./components/MailManualModule";
import FinancialReportsModule from "./components/FinancialReportsModule";
import PdfExportModule from "./components/PdfExportModule";

export default function App() {
  // 🔄 Multi-device sync: loading state only, localStorage as fallback
  const [isLoading, setIsLoading] = useState(true);
  const [isOnlineMode, setIsOnlineMode] = useState(false);

  const [state, setState] = useState<ERPState>(() => {
    const tryLocal = localStorage.getItem("ABDO_ERP_V2_DATA");
    if (tryLocal) {
      try {
        const parsed = JSON.parse(tryLocal);
        if (parsed && typeof parsed === "object") return parsed;
      } catch (e) {}
    }
    return INITIAL_ERP_STATE;
  });

  // 👥 Active session details
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem("ABDO_ERP_V2_ACTIVE_USER");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (err) {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<string>("debts");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  type AppTheme =
    | "banker-light"
    | "royal-dark"
    | "corporate-navy"
    | "graphite-gray"
    | "terminal-market";
  const [appTheme, setAppTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem("ABDO_ERP_THEME") as AppTheme) || "banker-light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appTheme);
  }, [appTheme]);

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const handleToggleTheme = () => setIsThemeModalOpen(true);

  const [showExcelImportModal, setShowExcelImportModal] = useState(false);
  const [showGlobSearch, setShowGlobSearch] = useState(false);
  const [searchPreFilter, setSearchPreFilter] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  const [showImageExportModal, setShowImageExportModal] = useState(false);
  const [exportSectionTitle, setExportSectionTitle] = useState("");
  const [showCustomCardModal, setShowCustomCardModal] = useState(false);
  const [customCardValue, setCustomCardValue] = useState("");

  const [exportMetrics, setExportMetrics] = useState({
    label1: "", value1: "", label2: "", value2: "", label3: "", value3: "",
  });
  const [exportHeaders, setExportHeaders] = useState<string[]>([]);
  const [exportRows, setExportRows] = useState<any[][]>([]);
  const [exportFooterMetrics, setExportFooterMetrics] = useState<any[] | undefined>(undefined);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showSeedBannerConfirm, setShowSeedBannerConfirm] = useState(false);
  const [showCustomToast, setShowCustomToast] = useState("");

  type PendingDeletion = {
    id: string;
    type: 'customer' | 'company' | 'merchant' | 'deposit' | 'transaction';
    displayName: string;
    timestamp: number;
    timerId: ReturnType<typeof setTimeout>;
  };
  const [pendingDeletions, setPendingDeletions] = useState<PendingDeletion[]>([]);
  const [undoToast, setUndoToast] = useState<{id: string; name: string; countdown: number} | null>(null);

  const scheduleDeletion = (
    type: PendingDeletion['type'],
    itemId: string,
    displayName: string,
    executeDeletion: () => void
  ) => {
    const timerId = setTimeout(() => {
      executeDeletion();
      setPendingDeletions(prev => prev.filter(p => p.id !== itemId));
      setUndoToast(null);
    }, 10000);

    const pending: PendingDeletion = { id: itemId, type, displayName, timestamp: Date.now(), timerId };
    setPendingDeletions(prev => [...prev, pending]);
    setUndoToast({ id: itemId, name: displayName, countdown: 10 });

    const countdownInterval = setInterval(() => {
      setUndoToast(prev => {
        if (!prev || prev.id !== itemId) {
          clearInterval(countdownInterval);
          return null;
        }
        if (prev.countdown <= 1) {
          clearInterval(countdownInterval);
          return null;
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(timerId);
    };
  };

  const cancelDeletion = (itemId: string) => {
    setPendingDeletions(prev => {
      const pending = prev.find(p => p.id === itemId);
      if (pending) clearTimeout(pending.timerId);
      return prev.filter(p => p.id !== itemId);
    });
    setUndoToast(null);
  };

  const isPendingDeletion = (itemId: string) => pendingDeletions.some(p => p.id === itemId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
      if (!keys.includes(e.key)) return;

      const target = e.target as HTMLElement;
      if (
        !["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
        (target as HTMLInputElement).disabled ||
        (target as HTMLInputElement).readOnly ||
        (target as HTMLInputElement).type === "hidden"
      ) return;

      const focusableElements = Array.from(
        document.querySelectorAll(
          'input:not([disabled]):not([readonly]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
        )
      ) as HTMLElement[];

      const index = focusableElements.indexOf(target);
      if (index === -1) return;

      let nextElement: HTMLElement | null = null;
      const rect = target.getBoundingClientRect();

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
            const input = target as HTMLInputElement;
            let shouldNavigate = false;
            try {
              const start = input.selectionStart;
              const end = input.selectionEnd;
              const len = input.value?.length || 0;
              
              if (start !== null && end !== null) {
                  if (start === 0 && end === len && len > 0) {
                      shouldNavigate = true;
                  } else if (start === end) {
                      if (start === 0 && e.key === "ArrowRight") shouldNavigate = true;
                      if (start === len && e.key === "ArrowLeft") shouldNavigate = true;
                      if (len === 0) shouldNavigate = true;
                  }
              } else {
                  shouldNavigate = true;
              }
            } catch (err) {
               shouldNavigate = true;
            }
            if (!shouldNavigate) return;
        }
      }

      e.preventDefault();

      if (e.key === "Enter") {
        nextElement = focusableElements[index + 1] || focusableElements[0];
      } else {
         let nearestDistance = Infinity;
         
         focusableElements.forEach(el => {
           if (el === target) return;
           const elRect = el.getBoundingClientRect();
           let isMatch = false;
           let distance = Infinity;
           
           const xCenterDiff = Math.abs((rect.left + rect.width / 2) - (elRect.left + elRect.width / 2));
           const yCenterDiff = Math.abs((rect.top + rect.height / 2) - (elRect.top + elRect.height / 2));
           
           if (e.key === "ArrowUp") {
             if (elRect.bottom <= rect.top + 5 && xCenterDiff < 80) {
               isMatch = true;
               distance = Math.abs(rect.top - elRect.bottom) + xCenterDiff;
             }
           } else if (e.key === "ArrowDown") {
             if (elRect.top >= rect.bottom - 5 && xCenterDiff < 80) {
               isMatch = true;
               distance = Math.abs(elRect.top - rect.bottom) + xCenterDiff;
             }
           } else if (e.key === "ArrowLeft") {
             if (elRect.left < rect.left && yCenterDiff < 30) {
               isMatch = true;
               distance = Math.abs(rect.left - elRect.right) + yCenterDiff;
             }
           } else if (e.key === "ArrowRight") {
             if (elRect.right > rect.right && yCenterDiff < 30) {
               isMatch = true;
               distance = Math.abs(elRect.left - rect.right) + yCenterDiff;
             }
           }

           if (isMatch && distance < nearestDistance) {
             nearestDistance = distance;
             nextElement = el;
           }
         });
         
         if (!nextElement) {
           if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
             nextElement = focusableElements[index + 1] || focusableElements[0];
           } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
             nextElement = focusableElements[index - 1] || focusableElements[focusableElements.length - 1];
           }
         }
      }

      if (nextElement) {
        nextElement.focus();
        if (nextElement instanceof HTMLInputElement || nextElement instanceof HTMLTextAreaElement) {
          try { nextElement.select(); } catch(err){}
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const syncTimeoutRef = useRef<any>(null);

  // 1. Firebase Synchronization Core
  useEffect(() => {
    let unmounted = false;
    if (!db) return;

    const docRef = doc(db, "erp_system", "main_state");
    const unsubscribe = onSnapshot(
      docRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ERPState;
          if (!data.users || data.users.length === 0) data.users = INITIAL_ERP_STATE.users;
          if (!data.merchants) data.merchants = INITIAL_ERP_STATE.merchants || [];
          if (!data.merchantTransactions) data.merchantTransactions = INITIAL_ERP_STATE.merchantTransactions || [];
          if (!data.companies) data.companies = INITIAL_ERP_STATE.companies || [];
          if (!data.companyTransactions) data.companyTransactions = INITIAL_ERP_STATE.companyTransactions || [];

          if (data.merchants && Array.isArray(data.merchants) && data.merchants.length > 0) {
            data.companies.push(
              ...data.merchants.map((m) => ({ ...m, id: m.id.replace("mer_", "comp_") })),
            );
            if (data.merchantTransactions && Array.isArray(data.merchantTransactions)) {
              data.companyTransactions.push(
                ...data.merchantTransactions.map((tx) => ({
                  ...tx,
                  id: tx.id.replace("tx_m_", "tx_c_"),
                  companyId: tx.merchantId.replace("mer_", "comp_"),
                  type: (tx.type === "debt" ? "purchase_invoice" : tx.type) as "payment" | "purchase_invoice",
                })),
              );
            }
            data.merchants = [];
            data.merchantTransactions = [];
            await setDoc(docRef, data, { merge: true });
          }

          if (!data.trustDeposits) data.trustDeposits = INITIAL_ERP_STATE.trustDeposits || [];
          if (!data.purchases) data.purchases = INITIAL_ERP_STATE.purchases || [];
          if (!data.egyptianCashRecords) data.egyptianCashRecords = [];

          if (!unmounted) {
            setIsLoading(false);
            setIsOnlineMode(true);
            setState((current) => JSON.stringify(current) === JSON.stringify(data) ? current : data);
            try { localStorage.setItem("ABDO_ERP_V2_DATA", JSON.stringify(data)); } catch (e) {}
          }
        } else {
          const tryLocal = localStorage.getItem("ABDO_ERP_V2_DATA");
          let initialData = INITIAL_ERP_STATE;
          if (tryLocal) {
            try {
              const parsed = JSON.parse(tryLocal);
              if (parsed && parsed.customers) initialData = parsed;
            } catch (e) {}
          }
          await setDoc(docRef, initialData, { merge: true });
          if (!unmounted) {
            setIsLoading(false);
            setIsOnlineMode(true);
            setState(initialData);
          }
        }
      },
      (err) => {
        console.error("Firebase sync error:", err);
        if (!unmounted) setIsLoading(false);
      },
    );

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  // 2. إنشاء مستخدم Admin افتراضي إذا لم يكن هناك مستخدمين (Seed)
  useEffect(() => {
    const seedInitialAdmin = async () => {
      if (!db || !auth) return;
      
      try {
        const usersCol = collection(db, "users");
        const snapshot = await getDocs(usersCol);
        
        if (snapshot.empty) {
          console.log("No users found. Seeding initial admin...");
          const defaultEmail = "admin@abdocash121.com";
          const defaultPassword = "Abdo@121Secure!";
          
          const userCred = await createUserWithEmailAndPassword(auth, defaultEmail, defaultPassword);
          const newAdmin: User = {
            id: userCred.user.uid,
            username: defaultEmail,
            role: "admin",
            permissions: {
              canViewDebts: true,
              canViewCompanies: true,
              canViewTreasury: true,
              canViewPurchases: true,
              canViewDeposits: true,
              canViewBackup: true,
              canManageUsers: true,
              canDeleteRecords: true,
              canViewAdvances: true
            }
          };
          
          await setDoc(doc(db, "users", userCred.user.uid), newAdmin);
          console.log("Initial admin created successfully.");
        }
      } catch (error) {
        console.error("Failed to seed initial admin:", error);
      }
    };

    seedInitialAdmin();
  }, []);

  // 🛡️ SECURE THE SYNC FUNCTION
  const updateStateAndSync = async (newState: ERPState) => {
    const cleanedState = JSON.parse(JSON.stringify(newState));
    setState(cleanedState);

    try {
      localStorage.setItem("ABDO_ERP_V2_DATA", JSON.stringify(cleanedState));
    } catch (e) {
      console.error("Local storage save failed", e);
    }

    if (db) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          await setDoc(doc(db, "erp_system", "main_state"), cleanedState, { merge: true });
        } catch (err) {
          console.error("Failed to sync to Firebase", err);
        }
      }, 500);
    }
  };

  const handleExportAllToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const customersData = state.customers.map((c) => {
        const activeCycle = state.cycles.find(cy => cy.customerId === c.id && cy.status === "active");
        return {
          "معرف الزبون": c.id,
          "اسم الزبون بالكامل": c.name,
          الهاتف: c.phone || "غير مسجل",
          "تاريخ الانضمام والتسجيل": c.createdAt ? new Date(c.createdAt).toLocaleDateString("ar-LY") : "---",
          "الحالة الحالية": c.isDeleted ? "مؤرشف بالمهملات" : "نشط جاري",
          "الدين المتبقي الحالي (د.ل)": activeCycle ? activeCycle.currentBalance : 0,
        };
      });
      const wsCustomers = XLSX.utils.json_to_sheet(customersData);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "ديون العملاء والزبائن");

      const companiesData = state.companies.map((c) => ({
        "معرف الشركة": c.id,
        "اسم الجهة الموردة": c.name,
        "هاتف التواصل": c.contact || "غير مسجل",
        "القيمة السابقة (د.ل)": c.previousBalance || 0,
        "فواتير جديدة اليوم (د.ل)": c.newDebt || 0,
        "المدفوع والمسدد اليوم (د.ل)": c.paymentToday || 0,
        "صافي الدين المتبقي (د.ل)": c.balance || 0,
        "حالة الأرشيف": c.isDeleted ? "مؤرشف بالمهملات" : "نشط بالدفتر",
      }));
      const wsCompanies = XLSX.utils.json_to_sheet(companiesData);
      XLSX.utils.book_append_sheet(wb, wsCompanies, "حسابات الشركات والموردين");

      const merchantsData = state.merchants.map((m) => ({
        "معرف التاجر": m.id,
        "اسم التاجر": m.name,
        "هاتف التواصل": m.contact || "غير مسجل",
        "القيمة السابقة د.ل": m.previousBalance || 0,
        "سحوبات جديدة اليوم د.ل": m.newDebt || 0,
        "المدفوع اليوم د.ل": m.paymentToday || 0,
        "صافي الدين المترصد د.ل": m.balance || 0,
        "حالة الأرشيف": m.isDeleted ? "مؤرشف بالمهملات" : "نشط جاري",
      }));
      const wsMerchants = XLSX.utils.json_to_sheet(merchantsData);
      XLSX.utils.book_append_sheet(wb, wsMerchants, "دفتر كشوفات التجار");

      const purchasesData = state.purchases.map((p) => ({
        "رقم الفاتورة المعتمة": p.referenceNo,
        "تاريخ الاعتماد المالي": p.date ? new Date(p.date).toLocaleDateString("ar-LY") : "---",
        "اسم الصنف وتفاصيله": p.itemName,
        "الكمية الواردة": p.quantity,
        "سعر المفرد المحاسبي": p.unitPrice,
        "الإجمالي بالعملة الأصلية": p.totalPrice,
        "المعدل للعملة المحلية (د.ل)": p.conversionRate || 1.0,
        "الإجمالي المعادل بالليبي (د.ل)": p.totalPrice * (p.conversionRate || 1.0),
        "حالة الخزينة": p.postedToTreasury ? "✓ تم ترحيلها والخصم" : "سداد خارجي فوري",
      }));
      const wsPurchases = XLSX.utils.json_to_sheet(purchasesData);
      XLSX.utils.book_append_sheet(wb, wsPurchases, "مشتريات وفواتير اليوم");

      const depositsData = state.trustDeposits.map((d) => ({
        "رقم الأمانة": d.referenceNo,
        "اسم العميل المودع": d.customerName,
        "القيمة بالدينار الليبي د.ل": d.amountLyd,
        "القيمة بالجنيه المصري": d.amountEgp,
        "تاريخ الإيداع": d.date ? new Date(d.date).toLocaleDateString("ar-LY") : "---",
        "الحالة المحاسبية الحالية": d.status === "held" ? "محتجزة بالصندوق 🛡️" : d.status === "refunded" ? "مسترجعة للعميل ✕" : "مسواة ومقاصة لدفتر ديونه ✓",
        "البيان والشرح": d.note,
      }));
      const wsDeposits = XLSX.utils.json_to_sheet(depositsData);
      XLSX.utils.book_append_sheet(wb, wsDeposits, "الأمانات وودائع الزباين");

      XLSX.writeFile(wb, `ABDO_MULTY_LEDGER_MASTER_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`);
      alert("🎉 تم توليد وتصدير ملف الإكسل الشامل لكافة صفحات كشوفات وحركات المنظومة بنجاح!");
    } catch (error: any) {
      console.error(error);
      alert("⚠️ حصل خطأ أثناء ترحيل وتصدير البيانات لملف الإكسل: " + error.message);
    }
  };

  const handleRestoreState = (newState: ERPState) => updateStateAndSync(newState);
  const handleSaveBackupPoint = (name: string, description: string) => {
    const newPoint = { id: `point_${Date.now()}`, name, date: new Date().toISOString(), description, dataJson: JSON.stringify(state) };
    updateStateAndSync({ ...state, backupPoints: [...state.backupPoints, newPoint] });
  };
  const handleDeleteBackupPoint = (id: string) => {
    updateStateAndSync({ ...state, backupPoints: state.backupPoints.filter((p) => p.id !== id) });
  };

  const postUnpostedPurchaseFromAlert = (purchaseId: string) => {
    const purchase = state.purchases.find((p) => p.id === purchaseId);
    if (!purchase) return;
    const updatedPurchases = state.purchases.map((p) => p.id === purchaseId ? { ...p, postedToTreasury: true } : p);
    updateStateAndSync({ ...state, purchases: updatedPurchases });
    alert(`تم بنجاح ترحيل واعتمـــاد مشتريات ${purchase.itemName}.`);
  };

  const handleExcelImportComplete = (newState: ERPState) => updateStateAndSync(newState);

  const handleOpenExporter = (title: string, metrics: any, headers: string[] = [], rows: any[][] = [], imageType?: "full" | "table" | "card", footerMetrics?: any[]) => {
    setExportSectionTitle(title);
    setExportMetrics(metrics);
    setExportHeaders(headers);
    setExportRows(rows);
    setExportFooterMetrics(footerMetrics);
    setShowImageExportModal(true);
  };

  const handleNavigateFromItem = (tab: string, filterText: string) => {
    setActiveTab(tab);
    setSearchPreFilter(filterText);
    setGlobalSearchQuery(filterText);
    setShowGlobSearch(false);
  };

const handleLoginSuccess = (user: User) => {
    // 🛡️ درع الحماية المعكوس: نجلب بيانات الفايربيس أولاً، ثم نفرض سيطرتنا بالقيم الآمنة
    const secureUser: User = {
      ...user,
      permissions: {
        ...(user.permissions || {}),        // 1. نقرأ ما في الفايربيس أولاً
        canViewDebts: true,                 // 2. نفرض سيطرتنا ونضمن ظهور الأقسام
        canViewCompanies: true,
        canViewTreasury: true,              // ✅ الخزنة مضمونة الظهور
        canViewPurchases: true,             // ✅ المشتريات مضمونة الظهور
        canViewDeposits: true,
        canViewAdvances: true,
        canViewBackup: true,
        canViewArchive: true,
      }
    };

    setCurrentUser(secureUser);
    sessionStorage.setItem("ABDO_ERP_V2_ACTIVE_USER", JSON.stringify(secureUser));
    
    // تحديد أول قسم مسموح به للفتح تلقائياً
    const allowed = [
      { id: "debts", enabled: secureUser.permissions.canViewDebts },
      { id: "companies", enabled: secureUser.permissions.canViewCompanies },
      { id: "treasury", enabled: secureUser.permissions.canViewTreasury },
      { id: "purchases", enabled: secureUser.permissions.canViewPurchases },
      { id: "deposits", enabled: secureUser.permissions.canViewDeposits },
      { id: "backup", enabled: secureUser.permissions.canViewBackup },
      { id: "settings", enabled: true },
    ];
    
    const firstTab = allowed.find((t) => t.enabled);
    setActiveTab(firstTab ? firstTab.id : "settings");
  };

  const handleLogout = () => setShowLogoutConfirm(true);
  const executeLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem("ABDO_ERP_V2_ACTIVE_USER");
    setShowLogoutConfirm(false);
  };

  const triggerCustomToast = (msg: string) => {
    setShowCustomToast(msg);
    setTimeout(() => setShowCustomToast(""), 4500);
  };

  const executeDataSeed = () => {
    updateStateAndSync(INITIAL_ERP_STATE);
    setShowSeedConfirm(false);
    triggerCustomToast("👑 تم تعبئة البيانات النموذجية للزبائن والشركات بنجاح!");
  };

  const executeSeedBanner = () => {
    updateStateAndSync(INITIAL_ERP_STATE);
    setShowSeedBannerConfirm(false);
    triggerCustomToast("👑 تم تهيئة قاعدة المعطيات وتنزيل عينة محرك الدفاتر بنجاح!");
  };

  const handleUpdateCurrentSession = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    sessionStorage.setItem("ABDO_ERP_V2_ACTIVE_USER", JSON.stringify(updatedUser));
  };

  // 🌀 Loading screen
  if (isLoading && !isOnlineMode) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6 font-sans" dir="rtl">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-600 border-t-indigo-500"></div>
        <h2 className="text-white text-xl font-extrabold">جاري تحميل المنظومة...</h2>
        <p className="text-slate-400 text-sm">يتم الاتصال بقاعدة البيانات الآمنة. يرجى الانتظار.</p>
      </div>
    );
  }

  // 🛡️ SECURE LOGIN SCREEN RENDERING
  if (!currentUser) {
    return (
      <LoginScreen onLoginSuccess={handleLoginSuccess} />
    );
  }

  const getThemeButtonConfig = () => {
    switch (appTheme) {
      case "royal-dark": return { icon: "👑", label: "التيتانيوم الأسود", bg: "bg-[#141414] hover:bg-[#222222] text-[#d4af37] border-[#333333]" };
      case "corporate-navy": return { icon: "🏦", label: "الأزرق المؤسسي", bg: "bg-[#0f172a] hover:bg-[#1e293b] text-[#38bdf8] border-[#1e293b]" };
      case "graphite-gray": return { icon: "⚙️", label: "رمادي جرافيت", bg: "bg-[#2d2d2d] hover:bg-[#404040] text-[#fbbf24] border-[#404040]" };
      case "terminal-market": return { icon: "📈", label: "شاشة التداول", bg: "bg-[#111111] hover:bg-[#222222] text-[#10b981] border-[#222222]" };
      case "banker-light":
      default: return { icon: "☀️", label: "الوضع النهاري", bg: "bg-white hover:bg-slate-50 text-slate-900 border-slate-200" };
    }
  };

  const themeBtnData = getThemeButtonConfig();

  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-600 selection:text-white transition-colors duration-300`} dir="rtl">
      <header className={`bg-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-indigo-950 transition-all duration-300 ${isSidebarOpen ? "lg:pr-[210px]" : ""}`}>
        <div className="w-full px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 leading-none">
                <span>نظام الإدارة الشامل 📊</span>
                <span className="text-[9px] bg-emerald-600 text-white font-bold font-mono px-1.5 py-0.2 rounded-full leading-normal">مستقر ✓</span>
              </h1>
            </div>
          </div>

          <div className="relative w-full md:w-64 shrink-0 mx-2">
            <input
              type="text"
              placeholder="🔍 البحث الشامل..."
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              className="w-full text-right text-xs pr-9 pl-8 py-2 bg-slate-800 hover:bg-slate-750/90 focus:bg-slate-750 border border-slate-700 hover:border-slate-600 focus:border-indigo-550 rounded-xl text-white font-sans placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
              dir="rtl"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
              <VoiceInputButton onResult={(text) => setGlobalSearchQuery(text)} className="bg-slate-700 text-slate-300 hover:bg-slate-600 border-none scale-90" />
              {globalSearchQuery && (
                <button onClick={() => setGlobalSearchQuery("")} className="text-slate-400 hover:text-white rounded-full hover:bg-slate-700 p-1 flex items-center justify-center" title="تصفير البحث ✕">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {globalSearchQuery && (
              <div className="absolute top-full right-0 w-[90vw] md:w-[600px] mt-2 z-50">
                <GlobalSearch state={state} searchQuery={globalSearchQuery} onNavigateToItem={handleNavigateFromItem} onClose={() => setGlobalSearchQuery("")} />
              </div>
            )}
          </div>

          <button onClick={() => window.open("/card-generator.html", "_blank")} className="bg-amber-500 hover:bg-amber-600 text-white border border-amber-400 font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer shrink-0" title="منظومة توليد الكروت الشاملة">
            <span className="text-sm">👑</span><span>منظومة الكروت الذكية</span>
          </button>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={handleToggleTheme} className={`font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer border ${themeBtnData.bg}`} title="تغيير مظهر المنظومة">
              <span className="text-sm">{themeBtnData.icon}</span><span>{themeBtnData.label}</span>
            </button>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 px-1.5 flex items-center justify-end">
            <button id="header_exit_button" onClick={handleLogout} className="p-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-sm border border-rose-500" title="تسجيل الخروج والعودة لبوابة الدخول ✕">
              <LogOut className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      <AlertCenter state={state} onNavigateToSection={(sec) => setActiveTab(sec)} onPostPurchaseToTreasury={postUnpostedPurchaseFromAlert} />

      {state.customers.length === 0 && (
        <div className={`w-full px-4 mt-4 transition-all duration-300 ${isSidebarOpen ? "lg:pr-[210px]" : ""}`}>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-right flex flex-col md:flex-row items-center justify-between gap-3 text-amber-900 shadow-sm" dir="rtl">
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce shrink-0">💡</span>
              <div>
                <h4 className="font-extrabold text-xs text-amber-950">تنبيه: قاعدة البيانات المحاسبية فارغة حالياً!</h4>
                <p className="text-[11px] mt-0.5 text-amber-800 leading-normal">بدأ التطبيق بملف تخزين فارغ نظراً لذاكرة متصفحك. يرجى تهيئة وشحن البيانات المحاسبية النموذجية...</p>
              </div>
            </div>
            <button onClick={() => setShowSeedBannerConfirm(true)} className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shrink-0 shadow-xs transition-all cursor-pointer">
              🔄 تهيئة وتنزيل البيانات الافتراضية
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
        )}
      </AnimatePresence>

      <div className={`w-full p-4 flex flex-col gap-4 transition-all duration-300 ${isSidebarOpen ? "lg:pr-[210px]" : ""}`} dir="rtl">
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }} transition={{ type: "spring", damping: 28, stiffness: 220 }} className="fixed top-0 right-0 h-screen w-[210px] bg-slate-950 shadow-2xl overflow-hidden flex flex-col justify-between border-l border-slate-900 z-50" dir="rtl">
              <div className="p-3.5 border-b border-slate-900 flex items-center justify-between bg-slate-950 shrink-0">
                <div className="text-right">
                  <span className="text-[9px] text-indigo-400 font-extrabold block uppercase tracking-widest leading-none font-mono">الدوائر المالية والمحاسبية</span>
                  <h3 className="font-extrabold text-white text-[11.5px] mt-1 leading-none">الإدارة العامة 📋</h3>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-800" title="طي الأقسام">
                  <Menu className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2 space-y-1.5 overflow-y-auto flex-1 text-right max-h-[calc(100vh-130px)] custom-scrollbar">
                {[
                  { id: "debts", label: "1. قسم ديون العملاء 👥", enabled: currentUser.permissions.canViewDebts },
                  { id: "companies", label: "2. حسابات الشركات والتجار 🏭", enabled: currentUser.permissions.canViewCompanies || currentUser.permissions.canViewDebts },
                  { id: "deposits", label: "3. قسم الأمانات 🛡️", enabled: currentUser.permissions.canViewDeposits },
                  { id: "advances", label: "4. العهد والسلفيات واليوميات 💸", enabled: currentUser.permissions.canViewAdvances !== false },
                  { id: "mail_manual", label: "5. المصراوية 🇪🇬", enabled: true },
                  { id: "purchases", label: "6. قسم المشتريات 🛒", enabled: currentUser.permissions.canViewPurchases },
                  { id: "treasury", label: "7. قسم الخزنة 💰", enabled: currentUser.permissions.canViewTreasury },
                  { id: "financial_reports", label: "8. قسم التقارير المالية 📊", enabled: true },
                  { id: "transaction_log", label: "9. سجل المعاملات الشامل 📝", enabled: true },
                  { id: "trash_can", label: "10. سلة المهملات 🗑️", enabled: true },
                  { id: "settings", label: "11. صلاحيات الموظفين ⚙️", enabled: true },
                  { id: "backup", label: "12. الاعدادات الشامله 📦", enabled: currentUser.permissions.canViewBackup },
                  { id: "export_pdf", label: "13. تصدير بي دي اف 📤", enabled: true },
                ].filter((t) => t.enabled).map((tab) => (
                  <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchPreFilter(""); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`text-right w-full text-[11px] font-extrabold px-3 py-3 rounded-lg transition-all cursor-pointer flex items-center justify-between group border relative overflow-hidden ${activeTab === tab.id ? "bg-slate-800 text-[#d4af37] border-[#d4af37]/30 shadow-md scale-[1.02]" : "text-slate-300 hover:text-white bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800"}`}>
                    {activeTab === tab.id && <div className="absolute top-0 right-0 w-1.5 h-full bg-[#d4af37]" />}
                    <span className="truncate pr-1">{tab.label}</span>
                    <span className={`text-[9px] transform transition-transform group-hover:translate-x-0.5 shrink-0 ${activeTab === tab.id ? "text-[#d4af37]" : "text-slate-600"}`}>◀</span>
                  </button>
                ))}
              </div>

              <div className="p-2.5 border-t border-slate-900 bg-slate-950/40 space-y-1.5 shrink-0" dir="rtl">
                <button type="button" onClick={() => setShowExcelImportModal(true)} className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-98 text-white font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md border border-emerald-600 shrink-0 cursor-pointer" title="تحميل كشوفات وحسابات من ملف Excel">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-white" /><span>استيراد كشوفات من Excel 📥</span>
                </button>
                <button type="button" onClick={handleExportAllToExcel} className="w-full bg-slate-900 hover:bg-slate-800 active:scale-98 text-indigo-400 hover:text-white font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md border border-slate-800 shrink-0 cursor-pointer" title="تصدير نسخة كاملة من المنظومة كملف Excel">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /><span>تصدير الحسابات Excel 📤</span>
                </button>
              </div>
              <div className="p-3 bg-slate-950/60 border-t border-slate-900 text-center text-[10px] text-slate-500 font-mono shrink-0">ABDO Multi-Ledger v2.0</div>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex-1 w-full min-h-[60vh] flex flex-col items-start gap-4">
          {!isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded-xl shadow-lg transition-all cursor-pointer hover:scale-103 flex items-center gap-1.5 focus:outline-none" title="عرض شريط الأقسام الجانبي">
              <Menu className="w-4 h-4 text-indigo-300" /><span className="text-[11px] font-bold">توسيع الأقسام المحاسبية ◀</span>
            </button>
          )}

          <main className="flex-1 w-full min-h-[60vh] transition-all">
            <div className="transition-all">
              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
                  {activeTab === "debts" && <CustomerDebtsModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} searchQuery={globalSearchQuery} pendingDeletions={pendingDeletions.map(p => p.id)} onScheduleDeletion={scheduleDeletion} onCancelDeletion={cancelDeletion} />}
                  {activeTab === "companies" && <CompaniesModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} searchQuery={globalSearchQuery} pendingDeletions={pendingDeletions.map(p => p.id)} onScheduleDeletion={scheduleDeletion} onCancelDeletion={cancelDeletion} />}
                  {activeTab === "merchants" && <MerchantsModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} searchQuery={globalSearchQuery} pendingDeletions={pendingDeletions.map(p => p.id)} onScheduleDeletion={scheduleDeletion} onCancelDeletion={cancelDeletion} />}
                  {activeTab === "treasury" && <TreasuryModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} />}
                  {activeTab === "mail_manual" && <MailManualModule state={state} onUpdateState={updateStateAndSync} />}
                  {activeTab === "financial_reports" && <FinancialReportsModule state={state} onOpenExporter={handleOpenExporter} />}
                  {activeTab === "purchases" && <PurchasesModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} />}
                  {activeTab === "deposits" && <DepositsModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} pendingDeletions={pendingDeletions.map(p => p.id)} onScheduleDeletion={scheduleDeletion} onCancelDeletion={cancelDeletion} />}
                  {activeTab === "advances" && <AdvancesModule state={state} onUpdateState={updateStateAndSync} searchQuery={globalSearchQuery} />}
                  {activeTab === "transaction_log" && <TransactionLogModule state={state} onOpenExporter={handleOpenExporter} onUpdateState={updateStateAndSync} />}
                  {activeTab === "trash_can" && <TrashCanModule state={state} onUpdateState={updateStateAndSync} />}
                  {activeTab === "backup" && <BackupCenter state={state} onRestoreState={handleRestoreState} onSaveBackupPoint={handleSaveBackupPoint} onDeleteBackupPoint={handleDeleteBackupPoint} />}
                  {activeTab === "settings" && <SettingsModule state={state} currentUser={currentUser} onUpdateState={updateStateAndSync} onUpdateCurrentSession={handleUpdateCurrentSession} />}
                  {activeTab === "export_pdf" && <PdfExportModule state={state} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      {showExcelImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl border border-slate-200 shadow-2xl overflow-hidden p-3 md:p-5">
            <div className="flex justify-between items-center pb-2.5 border-b-mb-3 text-right" dir="rtl">
              <span className="font-extrabold text-sm text-slate-800">📊 استيراد ومعالجة ملفات الإكسل</span>
              <button id="close-excel-modal" onClick={() => setShowExcelImportModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-3 py-1.5 rounded-full text-xs transition">إغلاق ✕</button>
            </div>
            <ExcelImporter state={state} onImportComplete={handleExcelImportComplete} onClose={() => setShowExcelImportModal(false)} />
          </div>
        </div>
      )}

      {showCustomCardModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-l from-amber-500 to-amber-600 p-5 flex items-center justify-between">
              <h3 className="font-extrabold text-white text-lg flex items-center gap-2"><span>👑</span><span>قالب سعر الأهرام 3D</span></h3>
              <button onClick={() => setShowCustomCardModal(false)} className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-full transition-all"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">السعر الجديد</label>
                <input type="number" step="any" value={customCardValue} onChange={(e) => setCustomCardValue(e.target.value)} placeholder="مثال: 12500" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-2xl font-black text-center font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" dir="ltr" />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button onClick={() => setShowCustomCardModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-all">إلغاء</button>
              <button onClick={async () => { if (!customCardValue) { alert("يرجى إدخال السعر أولاً."); return; } const success = await copyCustomCardImage(customCardValue); if (success) { setShowCustomCardModal(false); setCustomCardValue(""); } }} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                <span>إنشاء ونسخ الكارت</span><span>✨</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showImageExportModal && (
        <ImageExporter sectionName={exportSectionTitle} activeCurrency="دينار ليبي د.ل" metrics={exportMetrics} tableHeaders={exportHeaders} tableRows={exportRows} footerMetrics={exportFooterMetrics} onClose={() => setShowImageExportModal(false)} />
      )}

      <footer className="bg-slate-900 text-slate-500 text-center px-6 border-t border-slate-950 mt-12 text-xs">
        <p className="font-mono">ABDO ERP MULTI-LEDGER V2 • CODENAME ANTIGRAVITY SECURITY SYSTEM</p>
        <p className="font-sans mt-1">جميع الحقوق محفوظة للمطورين. لا تظهر معلومات الحساب غير المسجلين بالشاشة.</p>
      </footer>

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 shadow-2xl" dir="rtl">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] p-6 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0"><LogOut className="w-5 h-5" /></div>
              <div>
                <h3 className="font-extrabold text-[#f1f5f9] text-sm">تأكيد إنهاء الجلسة والخروج</h3>
                <p className="text-[10px] text-slate-400 font-semibold">بوابة الأمان والتدقيق الحركي لعام 2100</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold mb-6">هل أنت متأكد من تسجيل الخروج كلياً من دفاترك الحالية؟ سيتم تفكيك مفتاح الوصول الفردي وإعادتك مباشرةً لبوابة الدخول.</p>
            <div className="flex items-center gap-3 justify-end">
              <button type="button" onClick={executeLogout} className="flex-1 bg-gradient-to-l from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer text-center active:scale-95">تأكيد الخروج الآمن</button>
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer text-center active:scale-95">إلغاء التراجع</button>
            </div>
          </div>
        </div>
      )}

      {showSeedConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 shadow-2xl" dir="rtl">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] p-6 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0"><Database className="w-5 h-5" /></div>
              <div>
                <h3 className="font-extrabold text-[#f1f5f9] text-sm">شحن قاعدة البيانات المحاسبية</h3>
                <p className="text-[10px] text-indigo-400 font-semibold">تحميل المعطيات النموذجية التجريبية</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold mb-5">هل تود شحن المنظومة وتحميل كافة البيانات النموذجية الآن؟ <br /><strong className="text-amber-500/90 font-sans block mt-2 text-[10px]">⚠️ سيتم استبدال البيانات الحالية.</strong></p>
            <div className="flex items-center gap-3 justify-end">
              <button type="button" onClick={executeDataSeed} className="flex-1 bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95">موافق، شحن الدفاتر</button>
              <button type="button" onClick={() => setShowSeedConfirm(false)} className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95">تراجع وإلغاء</button>
            </div>
          </div>
        </div>
      )}

      {showSeedBannerConfirm && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 shadow-2xl" dir="rtl">
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] p-6 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0"><Database className="w-5 h-5" /></div>
              <div>
                <h3 className="font-extrabold text-[#f1f5f9] text-sm">تهيئة الحسابات وتفعيل محاكي الدفاتر</h3>
                <p className="text-[10px] text-amber-500 font-semibold">نظام التشغيل التلقائي بالأرصدة</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold mb-5">هل تود شحن المنظومة ببيانات العينة وتجربة كافة الميزات الآن؟</p>
            <div className="flex items-center gap-3 justify-end">
              <button type="button" onClick={executeSeedBanner} className="flex-1 bg-gradient-to-l from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-slate-950 font-black py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95">تحديث وتجربة الفوري</button>
              <button type="button" onClick={() => setShowSeedBannerConfirm(false)} className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95">إلغاء التنزيل</button>
            </div>
          </div>
        </div>
      )}

      {showCustomToast && (
        <div className="fixed bottom-6 left-6 max-w-md bg-[#0b0f19] border border-slate-800 p-4 rounded-2xl z-[99999] shadow-2xl text-right animate-slide-up flex items-center gap-3 border-l-4 border-l-emerald-500" dir="rtl">
          <div className="w-8 h-8 rounded-full bg-emerald-500/25 text-emerald-400 text-xs font-black flex items-center justify-center shrink-0">✓</div>
          <span className="text-xs font-bold text-slate-100">{showCustomToast}</span>
        </div>
      )}

      <AnimatePresence>
        {undoToast && (
          <motion.div initial={{ opacity: 0, y: 50, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 50, x: "-50%" }} transition={{ duration: 0.3 }} className="fixed bottom-6 left-1/2 z-[99999] pointer-events-auto" dir="rtl">
            <div className="bg-gradient-to-r from-rose-950 to-slate-900 border border-rose-800/50 rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4 min-w-[320px]">
              <div className="flex-1">
                <p className="text-rose-300 text-xs font-bold mb-1">تتمة الحذف...</p>
                <p className="text-white text-sm font-black truncate">{undoToast.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-rose-900/50 border-2 border-rose-600 flex items-center justify-center"><span className="text-rose-300 font-black text-lg">{undoToast.countdown}</span></div>
                <button onClick={() => cancelDeletion(undoToast.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-all active:scale-95 shadow-lg">تراجع</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isThemeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-[#0b0f19] border border-slate-800/80 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden p-6 relative">
            <button onClick={() => setIsThemeModalOpen(false)} className="absolute top-5 left-5 text-slate-400 hover:text-white p-2 bg-slate-900 rounded-full cursor-pointer hover:bg-slate-800 transition" title="إغلاق النافذة"><X className="w-5 h-5" /></button>
            <div className="text-right border-b border-white/5 pb-4 mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">🎨 اختيار مظهر لوحة التحكم والموديلات</h2>
              <p className="text-slate-400 text-xs mt-1 font-medium">الرجاء اختيار المظهر المناسب الذي ترغب في استخدامه في المنظومة (يتوفر 5 مظاهر)</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 overflow-y-auto max-h-[60vh] p-1">
              {[
                { id: "banker-light", icon: "☀️", label: "الوضع النهاري", bgThemeClass: "bg-slate-100 text-slate-800" },
                { id: "royal-dark", icon: "👑", label: "التيتانيوم الأسود", bgThemeClass: "bg-zinc-900 text-amber-500" },
                { id: "corporate-navy", icon: "🏦", label: "الأزرق المؤسسي", bgThemeClass: "bg-slate-800 text-sky-400" },
                { id: "graphite-gray", icon: "⚙️", label: "رمادي جرافيت", bgThemeClass: "bg-stone-800 text-amber-400" },
                { id: "terminal-market", icon: "📈", label: "شاشة التداول", bgThemeClass: "bg-black text-emerald-500" },
              ].map((theme) => (
                <button key={theme.id} onClick={() => { setAppTheme(theme.id as any); localStorage.setItem("ABDO_ERP_THEME", theme.id); setIsThemeModalOpen(false); }} className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 group overflow-hidden ${appTheme === theme.id ? "border-amber-500 scale-105 shadow-[0_0_20px_rgba(245,158,11,0.2)] z-10 block" : "border-slate-800/50 opacity-80 hover:opacity-100 hover:border-slate-600 block"}`}>
                  <div className={`absolute inset-0 opacity-20 group-hover:opacity-100 transition-opacity blur-xl ${theme.bgThemeClass}`}></div>
                  <div className={`absolute inset-0 ${theme.bgThemeClass} opacity-90`}></div>
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <span className={`text-4xl drop-shadow-md`}>{theme.icon}</span>
                    <span className="font-extrabold text-xs tracking-wide shadow-sm">{theme.label}</span>
                  </div>
                  {appTheme === theme.id && <div className="absolute top-2 right-2 flex bg-amber-500 text-amber-950 rounded-full w-5 h-5 items-center justify-center text-[10px] z-20">✓</div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
