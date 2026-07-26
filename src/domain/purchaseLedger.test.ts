import { describe, expect, it } from 'vitest';
import {
  calculatePurchaseResult,
  calculatePurchaseTotals,
  isVodafonePurchase,
  nextPurchaseBusinessDate,
} from './purchaseLedger';
import type { PurchaseAccountState, PurchaseRecord } from '../types';

const account: PurchaseAccountState = {
  id: 'purchase_account_baqy',
  merchant: 'baqy',
  openingBalanceLyd: 100,
  openingBalanceEgp: 1_000,
  activeDate: '2026-07-26',
  updatedAt: '2026-07-26T00:00:00.000Z',
};

const row = (partial: Partial<PurchaseRecord>): PurchaseRecord => ({
  id: partial.id || crypto.randomUUID(),
  date: partial.date || '2026-07-26',
  createdAt: partial.createdAt || '2026-07-26T00:00:00.000Z',
  merchant: 'baqy',
  ...partial,
});

describe('purchase ledger', () => {
  it('truncates fractional results toward zero instead of rounding up', () => {
    expect(calculatePurchaseResult(10_403, 2, 'divide')).toBe(5_201);
    expect(calculatePurchaseResult(1_001, 5.2, 'multiply')).toBe(5_205);
  });

  it('rejects a zero exchange rate', () => {
    expect(() => calculatePurchaseResult(100, 0, 'divide')).toThrow();
  });

  it('recognizes common Vodafone spelling variations', () => {
    expect(isVodafonePurchase('فودافون')).toBe(true);
    expect(isVodafonePurchase(' ڤودافون - كروت ')).toBe(true);
    expect(isVodafonePurchase('Vodaphone cash')).toBe(true);
  });

  it('recalculates current totals immediately after an archived edit', () => {
    const before = [
      row({ id: 'old', date: '2026-07-25', result: 500, paid: 100, type: 'فودافون', value: 4_000, consumer: 500 }),
      row({ id: 'today', result: 200, paid: 50 }),
    ];
    const after = before.map((item) => item.id === 'old' ? { ...item, result: 700 } : item);
    expect(calculatePurchaseTotals(before, account).totalDebtLyd).toBe(650);
    expect(calculatePurchaseTotals(after, account).totalDebtLyd).toBe(850);
    expect(calculatePurchaseTotals(after, account).remainingEgp).toBe(4_500);
  });

  it('carries the ledger by advancing the active business date only', () => {
    expect(nextPurchaseBusinessDate('2026-07-25', '2026-07-26')).toBe('2026-07-26');
    expect(nextPurchaseBusinessDate('2026-07-26', '2026-07-26')).toBe('2026-07-27');
  });

  it('keeps both merchants independent so the owl can sum their LYD debts', () => {
    const semsemAccount = { ...account, id: 'purchase_account_semsem', merchant: 'semsem' as const };
    const rows = [
      row({ id: 'baqy-row', result: 500, paid: 100 }),
      row({ id: 'semsem-row', merchant: 'semsem', result: 900, paid: 200 }),
    ];
    const owlTotal =
      calculatePurchaseTotals(rows, account).totalDebtLyd
      + calculatePurchaseTotals(rows, semsemAccount).totalDebtLyd;
    expect(owlTotal).toBe(1_300);
  });

  it('removes soft-deleted active rows from every total', () => {
    const totals = calculatePurchaseTotals([
      row({ id: 'kept', result: 500, paid: 100 }),
      row({ id: 'deleted', result: 10_000, paid: 0, isDeleted: true }),
    ], account);
    expect(totals.totalDebtLyd).toBe(500);
  });
});
