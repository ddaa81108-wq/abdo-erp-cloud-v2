import { describe, expect, it } from 'vitest';
import { INITIAL_ERP_STATE, type ERPState } from '../types';
import {
  auditMonthKey,
  assembleErpStateFromStorage,
  changedAuditMonths,
  changedChunkKeys,
  groupAuditEntriesByMonth,
  mergeErpStateChanges,
  splitErpStateForStorage,
} from './erpSyncService';

const state = (): ERPState => structuredClone(INITIAL_ERP_STATE);

describe('ERP concurrent merge', () => {
  it('preserves records added by two different users', () => {
    const base = state();
    const local = state();
    const remote = state();
    local.customers.push({ id: 'local', name: 'Local', createdAt: '2026-01-01' });
    remote.customers.push({ id: 'remote', name: 'Remote', createdAt: '2026-01-01' });
    const merged = mergeErpStateChanges(base, local, remote);
    expect(merged.customers.map((customer) => customer.id)).toContain('local');
    expect(merged.customers.map((customer) => customer.id)).toContain('remote');
  });

  it('does not restore a remotely deleted record when local users changed another record', () => {
    const base = state();
    const local = state();
    const remote = state();
    local.customers[0] = { ...local.customers[0], phone: '091' };
    remote.customers = remote.customers.filter((customer) => customer.id !== base.customers[1].id);
    const merged = mergeErpStateChanges(base, local, remote);
    expect(merged.customers.some((customer) => customer.id === base.customers[1].id)).toBe(false);
    expect(merged.customers[0].phone).toBe('091');
  });

  it('merges independent financial transactions without dropping either one', () => {
    const base = state();
    const local = state();
    const remote = state();
    local.debtTransactions.push({ ...local.debtTransactions[0], id: 'local-tx', amount: 25 });
    remote.debtTransactions.push({ ...remote.debtTransactions[0], id: 'remote-tx', amount: 40 });
    const merged = mergeErpStateChanges(base, local, remote);
    expect(merged.debtTransactions.some((transaction) => transaction.id === 'local-tx')).toBe(true);
    expect(merged.debtTransactions.some((transaction) => transaction.id === 'remote-tx')).toBe(true);
  });

  it('keeps growing arrays out of the Firestore main document', () => {
    const source = state();
    const { mainState, chunks } = splitErpStateForStorage(source);

    expect(mainState.purchases).toBeUndefined();
    expect(mainState.trustDeposits).toBeUndefined();
    expect(mainState.treasuryTransactions).toBeUndefined();
    expect(mainState.users).toBeUndefined();
    expect(chunks.purchases).toEqual(source.purchases);
    expect(chunks.trustDeposits).toEqual(source.trustDeposits);
  });

  it('reassembles chunked data and can still read legacy main-state arrays', () => {
    const source = state();
    const { mainState, chunks } = splitErpStateForStorage(source);
    const chunkDocuments = Object.fromEntries(
      Object.entries(chunks).map(([key, value]) => [key, { [key]: value }]),
    );
    const assembled = assembleErpStateFromStorage(mainState, chunkDocuments as any);
    expect(assembled.customers).toEqual(source.customers);
    expect(assembled.purchases).toEqual(source.purchases);

    const legacy = assembleErpStateFromStorage(source, {});
    expect(legacy.trustDeposits).toEqual(source.trustDeposits);
  });

  it('identifies only the section that actually changed', () => {
    const base = state();
    const next = state();
    next.customers[0] = { ...next.customers[0], phone: '0920000000' };
    expect(changedChunkKeys(base, next)).toEqual(['customers']);
  });

  it('applies an incremental chunk without clearing untouched sections', () => {
    const current = state();
    const changedCustomers = [
      ...current.customers,
      { id: 'incremental', name: 'Incremental', createdAt: '2026-07-27' },
    ];
    const assembled = assembleErpStateFromStorage(
      { managerPasswordHash: current.managerPasswordHash },
      { customers: { customers: changedCustomers } },
      current,
    );
    expect(assembled.customers).toEqual(changedCustomers);
    expect(assembled.debtTransactions).toEqual(current.debtTransactions);
    expect(assembled.trustDeposits).toEqual(current.trustDeposits);
  });

  it('ignores stale legacy arrays during an incremental refresh', () => {
    const current = state();
    const assembled = assembleErpStateFromStorage(
      {
        customers: [{ id: 'stale', name: 'Stale', createdAt: '2020-01-01' }],
        users: [],
        managerPasswordHash: current.managerPasswordHash,
      },
      {},
      current,
    );
    expect(assembled.customers).toEqual(current.customers);
    expect(assembled.users).toEqual(current.users);
  });

  it('partitions the comprehensive audit log by calendar month', () => {
    const entries = [
      {
        id: 'audit-1',
        occurredAt: '2026-07-31T23:00:00.000Z',
        action: 'create' as const,
        section: 'الخزينة',
        entityType: 'transaction',
        entityId: 'one',
        title: 'إضافة',
        details: '',
      },
      {
        id: 'audit-2',
        occurredAt: '2026-08-01T01:00:00.000Z',
        action: 'update' as const,
        section: 'الخزينة',
        entityType: 'transaction',
        entityId: 'two',
        title: 'تعديل',
        details: '',
      },
    ];
    expect(auditMonthKey(entries[0])).toBe('2026_07');
    expect([...groupAuditEntriesByMonth(entries).keys()]).toEqual([
      '2026_07',
      '2026_08',
    ]);
    expect(changedAuditMonths([], entries)).toEqual(['2026_07', '2026_08']);
    expect(changedAuditMonths(entries, entries)).toEqual([]);
  });
});
