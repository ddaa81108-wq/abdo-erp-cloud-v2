import type { BackupPoint, ERPState, User } from '../types';

export const AUTO_BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const AUTO_BACKUP_RETENTION = 3;

// A shared full-system backup must be created only from an administrator
// session. Limited employees intentionally load only their permitted chunks;
// allowing them to create a backup would both produce an incomplete snapshot
// and make their otherwise valid section write fail Firestore permissions.
export const canCreateAutomaticBackup = (
  user: Pick<User, 'role'> | null | undefined,
) => user?.role === 'admin';

export const isAutoBackup = (backup: BackupPoint) =>
  backup.id.startsWith('auto_backup_');

export function latestAutoBackupAt(backups: BackupPoint[] = []): number {
  return backups
    .filter(isAutoBackup)
    .reduce((latest, backup) => {
      const timestamp = new Date(backup.date).getTime();
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);
}

export function isAutoBackupDue(
  backups: BackupPoint[] = [],
  now = Date.now(),
): boolean {
  const latest = latestAutoBackupAt(backups);
  return latest === 0 || now - latest >= AUTO_BACKUP_INTERVAL_MS;
}

export function nextAutoBackupAt(backups: BackupPoint[] = []): number {
  const latest = latestAutoBackupAt(backups);
  return latest === 0 ? Date.now() : latest + AUTO_BACKUP_INTERVAL_MS;
}

export function snapshotForBackup(state: ERPState): ERPState {
  return {
    ...structuredClone(state),
    // A backup must not contain the full bodies of older backups. Keeping them
    // recursively makes every new backup grow exponentially.
    backupPoints: [],
  };
}

export function retainLatestAutomaticBackups(
  backups: BackupPoint[] = [],
  keep = AUTO_BACKUP_RETENTION - 1,
): { retained: BackupPoint[]; removed: BackupPoint[] } {
  const automatic = backups
    .filter(isAutoBackup)
    .sort((left, right) => (
      new Date(right.date).getTime() - new Date(left.date).getTime()
    ));
  const keepIds = new Set(automatic.slice(0, Math.max(0, keep)).map((item) => item.id));
  return {
    retained: backups.filter((item) => !isAutoBackup(item) || keepIds.has(item.id)),
    removed: automatic.filter((item) => !keepIds.has(item.id)),
  };
}
