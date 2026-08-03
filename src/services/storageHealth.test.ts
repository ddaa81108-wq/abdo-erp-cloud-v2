import { describe, expect, it } from 'vitest';
import { INITIAL_ERP_STATE, type ERPState } from '../types';
import {
  estimateStorageHealth,
  formatStorageBytes,
  STORAGE_CRITICAL_BYTES,
  STORAGE_WARNING_BYTES,
  utf8JsonBytes,
} from './storageHealth';

const emptyState = (): ERPState => structuredClone(INITIAL_ERP_STATE);

describe('Firestore storage health monitor', () => {
  it('reports an empty system as safe without changing its state', () => {
    const state = emptyState();
    const before = structuredClone(state);
    const report = estimateStorageHealth(state);

    expect(report.overallLevel).toBe('safe');
    expect(report.chunks.every((chunk) => chunk.level === 'safe')).toBe(true);
    expect(state).toEqual(before);
  });

  it('measures UTF-8 bytes rather than JavaScript character count', () => {
    expect(utf8JsonBytes('أ')).toBeGreaterThan(JSON.stringify('أ').length);
  });

  it('warns before a chunk reaches the Firestore hard limit', () => {
    const state = emptyState();
    state.customers = [{
      id: 'large-customer',
      name: 'x'.repeat(STORAGE_WARNING_BYTES),
      createdAt: '2026-08-03',
    }];

    const report = estimateStorageHealth(state);
    const customers = report.chunks.find((chunk) => chunk.key === 'customers');
    expect(customers?.level).toBe('warning');
    expect(customers?.estimatedBytes).toBeLessThan(STORAGE_CRITICAL_BYTES);
  });

  it('marks very large chunks as critical', () => {
    const state = emptyState();
    state.customers = [{
      id: 'critical-customer',
      name: 'x'.repeat(STORAGE_CRITICAL_BYTES),
      createdAt: '2026-08-03',
    }];

    const report = estimateStorageHealth(state);
    expect(report.chunks[0].key).toBe('customers');
    expect(report.chunks[0].level).toBe('critical');
    expect(report.overallLevel).toBe('critical');
  });

  it('does not recursively count older backup bodies in a new backup', () => {
    const state = emptyState();
    state.backupPoints = [{
      id: 'manual-1',
      name: 'old',
      date: '2026-08-03',
      description: '',
      dataJson: 'x'.repeat(STORAGE_CRITICAL_BYTES),
    }];

    const report = estimateStorageHealth(state);
    expect(report.backupLevel).toBe('safe');
  });

  it('formats sizes for the settings screen', () => {
    expect(formatStorageBytes(512)).toBe('512 بايت');
    expect(formatStorageBytes(2048)).toBe('2.0 كيلوبايت');
    expect(formatStorageBytes(2 * 1024 * 1024)).toBe('2.00 ميجابايت');
  });
});
