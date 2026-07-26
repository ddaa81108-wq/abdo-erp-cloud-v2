import { describe, expect, it } from 'vitest';
import { INITIAL_ERP_STATE, type ERPState } from '../types';
import { collectSystemAuditEntries } from './systemAudit';

const state = (): ERPState => structuredClone(INITIAL_ERP_STATE);

describe('system audit log', () => {
  it('records creation without changing the business state', () => {
    const base = state();
    const next = state();
    next.customers.push({
      id: 'new-customer',
      name: 'عميل جديد',
      createdAt: '2026-01-01',
    });
    const entries = collectSystemAuditEntries(base, next, null);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'create',
      section: 'ديون العملاء',
      entityId: 'new-customer',
    });
    expect(base.customers).toHaveLength(INITIAL_ERP_STATE.customers.length);
  });

  it('distinguishes update, delete and restore', () => {
    const base = state();
    const updated = state();
    updated.customers[0] = { ...updated.customers[0], phone: '091' };
    expect(collectSystemAuditEntries(base, updated, null)[0].action).toBe('update');

    const deleted = structuredClone(updated);
    deleted.customers[0].isDeleted = true;
    expect(collectSystemAuditEntries(updated, deleted, null)[0].action).toBe('delete');

    const restored = structuredClone(deleted);
    restored.customers[0].isDeleted = false;
    expect(collectSystemAuditEntries(deleted, restored, null)[0].action).toBe('restore');
  });

  it('does not audit changes to the audit log itself', () => {
    const base = state();
    const next = state();
    next.systemAuditLog = [{
      id: 'audit',
      occurredAt: '2026-01-01',
      action: 'create',
      section: 'اختبار',
      entityType: 'test',
      entityId: '1',
      title: 'اختبار',
      details: 'اختبار',
    }];
    expect(collectSystemAuditEntries(base, next, null)).toEqual([]);
  });
});
