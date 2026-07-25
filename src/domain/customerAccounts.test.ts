import { describe, expect, it } from 'vitest';
import type { CustomerCycle, DebtTransaction } from '../types';
import {
  calculateActiveCycleBalance,
  customerLastActivityAt,
  debtAgeInDays,
  oldestOutstandingDebtDate,
  repairLegacyCustomerCycles,
  upsertCustomerPaymentInTreasury,
} from './customerAccounts';

const cycle: CustomerCycle = {
  id: 'cycle-1',
  customerId: 'customer-1',
  startDate: '2026-07-01T00:00:00.000Z',
  status: 'active',
  initialBalance: 0,
  currentBalance: 0,
};

const tx = (
  id: string,
  type: 'debt' | 'payment',
  amount: number,
  date: string,
): DebtTransaction => ({
  id,
  customerId: 'customer-1',
  cycleId: 'cycle-1',
  type,
  amount,
  currency: 'د.ل',
  conversionRate: 1,
  date,
  referenceNo: id,
  note: '',
  postedToTreasury: type === 'payment',
  createdAt: date,
});

describe('customer account ledger', () => {
  it('calculates the active balance only from separate ledger rows', () => {
    const rows = [
      tx('d1', 'debt', 500, '2026-07-01T00:00:00.000Z'),
      tx('d2', 'debt', 200, '2026-07-02T00:00:00.000Z'),
      tx('p1', 'payment', 100, '2026-07-03T00:00:00.000Z'),
    ];
    expect(calculateActiveCycleBalance(cycle, rows)).toBe(600);
    expect(rows).toHaveLength(3);
  });

  it('recalculates immediately after editing or soft deleting a row', () => {
    const rows = [
      tx('d1', 'debt', 500, '2026-07-01T00:00:00.000Z'),
      tx('p1', 'payment', 100, '2026-07-03T00:00:00.000Z'),
    ];
    const edited = rows.map((row) => row.id === 'd1' ? { ...row, amount: 750 } : row);
    expect(calculateActiveCycleBalance(cycle, edited)).toBe(650);
    const deleted = edited.map((row) => row.id === 'p1' ? { ...row, isDeleted: true } : row);
    expect(calculateActiveCycleBalance(cycle, deleted)).toBe(750);
  });

  it('ages the oldest amount that is still unpaid', () => {
    const rows = [
      tx('d1', 'debt', 500, '2026-07-01T00:00:00.000Z'),
      tx('d2', 'debt', 300, '2026-07-10T00:00:00.000Z'),
      tx('p1', 'payment', 500, '2026-07-11T00:00:00.000Z'),
    ];
    expect(oldestOutstandingDebtDate(cycle, rows)).toBe('2026-07-10T00:00:00.000Z');
    expect(debtAgeInDays('2026-07-10T00:00:00.000Z', new Date('2026-07-13T12:00:00.000Z'))).toBe(3);
  });

  it('repairs the old double-counted opening pattern', () => {
    const oldCycle = { ...cycle, initialBalance: 400, currentBalance: 400 };
    const rows = [tx('d1', 'debt', 400, '2026-07-01T00:00:30.000Z')];
    const [repaired] = repairLegacyCustomerCycles([oldCycle], rows);
    expect(repaired.initialBalance).toBe(0);
    expect(repaired.currentBalance).toBe(400);
  });

  it('preserves a legacy cached balance when its ledger rows are missing', () => {
    const [repaired] = repairLegacyCustomerCycles(
      [{ ...cycle, currentBalance: 325 }],
      [],
    );
    expect(repaired.initialBalance).toBe(325);
    expect(repaired.currentBalance).toBe(325);
  });

  it('sorts activity by the latest transaction update', () => {
    const customer = { id: 'customer-1', name: 'أحمد', createdAt: '2026-01-01' };
    const rows = [tx('d1', 'debt', 50, '2026-07-01T00:00:00.000Z')];
    rows[0].updatedAt = '2026-07-20T00:00:00.000Z';
    expect(customerLastActivityAt(customer, rows)).toBe(new Date(rows[0].updatedAt).getTime());
  });

  it('creates and updates one linked inbound treasury row', () => {
    const payment = {
      ...tx('p1', 'payment', 150, '2026-07-20T00:00:00.000Z'),
      paymentMode: 'partial' as const,
    };
    const created = upsertCustomerPaymentInTreasury([], payment, 'أحمد');
    expect(created[0]).toMatchObject({
      type: 'in',
      amount: 150,
      source: 'customer_payment',
      sourceId: 'p1',
    });
    const updated = upsertCustomerPaymentInTreasury(created, { ...payment, amount: 250 }, 'أحمد');
    expect(updated).toHaveLength(1);
    expect(updated[0].amount).toBe(250);
  });
});
