import { describe, expect, it } from 'vitest';
import type { CompanyTransaction } from '../types';
import {
  calculateBusinessBalance,
  calculateBusinessSummary,
  migrateLegacyBusinessAccounts,
  upsertBusinessPaymentInTreasury,
} from './businessAccounts';

const transaction = (
  id: string,
  type: 'purchase_invoice' | 'payment',
  amount: number,
  extra: Partial<CompanyTransaction> = {},
): CompanyTransaction => ({
  id,
  companyId: 'account-1',
  type,
  amount,
  currency: 'د.ل',
  date: '2026-07-25T10:00:00.000Z',
  referenceNo: id,
  note: '',
  postedToTreasury: false,
  createdAt: '2026-07-25T10:00:00.000Z',
  ...extra,
});

describe('unified business ledger', () => {
  it('uses the ledger as the single source of the final balance', () => {
    const rows = [
      transaction('open', 'purchase_invoice', 1000, {
        entryKind: 'opening_balance',
        date: '2026-07-20T10:00:00.000Z',
      }),
      transaction('old-pay', 'payment', 200, {
        entryKind: 'payment',
        date: '2026-07-22T10:00:00.000Z',
      }),
      transaction('debt', 'purchase_invoice', 600, {
        entryKind: 'debt',
        date: '2026-07-27T10:00:00.000Z',
      }),
      transaction('pay', 'payment', 250, {
        entryKind: 'payment',
        date: '2026-07-27T11:00:00.000Z',
      }),
    ];
    const summary = calculateBusinessSummary(
      rows,
      'account-1',
      new Date('2026-07-27T12:00:00.000Z'),
    );
    expect(calculateBusinessBalance(rows, 'account-1')).toBe(1150);
    expect(summary).toMatchObject({
      balanceBeforeToday: 800,
      debtAddedToday: 600,
      paymentsToday: 250,
      finalBalance: 1150,
    });
  });

  it('shows only debts added on the selected day as new debt', () => {
    const rows = [
      transaction('yesterday', 'purchase_invoice', 900, {
        entryKind: 'debt',
        date: '2026-07-26T10:00:00.000Z',
      }),
      transaction('today', 'purchase_invoice', 300, {
        entryKind: 'debt',
        date: '2026-07-27T10:00:00.000Z',
      }),
    ];
    const summary = calculateBusinessSummary(
      rows,
      'account-1',
      new Date('2026-07-27T12:00:00.000Z'),
    );
    expect(summary.balanceBeforeToday).toBe(900);
    expect(summary.debtAddedToday).toBe(300);
    expect(summary.finalBalance).toBe(1200);
  });

  it('clears old and new debt cards after a full settlement', () => {
    const rows = [
      transaction('old-debt', 'purchase_invoice', 1000, {
        entryKind: 'debt',
        date: '2026-07-26T10:00:00.000Z',
      }),
      transaction('today-debt', 'purchase_invoice', 400, {
        entryKind: 'debt',
        date: '2026-07-27T09:00:00.000Z',
      }),
      transaction('full-payment', 'payment', 1400, {
        entryKind: 'payment',
        paymentMode: 'full',
        date: '2026-07-27T11:00:00.000Z',
      }),
    ];
    const summary = calculateBusinessSummary(
      rows,
      'account-1',
      new Date('2026-07-27T12:00:00.000Z'),
    );
    expect(summary).toMatchObject({
      oldDebt: 0,
      newDebt: 0,
      balanceBeforeToday: 0,
      debtAddedToday: 0,
      paymentsToday: 1400,
      finalBalance: 0,
    });
  });

  it('recalculates after editing or soft deleting any row', () => {
    const rows = [
      transaction('debt', 'purchase_invoice', 500, { entryKind: 'debt' }),
      transaction('pay', 'payment', 200, { entryKind: 'payment' }),
    ];
    expect(calculateBusinessBalance(rows, 'account-1')).toBe(300);
    const edited = rows.map((row) => row.id === 'pay' ? { ...row, amount: 350 } : row);
    expect(calculateBusinessBalance(edited, 'account-1')).toBe(150);
    const deleted = edited.map((row) => row.id === 'debt' ? { ...row, isDeleted: true } : row);
    expect(calculateBusinessBalance(deleted, 'account-1')).toBe(-350);
  });

  it('merges legacy merchants without changing their identifiers', () => {
    const result = migrateLegacyBusinessAccounts([], [], [{
      id: 'mer-1',
      name: 'سالم',
      balance: 300,
      createdAt: '2026-01-01T00:00:00.000Z',
    }], [{
      id: 'm-debt',
      merchantId: 'mer-1',
      type: 'debt',
      amount: 300,
      currency: 'د.ل',
      date: '2026-07-25T10:00:00.000Z',
      referenceNo: 'm-debt',
      note: '',
      postedToTreasury: false,
      createdAt: '2026-07-25T10:00:00.000Z',
    }]);
    expect(result.companies[0]).toMatchObject({ id: 'mer-1', accountType: 'merchant' });
    expect(result.companyTransactions[0].companyId).toBe('mer-1');
    expect(result.merchants).toEqual([]);
  });

  it('creates one opening row for a legacy account that has only a cached balance', () => {
    const result = migrateLegacyBusinessAccounts([{
      id: 'old',
      name: 'شركة قديمة',
      balance: 725,
    }], [], [], []);
    expect(result.companyTransactions).toHaveLength(1);
    expect(result.companyTransactions[0]).toMatchObject({
      companyId: 'old',
      entryKind: 'opening_balance',
      amount: 725,
    });
    expect(result.companies[0].balance).toBe(725);
  });

  it('keeps one linked treasury row when a payment is added, edited, or deleted', () => {
    const payment = transaction('payment-1', 'payment', 250, {
      entryKind: 'payment',
      paymentMode: 'partial',
    });
    const created = upsertBusinessPaymentInTreasury([], payment, 'شركة النور');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      type: 'out',
      amount: 250,
      source: 'company_payment',
      sourceId: 'payment-1',
      isDeleted: false,
    });

    const edited = upsertBusinessPaymentInTreasury(
      created,
      { ...payment, amount: 400 },
      'شركة النور',
    );
    expect(edited).toHaveLength(1);
    expect(edited[0].amount).toBe(400);

    const deleted = upsertBusinessPaymentInTreasury(
      edited,
      { ...payment, amount: 400, isDeleted: true },
      'شركة النور',
    );
    expect(deleted[0].isDeleted).toBe(true);
  });
});
