import { describe, expect, it } from 'vitest';
import { INITIAL_ERP_STATE, type ERPState } from '../types';
import {
  calculateTreasurySummary,
  manualTreasuryTransactions,
} from './treasurySummary';

const emptyState = (): ERPState => ({
  ...structuredClone(INITIAL_ERP_STATE),
  customers: [],
  cycles: [],
  debtTransactions: [],
  companies: [],
  companyTransactions: [],
  merchants: [],
  merchantTransactions: [],
  treasuryTransactions: [],
  purchases: [],
  purchaseAccounts: [],
  purchaseAuditLog: [],
  trustDeposits: [],
});

describe('treasury summary', () => {
  it('uses only manual deposits and withdrawals for active cash', () => {
    const state = emptyState();
    state.treasuryTransactions = [
      {
        id: 'manual-in',
        type: 'in',
        amount: 1000,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-01-01',
        referenceNo: '1',
        source: 'manual_deposit',
        description: '',
        createdAt: '2026-01-01',
      },
      {
        id: 'linked-customer',
        type: 'in',
        amount: 9000,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-01-01',
        referenceNo: '2',
        source: 'customer_payment',
        description: '',
        createdAt: '2026-01-01',
      },
    ];
    expect(manualTreasuryTransactions(state)).toHaveLength(1);
    expect(calculateTreasurySummary(state).activeCash).toBe(1000);
  });

  it('combines section card totals using the requested equation', () => {
    const state = emptyState();
    state.treasuryTransactions = [{
      id: 'cash',
      type: 'in',
      amount: 100,
      currency: 'د.ل',
      conversionRate: 1,
      date: '2026-01-01',
      referenceNo: '1',
      source: 'manual_deposit',
      description: '',
      createdAt: '2026-01-01',
    }];
    state.customers = [{ id: 'c', name: 'عميل', createdAt: '2026-01-01' }];
    state.cycles = [{
      id: 'cycle',
      customerId: 'c',
      startDate: '2026-01-01',
      status: 'active',
      initialBalance: 0,
      currentBalance: 300,
    }];
    state.companies = [{
      id: 'co',
      name: 'شركة',
      balance: 0,
      createdAt: '2026-01-01',
    }];
    state.companyTransactions = [{
      id: 'co-debt',
      companyId: 'co',
      type: 'purchase_invoice',
      entryKind: 'debt',
      amount: 200,
      currency: 'د.ل',
      date: '2026-01-01',
      referenceNo: 'co-1',
      note: '',
      postedToTreasury: false,
      createdAt: '2026-01-01',
    }];
    state.trustDeposits = [{
      id: 'trust',
      customerName: 'أمانة',
      amount: 50,
      amountLyd: 50,
      amountEgp: 0,
      currency: 'د.ل',
      date: '2026-01-01',
      referenceNo: 'trust-1',
      status: 'held',
      note: '',
      createdAt: '2026-01-01',
    }];
    state.purchaseAccounts = [{
      id: 'purchase_account_baqy',
      merchant: 'baqy',
      openingBalanceLyd: 25,
      openingBalanceEgp: 0,
      activeDate: '2026-01-01',
      updatedAt: '2026-01-01',
    }];

    const summary = calculateTreasurySummary(state);
    expect(summary.totalPositives).toBe(600);
    expect(summary.totalObligations).toBe(75);
    expect(summary.netTreasury).toBe(525);
  });

  it('recalculates customer debt from ledger rows instead of a stale card cache', () => {
    const state = emptyState();
    state.customers = [{ id: 'c', name: 'عميل', createdAt: '2026-01-01' }];
    state.cycles = [{
      id: 'cycle',
      customerId: 'c',
      startDate: '2026-01-01',
      status: 'active',
      initialBalance: 100,
      currentBalance: 99_999,
    }];
    state.debtTransactions = [
      {
        id: 'debt',
        customerId: 'c',
        cycleId: 'cycle',
        type: 'debt',
        amount: 500,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-01-01',
        referenceNo: 'd',
        note: '',
        postedToTreasury: false,
        createdAt: '2026-01-01',
      },
      {
        id: 'payment',
        customerId: 'c',
        cycleId: 'cycle',
        type: 'payment',
        amount: 200,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-01-02',
        referenceNo: 'p',
        note: '',
        postedToTreasury: false,
        createdAt: '2026-01-02',
      },
    ];
    expect(calculateTreasurySummary(state).customerDebts).toBe(400);
  });

  it('adds Baqy and Semsem payable debts without allowing one credit to offset the other', () => {
    const state = emptyState();
    state.purchaseAccounts = [
      {
        id: 'purchase_account_baqy',
        merchant: 'baqy',
        openingBalanceLyd: 100,
        openingBalanceEgp: 0,
        activeDate: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'purchase_account_semsem',
        merchant: 'semsem',
        openingBalanceLyd: 0,
        openingBalanceEgp: 0,
        activeDate: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ];
    state.purchases = [
      {
        id: 'baqy-debt', merchant: 'baqy', date: '2026-01-01',
        createdAt: '2026-01-01', result: 500, paid: 100,
      },
      {
        id: 'semsem-credit', merchant: 'semsem', date: '2026-01-01',
        createdAt: '2026-01-01', result: 300, paid: 500,
      },
    ];

    expect(calculateTreasurySummary(state).purchaseObligations).toBe(500);
  });

  it('includes purchase rows during migration even before their account is saved', () => {
    const state = emptyState();
    state.purchases = [
      {
        id: 'semsem-debt', merchant: 'semsem', date: '2026-01-01',
        createdAt: '2026-01-01', result: 750, paid: 250,
      },
    ];

    expect(calculateTreasurySummary(state).purchaseObligations).toBe(500);
  });
});
