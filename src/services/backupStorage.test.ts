import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackupPoint } from '../types';

const firestore = vi.hoisted(() => ({
  documents: new Map<string, any>(),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => segments.join('/'),
  setDoc: async (reference: string, value: unknown) => {
    firestore.documents.set(reference, structuredClone(value));
  },
  getDoc: async (reference: string) => ({
    exists: () => firestore.documents.has(reference),
    data: () => structuredClone(firestore.documents.get(reference)),
  }),
  deleteDoc: async (reference: string) => {
    firestore.documents.delete(reference);
  },
}));

import {
  deleteBackupPayload,
  loadBackupPayload,
  storeBackupPayload,
} from './backupStorage';

const point = (dataJson: string): BackupPoint => ({
  id: 'point-safe',
  name: 'Safe point',
  date: '2026-08-03T00:00:00.000Z',
  description: '',
  dataJson,
});

describe('Firestore chunked backup storage', () => {
  beforeEach(() => firestore.documents.clear());

  it('stores metadata separately and restores the exact JSON', async () => {
    const original = point(JSON.stringify({
      customers: [{ id: '1', name: 'أحمد' }],
      notes: 'x'.repeat(20_000),
    }));
    const stored = await storeBackupPayload({} as any, original);

    expect(stored.dataJson).toBe('');
    expect(stored.storageVersion).toBe(2);
    expect(stored.partCount).toBeGreaterThan(0);
    expect(firestore.documents.get('erp_system/backup_point-safe'))
      .not.toHaveProperty('dataJson');

    const restored = await loadBackupPayload({} as any, stored);
    expect(restored.dataJson).toBe(original.dataJson);
  });

  it('refuses restoration when one stored part is missing', async () => {
    const stored = await storeBackupPayload(
      {} as any,
      point(JSON.stringify({ data: 'important'.repeat(10_000) })),
    );
    firestore.documents.delete('erp_system/backup_point-safe_part_0000');

    await expect(loadBackupPayload({} as any, stored))
      .rejects.toThrow('BACKUP_PART_NOT_FOUND');
  });

  it('deletes the manifest and every stored part', async () => {
    const stored = await storeBackupPayload(
      {} as any,
      point(JSON.stringify({ data: 'delete-me'.repeat(10_000) })),
    );
    await deleteBackupPayload({} as any, stored);

    expect(firestore.documents.size).toBe(0);
  });

  it('continues to load legacy single-document backups', async () => {
    const legacy = point('');
    firestore.documents.set('erp_system/backup_point-safe', {
      ...legacy,
      dataJson: JSON.stringify({ customers: [] }),
    });

    const restored = await loadBackupPayload({} as any, legacy);
    expect(JSON.parse(restored.dataJson)).toEqual({ customers: [] });
  });
});
