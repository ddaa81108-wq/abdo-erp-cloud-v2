import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Landmark, UserCheck, Inbox, FolderArchive, ShoppingBag, ShieldCheck, Database, Search, FileDown, CircleAlert as AlertCircle, FileSpreadsheet, Bell, Info, LogOut, Settings, Shield, X, Menu, Calculator } from "lucide-react";
import { doc, setDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

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
import { canAccessTab, firstAllowedTab, resolvePermissions } from "./utils/permissions";
import { downloadXlsx } from "./utils/spreadsheet";
import { createErpWorkbookSheets } from "./services/erpSpreadsheetExport";
import {
  CHUNK_ARRAY_KEYS,
  loadCompleteErpState,
  mergeErpStateChanges,
  writeMergedErpState,
} from "./services/erpSyncService";
import { migrateLegacyBusinessAccounts } from "./domain/businessAccounts";
import { repairLegacyCustomerCycles } from "./domain/customerAccounts";
import { collectSystemAuditEntries } from "./domain/systemAudit";
import {
  AUTO_BACKUP_INTERVAL_MS,
  isAutoBackupDue,
  latestAutoBackupAt,
  retainLatestAutomaticBackups,
  snapshotForBackup,
} from "./domain/backups";
import {
  synchronizeTrustDeposit,
} from "./domain/trustAccounts";

// Import modules
import CustomerDebtsModule from "./components/CustomerDebtsModule";
import CompaniesModule from "./components/CompaniesModule";
import TreasuryModule from "./components/TreasuryModule";
import PurchasesModule from "./components/PurchasesModule";
import DepositsModule from "./components/DepositsModule";
import TransactionLogModule from "./components/TransactionLogModule";
import TrashCanModule from "./components/TrashCanModule";
import MailManualModule from "./components/MailManualModule";
import FinancialReportsModule from "./components/FinancialReportsModule";
import GlobalCalculator from "./components/GlobalCalculator";

const normalizeBusinessState = (value: ERPState): ERPState => {
  const trustDeposits = (value.trustDeposits || []).map(synchronizeTrustDeposit);
  return {
    ...value,
    ...migrateLegacyBusinessAccounts(
      value.companies || [],
      value.companyTransactions || [],
      value.merchants || [],
      value.merchantTransactions || [],
    ),
    cycles: repairLegacyCustomerCycles(
      value.cycles || [],
      value.debtTransactions || [],
    ),
    trustDeposits,
    // The active treasury ledger is intentionally manual-only. Other modules
    // contribute through their summary cards, never as cash movements.
    treasuryTransactions: (value.treasuryTransactions || []).filter(
      (transaction) =>
        transaction.source === "manual_deposit" ||
        transaction.source === "manual_withdraw",
    ),
  };
};

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnlineMode, setIsOnlineMode] = useState(false);

  const [state, setState] = useState<ERPState>(() => {
    const tryLocal = localStorage.getItem("ABDO_ERP_V2_DATA");
    if (tryLocal) {
      try {
        const parsed = JSON.parse(tryLocal);
        if (parsed && typeof parsed === "object") {
          return normalizeBusinessState(parsed);
        }
      } catch (e) {}
    }
    return normalizeBusinessState(INITIAL_ERP_STATE);
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem("ABDO_ERP_V2_ACTIVE_USER");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as User;
        return {
          ...parsed,
          permissions: resolvePermissions(parsed.role, parsed.permissions),
        };
      } catch (err) {
        return null;
      }
    }
    return null;
  });
  const canCurrentUserAccess = useCallback(
    (section: string) => canAccessTab(currentUser, section),
    [currentUser],
  );

  const [activeTab, setActiveTab] = useState<string>("debts");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  type AppTheme =
    | "banker-light"
    | "midnight-cobalt"
    | "sahara-aurora"
    | "emerald-glass";
  const [appTheme, setAppTheme] = useState<AppTheme>(() => {
    const savedTheme = localStorage.getItem("ABDO_ERP_THEME");
    const availableThemes: AppTheme[] = [
      "banker-light",
      "midnight-cobalt",
      "sahara-aurora",
      "emerald-glass",
    ];
    return availableThemes.includes(savedTheme as AppTheme)
      ? savedTheme as AppTheme
      : "banker-light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", appTheme);
  }, [appTheme]);

  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [showGlobalCalculator, setShowGlobalCalculator] = useState(false);
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
  const syncRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSyncRef = useRef<{ base: ERPState; next: ERPState } | null>(null);
  const inFlightSyncRef = useRef<{ base: ERPState; next: ERPState } | null>(null);
  const lastLoadedRevisionRef = useRef(0);

  // 🔄 Auto Backup Logic
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ============================================================
  // Automatic shared backup: every 12 hours while a user is signed in.
  // If the application was closed when the backup became due, it runs
  // immediately on the next successful login.
  // ============================================================
  useEffect(() => {
    // Wait until the shared Firestore state has loaded. This prevents a new
    // device with empty local storage from creating a duplicate backup before
    // it sees the latest cloud backup.
    if (!currentUser || isLoading) return;
    let cancelled = false;
    let nextBackupTimer: ReturnType<typeof setTimeout> | null = null;

    const performAutoBackup = async () => {
      const currentState = stateRef.current;
      const now = Date.now();
      if (cancelled || !isAutoBackupDue(currentState.backupPoints || [], now)) return;

      console.log("⏰ حان وقت النسخة الاحتياطية التلقائية...");
      try {
        const backupName = `نسخة تلقائية - ${new Date().toLocaleString('ar-LY', { 
          dateStyle: 'short', timeStyle: 'short' 
        })}`;

        const newBackup = {
          id: `auto_backup_${now}`,
          name: backupName,
          date: new Date().toISOString(),
          description: "تم الإنشاء تلقائياً لحماية بياناتك (نظام الـ 12 ساعة)",
          dataJson: JSON.stringify(snapshotForBackup(currentState)),
        };
        const { retained, removed } = retainLatestAutomaticBackups(
          currentState.backupPoints || [],
        );

        await updateStateAndSync({
          ...currentState,
          backupPoints: [...retained, newBackup],
        });

        // Never remove an older cloud backup before the new snapshot has
        // completed synchronization. If a save is still pending, the old
        // document remains as a harmless safety copy.
        if (db && removed.length > 0) {
          window.setTimeout(() => {
            if (pendingSyncRef.current || inFlightSyncRef.current) return;
            removed.forEach((old) => {
              deleteDoc(doc(db, "erp_system", `backup_${old.id}`))
                .catch(() => undefined);
            });
          }, 5_000);
        }

        console.log("✅ أضيفت النسخة الاحتياطية التلقائية إلى المزامنة");
      } catch (error) {
        console.error("❌ فشل إنشاء النسخة التلقائية:", error);
      }
    };

    const scheduleNextBackup = () => {
      if (cancelled) return;
      const latest = latestAutoBackupAt(stateRef.current.backupPoints || []);
      const delay = latest === 0
        ? 0
        : Math.max(1_000, latest + AUTO_BACKUP_INTERVAL_MS - Date.now());
      nextBackupTimer = setTimeout(async () => {
        await performAutoBackup();
        scheduleNextBackup();
      }, Math.min(delay, 2_147_000_000));
    };

    scheduleNextBackup();
    return () => {
      cancelled = true;
      if (nextBackupTimer) clearTimeout(nextBackupTimer);
    };
  }, [currentUser, isLoading]);

  // ============================================================
  // 🆕 Firebase Synchronization Core - Multi-document merge
  // 🔒 FIX #4: Only sync AFTER login — prevents permission errors
  // 🔒 FIX #1: NEVER auto-write INITIAL_ERP_STATE to Firebase
  // ============================================================
  useEffect(() => {
    let unmounted = false;
    if (!db) return;
    if (!currentUser) return; // 🔒 FIX #4: wait for login before any read/write

    const mainRef = doc(db, "erp_system", "main_state");
    const unsubscribe = onSnapshot(
      mainRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as any;

          // Legacy migration: merchants → companies
          const migratedBusiness = migrateLegacyBusinessAccounts(
            Array.isArray(data.companies) ? data.companies : [],
            Array.isArray(data.companyTransactions) ? data.companyTransactions : [],
            Array.isArray(data.merchants) ? data.merchants : [],
            Array.isArray(data.merchantTransactions) ? data.merchantTransactions : [],
          );
          const businessChanged =
            JSON.stringify(data.companies || []) !== JSON.stringify(migratedBusiness.companies) ||
            JSON.stringify(data.companyTransactions || []) !== JSON.stringify(migratedBusiness.companyTransactions) ||
            (data.merchants?.length || 0) > 0 ||
            (data.merchantTransactions?.length || 0) > 0;
          Object.assign(data, migratedBusiness);
          if (businessChanged) {
            await setDoc(mainRef, migratedBusiness, { merge: true });
          }
          const incomingRevision = Number(data._syncRevision || 0);
          const changedKeys = Array.isArray(data._changedChunks)
            ? data._changedChunks.filter(
                (key: unknown): key is keyof ERPState =>
                  typeof key === 'string'
                  && CHUNK_ARRAY_KEYS.includes(key as keyof ERPState),
              )
            : [];
          const canLoadIncrementally =
            lastLoadedRevisionRef.current > 0
            && incomingRevision === lastLoadedRevisionRef.current + 1
            && Array.isArray(data._changedChunks);

          // Consecutive revisions fetch only the changed sections. A new
          // device, reconnect, or missed revision safely falls back to a full
          // load so no remote update can be skipped.
          const fullState = normalizeBusinessState(await loadCompleteErpState(
            db,
            data,
            canLoadIncrementally
              ? {
                  currentState: stateRef.current,
                  chunkKeys: changedKeys,
                }
              : undefined,
          ));
          lastLoadedRevisionRef.current = incomingRevision;

                   if (!unmounted) {
            setIsLoading(false);
            setIsOnlineMode(true);
            let safe = fullState;
            if (inFlightSyncRef.current) {
              safe = mergeErpStateChanges(
                inFlightSyncRef.current.base,
                inFlightSyncRef.current.next,
                safe,
              );
            }
            if (pendingSyncRef.current) {
              safe = mergeErpStateChanges(
                pendingSyncRef.current.base,
                pendingSyncRef.current.next,
                safe,
              );
            }
            setState((current) => JSON.stringify(current) === JSON.stringify(safe) ? current : safe);
            try { localStorage.setItem("ABDO_ERP_V2_DATA", JSON.stringify(safe)); } catch (e) {}
          }
        } else {
          // 🔒 FIX #1: Document doesn't exist in Firebase.
          // NEVER write INITIAL_ERP_STATE (test data) to Firebase automatically.
          // Only load from localStorage if available. Otherwise show empty state.
          const tryLocal = localStorage.getItem("ABDO_ERP_V2_DATA");
          let localData: ERPState | null = null;
          if (tryLocal) {
            try {
              const parsed = JSON.parse(tryLocal);
              if (parsed && parsed.customers && parsed.customers.length > 0) {
                localData = parsed;
              }
            } catch (e) {}
          }
          if (!unmounted) {
            setIsLoading(false);
            setIsOnlineMode(true);
            if (localData) {
              // Restore from local backup — do NOT push to Firebase automatically
              setState(localData);
            } else {
              // No data anywhere — show empty state, user must import/restore manually
              setState(INITIAL_ERP_STATE);
            }
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
  }, [currentUser]);

  // ============================================================
  // Atomic optimistic synchronization with record-level conflict merging
  // ============================================================
  const updateStateAndSync = async (newState: ERPState) => {
    const baseState = stateRef.current;
    const normalizedState = normalizeBusinessState(newState);
    const auditEntries = collectSystemAuditEntries(
      baseState,
      normalizedState,
      currentUser,
    );
    const cleanedState = JSON.parse(JSON.stringify({
      ...normalizedState,
      systemAuditLog: [
        ...(normalizedState.systemAuditLog || []),
        ...auditEntries,
      ],
    }));
    stateRef.current = cleanedState;
    setState(cleanedState);

    try {
      localStorage.setItem("ABDO_ERP_V2_DATA", JSON.stringify(cleanedState));
    } catch (e) {
      console.error("Local storage save failed", e);
    }

    if (db) {
      pendingSyncRef.current = pendingSyncRef.current
        ? { ...pendingSyncRef.current, next: cleanedState }
        : { base: baseState, next: cleanedState };
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(async () => {
        const pending = pendingSyncRef.current;
        pendingSyncRef.current = null;
        if (!pending) return;
        inFlightSyncRef.current = pending;
        try {
          const merged = normalizeBusinessState(
            await writeMergedErpState(db, pending.base, pending.next),
          );
          const displayState = normalizeBusinessState(pendingSyncRef.current
            ? mergeErpStateChanges(
                pendingSyncRef.current.base,
                pendingSyncRef.current.next,
                merged,
              )
            : merged);
          stateRef.current = displayState;
          setState(displayState);
          localStorage.setItem("ABDO_ERP_V2_DATA", JSON.stringify(displayState));
          inFlightSyncRef.current = null;
          if (syncRetryTimeoutRef.current) {
            clearTimeout(syncRetryTimeoutRef.current);
            syncRetryTimeoutRef.current = null;
          }
        } catch (err) {
          console.error("Failed to sync to Firebase", err);
          pendingSyncRef.current = pendingSyncRef.current
            ? { base: pending.base, next: pendingSyncRef.current.next }
            : pending;
          inFlightSyncRef.current = null;
          if (!syncRetryTimeoutRef.current) {
            syncRetryTimeoutRef.current = setTimeout(() => {
              syncRetryTimeoutRef.current = null;
              void updateStateAndSync(stateRef.current);
            }, 30_000);
          }
          triggerCustomToast("تعذر حفظ آخر تعديل على الخادم. سيُعاد المحاولة مع التعديل القادم.");
        }
      }, 500);
    }
  };

  const handleExportAllToExcel = () => {
    try {
      downloadXlsx(
        createErpWorkbookSheets(state),
        `ABDO_MULTY_LEDGER_MASTER_EXPORT_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      alert("🎉 تم توليد وتصدير ملف الإكسل الشامل لكافة صفحات كشوفات وحركات المنظومة بنجاح!");
    } catch (error: any) {
      console.error(error);
      alert("⚠️ حصل خطأ أثناء ترحيل وتصدير البيانات لملف الإكسل: " + error.message);
    }
  };

  const handleRestoreState = (newState: ERPState) => updateStateAndSync(newState);

  // 🆕 Modified: backup dataJson stored in separate Firebase doc
  const handleSaveBackupPoint = (name: string, description: string) => {
    const newPoint = {
      id: `point_${Date.now()}`,
      name,
      date: new Date().toISOString(),
      description,
      dataJson: JSON.stringify(snapshotForBackup(state)),
    };
    updateStateAndSync({ ...state, backupPoints: [...state.backupPoints, newPoint] });
  };

  // 🆕 Modified: also deletes the separate backup document
  const handleDeleteBackupPoint = (id: string) => {
    if (db) {
      deleteDoc(doc(db, "erp_system", `backup_${id}`)).catch(() => {});
    }
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
    if (tab === "merchants") tab = "companies";
    if (!canCurrentUserAccess(tab)) {
      triggerCustomToast("هذا القسم غير متاح ضمن صلاحيات حسابك.");
      return;
    }
    setActiveTab(tab);
    setSearchPreFilter(filterText);
    setGlobalSearchQuery(filterText);
    setShowGlobSearch(false);
  };

  const handleLoginSuccess = (user: User) => {
    const secureUser: User = {
      ...user,
      permissions: resolvePermissions(user.role, user.permissions)
    };

    setCurrentUser(secureUser);
    sessionStorage.setItem("ABDO_ERP_V2_ACTIVE_USER", JSON.stringify(secureUser));
    
    setActiveTab(firstAllowedTab(secureUser));
  };

  const handleLogout = () => setShowLogoutConfirm(true);
  const executeLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      sessionStorage.removeItem("ABDO_ERP_V2_ACTIVE_USER");
      setShowLogoutConfirm(false);
    } catch (error) {
      console.error("Firebase logout failed:", error);
      setShowCustomToast("تعذر تسجيل الخروج من Firebase. حاول مرة أخرى.");
    }
  };

  const triggerCustomToast = (msg: string) => {
    setShowCustomToast(msg);
    setTimeout(() => setShowCustomToast(""), 4500);
  };

  // 🔒 FIX #2: Block seeding if real data already exists — prevents accidental wipe
  const executeDataSeed = () => {
    if (state.customers.length > 0 || state.companies.length > 0 || state.merchants.length > 0) {
      setShowSeedConfirm(false);
      triggerCustomToast("⚠️ ممنوع: توجد بيانات حقيقية بالفعل. لا يمكن تهيئة بيانات تجريبية فوقها.");
      return;
    }
    updateStateAndSync(INITIAL_ERP_STATE);
    setShowSeedConfirm(false);
    triggerCustomToast("👑 تم تعبئة البيانات النموذجية للزبائن والشركات بنجاح!");
  };

  const executeSeedBanner = () => {
    if (state.customers.length > 0 || state.companies.length > 0 || state.merchants.length > 0) {
      setShowSeedBannerConfirm(false);
      triggerCustomToast("⚠️ ممنوع: توجد بيانات حقيقية بالفعل. لا يمكن تهيئة بيانات تجريبية فوقها.");
      return;
    }
    updateStateAndSync(INITIAL_ERP_STATE);
    setShowSeedBannerConfirm(false);
    triggerCustomToast("👑 تم تهيئة قاعدة المعطيات وتنزيل عينة محرك الدفاتر بنجاح!");
  };

  const handleUpdateCurrentSession = (updatedUser: User) => {
    const securedUser = {
      ...updatedUser,
      permissions: resolvePermissions(updatedUser.role, updatedUser.permissions),
    };
    setCurrentUser(securedUser);
    sessionStorage.setItem("ABDO_ERP_V2_ACTIVE_USER", JSON.stringify(securedUser));
  };

  const activeTabIsAllowed = canCurrentUserAccess(activeTab);

    if (!currentUser) {
    return (
      <LoginScreen onLoginSuccess={handleLoginSuccess} />
    );
  }

  if (isLoading && !isOnlineMode) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-6 font-sans" dir="rtl">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-600 border-t-indigo-500"></div>
        <h2 className="text-white text-xl font-extrabold">جاري تحميل المنظومة...</h2>
        <p className="text-slate-400 text-sm">يتم الاتصال بقاعدة البيانات الآمنة. يرجى الانتظار.</p>
      </div>
    );
  }

  const getThemeButtonConfig = () => {
    switch (appTheme) {
      case "midnight-cobalt": return { icon: "🌌", label: "ليل الكوبالت", bg: "bg-[#071329] hover:bg-[#0b2144] text-[#67e8f9] border-[#164e63]" };
      case "sahara-aurora": return { icon: "🌅", label: "شفق الصحراء", bg: "bg-[#241331] hover:bg-[#3a1d46] text-[#fbbf24] border-[#9f3f68]" };
      case "emerald-glass": return { icon: "💎", label: "الزمرد الزجاجي", bg: "bg-[#062923] hover:bg-[#0a3f35] text-[#99f6e4] border-[#0f766e]" };
      case "banker-light":
      default: return { icon: "☀️", label: "الوضع النهاري", bg: "bg-white hover:bg-slate-50 text-slate-900 border-slate-200" };
    }
  };

  const themeBtnData = getThemeButtonConfig();

  return (
    <div className={`min-h-screen font-sans selection:bg-indigo-600 selection:text-white transition-colors duration-300`} dir="rtl">
      <header className={`bg-white text-slate-900 shadow-xl sticky top-0 z-40 border-b border-slate-200 transition-all duration-300 ${isSidebarOpen ? "lg:pr-[210px]" : ""}`}>
        <div className="w-full px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <h1 className="font-extrabold text-sm tracking-tight text-slate-900 flex items-center gap-1.5 leading-none">
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
              className="w-full text-right text-xs pr-9 pl-8 py-2 bg-slate-100 hover:bg-slate-200 focus:bg-slate-200 border border-slate-300 hover:border-emerald-400 focus:border-emerald-500 rounded-xl text-slate-900 font-sans placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all font-bold"
              dir="rtl"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
            <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
              <VoiceInputButton onResult={(text) => setGlobalSearchQuery(text)} className="bg-emerald-100 text-emerald-600 hover:bg-emerald-200 border-none scale-90" />
              {globalSearchQuery && (
                <button onClick={() => setGlobalSearchQuery("")} className="text-slate-500 hover:text-emerald-600 rounded-full hover:bg-emerald-100 p-1 flex items-center justify-center" title="تصفير البحث ✕">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {globalSearchQuery && (
              <div className="absolute top-full right-0 w-[90vw] md:w-[600px] mt-2 z-50">
                <GlobalSearch
                  state={state}
                  searchQuery={globalSearchQuery}
                  onNavigateToItem={handleNavigateFromItem}
                  canAccessSection={canCurrentUserAccess}
                  onClose={() => setGlobalSearchQuery("")}
                />
              </div>
            )}
          </div>

          <button onClick={() => window.open("/card-generator.html", "_blank")} className="bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 cursor-pointer shrink-0" title="منظومة توليد الكروت الشاملة">
            <span className="text-sm">👑</span><span>منظومة الكروت الذكية</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGlobalCalculator(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-500 bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-lg"
            title="فتح الآلة الحاسبة العامة"
          >
            <Calculator className="h-4 w-4" />
            <span>الآلة الحاسبة</span>
          </button>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={handleToggleTheme} className={`font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer border border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700`} title="تغيير مظهر المنظومة">
              <span className="text-sm">{themeBtnData.icon}</span><span>{themeBtnData.label}</span>
            </button>
          </div>

          <div className="bg-slate-100 border border-slate-300 rounded-xl p-1 px-1.5 flex items-center justify-end">
            <button id="header_exit_button" onClick={handleLogout} className="p-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-sm border border-emerald-500" title="تسجيل الخروج والعودة لبوابة الدخول ✕">
              <LogOut className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </header>

      <GlobalCalculator
        open={showGlobalCalculator}
        onClose={() => setShowGlobalCalculator(false)}
      />

      <AlertCenter
        state={state}
        onNavigateToSection={(sec) => {
          if (canCurrentUserAccess(sec)) setActiveTab(sec);
          else triggerCustomToast("هذا القسم غير متاح ضمن صلاحيات حسابك.");
        }}
        onPostPurchaseToTreasury={postUnpostedPurchaseFromAlert}
      />

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
            <motion.aside initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }} transition={{ type: "spring", damping: 28, stiffness: 220 }} className="fixed top-0 right-0 h-screen w-[210px] bg-white shadow-2xl overflow-hidden flex flex-col justify-between border-l border-slate-200 z-50" dir="rtl">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                <div className="text-right">
                  <span className="text-[9px] text-emerald-600 font-extrabold block uppercase tracking-widest leading-none font-mono">الدوائر المالية والمحاسبية</span>
                  <h3 className="font-extrabold text-slate-900 text-[11.5px] mt-1 leading-none">الإدارة العامة 📋</h3>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-600 hover:text-emerald-700 rounded-lg transition-all cursor-pointer border border-emerald-300" title="طي الأقسام">
                  <Menu className="w-4 h-4" />
                </button>
              </div>

              <div className="p-2 space-y-1.5 overflow-y-auto flex-1 text-right max-h-[calc(100vh-130px)] custom-scrollbar">
                {[
                  { id: "debts", label: "1. قسم ديون العملاء 👥", enabled: currentUser?.permissions?.canViewDebts ?? false },
                  { id: "companies", label: "2. حسابات الشركات والتجار 🏭", enabled: currentUser?.permissions?.canViewCompanies ?? false },
                  { id: "deposits", label: "3. قسم الأمانات 🛡️", enabled: currentUser?.permissions?.canViewDeposits ?? false },
                  { id: "mail_manual", label: "4. المصراوية 🇪🇬", enabled: currentUser?.permissions?.canViewMailManual ?? false },
                  { id: "purchases", label: "6. قسم المشتريات 🛒", enabled: currentUser?.permissions?.canViewPurchases ?? false },
                  { id: "treasury", label: "7. قسم الخزنة 💰", enabled: currentUser?.permissions?.canViewTreasury ?? false },
                  { id: "financial_reports", label: "8. قسم التقارير المالية 📊", enabled: currentUser?.permissions?.canViewFinancialReports ?? false },
                  { id: "transaction_log", label: "9. سجل المعاملات الشامل 📝", enabled: currentUser?.permissions?.canViewTransactionLog ?? false },
                  { id: "trash_can", label: "10. سلة المهملات 🗑️", enabled: currentUser?.permissions?.canViewTrash ?? false },
                  { id: "settings", label: "11. صلاحيات الموظفين ⚙️", enabled: currentUser?.role === "admin" },
                  { id: "backup", label: "12. الاعدادات الشامله 📦", enabled: currentUser?.permissions?.canViewBackup ?? false },
                ].filter((t) => t.enabled).map((tab) => (
                  <button 
                    key={tab.id} 
                    onClick={() => { setActiveTab(tab.id); setSearchPreFilter(""); if (window.innerWidth < 1024) setIsSidebarOpen(false); }} 
                    className={`text-right w-full text-[11px] font-extrabold px-3 py-3 rounded-lg transition-all cursor-pointer flex items-center justify-between group border relative overflow-hidden ${activeTab === tab.id ? "bg-emerald-600 text-white border-emerald-500 shadow-md scale-[1.02]" : "text-slate-700 hover:text-emerald-600 bg-white border-slate-300 hover:border-emerald-400 hover:bg-emerald-50"}`}
                  >
                    {activeTab === tab.id && <div className="absolute top-0 right-0 w-1.5 h-full bg-white" />}
                    <span className="truncate pr-1">{tab.label}</span>
                    <span className={`text-[9px] transform transition-transform group-hover:translate-x-0.5 shrink-0 ${activeTab === tab.id ? "text-white" : "text-emerald-600"}`}>◀</span>
                  </button>
                ))}
              </div>

              {(currentUser?.permissions?.canImportExcel || currentUser?.permissions?.canExportExcel) && (
                <div className="p-2.5 border-t border-slate-200 bg-white space-y-1.5 shrink-0" dir="rtl">
                  {currentUser.permissions.canImportExcel && (
                    <button type="button" onClick={() => setShowExcelImportModal(true)} className="w-full bg-emerald-700 hover:bg-emerald-600 active:scale-98 text-white font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md border border-emerald-600 shrink-0 cursor-pointer" title="تحميل كشوفات وحسابات من ملف Excel">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-white" /><span>استيراد كشوفات من Excel 📥</span>
                    </button>
                  )}
                  {currentUser.permissions.canExportExcel && (
                    <button type="button" onClick={handleExportAllToExcel} className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md border border-emerald-500 shrink-0 cursor-pointer" title="تصدير نسخة كاملة من المنظومة كملف Excel">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" /><span>تصدير الحسابات Excel 📤</span>
                    </button>
                  )}
                </div>
              )}
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
                  {!activeTabIsAllowed && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center font-bold text-amber-800">
                      هذا القسم غير متاح ضمن صلاحيات حسابك.
                    </div>
                  )}
                  {activeTabIsAllowed && activeTab === "debts" && <CustomerDebtsModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} searchQuery={globalSearchQuery} pendingDeletions={pendingDeletions.map(p => p.id)} onScheduleDeletion={scheduleDeletion} onCancelDeletion={cancelDeletion} />}
                  {activeTabIsAllowed && activeTab === "companies" && <CompaniesModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} searchQuery={globalSearchQuery} pendingDeletions={pendingDeletions.map(p => p.id)} onScheduleDeletion={scheduleDeletion} onCancelDeletion={cancelDeletion} />}
                  {activeTabIsAllowed && activeTab === "merchants" && <CompaniesModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} searchQuery={globalSearchQuery} pendingDeletions={pendingDeletions.map(p => p.id)} onScheduleDeletion={scheduleDeletion} onCancelDeletion={cancelDeletion} />}
                  {activeTabIsAllowed && activeTab === "treasury" && <TreasuryModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} />}
                  {activeTabIsAllowed && activeTab === "mail_manual" && <MailManualModule state={state} onUpdateState={updateStateAndSync} />}
                  {activeTabIsAllowed && activeTab === "financial_reports" && <FinancialReportsModule />}
                  {activeTabIsAllowed && activeTab === "purchases" && <PurchasesModule state={state} currentUser={currentUser} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} />}
                  {activeTabIsAllowed && activeTab === "deposits" && <DepositsModule state={state} onUpdateState={updateStateAndSync} onOpenExporter={handleOpenExporter} searchQuery={globalSearchQuery} pendingDeletions={pendingDeletions.map(p => p.id)} onScheduleDeletion={scheduleDeletion} onCancelDeletion={cancelDeletion} />}
                  {activeTabIsAllowed && activeTab === "transaction_log" && <TransactionLogModule state={state} onOpenExporter={handleOpenExporter} onUpdateState={updateStateAndSync} />}
                  {activeTabIsAllowed && activeTab === "trash_can" && <TrashCanModule state={state} onUpdateState={updateStateAndSync} />}
                  {activeTabIsAllowed && activeTab === "backup" && <BackupCenter state={state} isOnline={isOnlineMode} onRestoreState={handleRestoreState} onSaveBackupPoint={handleSaveBackupPoint} onDeleteBackupPoint={handleDeleteBackupPoint} />}
                  {activeTabIsAllowed && activeTab === "settings" && <SettingsModule state={state} currentUser={currentUser} onUpdateState={updateStateAndSync} onUpdateCurrentSession={handleUpdateCurrentSession} />}
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
            <p className="text-xs text-slate-300 leading-relaxed font-semibold mb-5">هل تود شحن المنظومة وتحميل كافة البيانات النموذجية الآن؟ <br /><strong className="text-rose-500 font-sans block mt-2 text-[10px]">⚠️ تحذير شديد: سيتم استبدال ALL البيانات الحالية. هذا الإجراء لا يمكن التراجع عنه!</strong></p>
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
            <p className="text-xs text-slate-300 leading-relaxed font-semibold mb-5">هل تود شحن المنظومة ببيانات العينة وتجربة كافة الميزات الآن؟ <br /><strong className="text-rose-500 font-sans block mt-2 text-[10px]">⚠️ تحذير شديد: سيتم استبدال ALL البيانات الحالية. هذا الإجراء لا يمكن التراجع عنه!</strong></p>
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
              <p className="text-slate-400 text-xs mt-1 font-medium">اختر من أربعة مظاهر متكاملة ومريحة للعين.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 overflow-y-auto max-h-[60vh] p-1">
              {[
                { id: "banker-light", icon: "☀️", label: "الوضع النهاري", bgThemeClass: "bg-slate-100 text-slate-800" },
                { id: "midnight-cobalt", icon: "🌌", label: "ليل الكوبالت", bgThemeClass: "bg-[#071329] text-cyan-300" },
                { id: "sahara-aurora", icon: "🌅", label: "شفق الصحراء", bgThemeClass: "bg-[#2a1535] text-amber-300" },
                { id: "emerald-glass", icon: "💎", label: "الزمرد الزجاجي", bgThemeClass: "bg-[#062923] text-teal-200" },
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
