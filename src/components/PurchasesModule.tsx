import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Calculator,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  FileText,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  ERPState,
  PurchaseAccountState,
  PurchaseAuditEntry,
  PurchaseRecord,
  User,
} from '../types';
import {
  calculatePurchaseRow,
  calculatePurchaseTotals,
  isVodafonePurchase,
  nextPurchaseBusinessDate,
  purchaseInteger,
  type PurchaseMerchant,
} from '../domain/purchaseLedger';
import { openSmartCardStudio } from '../utils/imageExporterUtils';

interface PurchasesModuleProps {
  state: ERPState;
  currentUser: User | null;
  onUpdateState: (newState: ERPState) => void;
  onOpenExporter: (
    section: string,
    metrics: unknown,
    headers: string[],
    rows: unknown[][],
  ) => void;
}

type EditableField = 'type' | 'value' | 'rate' | 'paid' | 'consumer';

const MERCHANTS: PurchaseMerchant[] = ['baqy', 'semsem'];
const MERCHANT_LABELS: Record<PurchaseMerchant, string> = {
  baqy: 'البيان',
  semsem: 'سمسم',
};
const DAY_COLORS = [
  'bg-sky-100 text-sky-950 border-sky-300',
  'bg-violet-100 text-violet-950 border-violet-300',
  'bg-amber-100 text-amber-950 border-amber-300',
  'bg-rose-100 text-rose-950 border-rose-300',
  'bg-cyan-100 text-cyan-950 border-cyan-300',
];
const INPUT_FIELDS: EditableField[] = ['type', 'value', 'rate', 'paid', 'consumer'];

const localDate = () => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
};

const makeId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const dayColor = (date: string) => {
  const hash = [...date].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return DAY_COLORS[hash % DAY_COLORS.length];
};

const money = (value: number, currency = 'د.ل') =>
  `${purchaseInteger(value).toLocaleString('en-US')} ${currency}`;

function makeAccount(
  merchant: PurchaseMerchant,
  activeDate = localDate(),
  openingBalanceLyd = 0,
  openingBalanceEgp = 0,
): PurchaseAccountState {
  return {
    id: `purchase_account_${merchant}`,
    merchant,
    openingBalanceLyd: purchaseInteger(openingBalanceLyd),
    openingBalanceEgp: purchaseInteger(openingBalanceEgp),
    activeDate,
    updatedAt: new Date().toISOString(),
  };
}

