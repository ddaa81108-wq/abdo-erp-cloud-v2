import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { BackupPoint } from '../types';
import {
  BACKUP_STORAGE_ENCODING,
  BACKUP_STORAGE_VERSION,
  decodeBackupPayload,
  encodeBackupPayload,
  type BackupPayloadMetadata,
} from '../domain/backupPayload';

const manifestId = (backupId: string) => `backup_${backupId}`;
const partId = (backupId: string, index: number) =>
  `backup_${backupId}_part_${String(index).padStart(4, '0')}`;

export const withoutBackupBody = (backup: BackupPoint): BackupPoint => ({
  ...backup,
  dataJson: '',
});

const metadataFrom = (value: Partial<BackupPoint>): BackupPayloadMetadata => {
  if (
    value.storageVersion !== BACKUP_STORAGE_VERSION
    || value.storageEncoding !== BACKUP_STORAGE_ENCODING
    || !Number.isInteger(value.partCount)
    || Number(value.partCount) <= 0
    || !Number.isFinite(value.sourceBytes)
    || !Number.isFinite(value.compressedBytes)
    || typeof value.checksum !== 'string'
  ) {
    throw new Error('INVALID_BACKUP_MANIFEST');
  }
  return {
    storageVersion: BACKUP_STORAGE_VERSION,
    storageEncoding: BACKUP_STORAGE_ENCODING,
    partCount: Number(value.partCount),
    sourceBytes: Number(value.sourceBytes),
    compressedBytes: Number(value.compressedBytes),
    checksum: value.checksum,
  };
};

export async function storeBackupPayload(
  db: Firestore,
  backup: BackupPoint,
): Promise<BackupPoint> {
  const encoded = encodeBackupPayload(backup.dataJson);
  await Promise.all(encoded.parts.map((payload, index) =>
    setDoc(doc(db, 'erp_system', partId(backup.id, index)), {
      backupId: backup.id,
      partIndex: index,
      partCount: encoded.metadata.partCount,
      storageVersion: BACKUP_STORAGE_VERSION,
      storageEncoding: BACKUP_STORAGE_ENCODING,
      payload,
    }),
  ));
  const stored = {
    ...withoutBackupBody(backup),
    ...encoded.metadata,
  };
  const { dataJson: _dataJson, ...manifest } = stored;
  await setDoc(doc(db, 'erp_system', manifestId(backup.id)), manifest);
  return stored;
}

export async function prepareBackupPointsForStorage(
  db: Firestore,
  baseBackups: BackupPoint[] = [],
  nextBackups: BackupPoint[] = [],
): Promise<BackupPoint[]> {
  const beforeById = new Map(baseBackups.map((backup) => [backup.id, backup]));
  return Promise.all(nextBackups.map(async (backup) => {
    const previous = beforeById.get(backup.id);
    const hasNewBody = Boolean(backup.dataJson) && (
      !previous
      || previous.dataJson !== backup.dataJson
      || backup.storageVersion !== BACKUP_STORAGE_VERSION
    );
    return hasNewBody
      ? storeBackupPayload(db, backup)
      : withoutBackupBody(backup);
  }));
}

export async function loadBackupPayload(
  db: Firestore,
  backup: BackupPoint,
): Promise<BackupPoint> {
  if (backup.dataJson) return backup;
  const manifestSnapshot = await getDoc(
    doc(db, 'erp_system', manifestId(backup.id)),
  );
  if (!manifestSnapshot.exists()) throw new Error('BACKUP_MANIFEST_NOT_FOUND');
  const manifest = manifestSnapshot.data() as Partial<BackupPoint>;

  // Backward compatibility: backups created before chunked storage remain
  // readable from their original single document.
  if (typeof manifest.dataJson === 'string' && manifest.dataJson) {
    return { ...backup, ...manifest, dataJson: manifest.dataJson } as BackupPoint;
  }

  const metadata = metadataFrom(manifest);
  const partSnapshots = await Promise.all(
    Array.from({ length: metadata.partCount }, (_, index) =>
      getDoc(doc(db, 'erp_system', partId(backup.id, index))),
    ),
  );
  if (partSnapshots.some((snapshot) => !snapshot.exists())) {
    throw new Error('BACKUP_PART_NOT_FOUND');
  }
  const parts = partSnapshots.map((snapshot, index) => {
    const part = snapshot.data() as {
      backupId?: string;
      partIndex?: number;
      partCount?: number;
      payload?: string;
    };
    if (
      part.backupId !== backup.id
      || part.partIndex !== index
      || part.partCount !== metadata.partCount
      || typeof part.payload !== 'string'
    ) {
      throw new Error('INVALID_BACKUP_PART');
    }
    return part.payload;
  });
  return {
    ...backup,
    ...manifest,
    ...metadata,
    dataJson: decodeBackupPayload(metadata, parts),
  } as BackupPoint;
}

export async function deleteBackupPayload(
  db: Firestore,
  backup: BackupPoint,
): Promise<void> {
  let partCount = Number(backup.partCount || 0);
  if (!partCount) {
    try {
      const manifestSnapshot = await getDoc(
        doc(db, 'erp_system', manifestId(backup.id)),
      );
      partCount = Number(manifestSnapshot.data()?.partCount || 0);
    } catch {
      partCount = 0;
    }
  }
  await Promise.all([
    deleteDoc(doc(db, 'erp_system', manifestId(backup.id))),
    ...Array.from({ length: partCount }, (_, index) =>
      deleteDoc(doc(db, 'erp_system', partId(backup.id, index))),
    ),
  ]);
}
