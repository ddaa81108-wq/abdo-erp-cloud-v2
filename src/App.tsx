import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import {
  Landmark,
  UserCheck,
  Inbox,
  FolderArchive,
  ShoppingBag,
  ShieldCheck,
  Database,
  Search,
  FileDown,
  AlertCircle,
  FileSpreadsheet,
  Bell,
  Info,
  LogOut,
  Settings,
  Shield,
  X,
  Menu,
} from "lucide-react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

import {
  ERPState,
  INITIAL_ERP_STATE,
  DebtTransaction,
  Customer,
  CustomerCycle,
  PurchaseRecord,
  User,
} from "./types";
import { db } from "./firebase";

// Import subcomponents
import AlertCenter from "./components/AlertCenter";
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
  const [state, setState] = useState<ERPState>(() => {
    // Sync initially from LocalStorage to avoid UI jumping and ensure data availability if Firebase fails
    const tryLocal = localStorage.getItem("ABDO_ERP_V2_DATA");
    if (tryLocal) {
      try {
        const parsed = JSON.parse(tryLocal);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } catch (e) {
        // Fallback
      }
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

  // 👑 Premium Appearance Theme state
  type AppTheme =
    | "banker-light"
    | "royal-dark"
    | "corporate-navy"
    | "graphite-gray"
    | "terminal-market";
  const [appTheme, setAppTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem("ABDO_ERP_THEME") as AppTheme) || "banker-light";
  });

  // Apply CSS Variables on theme change
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appTheme);
  }, [appTheme]);

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  const handleToggleTheme = () => {
    setIsThemeModalOpen(true);
  };

  // Importer
  const [showExcelImportModal, setShowExcelImportModal] = useState(false);

  // Global search
  const [showGlobSearch, setShowGlobSearch] = useState(false);
  const [searchPreFilter, setSearchPreFilter] = useState("");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  // Image share card modal states
  const [showImageExportModal, setShowImageExportModal] = useState(false);
  const [exportSectionTitle, setExportSectionTitle] = useState("");
  
  // Custom Card Modal state
  const [showCustomCardModal, setShowCustomCardModal] = useState(false);
  const [customCardValue, setCustomCardValue] = useState("");

  const [exportMetrics, setExportMetrics] = useState({
    label1: "",
    value1: "",
    label2: "",
    value2: "",
    label3: "",
    value3: "",
  });
  const [exportHeaders, setExportHeaders] = useState<string[]>([]);
  const [exportRows, setExportRows] = useState<any[][]>([]);
  const [exportFooterMetrics, setExportFooterMetrics] = useState<
    any[] | undefined
  >(undefined);

  // States for custom confirmation dialogs & toast alerts to bypass standard iframe restrictions
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showSeedBannerConfirm, setShowSeedBannerConfirm] = useState(false);
  const [showCustomToast, setShowCustomToast] = useState("");

  // Global Keyboard Navigation (ArrowUp / ArrowDown / ArrowLeft / ArrowRight / Enter)
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

      // For Left/Right, handle internal text selection and boundaries
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
                      if (start === 0 && e.key === "ArrowRight") shouldNavigate = true; // RTL: ArrowRight goes previous
                      if (start === len && e.key === "ArrowLeft") shouldNavigate = true; // RTL: ArrowLeft goes next
                      if (len === 0) shouldNavigate = true;
                  }
              } else {
                  shouldNavigate = true;
              }
            } catch (err) {
               shouldNavigate = true; // For number inputs, etc.
            }
            if (!shouldNavigate) return; // Let default browser action handle cursor move
        }
      }

      e.preventDefault();

      if (e.key === "Enter") {
        nextElement = focusableElements[index + 1] || focusableElements[0];
      } else {
         // Spatial Search
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
           } else if (e.key === "ArrowLeft") { // Visually Left = Next Field in RTL
             if (elRect.left < rect.left && yCenterDiff < 30) {
               isMatch = true;
               distance = Math.abs(rect.left - elRect.right) + yCenterDiff;
             }
           } else if (e.key === "ArrowRight") { // Visually Right = Prev Field in RTL
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
         
         // Fallback to purely DOM array sequential movement if spatial search failed
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

  // 1. Firebase Synchronization Core
  useEffect(() => {
    let unmounted = false;

    if (!db) {
      console.error("Firebase DB not initialized!");
      return;
    }

    const docRef = doc(db, "erp_system", "main_state");

    const unsubscribe = onSnapshot(
      docRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ERPState;

          // Backfill new properties
          if (!data.users || data.users.length === 0)
            data.users = INITIAL_ERP_STATE.users;
          if (!data.merchants)
            data.merchants = INITIAL_ERP_STATE.merchants || [];
          if (!data.merchantTransactions)
            data.merchantTransactions =
              INITIAL_ERP_STATE.merchantTransactions || [];
          if (!data.companies)
            data.companies = INITIAL_ERP_STATE.companies || [];
          if (!data.companyTransactions)
            data.companyTransactions =
              INITIAL_ERP_STATE.companyTransactions || [];

          // MIGRATION: Merge merchants into companies for Firebase state
          if (
            data.merchants &&
            Array.isArray(data.merchants) &&
            data.merchants.length > 0
          ) {
            data.companies.push(
              ...data.merchants.map((m) => ({
                ...m,
                id: m.id.replace("mer_", "comp_"),
              })),
            );
            if (
              data.merchantTransactions &&
              Array.isArray(data.merchantTransactions)
            ) {
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
            // Update the migrated data back to Firestore
            await setDoc(docRef, data);
          }

          if (!data.trustDeposits)
            data.trustDeposits = INITIAL_ERP_STATE.trustDeposits || [];
          if (!data.purchases)
            data.purchases = INITIAL_ERP_STATE.purchases || [];
          if (!data.egyptianCashRecords) data.egyptianCashRecords = [];

          if (!unmounted) {
            setState(data);
            try {
              localStorage.setItem("ABDO_ERP_V2_DATA", JSON.stringify(data));
            } catch (e) {
              console.error("Local storage sync failed", e);
            }
          }
        } else {
          // First time setup in Firebase: attempt to migrate from old localStorage if exists
          const tryLocal = localStorage.getItem("ABDO_ERP_V2_DATA");
          let initialData = INITIAL_ERP_STATE;

          if (tryLocal) {
            try {
              const parsed = JSON.parse(tryLocal);
              if (parsed && parsed.customers) initialData = parsed;
            } catch (e) {}
          }

          await setDoc(docRef, initialData);
          if (!unmounted) {
            setState(initialData);
          }
        }
      },
      (err) => {
        console.error("Firebase sync error:", err);
      },
    );

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  const updateStateAndSync = async (newState: ERPState) => {
    // Strip out any undefined properties that cause Firebase setDoc to fail
    const cleanedState = JSON.parse(JSON.stringify(newState));

    // Only save to Firebase, onSnapshot will update local state. Fast optimistic update ->
    setState(cleanedState);
    
    // Save to LocalStorage as a fallback
    try {
      localStorage.setItem("ABDO_ERP_V2_DATA", JSON.stringify(cleanedState));
    } catch (e) {
      console.error("Local storage save failed", e);
    }
    
    if (db) {
      try {
        await setDoc(doc(db, "erp_system", "main_state"), cleanedState);
      } catch (err) {
        console.error("Failed to sync to Firebase", err);
      }
    }
  };

  const handleExportAllToExcel = () => {
    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // 1. Customers Sheet
      const customersData = state.customers.map((c) => {
        const activeCycle = state.cycles.find(
          (cy) => cy.customerId === c.id && cy.status === "active",
        );
        return {
          "معرف الزبون": c.id,
          "اسم الزبون بالكامل": c.name,
          الهاتف: c.phone || "غير مسجل",
          "تاريخ الانضمام والتسجيل": c.createdAt
            ? new Date(c.createdAt).toLocaleDateString("ar-LY")
            : "---",
          "الحالة الحالية": c.isDeleted ? "مؤرشف بالمهملات" : "نشط جاري",
          "الدين المتبقي الحالي (د.ل)": activeCycle
            ? activeCycle.currentBalance
            : 0,
        };
      });
      const wsCustomers = XLSX.utils.json_to_sheet(customersData);
      XLSX.utils.book_append_sheet(wb, wsCustomers, "ديون العملاء والزبائن");

      // 2. Companies Sheet
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

      // 3. Merchants Sheet
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

      // Treasury Transactions Sheet removed per instructions

      // 5. Purchases Sheet
      const purchasesData = state.purchases.map((p) => ({
        "رقم الفاتورة المعتمة": p.referenceNo,
        "تاريخ الاعتماد المالي": p.date
          ? new Date(p.date).toLocaleDateString("ar-LY")
          : "---",
        "اسم الصنف وتفاصيله": p.itemName,
        "الكمية الواردة": p.quantity,
        "سعر المفرد المحاسبي": p.unitPrice,
        "الإجمالي بالعملة الأصلية": p.totalPrice,
        "المعدل للعملة المحلية (د.ل)": p.conversionRate || 1.0,
        "الإجمالي المعادل بالليبي (د.ل)":
          p.totalPrice * (p.conversionRate || 1.0),
        "حالة الخزينة": p.postedToTreasury
          ? "✓ تم ترحيلها والخصم"
          : "سداد خارجي فوري",
      }));
      const wsPurchases = XLSX.utils.json_to_sheet(purchasesData);
      XLSX.utils.book_append_sheet(wb, wsPurchases, "مشتريات وفواتير اليوم");

      // 6. Escrow/Deposits Sheet
      const depositsData = state.trustDeposits.map((d) => ({
        "رقم الأمانة": d.referenceNo,
        "اسم العميل المودع": d.customerName,
        "القيمة بالدينار الليبي د.ل": d.amountLyd,
        "القيمة بالجنيه المصري": d.amountEgp,
        "تاريخ الإيداع": d.date
          ? new Date(d.date).toLocaleDateString("ar-LY")
          : "---",
        "الحالة المحاسبية الحالية":
          d.status === "held"
            ? "محتجزة بالصندوق 🛡️"
            : d.status === "refunded"
              ? "مسترجعة للعميل ✕"
              : "مسواة ومقاصة لدفتر ديونه ✓",
        "البيان والشرح": d.note,
      }));
      const wsDeposits = XLSX.utils.json_to_sheet(depositsData);
      XLSX.utils.book_append_sheet(wb, wsDeposits, "الأمانات وودائع الزباين");

      // Generate Excel file downstream download
      XLSX.writeFile(
        wb,
        `ABDO_MULTY_LEDGER_MASTER_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      alert(
        "🎉 تم توليد وتصدير ملف الإكسل الشامل لكافة صفحات كشوفات وحركات المنظومة بنجاح!",
      );
    } catch (error: any) {
      console.error(error);
      alert(
        "⚠️ حصل خطأ أثناء ترحيل وتصدير البيانات لملف الإكسل: " + error.message,
      );
    }
  };

  // 2. State Actions forwarded from subpanels
  const handleRestoreState = (newState: ERPState) => {
    updateStateAndSync(newState);
  };

  const handleSaveBackupPoint = (name: string, description: string) => {
    const newPoint = {
      id: `point_${Date.now()}`,
      name,
      date: new Date().toISOString(),
      description,
      dataJson: JSON.stringify(state),
    };
    updateStateAndSync({
      ...state,
      backupPoints: [...state.backupPoints, newPoint],
    });
  };

  const handleDeleteBackupPoint = (id: string) => {
    updateStateAndSync({
      ...state,
      backupPoints: state.backupPoints.filter((p) => p.id !== id),
    });
  };

  // Safe posting handlers from Alert center
  const postUnpostedPurchaseFromAlert = (purchaseId: string) => {
    const purchase = state.purchases.find((p) => p.id === purchaseId);
    if (!purchase) return;

    const rateFactor = purchase.conversionRate || 1.0;
    const equivalentLydAmount = purchase.totalPrice * rateFactor;

    const updatedPurchases = state.purchases.map((p) => {
      if (p.id === purchaseId) {
        return { ...p, postedToTreasury: true };
      }
      return p;
    });

    updateStateAndSync({
      ...state,
      purchases: updatedPurchases,
    });

    alert(`تم بنجاح ترحيل واعتمـــاد مشتريات ${purchase.itemName}.`);
  };

  // 3. Smart Excel Import Integration
  const handleExcelImportComplete = (newState: ERPState) => {
    updateStateAndSync(newState);
  };

  // 4. Multi-Page Share Card exporter launcher
  const handleOpenExporter = (
    title: string,
    metrics: {
      label1: string;
      value1: string | number;
      label2: string;
      value2: string | number;
      label3: string;
      value3: string | number;
    },
    headers: string[] = [],
    rows: any[][] = [],
    imageType?: "full" | "table" | "card",
    footerMetrics?: any[],
  ) => {
    setExportSectionTitle(title);
    setExportMetrics(metrics);
    setExportHeaders(headers);
    setExportRows(rows);
    setExportFooterMetrics(footerMetrics);
    setShowImageExportModal(true);
  };

  // Global Navigation shortcut trigger from search results
  const handleNavigateFromItem = (tab: string, filterText: string) => {
    setActiveTab(tab);
    setSearchPreFilter(filterText);
    setGlobalSearchQuery(filterText);
    setShowGlobSearch(false);
  };

  // 👥 Session authentication helpers
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    sessionStorage.setItem("ABDO_ERP_V2_ACTIVE_USER", JSON.stringify(user));

    // Auto-navigate to first available allowed module
    const allowed = [
      { id: "debts", enabled: user.permissions.canViewDebts },
      { id: "companies", enabled: user.permissions.canViewCompanies },
      { id: "treasury", enabled: user.permissions.canViewTreasury },
      { id: "purchases", enabled: user.permissions.canViewPurchases },
      { id: "deposits", enabled: user.permissions.canViewDeposits },
      { id: "backup", enabled: user.permissions.canViewBackup },
      { id: "settings", enabled: true },
    ];
    const firstTab = allowed.find((t) => t.enabled);
    if (firstTab) {
      setActiveTab(firstTab.id);
    } else {
      setActiveTab("settings");
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const executeLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem("ABDO_ERP_V2_ACTIVE_USER");
    setShowLogoutConfirm(false);
  };

  const triggerCustomToast = (msg: string) => {
    setShowCustomToast(msg);
    setTimeout(() => {
      setShowCustomToast("");
    }, 4500);
  };

  const executeDataSeed = () => {
    updateStateAndSync(INITIAL_ERP_STATE);
    setShowSeedConfirm(false);
    triggerCustomToast(
      "👑 تم تعبئة البيانات النموذجية للزبائن والشركات بنجاح! يسعدنا تصفحك لكامل المزايا الآن.",
    );
  };

  const executeSeedBanner = () => {
    updateStateAndSync(INITIAL_ERP_STATE);
    setShowSeedBannerConfirm(false);
    triggerCustomToast(
      "👑 تم تهيئة قاعدة المعطيات وتنزيل عينة محرك الدفاتر بنجاح!",
    );
  };

  const handleUpdateCurrentSession = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    sessionStorage.setItem(
      "ABDO_ERP_V2_ACTIVE_USER",
      JSON.stringify(updatedUser),
    );
  };

  if (!currentUser) {
    return (
      <LoginScreen
        state={state}
        onUpdateState={updateStateAndSync}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  const getThemeButtonConfig = () => {
    switch (appTheme) {
      case "royal-dark":
        return {
          icon: "👑",
          label: "التيتانيوم الأسود",
          bg: "bg-[#141414] hover:bg-[#222222] text-[#d4af37] border-[#333333]",
        };
      case "corporate-navy":
        return {
          icon: "🏦",
          label: "الأزرق المؤسسي",
          bg: "bg-[#0f172a] hover:bg-[#1e293b] text-[#38bdf8] border-[#1e293b]",
        };
      case "graphite-gray":
        return {
          icon: "⚙️",
          label: "رمادي جرافيت",
          bg: "bg-[#2d2d2d] hover:bg-[#404040] text-[#fbbf24] border-[#404040]",
        };
      case "terminal-market":
        return {
          icon: "📈",
          label: "شاشة التداول",
          bg: "bg-[#111111] hover:bg-[#222222] text-[#10b981] border-[#222222]",
        };
      case "banker-light":
      default:
        return {
          icon: "☀️",
          label: "الوضع النهاري",
          bg: "bg-white hover:bg-slate-50 text-slate-900 border-slate-200",
        };
    }
  };

  const themeBtnData = getThemeButtonConfig();

  return (
    <div
      className={`min-h-screen font-sans selection:bg-indigo-600 selection:text-white transition-colors duration-300`}
      dir="rtl"
    >
      {/* 1. TOP HEADER & NAVIGATION RAIL (FAR LEFT Exit Button & Demo Seed Button in line) */}
      <header
        className={`bg-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-indigo-950 transition-all duration-300 ${isSidebarOpen ? "lg:pr-[210px]" : ""}`}
      >
        <div className="w-full px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand/Signature */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <h1 className="font-extrabold text-sm tracking-tight text-white flex items-center gap-1.5 leading-none">
                <span>نظام الإدارة الشامل 📊</span>
                <span className="text-[9px] bg-emerald-600 text-white font-bold font-mono px-1.5 py-0.2 rounded-full leading-normal">
                  مستقر ✓
                </span>
              </h1>
            </div>
          </div>

          {/* 🔎 حقل البحث بالشريط العلوي للكروت */}
          <div className="relative w-full md:w-64 shrink-0 mx-2">
            <input
              type="text"
              placeholder="🔍 ابحث بالاسم في ديون العملاء والشركات والتجار..."
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              className="w-full text-right text-xs pr-9 pl-8 py-2 bg-slate-800 hover:bg-slate-750/90 focus:bg-slate-750 border border-slate-700 hover:border-slate-600 focus:border-indigo-550 rounded-xl text-white font-sans placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-bold"
              dir="rtl"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
            {globalSearchQuery && (
              <button
                onClick={() => setGlobalSearchQuery("")}
                className="absolute left-3 top-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 p-0.5 flex items-center justify-center"
                title="تصفير البحث ✕"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {globalSearchQuery && (
              <div className="absolute top-full right-0 w-[90vw] md:w-[600px] mt-2 z-50">
                <GlobalSearch
                  state={state}
                  searchQuery={globalSearchQuery}
                  onNavigateToItem={handleNavigateFromItem}
                  onClose={() => setGlobalSearchQuery("")}
                />
              </div>
            )}
          </div>

          <button
            onClick={() => setShowCustomCardModal(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white border border-amber-400 font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer shrink-0"
            title="مُولد الكروت الحرة المخصصة 3D"
          >
            <span className="text-sm">👑</span>
            <span>إنشاء كارت مخصص</span>
          </button>

          {/* Quick Universal widgets trigger buttons & DATA SEEDER BUTTON */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 👑 زر تغيير المظهر الفاخر (Prestige Dynamic Theme Controller) */}
            <button
              onClick={handleToggleTheme}
              className={`font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer border ${themeBtnData.bg}`}
              title="تغيير مظهر المنظومة"
            >
              <span className="text-sm">{themeBtnData.icon}</span>
              <span>{themeBtnData.label}</span>
            </button>

            {/* 📊 A button for populating data from an example */}
            <button
              onClick={() => setShowSeedConfirm(true)}
              className="bg-indigo-650 hover:bg-indigo-600 text-white border border-indigo-550 font-extrabold text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              title="تعبئة بيانات تجريبية (عينة) لتجربة النظام المحاسبي"
            >
              <Database className="w-4 h-4 text-indigo-300" />
              <span>تعبئة بيانات تجريبية 📊</span>
            </button>
          </div>

          {/* FAR LEFT Signout/Exit button container */}
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-1 px-1.5 flex items-center justify-end">
            {/* Exit button with ONLY icon and no text next to or inside it */}
            <button
              id="header_exit_button"
              onClick={handleLogout}
              className="p-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-sm border border-rose-500"
              title="تسجيل الخروج والعودة لبوابة الدخول ✕"
            >
              <LogOut className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. LIVE ALERT BAR CENTER 🔔 */}
      <AlertCenter
        state={state}
        onNavigateToSection={(sec) => setActiveTab(sec)}
        onPostPurchaseToTreasury={postUnpostedPurchaseFromAlert}
      />

      {/* 4. DB EMPTY SEED ALERT BANNER */}
      {state.customers.length === 0 && (
        <div
          className={`w-full px-4 mt-4 transition-all duration-300 ${isSidebarOpen ? "lg:pr-[210px]" : ""}`}
        >
          <div
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-right flex flex-col md:flex-row items-center justify-between gap-3 text-amber-900 shadow-sm"
            dir="rtl"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl animate-bounce shrink-0">💡</span>
              <div>
                <h4 className="font-extrabold text-xs text-amber-950">
                  تنبيه: قاعدة البيانات المحاسبية فارغة حالياً!
                </h4>
                <p className="text-[11px] mt-0.5 text-amber-800 leading-normal">
                  بدأ التطبيق بملف تخزين فارغ نظراً لذاكرة متصفحك. يرجى تهيئة
                  وشحن البيانات المحاسبية النموذجية المفصلة للزبائن (أحمد
                  المحمودي، محمد الفيتوري، حركة الخزينة والمستحقات والشركات)
                  لتجربة ميزة الدورة النشطة ومتابعة الأرباح وخدمة تصفير الديون
                  والتخفيض الفوري.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSeedBannerConfirm(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shrink-0 shadow-xs transition-all cursor-pointer"
            >
              🔄 تهيئة وتنزيل البيانات الافتراضية للزبائن والشركات
            </button>
          </div>
        </div>
      )}

      {/* 5. MAIN CENTRAL CONTENT & WORKSPACE WORKBENCH WITH IN-FLOW/FLEXIBLE SIDEBAR */}
      {/* Drawer backdrop ONLY on mobile screens (< lg) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div
        className={`w-full p-4 flex flex-col gap-4 transition-all duration-300 ${isSidebarOpen ? "lg:pr-[210px]" : ""}`}
        dir="rtl"
      >
        {/* A. RIGHT VERTICAL SIDEBAR (On the right of main content, slides or collapses) */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed top-0 right-0 h-screen w-[210px] bg-slate-950 shadow-2xl overflow-hidden flex flex-col justify-between border-l border-slate-900 z-50"
              dir="rtl"
            >
              <div className="p-3.5 border-b border-slate-900 flex items-center justify-between bg-slate-950 shrink-0">
                <div className="text-right">
                  <span className="text-[9px] text-indigo-400 font-extrabold block uppercase tracking-widest leading-none font-mono">
                    الدوائر المالية والمحاسبية
                  </span>
                  <h3 className="font-extrabold text-white text-[11.5px] mt-1 leading-none">
                    الإدارة العامة 📋
                  </h3>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-800"
                  title="طي الأقسام"
                >
                  <Menu className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2 space-y-1.5 overflow-y-auto flex-1 text-right max-h-[calc(100vh-130px)] custom-scrollbar">
                {[
                  {
                    id: "debts",
                    label: "1. قسم ديون العملاء 👥",
                    enabled: currentUser.permissions.canViewDebts,
                  },
                  {
                    id: "companies",
                    label: "2. حسابات الشركات والتجار 🏭",
                    enabled:
                      currentUser.permissions.canViewCompanies ||
                      currentUser.permissions.canViewDebts,
                  },
                  {
                    id: "deposits",
                    label: "3. قسم الأمانات 🛡️",
                    enabled: currentUser.permissions.canViewDeposits,
                  },
                  {
                    id: "advances",
                    label: "4. العهد والسلفيات واليوميات 💸",
                    enabled: currentUser.permissions.canViewAdvances !== false, // fallback true
                  },
                  {
                    id: "mail_manual",
                    label: "5. المصراوية 🇪🇬",
                    enabled: true,
                  },
                  {
                    id: "purchases",
                    label: "6. قسم المشتريات 🛒",
                    enabled: currentUser.permissions.canViewPurchases,
                  },
                  {
                    id: "treasury",
                    label: "7. قسم الخزنة 💰",
                    enabled: currentUser.permissions.canViewTreasury,
                  },
                  {
                    id: "financial_reports",
                    label: "8. قسم التقارير المالية 📊",
                    enabled: true,
                  },
                  {
                    id: "transaction_log",
                    label: "9. سجل المعاملات الشامل 📝",
                    enabled: true,
                  },
                  {
                    id: "trash_can",
                    label: "10. سلة المهملات 🗑️",
                    enabled: true,
                  },
                  {
                    id: "settings",
                    label: "11. صلاحيات الموظفين ⚙️",
                    enabled: true,
                  },
                  {
                    id: "backup",
                    label: "12. الاعدادات الشامله 📦",
                    enabled: currentUser.permissions.canViewBackup,
                  },
                  {
                    id: "export_pdf",
                    label: "13. تصدير بي دي اف 📤",
                    enabled: true,
                  },
                ]
                  .filter((t) => t.enabled)
                  .map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setSearchPreFilter("");
                        if (window.innerWidth < 1024) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={`text-right w-full text-[11px] font-extrabold px-3 py-3 rounded-lg transition-all cursor-pointer flex items-center justify-between group border relative overflow-hidden ${
                        activeTab === tab.id
                          ? "bg-slate-800 text-[#d4af37] border-[#d4af37]/30 shadow-md scale-[1.02]"
                          : "text-slate-300 hover:text-white bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800"
                      }`}
                    >
                      {activeTab === tab.id && (
                        <div className="absolute top-0 right-0 w-1.5 h-full bg-[#d4af37]" />
                      )}
                      <span className="truncate pr-1">{tab.label}</span>
                      <span
                        className={`text-[9px] transform transition-transform group-hover:translate-x-0.5 shrink-0 ${
                          activeTab === tab.id ? "text-[#d4af37]" : "text-slate-600"
                        }`}
                      >
                        ◀
                      </span>
                    </button>
                  ))}
              </div>

              {/* 📊 Excel Import & Export actions in the sidebar */}
              <div
                className="p-2.5 border-t border-slate-900 bg-slate-950/40 space-y-1.5 shrink-0"
                dir="rtl"
              >
                <button
                  type="button"
                  onClick={() => setShowExcelImportModal(true)}
                  className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-98 text-white font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md border border-emerald-600 shrink-0 cursor-pointer"
                  title="تحميل كشوفات وحسابات من ملف Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
                  <span>استيراد كشوفات من Excel 📥</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAllToExcel}
                  className="w-full bg-slate-900 hover:bg-slate-800 active:scale-98 text-indigo-400 hover:text-white font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md border border-slate-800 shrink-0 cursor-pointer"
                  title="تصدير نسخة كاملة من المنظومة كملف Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span>تصدير الحسابات Excel 📤</span>
                </button>
              </div>

              <div className="p-3 bg-slate-950/60 border-t border-slate-900 text-center text-[10px] text-slate-500 font-mono shrink-0">
                ABDO Multi-Ledger v2.0
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* B. MAIN WORKSPACE */}
        <div className="flex-1 w-full min-h-[60vh] flex flex-col items-start gap-4">
          {/* B1. COLLAPSED SIDE SEAL (appears when sidebar is closed) */}
          {!isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white rounded-xl shadow-lg transition-all cursor-pointer hover:scale-103 flex items-center gap-1.5 focus:outline-none"
              title="عرض شريط الأقسام الجانبي"
            >
              <Menu className="w-4 h-4 text-indigo-300" />
              <span className="text-[11px] font-bold">
                توسيع الأقسام المحاسبية ◀
              </span>
            </button>
          )}

          <main className="flex-1 w-full min-h-[60vh] transition-all">
            {/* Animated Slide transition of panels */}
            <div className="transition-all">
              <AnimatePresence mode="wait">
                {/* Global Search Overlay was removed here */}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                >
                  {/* Dynamic rendering depending on selected division tab */}
                  {activeTab === "debts" && (
                    <CustomerDebtsModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                      onOpenExporter={handleOpenExporter}
                      searchQuery={globalSearchQuery}
                    />
                  )}

                  {activeTab === "companies" && (
                    <CompaniesModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                      onOpenExporter={handleOpenExporter}
                      searchQuery={globalSearchQuery}
                    />
                  )}

                  {activeTab === "merchants" && (
                    <MerchantsModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                      onOpenExporter={handleOpenExporter}
                      searchQuery={globalSearchQuery}
                    />
                  )}

                  {activeTab === "treasury" && (
                    <TreasuryModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                      onOpenExporter={handleOpenExporter}
                    />
                  )}

                  {activeTab === "mail_manual" && (
                    <MailManualModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                    />
                  )}

                  {activeTab === "financial_reports" && (
                    <FinancialReportsModule
                      state={state}
                      onOpenExporter={handleOpenExporter}
                    />
                  )}

                  {activeTab === "purchases" && (
                    <PurchasesModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                      onOpenExporter={handleOpenExporter}
                    />
                  )}

                  {activeTab === "deposits" && (
                    <DepositsModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                      onOpenExporter={handleOpenExporter}
                    />
                  )}

                  {activeTab === "advances" && (
                    <AdvancesModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                      searchQuery={globalSearchQuery}
                    />
                  )}

                  {activeTab === "transaction_log" && (
                    <TransactionLogModule
                      state={state}
                      onOpenExporter={handleOpenExporter}
                      onUpdateState={updateStateAndSync}
                    />
                  )}

                  {activeTab === "trash_can" && (
                    <TrashCanModule
                      state={state}
                      onUpdateState={updateStateAndSync}
                    />
                  )}

                  {activeTab === "backup" && (
                    <BackupCenter
                      state={state}
                      onRestoreState={handleRestoreState}
                      onSaveBackupPoint={handleSaveBackupPoint}
                      onDeleteBackupPoint={handleDeleteBackupPoint}
                    />
                  )}

                  {activeTab === "settings" && (
                    <SettingsModule
                      state={state}
                      currentUser={currentUser}
                      onUpdateState={updateStateAndSync}
                      onUpdateCurrentSession={handleUpdateCurrentSession}
                    />
                  )}

                  {activeTab === "export_pdf" && (
                    <PdfExportModule state={state} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      {/* 5. MODAL SIDEBARS / POPUPS */}

      {/* Excel Smart Importer Modal */}
      {showExcelImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-4xl border border-slate-200 shadow-2xl overflow-hidden p-3 md:p-5">
            <div
              className="flex justify-between items-center pb-2.5 border-b mb-3 text-right"
              dir="rtl"
            >
              <span className="font-extrabold text-sm text-slate-800">
                📊 استيراد ومعالجة ملفات الإكسل والـ CSV المعتمدة
              </span>
              <button
                id="close-excel-modal"
                onClick={() => setShowExcelImportModal(false)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-3 py-1.5 rounded-full text-xs transition"
              >
                إغلاق ✕
              </button>
            </div>
            <ExcelImporter
              state={state}
              onImportComplete={(newState) => {
                handleExcelImportComplete(newState);
              }}
              onClose={() => setShowExcelImportModal(false)}
            />
          </div>
        </div>
      )}

      {/* Custom Card Modal */}
      {showCustomCardModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="bg-gradient-to-l from-amber-500 to-amber-600 p-5 flex items-center justify-between">
              <h3 className="font-extrabold text-white text-lg flex items-center gap-2">
                <span>👑</span>
                <span>قالب سعر الأهرام 3D</span>
              </h3>
              <button
                onClick={() => setShowCustomCardModal(false)}
                className="bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">السعر الجديد</label>
                <input
                  type="number"
                  step="any"
                  value={customCardValue}
                  onChange={(e) => setCustomCardValue(e.target.value)}
                  placeholder="مثال: 12500"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-2xl font-black text-center font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setShowCustomCardModal(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200 transition-all"
              >
                إلغاء
              </button>
              <button
                onClick={async () => {
                  if (!customCardValue) {
                    alert("يرجى إدخال السعر أولاً.");
                    return;
                  }
                  
                  const success = await copyCustomCardImage(customCardValue);
                  if (success) {
                    setShowCustomCardModal(false);
                    // Reset fields
                    setCustomCardValue("");
                  }
                }}
                className="px-6 py-2.5 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span>إنشاء ونسخ الكارت</span>
                <span>✨</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Share Card PNG Image Exporter Component */}
      {showImageExportModal && (
        <ImageExporter
          sectionName={exportSectionTitle}
          activeCurrency="دينار ليبي د.ل"
          metrics={exportMetrics}
          tableHeaders={exportHeaders}
          tableRows={exportRows}
          footerMetrics={exportFooterMetrics}
          onClose={() => setShowImageExportModal(false)}
        />
      )}

      {/* Minimal Footer */}
      <footer className="bg-slate-900 text-slate-500 text-center py-6 border-t border-slate-950 mt-12 text-xs">
        <p className="font-mono">
          ABDO ERP MULTI-LEDGER V2 • CODENAME ANTIGRAVITY SECURITY SYSTEM
        </p>
        <p className="font-sans mt-1">
          جميع الحقوق محفوظة للمطورين. لا تظهر معلومات الحساب غير المسجلين
          بالشاشة.
        </p>
      </footer>

      {/* ========================================================= */}
      {/* YEAR 2100 MODERN CUSTOM SECURITY CONFIRMATION OVERLAYS */}
      {/* ========================================================= */}

      {/* 1. Log Out Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 shadow-2xl"
          dir="rtl"
        >
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] p-6 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#f1f5f9] text-sm">
                  تأكيد إنهاء الجلسة والخروج
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold">
                  بوابة الأمان والتدقيق الحركي لعام 2100
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-semibold mb-6">
              هل أنت متأكد من تسجيل الخروج كلياً من دفاترك الحالية؟ سيتم تفكيك
              مفتاح الوصول الفردي وإعادتك مباشرةً لبوابة الدخول.
            </p>

            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={executeLogout}
                className="flex-1 bg-gradient-to-l from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer text-center active:scale-95"
              >
                تأكيد الخروج الآمن
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer text-center active:scale-95"
              >
                إلغاء التراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Seed Sample Data Top Modal */}
      {showSeedConfirm && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 shadow-2xl"
          dir="rtl"
        >
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] p-6 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#f1f5f9] text-sm">
                  شحن قاعدة البيانات المحاسبية
                </h3>
                <p className="text-[10px] text-indigo-400 font-semibold">
                  تحميل المعطيات النموذجية التجريبية
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-semibold mb-5">
              هل تود شحن المنظومة وتحميل كافة البيانات المحاسبية والعملاء
              والشركات النموذجية الآن؟ <br />
              <strong className="text-amber-500/90 font-sans block mt-2 text-[10px]">
                ⚠️ سيتم استبدال وحذف أي بيانات فارغة أو مدرجة حالياً ببيانات
                العينة المتكاملة لتجربة الدورة المحاسبية النشطة بالكامل.
              </strong>
            </p>

            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={executeDataSeed}
                className="flex-1 bg-gradient-to-l from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95"
              >
                موافق، شحن الدفاتر
              </button>
              <button
                type="button"
                onClick={() => setShowSeedConfirm(false)}
                className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95"
              >
                تراجع وإلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Seed Sample Data Empty Banner Modal */}
      {showSeedBannerConfirm && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 shadow-2xl"
          dir="rtl"
        >
          <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.05)] p-6 text-right">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#f1f5f9] text-sm">
                  تهيئة الحسابات وتفعيل محاكي الدفاتر
                </h3>
                <p className="text-[10px] text-amber-500 font-semibold">
                  نظام التشغيل التلقائي بالأرصدة
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-semibold mb-5">
              هل تود شحن المنظومة ببيانات العينة وتجربة كافة الميزات والأرصدة
              الآن للتبويب؟
            </p>

            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={executeSeedBanner}
                className="flex-1 bg-gradient-to-l from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-slate-950 font-black py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95"
              >
                تحديث وتجربة الفوري
              </button>
              <button
                type="button"
                onClick={() => setShowSeedBannerConfirm(false)}
                className="flex-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95"
              >
                إلغاء التنزيل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Beautiful Custom Toast Alert Overlay */}
      {showCustomToast && (
        <div
          className="fixed bottom-6 left-6 max-w-md bg-[#0b0f19] border border-slate-800 p-4 rounded-2xl z-[99999] shadow-2xl text-right animate-slide-up flex items-center gap-3 border-l-4 border-l-emerald-500"
          dir="rtl"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/25 text-emerald-400 text-xs font-black flex items-center justify-center shrink-0">
            ✓
          </div>
          <span className="text-xs font-bold text-slate-100">
            {showCustomToast}
          </span>
        </div>
      )}

      {/* 5. Theme Selection Settings Modal */}
      {isThemeModalOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
          dir="rtl"
        >
          <div className="bg-[#0b0f19] border border-slate-800/80 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden p-6 relative">
            <button
              onClick={() => setIsThemeModalOpen(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-white p-2 bg-slate-900 rounded-full cursor-pointer hover:bg-slate-800 transition"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-right border-b border-white/5 pb-4 mb-6">
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                🎨 اختيار مظهر لوحة التحكم والموديلات
              </h2>
              <p className="text-slate-400 text-xs mt-1 font-medium">
                الرجاء اختيار المظهر المناسب الذي ترغب في استخدامه في المنظومة
                (يتوفر 5 مظاهر)
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4 overflow-y-auto max-h-[60vh] p-1">
              {(
                [
                  {
                    id: "banker-light",
                    icon: "☀️",
                    label: "الوضع النهاري",
                    bgThemeClass: "bg-slate-100 text-slate-800",
                  },
                  {
                    id: "royal-dark",
                    icon: "👑",
                    label: "التيتانيوم الأسود",
                    bgThemeClass: "bg-zinc-900 text-amber-500",
                  },
                  {
                    id: "corporate-navy",
                    icon: "🏦",
                    label: "الأزرق المؤسسي",
                    bgThemeClass: "bg-slate-800 text-sky-400",
                  },
                  {
                    id: "graphite-gray",
                    icon: "⚙️",
                    label: "رمادي جرافيت",
                    bgThemeClass: "bg-stone-800 text-amber-400",
                  },
                  {
                    id: "terminal-market",
                    icon: "📈",
                    label: "شاشة التداول",
                    bgThemeClass: "bg-black text-emerald-500",
                  },
                ] as const
              ).map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => {
                    setAppTheme(theme.id as any);
                    localStorage.setItem("ABDO_ERP_THEME", theme.id);
                    setIsThemeModalOpen(false);
                  }}
                  className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all cursor-pointer active:scale-95 group overflow-hidden ${appTheme === theme.id ? "border-amber-500 scale-105 shadow-[0_0_20px_rgba(245,158,11,0.2)] z-10 block" : "border-slate-800/50 opacity-80 hover:opacity-100 hover:border-slate-600 block"}`}
                >
                  <div
                    className={`absolute inset-0 opacity-20 group-hover:opacity-100 transition-opacity blur-xl ${theme.bgThemeClass}`}
                  ></div>
                  <div
                    className={`absolute inset-0 ${theme.bgThemeClass} opacity-90`}
                  ></div>
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <span className={`text-4xl drop-shadow-md`}>
                      {theme.icon}
                    </span>
                    <span className="font-extrabold text-xs tracking-wide shadow-sm">
                      {theme.label}
                    </span>
                  </div>
                  {appTheme === theme.id && (
                    <div className="absolute top-2 right-2 flex bg-amber-500 text-amber-950 rounded-full w-5 h-5 items-center justify-center text-[10px] z-20">
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