export default function PurchasesModule({
  state,
  currentUser,
  onUpdateState,
}: PurchasesModuleProps) {
  const [activeMerchant, setActiveMerchant] = useState<PurchaseMerchant>('baqy');
  const [editingArchivedDate, setEditingArchivedDate] = useState<string | null>(null);
  const [archivedDraftRows, setArchivedDraftRows] = useState<PurchaseRecord[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [calcRows, setCalcRows] = useState([
    { id: 'calc_1', value: '', price: '', operator: 'multiply' as const },
  ]);
  const [calcCopied, setCalcCopied] = useState(false);

  const actorName = currentUser?.name || currentUser?.username || 'مستخدم المنظومة';
  const canManageArchive =
    currentUser?.role === 'admin' || currentUser?.role === 'accountant';
  const canDeleteActive = currentUser?.role === 'admin';

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const makeAudit = (
    action: PurchaseAuditEntry['action'],
    details: string,
    date: string,
    purchaseId?: string,
  ): PurchaseAuditEntry => ({
    id: makeId('purchase_audit'),
    purchaseId,
    merchant: activeMerchant,
    date,
    action,
    actorId: currentUser?.id,
    actorName,
    details,
    createdAt: new Date().toISOString(),
  });

  // One-time, non-destructive migration from the old experimental document.
  useEffect(() => {
    if ((state.purchaseLedgerMigrationVersion || 0) >= 1) return;
    let cancelled = false;

    const migrate = async () => {
      const migratedRows: PurchaseRecord[] = [];
      const accounts: PurchaseAccountState[] = [];

      try {
        const snapshot = db
          ? await getDoc(doc(db, 'erp_system', 'purchases_module_v4'))
          : null;
        let oldStates = snapshot?.exists() ? snapshot.data().merchStates || {} : {};
        if (!Object.keys(oldStates).length) {
          try {
            oldStates = JSON.parse(
              localStorage.getItem('ABDO_DAILY_PURCHASES_V4') || '{}',
            );
          } catch {
            oldStates = {};
          }
        }

        for (const merchant of MERCHANTS) {
          const oldAccount = oldStates[merchant] || {};
          const oldRows = Array.isArray(oldAccount.rows) ? oldAccount.rows : [];
          const dates = oldRows
            .map((row: any) => String(row.date || ''))
            .filter(Boolean)
            .sort();
          const activeDate = dates.at(-1) || localDate();

          accounts.push(makeAccount(
            merchant,
            activeDate,
            oldAccount.previousBalance,
            oldAccount.egyptianPreviousBalance,
          ));

          oldRows.forEach((oldRow: any, index: number) => {
            const base: PurchaseRecord = {
              id: `purchase_${merchant}_${oldRow.id || index + 1}`,
              merchant,
              seq: Number(oldRow.seq) || index + 1,
              type: String(oldRow.type || ''),
              value: oldRow.value || 0,
              op: oldRow.op === 'multiply' ? 'multiply' : 'divide',
              rate: oldRow.rate || 10,
              paid: oldRow.paid || 0,
              consumer: oldRow.consumer || 0,
              result: Number(oldRow.result) || 0,
              remaining: Number(oldRow.remaining) || 0,
              date: oldRow.date || activeDate,
              createdAt: oldRow.createdAt || new Date().toISOString(),
              updatedAt: oldRow.updatedAt,
            };
            migratedRows.push(calculatePurchaseRow(base));
          });
        }
      } catch (error) {
        console.error('Purchase ledger migration failed', error);
        if (db) {
          notify('تعذر نقل بيانات المشتريات القديمة. لم يتم حذف أو تغيير البيانات، وسيعاد المحاولة عند فتح القسم لاحقًا.');
          return;
        }
        MERCHANTS.forEach((merchant) => accounts.push(makeAccount(merchant)));
      }

      if (cancelled) return;
      const existingIds = new Set((state.purchases || []).map((row) => row.id));
      const nextRows = migratedRows.filter((row) => !existingIds.has(row.id));
      const existingAccounts = state.purchaseAccounts || [];
      const normalizedAccounts = [
        ...existingAccounts,
        ...MERCHANTS
          .filter((merchant) =>
            !existingAccounts.some((account) => account.merchant === merchant))
          .map((merchant) =>
            accounts.find((account) => account.merchant === merchant)
            || makeAccount(merchant)),
      ];
      onUpdateState({
        ...state,
        purchases: [...(state.purchases || []), ...nextRows],
        purchaseAccounts: normalizedAccounts,
        purchaseAuditLog: state.purchaseAuditLog || [],
        purchaseLedgerMigrationVersion: 1,
      });
    };

    void migrate();
    return () => {
      cancelled = true;
    };
  }, [state.purchaseLedgerMigrationVersion]);

  const accounts = state.purchaseAccounts || [];
  const account = accounts.find((item) => item.merchant === activeMerchant)
    || makeAccount(activeMerchant);
  const ledgerRows = (state.purchases || [])
    .filter((row) => row.merchant === activeMerchant && !row.isDeleted)
    .sort((left, right) =>
      left.date.localeCompare(right.date)
      || (left.seq || 0) - (right.seq || 0));
  const totals = calculatePurchaseTotals(state.purchases || [], account);
  const activeRows = ledgerRows.filter((row) => row.date === account.activeDate);

  useEffect(() => {
    if (activeRows.length === 0 || reviewDismissed) return;
    const timer = window.setTimeout(() => {
      setToast('راجع معاملات اليوم قبل الترحيل.');
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeRows.length, reviewDismissed, activeMerchant]);

  const rowsByDay = useMemo(() => {
    const grouped = new Map<string, PurchaseRecord[]>();
    for (const row of ledgerRows) {
      const rows = grouped.get(row.date) || [];
      rows.push(row);
      grouped.set(row.date, rows);
    }
    if (!grouped.has(account.activeDate)) grouped.set(account.activeDate, []);
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [ledgerRows, account.activeDate]);

  const updateStateRows = (
    purchases: PurchaseRecord[],
    audit?: PurchaseAuditEntry,
    nextAccounts = accounts,
  ) => {
    onUpdateState({
      ...state,
      purchases,
      purchaseAccounts: nextAccounts,
      purchaseAuditLog: audit
        ? [...(state.purchaseAuditLog || []), audit]
        : state.purchaseAuditLog || [],
    });
  };

  const patchRow = (
    row: PurchaseRecord,
    field: EditableField | 'op',
    value: string,
  ) => {
    const patched = { ...row, [field]: value, updatedAt: new Date().toISOString(), updatedBy: actorName };
    return calculatePurchaseRow(patched);
  };

  const handleRowChange = (
    rowId: string,
    field: EditableField | 'op',
    value: string,
    archived = false,
  ) => {
    if (archived) {
      setArchivedDraftRows((rows) =>
        rows.map((row) => row.id === rowId ? patchRow(row, field, value) : row));
      return;
    }
    updateStateRows((state.purchases || []).map((row) =>
      row.id === rowId ? patchRow(row, field, value) : row));
  };

  const handleFieldBlur = (
    row: PurchaseRecord,
    field: EditableField,
    archived: boolean,
  ) => {
    if (field === 'rate' && Number(row.rate) <= 0) {
      notify('سعر الصرف يجب أن يكون أكبر من صفر.');
      return;
    }
    if (archived) {
      if (field !== 'type' && field !== 'rate') {
        handleRowChange(row.id, field, String(purchaseInteger(row[field])), true);
      }
      return;
    }

    const normalizedRows = (state.purchases || []).map((item) => {
      if (item.id !== row.id || field === 'type' || field === 'rate') return item;
      return patchRow(item, field, String(purchaseInteger(item[field])));
    });
    updateStateRows(
      normalizedRows,
      makeAudit(
        'update',
        `تعديل حقل ${field} في المعاملة رقم ${row.seq || '-'}`,
        row.date,
        row.id,
      ),
    );
  };

  const addRow = () => {
    const nextSeq = Math.max(0, ...(state.purchases || [])
      .filter((row) => row.merchant === activeMerchant)
      .map((row) => row.seq || 0)) + 1;
    const now = new Date().toISOString();
    const newRow = calculatePurchaseRow({
      id: makeId('purchase'),
      merchant: activeMerchant,
      seq: nextSeq,
      type: '',
      value: 0,
      op: 'divide',
      rate: 10,
      paid: 0,
      consumer: 0,
      result: 0,
      remaining: 0,
      date: account.activeDate,
      createdAt: now,
      updatedAt: now,
      createdBy: actorName,
    });
    updateStateRows(
      [...(state.purchases || []), newRow],
      makeAudit('create', `إضافة المعاملة رقم ${nextSeq}`, account.activeDate, newRow.id),
    );
    window.setTimeout(() => {
      document.getElementById(`purchase-type-${newRow.id}`)?.focus();
    }, 50);
  };

  const deleteActiveRow = (row: PurchaseRecord) => {
    if (!canDeleteActive || row.date !== account.activeDate) return;
    const now = new Date().toISOString();
    updateStateRows(
      (state.purchases || []).map((item) =>
        item.id === row.id
          ? { ...item, isDeleted: true, deletedAt: now, updatedAt: now, updatedBy: actorName }
          : item),
      makeAudit('delete', `نقل المعاملة رقم ${row.seq || '-'} إلى سلة المهملات`, row.date, row.id),
    );
    notify('تم نقل المعاملة إلى سلة المهملات.');
  };

  const startArchivedEdit = (date: string, rows: PurchaseRecord[]) => {
    if (!canManageArchive) return;
    setEditingArchivedDate(date);
    setArchivedDraftRows(rows.map((row) => ({ ...row })));
  };

  const cancelArchivedEdit = () => {
    setEditingArchivedDate(null);
    setArchivedDraftRows([]);
  };

  const saveArchivedEdit = () => {
    if (!editingArchivedDate || !canManageArchive) return;
    if (archivedDraftRows.some((row) => Number(row.rate) <= 0)) {
      notify('لا يمكن الحفظ: سعر الصرف يجب أن يكون أكبر من صفر.');
      return;
    }
    const drafts = new Map<string, PurchaseRecord>(
      archivedDraftRows.map((row): [string, PurchaseRecord] => [row.id, row]),
    );
    updateStateRows(
      (state.purchases || []).map((row) => drafts.get(row.id) || row),
      makeAudit(
        'update',
        `تعديل معاملات اليوم المؤرشف ${editingArchivedDate}`,
        editingArchivedDate,
      ),
    );
    cancelArchivedEdit();
    notify('تم حفظ تعديل اليوم القديم وتحديث جميع الإجماليات.');
  };

  const archiveActiveDay = () => {
    if (!canManageArchive) {
      notify('ترحيل اليوم متاح للمدير أو المحاسب فقط.');
      return;
    }
    if (activeRows.some((row) => Number(row.rate) <= 0)) {
      notify('لا يمكن الترحيل: يوجد سعر صرف يساوي صفرًا.');
      return;
    }
    const nextDate = nextPurchaseBusinessDate(account.activeDate, localDate());
    const nextAccounts = accounts.some((item) => item.merchant === activeMerchant)
      ? accounts.map((item) =>
          item.merchant === activeMerchant
            ? { ...item, activeDate: nextDate, updatedAt: new Date().toISOString() }
            : item)
      : [...accounts, { ...account, activeDate: nextDate, updatedAt: new Date().toISOString() }];
    updateStateRows(
      state.purchases || [],
      makeAudit('archive', `ترحيل يوم ${account.activeDate} وفتح يوم ${nextDate}`, account.activeDate),
      nextAccounts,
    );
    setShowArchiveConfirm(false);
    setReviewDismissed(true);
    notify(`تم ترحيل يوم ${account.activeDate} وفتح يوم ${nextDate}.`);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    row: PurchaseRecord,
    field: EditableField,
    archived: boolean,
  ) => {
    if (!event.key.startsWith('Arrow')) return;
    event.preventDefault();
    const visibleRows = archived ? archivedDraftRows : activeRows;
    const rowIndex = visibleRows.findIndex((item) => item.id === row.id);
    const fieldIndex = INPUT_FIELDS.indexOf(field);
    let nextRowIndex = rowIndex;
    let nextFieldIndex = fieldIndex;

    if (event.key === 'ArrowDown') nextRowIndex += 1;
    if (event.key === 'ArrowUp') nextRowIndex -= 1;
    if (event.key === 'ArrowLeft') nextFieldIndex += 1;
    if (event.key === 'ArrowRight') nextFieldIndex -= 1;

    const nextRow = visibleRows[nextRowIndex];
    const nextField = INPUT_FIELDS[nextFieldIndex];
    if (nextRow && nextField) {
      const input = document.getElementById(`purchase-${nextField}-${nextRow.id}`);
      input?.focus();
      (input as HTMLInputElement | null)?.select();
    } else if (
      !archived
      && event.key === 'ArrowDown'
      && rowIndex === visibleRows.length - 1
    ) {
      addRow();
    }
  };

  const openSmartSystem = () => {
    openSmartCardStudio({
      type: 'purchases',
      merchant: MERCHANT_LABELS[activeMerchant],
      p1: totals.previousLyd,
      p2: totals.todayWork,
      p3: totals.todayPaid,
      p4: totals.totalDebtLyd,
      p5: totals.remainingEgp,
      date: account.activeDate,
    });
  };

  const calcResult = (row: typeof calcRows[number]) => {
    const left = Number(row.value) || 0;
    const right = Number(row.price) || 0;
    if (row.operator === 'divide') return right === 0 ? 0 : Math.trunc(left / right);
    if (row.operator === 'add') return Math.trunc(left + right);
    if (row.operator === 'subtract') return Math.trunc(left - right);
    return Math.trunc(left * right);
  };
  const totalCalc = calcRows.reduce((sum, row) => sum + calcResult(row), 0);

  return (
    <div className="space-y-3 text-right" dir="rtl">
      {toast && (
        <div className="fixed right-5 top-20 z-[90] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-sm font-black text-emerald-950 shadow-2xl">
          <Check className="h-5 w-5 text-emerald-600" />
          <span className="flex-1">{toast}</span>
          <button type="button" onClick={() => { setToast(null); setReviewDismissed(true); }}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <UnifiedTile title="القيم السابقة" value={money(totals.previousLyd)} icon={<RotateCcw />} />
        <UnifiedTile title="إجمالي اليوم" value={money(totals.todayWork)} icon={<FileText />} />
        <UnifiedTile title="إجمالي المسدد" value={money(totals.todayPaid)} icon={<Check />} />
        <UnifiedTile title="إجمالي الديون" value={money(totals.totalDebtLyd)} icon={<Archive />} danger={totals.totalDebtLyd > 0} />
        <UnifiedTile title="الباقي المصري" value={money(totals.remainingEgp, 'ج.م')} icon={<Sparkles />} />

        <div className="flex min-h-[92px] rounded-2xl border-2 border-emerald-500 bg-emerald-700 p-2 text-white shadow-sm">
          {MERCHANTS.map((merchant) => (
            <button
              key={merchant}
              type="button"
              onClick={() => {
                setActiveMerchant(merchant);
                cancelArchivedEdit();
              }}
              className={`flex-1 rounded-xl px-2 text-sm font-black transition ${
                activeMerchant === merchant ? 'bg-white text-emerald-800 shadow' : 'hover:bg-emerald-600'
              }`}
            >
              {MERCHANT_LABELS[merchant]}
            </button>
          ))}
        </div>
        <UnifiedAction title="النظام الذكي" icon={<Smartphone />} onClick={openSmartSystem} />
        <UnifiedAction title="الآلة الحاسبة" icon={<Calculator />} onClick={() => setShowCalculator(true)} />
        <UnifiedAction title="إضافة معاملة" icon={<Plus />} onClick={addRow} />
        <UnifiedAction
          title="ترحيل اليوم"
          icon={<Archive />}
          onClick={() => setShowArchiveConfirm(true)}
          disabled={!canManageArchive}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-700" />
            <h2 className="text-sm font-black text-slate-900">سجل المشتريات اليومي والأرشيف</h2>
          </div>
          <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-800">
            اليوم النشط: {account.activeDate}
          </span>
        </div>

        <div className="max-h-[72vh] overflow-auto">
          <table className="min-w-[1250px] w-full table-fixed border-collapse text-[11px]">
            <thead className="sticky top-0 z-20 bg-emerald-800 font-black text-white shadow-sm">
              <tr>
                <th className="w-[4%] border-l border-emerald-700 p-2 text-center">ت</th>
                <th className="w-[10%] border-l border-emerald-700 p-2 text-center">التاريخ</th>
                <th className="w-[15%] border-l border-emerald-700 p-2 text-center">النوع</th>
                <th className="w-[11%] border-l border-emerald-700 p-2 text-center">القيمة (مصري)</th>
                <th className="w-[9%] border-l border-emerald-700 p-2 text-center">العملية</th>
                <th className="w-[8%] border-l border-emerald-700 p-2 text-center">سعر الصرف</th>
                <th className="w-[10%] border-l border-emerald-700 p-2 text-center">الناتج (د.ل)</th>
                <th className="w-[10%] border-l border-emerald-700 p-2 text-center">المسدد (د.ل)</th>
                <th className="w-[10%] border-l border-emerald-700 p-2 text-center">الباقي (د.ل)</th>
                <th className="w-[9%] border-l border-emerald-700 p-2 text-center">مستهلك فودافون</th>
                <th className="w-[4%] p-2 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-800">
              {rowsByDay.map(([date, storedRows]) => {
                const active = date === account.activeDate;
                const editing = editingArchivedDate === date;
                const displayRows = editing ? archivedDraftRows : storedRows;
                const color = active
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                  : dayColor(date);
                return (
                  <React.Fragment key={date}>
                    <tr className={`border-y ${color}`}>
                      <td colSpan={11} className="px-3 py-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 font-sans font-black">
                            <span>{new Date(`${date}T12:00:00`).toLocaleDateString('ar-LY', { weekday: 'long' })}</span>
                            <span dir="ltr">{date}</span>
                            <span className="rounded-lg bg-white/70 px-2 py-0.5 text-[10px]">
                              {active ? 'اليوم النشط' : 'مؤرشف — قراءة فقط'}
                            </span>
                          </div>
                          {!active && canManageArchive && (
                            editing ? (
                              <div className="flex gap-1">
                                <button type="button" onClick={saveArchivedEdit} className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1 text-xs font-black text-white"><Save className="h-3.5 w-3.5" /> حفظ</button>
                                <button type="button" onClick={cancelArchivedEdit} className="rounded-lg bg-white/80 px-3 py-1 text-xs font-black">إلغاء</button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => startArchivedEdit(date, storedRows)} className="flex items-center gap-1 rounded-lg bg-white/85 px-3 py-1 text-xs font-black shadow-sm"><Edit3 className="h-3.5 w-3.5" /> تعديل اليوم</button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-5 text-center font-sans font-bold text-slate-400">
                          لا توجد معاملات في اليوم النشط. اضغط «إضافة معاملة».
                        </td>
                      </tr>
                    ) : displayRows.map((row) => (
                      <React.Fragment key={row.id}>
                        <PurchaseTableRow
                          row={row}
                          active={active}
                          editing={editing}
                          canDelete={canDeleteActive}
                          onChange={handleRowChange}
                        onDelete={deleteActiveRow}
                        onKeyDown={handleKeyDown}
                        onBlur={handleFieldBlur}
                        />
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
              <tr className="sticky bottom-0 z-10 border-t-2 border-emerald-700 bg-emerald-50 font-black">
                <td colSpan={6} className="p-2 text-center font-sans">الإجماليات الحالية</td>
                <td className="p-2 text-center">{money(totals.todayWork)}</td>
                <td className="p-2 text-center text-emerald-800">{money(totals.todayPaid)}</td>
                <td className="p-2 text-center text-rose-700">{money(totals.totalDebtLyd)}</td>
                <td className="p-2 text-center text-violet-800">{money(totals.remainingEgp, 'ج.م')}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {showArchiveConfirm && (
        <Modal title="ترحيل اليوم" onClose={() => setShowArchiveConfirm(false)}>
          <p className="text-sm font-bold text-slate-700">
            سيتم إغلاق يوم <span className="font-mono text-emerald-800">{account.activeDate}</span> للقراءة فقط وفتح يوم عمل جديد. يمكنك تعديل اليوم القديم لاحقًا من زر «تعديل اليوم».
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setShowArchiveConfirm(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">إلغاء</button>
            <button type="button" onClick={archiveActiveDay} className="rounded-xl bg-emerald-700 px-5 py-2 text-sm font-black text-white">تأكيد الترحيل</button>
          </div>
        </Modal>
      )}

      {showCalculator && (
        <Modal title="الآلة الحاسبة" onClose={() => setShowCalculator(false)}>
          <div className="space-y-2">
            {calcRows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto_1fr_auto_auto] items-center gap-2">
                <input type="number" step="any" value={row.value} onChange={(event) => setCalcRows((rows) => rows.map((item) => item.id === row.id ? { ...item, value: event.target.value } : item))} className="rounded-xl border p-2 text-center font-mono" placeholder="القيمة الأولى" />
                <select value={row.operator} onChange={(event) => setCalcRows((rows) => rows.map((item) => item.id === row.id ? { ...item, operator: event.target.value as any } : item))} className="rounded-xl border p-2 font-black">
                  <option value="multiply">×</option><option value="divide">÷</option><option value="add">+</option><option value="subtract">−</option>
                </select>
                <input type="number" step="any" value={row.price} onChange={(event) => setCalcRows((rows) => rows.map((item) => item.id === row.id ? { ...item, price: event.target.value } : item))} className="rounded-xl border p-2 text-center font-mono" placeholder="القيمة الثانية" />
                <strong className="min-w-20 text-center font-mono">{calcResult(row).toLocaleString('en-US')}</strong>
                <button type="button" onClick={() => setCalcRows((rows) => rows.filter((item) => item.id !== row.id))} className="text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setCalcRows((rows) => [...rows, { id: makeId('calc'), value: '', price: '', operator: 'multiply' }])} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed p-2 text-sm font-black text-emerald-700"><Plus className="h-4 w-4" /> إضافة سطر</button>
          <div className="relative mt-4 rounded-2xl bg-emerald-800 p-4 text-white">
            <span className="text-xs font-black">الإجمالي</span>
            <div className="font-mono text-3xl font-black">{totalCalc.toLocaleString('en-US')}</div>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(String(totalCalc)); setCalcCopied(true); window.setTimeout(() => setCalcCopied(false), 1500); }} className="absolute bottom-3 left-3 flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-black">
              {calcCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {calcCopied ? 'تم النسخ' : 'نسخ'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PurchaseTableRow({
  row,
  active,
  editing,
  canDelete,
  onChange,
  onDelete,
  onKeyDown,
  onBlur,
}: {
  row: PurchaseRecord;
  active: boolean;
  editing: boolean;
  canDelete: boolean;
  onChange: (id: string, field: EditableField | 'op', value: string, archived?: boolean) => void;
  onDelete: (row: PurchaseRecord) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>, row: PurchaseRecord, field: EditableField, archived: boolean) => void;
  onBlur: (row: PurchaseRecord, field: EditableField, archived: boolean) => void;
}) {
  const editable = active || editing;
  const archived = !active;
  const inputClass = 'h-10 w-full border-0 bg-transparent px-2 text-center font-mono font-bold outline-none focus:bg-white/70 disabled:cursor-default disabled:text-slate-700';
  const field = (name: EditableField, placeholder: string) => (
    <input
      id={`purchase-${name}-${row.id}`}
      type="text"
      inputMode={name === 'type' ? 'text' : 'decimal'}
      value={(row[name] as string | number | undefined) || ''}
      placeholder={placeholder}
      disabled={!editable}
      onChange={(event) => onChange(row.id, name, event.target.value, archived)}
      onKeyDown={(event) => onKeyDown(event, row, name, archived)}
      onBlur={() => onBlur(row, name, archived)}
      className={inputClass}
    />
  );

  return (
    <tr className={`border-b border-slate-200 ${active ? 'bg-emerald-50/60' : 'bg-white'} ${isVodafonePurchase(row.type) ? 'font-bold' : ''}`}>
      <td className="p-2 text-center font-black">{row.seq || '-'}</td>
      <td className="p-2 text-center font-mono">{row.date}</td>
      <td className="border-x border-slate-200 p-0">{field('type', 'نوع العملية')}</td>
      <td className="border-l border-slate-200 p-0">{field('value', '0')}</td>
      <td className="border-l border-slate-200 p-1">
        <div className="flex overflow-hidden rounded-lg border bg-white">
          <button type="button" disabled={!editable} onClick={() => onChange(row.id, 'op', 'divide', archived)} className={`flex-1 py-1 font-black ${row.op !== 'multiply' ? 'bg-emerald-700 text-white' : 'text-slate-500'}`}>÷</button>
          <button type="button" disabled={!editable} onClick={() => onChange(row.id, 'op', 'multiply', archived)} className={`flex-1 py-1 font-black ${row.op === 'multiply' ? 'bg-emerald-700 text-white' : 'text-slate-500'}`}>×</button>
        </div>
      </td>
      <td className="border-l border-slate-200 p-0">{field('rate', '10')}</td>
      <td className="border-l border-slate-200 p-2 text-center font-black">{money(row.result || 0)}</td>
      <td className="border-l border-slate-200 p-0">{field('paid', '0')}</td>
      <td className={`border-l border-slate-200 p-2 text-center font-black ${(row.remaining || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{money(row.remaining || 0)}</td>
      <td className="border-l border-slate-200 p-0">{field('consumer', '0')}</td>
      <td className="p-1 text-center">
        {active && canDelete ? (
          <button type="button" onClick={() => onDelete(row)} title="نقل إلى سلة المهملات" className="rounded-lg p-1.5 text-rose-600 transition hover:bg-rose-100"><Trash2 className="mx-auto h-4 w-4" /></button>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

function UnifiedTile({
  title,
  value,
  icon,
  danger = false,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="flex min-h-[92px] flex-col justify-between rounded-2xl border-2 border-emerald-500 bg-emerald-700 p-3 text-white shadow-sm">
      <div className="flex items-center justify-between gap-2 text-xs font-black">
        <span>{title}</span><span className="h-5 w-5">{icon}</span>
      </div>
      <strong className={`font-mono text-xl font-black ${danger ? 'text-amber-200' : 'text-white'}`} dir="ltr">{value}</strong>
    </div>
  );
}

function UnifiedAction({
  title,
  icon,
  onClick,
  disabled = false,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500 bg-emerald-700 p-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="h-6 w-6">{icon}</span><span>{title}</span>
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
