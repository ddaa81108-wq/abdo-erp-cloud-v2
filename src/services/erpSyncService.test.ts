import { describe, expect, it } from 'vitest';
import { INITIAL_ERP_STATE, type ERPState } from '../types';
import {
  assembleErpStateFromStorage,
  changedChunkKeys,
  ErpSyncConflictError,
  mergeErpStateChanges,
  splitErpStateForStorage,
} from './erpSyncService';

const state = (): ERPState => structuredClone(INITIAL_ERP_STATE);

describe('ERP concurrent merge', () => {
  it('ships with no demonstration records or default credentials', () => {
    expect(INITIAL_ERP_STATE).toMatchObject({
      customers: [],
      cycles: [],
      debtTransactions: [],
      companies: [],
      companyTransactions: [],
      merchants: [],
      merchantTransactions: [],
      treasuryTransactions: [],
      purchases: [],
      trustDeposits: [],
      safeAudits: [],
      backupPoints: [],
      users: [],
    });
    expect('managerPasswordHash' in INITIAL_ERP_STATE).toBe(false);
  });

  it('preserves records added by two different users', () => {
    const base = state();
    const local = state();
    const remote = state();
    local.customers.push({ id: 'local', name: 'Local', createdAt: '2026-01-01' });
    remote.customers.push({ id: 'remote', name: 'Remote', createdAt: '2026-01-01' });
    const merged = mergeErpStateChanges(base, local, remote, {
      detectConflicts: true,
    });
    expect(merged.customers.map((customer) => customer.id)).toContain('local');
    expect(merged.customers.map((customer) => customer.id)).toContain('remote');
  });

  it('rejects concurrent changes to the same record instead of silently losing one', () => {
    const base = state();
    base.customers = [{ id: 'same', name: 'Original', createdAt: '2026-01-01' }];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.customers[0] = { ...local.customers[0], name: 'Local edit' };
    remote.customers[0] = { ...remote.customers[0], name: 'Remote edit' };

    expect(() => mergeErpStateChanges(base, local, remote, {
      detectConflicts: true,
    })).toThrow(ErpSyncConflictError);
  });

  it('accepts the same concurrent result when both devices saved identical data', () => {
    const base = state();
    base.customers = [{ id: 'same', name: 'Original', createdAt: '2026-01-01' }];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.customers[0] = { ...local.customers[0], name: 'Identical edit' };
    remote.customers[0] = { ...remote.customers[0], name: 'Identical edit' };

    expect(() => mergeErpStateChanges(base, local, remote, {
      detectConflicts: true,
    })).not.toThrow();
  });

  it('applies an explicit deletion to the newest remote record without resurrecting it', () => {
    const base = state();
    base.customers = [{ id: 'same', name: 'Original', createdAt: '2026-01-01' }];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.customers[0] = {
      ...local.customers[0],
      isDeleted: true,
      updatedAt: '2026-08-01T10:00:00.000Z',
    };
    remote.customers[0] = {
      ...remote.customers[0],
      name: 'Latest remote name',
      phone: '0910000000',
      updatedAt: '2026-08-01T09:59:00.000Z',
    };

    const merged = mergeErpStateChanges(base, local, remote, {
      detectConflicts: true,
    });
    expect(merged.customers[0]).toMatchObject({
      name: 'Latest remote name',
      phone: '0910000000',
      isDeleted: true,
    });
  });

  it('rejects concurrent edits to the same Masraweya day', () => {
    const base = state();
    base.egyptianCashRecords = [{
      date: '2026-07-27',
      rows: [{ value: 100, commission: 0 }],
      previousValue: 0,
      receivedValue: 200,
    }];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.egyptianCashRecords[0].receivedValue = 300;
    remote.egyptianCashRecords[0].receivedValue = 400;

    expect(() => mergeErpStateChanges(base, local, remote, {
      detectConflicts: true,
    })).toThrow(ErpSyncConflictError);
  });

  it('does not restore a remotely deleted record when local users changed another record', () => {
    const base = state();
    base.customers = [
      { id: 'kept', name: 'Kept', createdAt: '2026-01-01' },
      { id: 'deleted', name: 'Deleted', createdAt: '2026-01-01' },
    ];
    const local = structuredClone(base);
    const remote = structuredClone(base);
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

  it('preserves Masraweya days edited concurrently on different devices', () => {
    const base = state();
    base.egyptianCashRecords = [];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.egyptianCashRecords.push({
      date: '2026-07-27',
      rows: [{ value: 100, commission: 5 }],
      previousValue: 0,
      receivedValue: 200,
    });
    remote.egyptianCashRecords.push({
      date: '2026-07-26',
      rows: [{ value: 50, commission: 2 }],
      previousValue: 0,
      receivedValue: 100,
    });

    const merged = mergeErpStateChanges(base, local, remote);
    expect(merged.egyptianCashRecords.map((record) => record.date)).toEqual([
      '2026-07-26',
      '2026-07-27',
    ]);
  });

  it('keeps growing arrays out of the Firestore main document', () => {
    const source = state();
    source.financialReportRates = [{
      id: 'financial_rate_2026-07-27',
      date: '2026-07-27',
      egpPerLyd: 10,
      updatedAt: '2026-07-27',
    }];
    source.financialReportSnapshots = [{
      id: 'financial_snapshot_2026-07-27',
      date: '2026-07-27',
      treasuryPositivesLyd: 1_000,
      treasuryObligationsLyd: 300,
      egyptianCashRemainderEgp: 5_000,
      vodafoneBaqyRemainderEgp: 10_000,
      vodafoneSemsemRemainderEgp: 20_000,
      trustBalanceEgp: -2_000,
      netEgyptianPositionEgp: 37_000,
      egpPerLyd: 10,
      egyptianEquivalentLyd: 3_700,
      totalOwnedLyd: 4_700,
      netPositionLyd: 4_400,
      createdAt: '2026-07-27',
      updatedAt: '2026-07-27',
    }];
    const { mainState, chunks } = splitErpStateForStorage(source);

    expect(mainState.purchases).toBeUndefined();
    expect(mainState.trustDeposits).toBeUndefined();
    expect(mainState.treasuryTransactions).toBeUndefined();
    expect(mainState.financialReportRates).toBeUndefined();
    expect(mainState.financialReportSnapshots).toBeUndefined();
    expect(mainState.users).toBeUndefined();
    expect(chunks.purchases).toEqual(source.purchases);
    expect(chunks.trustDeposits).toEqual(source.trustDeposits);
    expect(chunks.financialReportRates).toEqual(source.financialReportRates);
    expect(chunks.financialReportSnapshots).toEqual(
      source.financialReportSnapshots,
    );
  });

  it('merges exchange rates saved for different report days', () => {
    const base = state();
    base.financialReportRates = [];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.financialReportRates = [{
      id: 'financial_rate_2026-07-27',
      date: '2026-07-27',
      egpPerLyd: 10,
      updatedAt: '2026-07-27',
    }];
    remote.financialReportRates = [{
      id: 'financial_rate_2026-07-26',
      date: '2026-07-26',
      egpPerLyd: 9.8,
      updatedAt: '2026-07-26',
    }];
    const merged = mergeErpStateChanges(base, local, remote);
    expect(merged.financialReportRates).toHaveLength(2);
  });

  it('merges financial snapshots saved for different report days', () => {
    const base = state();
    base.financialReportSnapshots = [];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    const snapshot = {
      treasuryPositivesLyd: 1_000,
      treasuryObligationsLyd: 300,
      egyptianCashRemainderEgp: 5_000,
      vodafoneBaqyRemainderEgp: 10_000,
      vodafoneSemsemRemainderEgp: 20_000,
      trustBalanceEgp: -2_000,
      netEgyptianPositionEgp: 37_000,
      egpPerLyd: 10,
      egyptianEquivalentLyd: 3_700,
      totalOwnedLyd: 4_700,
      netPositionLyd: 4_400,
      createdAt: '2026-07-27',
      updatedAt: '2026-07-27',
    };
    local.financialReportSnapshots = [{
      ...snapshot,
      id: 'financial_snapshot_2026-07-27',
      date: '2026-07-27',
    }];
    remote.financialReportSnapshots = [{
      ...snapshot,
      id: 'financial_snapshot_2026-07-26',
      date: '2026-07-26',
    }];

    const merged = mergeErpStateChanges(base, local, remote);
    expect(merged.financialReportSnapshots).toHaveLength(2);
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
      {},
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
        managerPasswordHash: 'legacy-secret-that-must-not-load',
      },
      {},
      current,
    );
    expect(assembled.customers).toEqual(current.customers);
    expect(assembled.users).toEqual(current.users);
    expect(assembled.managerPasswordHash).toBeUndefined();
  });

});
