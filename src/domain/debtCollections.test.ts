import { describe, expect, it } from 'vitest';
import type { ERPState, User } from '../types';
import { INITIAL_ERP_STATE } from '../types';
import {
  activeCollectionAssignments,
  activeCollectionReceipts,
  approveCollectionReceipt,
  assignmentReceiptSummary,
  clearCollectorBatch,
  collectionTotal,
  dispatchCustomersToCollector,
  payrollForMonth,
  payrollSummary,
  recordCollectionReceipt,
  synchronizeCollectionAssignments,
} from './debtCollections';

const admin: User = {
  id: 'admin', username: 'admin', name: 'المدير', role: 'admin', password: '',
  createdAt: '2026-08-01T00:00:00.000Z', permissions: {} as User['permissions'],
};
const collector: User = {
  id: 'collector', username: 'collector', name: 'المحصل', role: 'assistant', password: '',
  createdAt: '2026-08-01T00:00:00.000Z', permissions: { canViewDebtCollections: true } as User['permissions'],
};

function baseState(): ERPState {
  return {
    ...structuredClone(INITIAL_ERP_STATE),
    customers: [{
      id: 'c1', name: 'أحمد', createdAt: '2026-08-01T00:00:00.000Z', phone: '0910000000',
    }],
    cycles: [{
      id: 'cycle1', customerId: 'c1', startDate: '2026-08-01T00:00:00.000Z',
      status: 'active', initialBalance: 0, currentBalance: 1000,
    }],
    debtTransactions: [{
      id: 'debt1', customerId: 'c1', cycleId: 'cycle1', type: 'debt', amount: 1000,
      currency: 'د.ل', conversionRate: 1, date: '2026-08-01T00:00:00.000Z',
      referenceNo: 'D1', note: '', postedToTreasury: false,
      createdAt: '2026-08-01T00:00:00.000Z',
    }],
  };
}

function dispatched() {
  return dispatchCustomersToCollector(
    baseState(), collector,
    [{ customer: baseState().customers[0], balance: 1000 }],
    '2026-08-02T00:00:00.000Z',
  ).state;
}

describe('debt collections', () => {
  it('dispatches once, permits missing phone, and rejects an active duplicate', () => {
    const initial = baseState();
    initial.customers[0].phone = undefined;
    const first = dispatchCustomersToCollector(
      initial, collector, [{ customer: initial.customers[0], balance: 1000 }],
      '2026-08-02T00:00:00.000Z',
    );
    const second = dispatchCustomersToCollector(
      first.state, collector, [{ customer: initial.customers[0], balance: 1000 }],
      '2026-08-02T01:00:00.000Z',
    );
    expect(first.added).toBe(1);
    expect(activeCollectionAssignments(first.state, collector.id)[0].phone).toBeUndefined();
    expect(second.added).toBe(0);
    expect(second.duplicates).toBe(1);
  });

  it('keeps a partial receipt pending without changing the customer debt', () => {
    const state = dispatched();
    const assignment = activeCollectionAssignments(state, collector.id)[0];
    const next = recordCollectionReceipt(
      state, assignment.id, 'partial', 300, '2026-08-02T02:00:00.000Z',
    );
    const summary = assignmentReceiptSummary(
      assignment, activeCollectionReceipts(next, collector.id),
    );
    expect(summary.displayedRemaining).toBe(700);
    expect(collectionTotal(next, collector.id)).toBe(300);
    expect(next.debtTransactions).toHaveLength(1);
  });

  it('approves a receipt exactly once and reduces the original customer balance', () => {
    const state = dispatched();
    const assignment = activeCollectionAssignments(state, collector.id)[0];
    const pending = recordCollectionReceipt(state, assignment.id, 'partial', 300);
    const receipt = activeCollectionReceipts(pending, collector.id)[0];
    const approved = approveCollectionReceipt(pending, receipt.id, admin);
    const approvedAgain = approveCollectionReceipt(approved, receipt.id, admin);
    expect(approved.debtTransactions).toHaveLength(2);
    expect(approvedAgain.debtTransactions).toHaveLength(2);
    expect(approvedAgain.cycles[0].currentBalance).toBe(700);
    expect(activeCollectionReceipts(approvedAgain, collector.id)[0].status).toBe('approved');
  });

  it('closes the original cycle after a full approved collection', () => {
    const state = dispatched();
    const assignment = activeCollectionAssignments(state, collector.id)[0];
    const pending = recordCollectionReceipt(state, assignment.id, 'full');
    const receipt = activeCollectionReceipts(pending, collector.id)[0];
    const approved = approveCollectionReceipt(pending, receipt.id, admin);
    expect(approved.cycles[0].currentBalance).toBe(0);
    expect(approved.cycles[0].status).toBe('closed');
  });

  it('updates the assigned card when a new debt is added in customer debts', () => {
    const state = dispatched();
    state.debtTransactions.push({
      ...state.debtTransactions[0], id: 'debt2', amount: 500,
    });
    const synced = synchronizeCollectionAssignments(state);
    expect(activeCollectionAssignments(synced, collector.id)[0].currentDebt).toBe(1500);
  });

  it('blocks Clear All while review is pending and starts a fresh batch afterward', () => {
    const state = dispatched();
    const assignment = activeCollectionAssignments(state, collector.id)[0];
    const pending = recordCollectionReceipt(state, assignment.id, 'partial', 100);
    expect(() => clearCollectorBatch(pending, collector.id)).toThrow(/مراجعة/);
    const receipt = activeCollectionReceipts(pending, collector.id)[0];
    const approved = approveCollectionReceipt(pending, receipt.id, admin);
    const cleared = clearCollectorBatch(approved, collector.id);
    expect(activeCollectionAssignments(cleared, collector.id)).toHaveLength(0);
    expect(activeCollectionReceipts(cleared, collector.id)).toHaveLength(0);
  });

  it('calculates the 3500 monthly salary independently from collections', () => {
    const state = baseState();
    const payroll = payrollForMonth(state, collector, '2026-08');
    const summary = payrollSummary(payroll, [{
      id: 'w1', collectorUserId: collector.id, month: '2026-08', amount: 150,
      date: '2026-08-02', createdAt: '2026-08-02', updatedAt: '2026-08-02',
    }]);
    expect(payroll.salary).toBe(3500);
    expect(summary).toEqual({ withdrawn: 150, remaining: 3350 });
  });
});
