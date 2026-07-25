import { describe, expect, it } from 'vitest';
import { INITIAL_ERP_STATE, type ERPState } from '../types';
import { mergeErpStateChanges } from './erpSyncService';

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
});
