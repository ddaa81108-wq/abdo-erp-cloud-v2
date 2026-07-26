import type { PurchaseAccountState, PurchaseRecord } from '../types';

export type PurchaseMerchant = 'baqy' | 'semsem';

export const purchaseInteger = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

export function calculatePurchaseResult(
  value: unknown,
  rate: unknown,
  operation: 'multiply' | 'divide',
): number {
  const valueNumber = purchaseInteger(value);
  const rateNumber = Number(rate);
  if (!Number.isFinite(rateNumber) || rateNumber <= 0) {
    throw new Error('سعر الصرف يجب أن يكون أكبر من صفر.');
  }
  const result = operation === 'multiply'
    ? valueNumber * rateNumber
    : valueNumber / rateNumber;
  return Math.trunc(result);
}

export function calculatePurchaseRow(row: PurchaseRecord): PurchaseRecord {
  let result = 0;
  try {
    result = calculatePurchaseResult(row.value, row.rate, row.op || 'divide');
  } catch {
    result = 0;
  }
  const paid = purchaseInteger(row.paid);
  return { ...row, result, remaining: result - paid };
}

export function normalizePurchaseType(value: string): string {
  return value
    .toLocaleLowerCase('ar')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ڤ/g, 'ف')
    .replace(/[^a-z\u0600-\u06ff]/g, '');
}

export function isVodafonePurchase(type = ''): boolean {
  const normalized = normalizePurchaseType(type);
  return normalized.includes('فودافون')
    || normalized.includes('vodafone')
    || normalized.includes('vodaphone');
}

export interface PurchaseTotals {
  previousLyd: number;
  previousEgp: number;
  todayWork: number;
  todayPaid: number;
  totalDebtLyd: number;
  remainingEgp: number;
}

export function calculatePurchaseTotals(
  allRows: PurchaseRecord[],
  account: PurchaseAccountState,
): PurchaseTotals {
  const rows = allRows.filter(
    (row) => row.merchant === account.merchant && !row.isDeleted,
  );
  const activeRows = rows.filter((row) => row.date === account.activeDate);
  const priorRows = rows.filter((row) => row.date < account.activeDate);

  const lydMovement = (row: PurchaseRecord) =>
    purchaseInteger(row.result) - purchaseInteger(row.paid);
  const egpMovement = (row: PurchaseRecord) =>
    (isVodafonePurchase(row.type) ? purchaseInteger(row.value) : 0)
    - purchaseInteger(row.consumer);

  return {
    previousLyd:
      purchaseInteger(account.openingBalanceLyd)
      + priorRows.reduce((sum, row) => sum + lydMovement(row), 0),
    previousEgp:
      purchaseInteger(account.openingBalanceEgp)
      + priorRows.reduce((sum, row) => sum + egpMovement(row), 0),
    todayWork: activeRows.reduce(
      (sum, row) => sum + purchaseInteger(row.result),
      0,
    ),
    todayPaid: activeRows.reduce(
      (sum, row) => sum + purchaseInteger(row.paid),
      0,
    ),
    totalDebtLyd:
      purchaseInteger(account.openingBalanceLyd)
      + rows.reduce((sum, row) => sum + lydMovement(row), 0),
    remainingEgp:
      purchaseInteger(account.openingBalanceEgp)
      + rows.reduce((sum, row) => sum + egpMovement(row), 0),
  };
}

export function nextPurchaseBusinessDate(activeDate: string, today: string): string {
  if (today > activeDate) return today;
  const next = new Date(`${activeDate}T12:00:00`);
  next.setDate(next.getDate() + 1);
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-');
}
