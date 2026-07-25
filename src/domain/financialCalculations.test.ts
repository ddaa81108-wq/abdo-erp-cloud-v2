import { describe, expect, it } from 'vitest';
import type { CompanyTransaction, DebtTransaction, MerchantTransaction, TreasuryTransaction, TrustDepositTx } from '../types';
import {
  calculateCompanyLedgerBalance,
  calculateCustomerCycleBalance,
  calculateMerchantLedgerBalance,
  calculateTreasuryBalance,
  calculateTrustBalances,
} from './financialCalculations';

const debtTransaction = (overrides: Partial<DebtTransaction>): DebtTransaction => ({
  id: 'tx', customerId: 'customer', cycleId: 'cycle', type: 'debt',
  amount: 0, currency: 'LYD', conversionRate: 1, date: '2026-01-01',
  referenceNo: 'REF', note: '', postedToTreasury: false, createdAt: '2026-01-01',
  ...overrides,
});

describe('customer debt calculations', () => {
  it('calculates opening balance plus debts minus payments', () => {
    expect(calculateCustomerCycleBalance(
      { id: 'cycle', initialBalance: 100 },
      [
        debtTransaction({ id: 'debt', type: 'debt', amount: 500 }),
        debtTransaction({ id: 'payment', type: 'payment', amount: 250 }),
      ],
    )).toBe(350);
  });

  it('supports an overpayment as a negative balance', () => {
    expect(calculateCustomerCycleBalance(
      { id: 'cycle', initialBalance: 0 },
      [debtTransaction({ type: 'payment', amount: 300 })],
    )).toBe(-300);
  });

  it('ignores deleted entries and converts currency', () => {
    expect(calculateCustomerCycleBalance(
      { id: 'cycle', initialBalance: 0 },
      [
        debtTransaction({ id: 'converted', amount: 100, conversionRate: 5 }),
        debtTransaction({ id: 'deleted', amount: 900, isDeleted: true }),
      ],
    )).toBe(500);
  });
});

describe('supplier ledgers', () => {
  it('calculates company purchases and payments', () => {
    const transactions = [
      { companyId: 'company', type: 'purchase_invoice', amount: 1000 },
      { companyId: 'company', type: 'payment', amount: 400 },
    ] as CompanyTransaction[];
    expect(calculateCompanyLedgerBalance(transactions, 'company', 50)).toBe(650);
  });

  it('calculates one merchant without mixing another merchant', () => {
    const transactions = [
      { merchantId: 'one', type: 'debt', amount: 900 },
      { merchantId: 'one', type: 'payment', amount: 200 },
      { merchantId: 'two', type: 'debt', amount: 5000 },
    ] as MerchantTransaction[];
    expect(calculateMerchantLedgerBalance(transactions, 'one')).toBe(700);
  });
});

describe('treasury calculations', () => {
  it('calculates inbound and outbound local-currency value', () => {
    const transactions = [
      { type: 'in', amount: 1000, conversionRate: 1 },
      { type: 'out', amount: 100, conversionRate: 5 },
    ] as TreasuryTransaction[];
    expect(calculateTreasuryBalance(transactions)).toBe(500);
  });

  it('ignores soft-deleted entries', () => {
    const transactions = [
      { type: 'in', amount: 1000, conversionRate: 1 },
      { type: 'out', amount: 999, conversionRate: 1, isDeleted: true },
    ] as TreasuryTransaction[];
    expect(calculateTreasuryBalance(transactions)).toBe(1000);
  });
});

describe('trust deposits', () => {
  it('tracks both currencies through deposits, conversion and withdrawal', () => {
    const history = [
      { type: 'deposit_lyd', amountLyd: 1000, amountEgp: 0 },
      { type: 'convert_to_egp', amountLyd: 200, amountEgp: 3000 },
      { type: 'withdraw_egp', amountLyd: 0, amountEgp: 500 },
    ] as TrustDepositTx[];
    expect(calculateTrustBalances(history)).toEqual({ amountLyd: 800, amountEgp: 2500 });
  });
});
