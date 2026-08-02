import { describe, expect, it } from 'vitest';
import { INITIAL_ERP_STATE, type BackupPoint } from '../types';
import {
  AUTO_BACKUP_INTERVAL_MS,
  canCreateAutomaticBackup,
  isAutoBackupDue,
  latestAutoBackupAt,
  retainLatestAutomaticBackups,
  snapshotForBackup,
} from './backups';

const backup = (id: string, date: string): BackupPoint => ({
  id,
  date,
  name: id,
  description: '',
  dataJson: '{}',
});

describe('automatic backups', () => {
  it('runs full-system automatic backups only for administrators', () => {
    expect(canCreateAutomaticBackup({ role: 'admin' })).toBe(true);
    expect(canCreateAutomaticBackup({ role: 'assistant' })).toBe(false);
    expect(canCreateAutomaticBackup({ role: 'accountant' })).toBe(false);
    expect(canCreateAutomaticBackup(null)).toBe(false);
  });

  it('becomes due exactly after twelve hours', () => {
    const now = Date.parse('2026-07-26T12:00:00.000Z');
    const backups = [backup('auto_backup_1', new Date(now).toISOString())];
    expect(isAutoBackupDue(backups, now + AUTO_BACKUP_INTERVAL_MS - 1)).toBe(false);
    expect(isAutoBackupDue(backups, now + AUTO_BACKUP_INTERVAL_MS)).toBe(true);
    expect(latestAutoBackupAt(backups)).toBe(now);
  });

  it('keeps manual backups and only the newest automatic backups', () => {
    const backups = [
      backup('point_manual', '2026-07-20T00:00:00.000Z'),
      backup('auto_backup_1', '2026-07-21T00:00:00.000Z'),
      backup('auto_backup_2', '2026-07-22T00:00:00.000Z'),
      backup('auto_backup_3', '2026-07-23T00:00:00.000Z'),
    ];
    const result = retainLatestAutomaticBackups(backups, 2);
    expect(result.retained.map((item) => item.id)).toEqual([
      'point_manual',
      'auto_backup_2',
      'auto_backup_3',
    ]);
    expect(result.removed.map((item) => item.id)).toEqual(['auto_backup_1']);
  });

  it('does not recursively embed older backup bodies', () => {
    const state = {
      ...structuredClone(INITIAL_ERP_STATE),
      backupPoints: [backup('point_old', '2026-07-20T00:00:00.000Z')],
    };
    const snapshot = snapshotForBackup(state);
    expect(snapshot.backupPoints).toEqual([]);
    expect(snapshot.customers).toEqual(state.customers);
  });
});
