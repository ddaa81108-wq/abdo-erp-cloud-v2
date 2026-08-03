import type { ERPState } from '../types';
import {
  CHUNK_ARRAY_KEYS,
  chunkDocumentId,
} from './erpSyncService';

export const FIRESTORE_DOCUMENT_LIMIT_BYTES = 1_048_576;
export const STORAGE_WARNING_BYTES = 600 * 1024;
export const STORAGE_CRITICAL_BYTES = 800 * 1024;

export type StorageHealthLevel = 'safe' | 'warning' | 'critical';

export interface StorageChunkHealth {
  key: keyof ERPState;
  documentId: string;
  itemCount: number;
  estimatedBytes: number;
  usagePercent: number;
  level: StorageHealthLevel;
}

export interface StorageHealthReport {
  chunks: StorageChunkHealth[];
  backupEstimatedBytes: number;
  backupUsagePercent: number;
  backupLevel: StorageHealthLevel;
  overallLevel: StorageHealthLevel;
}

const levelForBytes = (bytes: number): StorageHealthLevel => {
  if (bytes >= STORAGE_CRITICAL_BYTES) return 'critical';
  if (bytes >= STORAGE_WARNING_BYTES) return 'warning';
  return 'safe';
};

const worstLevel = (
  levels: StorageHealthLevel[],
): StorageHealthLevel => {
  if (levels.includes('critical')) return 'critical';
  if (levels.includes('warning')) return 'warning';
  return 'safe';
};

export const utf8JsonBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

export function estimateStorageHealth(state: ERPState): StorageHealthReport {
  const chunkHealth = CHUNK_ARRAY_KEYS.map((key): StorageChunkHealth => {
    const source = Array.isArray(state[key]) ? state[key] : [];
    const values = key === 'backupPoints'
      ? (source as ERPState['backupPoints']).map(
          ({ dataJson: _dataJson, ...backup }) => backup,
        )
      : source;
    // Measure the same document shape written by erpSyncService. Firestore's
    // protocol adds a small amount of metadata, so warnings intentionally
    // start well below the hard document limit.
    const estimatedBytes = utf8JsonBytes({
      [key]: values,
      _syncRevision: 0,
    });
    return {
      key,
      documentId: chunkDocumentId(key),
      itemCount: values.length,
      estimatedBytes,
      usagePercent: Math.min(
        100,
        (estimatedBytes / FIRESTORE_DOCUMENT_LIMIT_BYTES) * 100,
      ),
      level: levelForBytes(estimatedBytes),
    };
  }).sort((left, right) => right.estimatedBytes - left.estimatedBytes);

  // Backups exclude older backup bodies. Add a conservative allowance for
  // the BackupPoint metadata stored beside the serialized state.
  const backupEstimatedBytes =
    utf8JsonBytes({ ...state, backupPoints: [] }) + 4 * 1024;
  const backupLevel = levelForBytes(backupEstimatedBytes);

  return {
    chunks: chunkHealth,
    backupEstimatedBytes,
    backupUsagePercent: Math.min(
      100,
      (backupEstimatedBytes / FIRESTORE_DOCUMENT_LIMIT_BYTES) * 100,
    ),
    backupLevel,
    overallLevel: worstLevel([
      backupLevel,
      ...chunkHealth.map((chunk) => chunk.level),
    ]),
  };
}

export function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} ميجابايت`;
}
