import { gzipSync, gunzipSync, strFromU8, strToU8 } from 'fflate';

export const BACKUP_STORAGE_VERSION = 2 as const;
export const BACKUP_STORAGE_ENCODING = 'gzip-base64' as const;
// Base64 expands bytes by roughly one third. A 300 KiB raw part remains well
// below Firestore's 1 MiB document limit after encoding and metadata.
export const BACKUP_PART_RAW_BYTES = 300 * 1024;

export interface BackupPayloadMetadata {
  storageVersion: typeof BACKUP_STORAGE_VERSION;
  storageEncoding: typeof BACKUP_STORAGE_ENCODING;
  partCount: number;
  sourceBytes: number;
  compressedBytes: number;
  checksum: string;
}

export interface EncodedBackupPayload {
  metadata: BackupPayloadMetadata;
  parts: string[];
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  const segments: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    segments.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  }
  return btoa(segments.join(''));
};

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
};

const checksumBytes = (bytes: Uint8Array): string => {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export function encodeBackupPayload(
  dataJson: string,
  rawPartBytes = BACKUP_PART_RAW_BYTES,
): EncodedBackupPayload {
  if (!dataJson || rawPartBytes <= 0) {
    throw new Error('INVALID_BACKUP_PAYLOAD');
  }
  const source = strToU8(dataJson);
  const compressed = gzipSync(source, { level: 6 });
  const parts: string[] = [];
  for (let offset = 0; offset < compressed.length; offset += rawPartBytes) {
    parts.push(bytesToBase64(compressed.subarray(offset, offset + rawPartBytes)));
  }
  return {
    metadata: {
      storageVersion: BACKUP_STORAGE_VERSION,
      storageEncoding: BACKUP_STORAGE_ENCODING,
      partCount: parts.length,
      sourceBytes: source.byteLength,
      compressedBytes: compressed.byteLength,
      checksum: checksumBytes(compressed),
    },
    parts,
  };
}

export function decodeBackupPayload(
  metadata: BackupPayloadMetadata,
  parts: string[],
): string {
  if (
    metadata.storageVersion !== BACKUP_STORAGE_VERSION
    || metadata.storageEncoding !== BACKUP_STORAGE_ENCODING
    || metadata.partCount <= 0
    || parts.length !== metadata.partCount
  ) {
    throw new Error('INCOMPLETE_BACKUP_PARTS');
  }

  const decodedParts = parts.map(base64ToBytes);
  const totalBytes = decodedParts.reduce(
    (total, part) => total + part.byteLength,
    0,
  );
  if (totalBytes !== metadata.compressedBytes) {
    throw new Error('INVALID_BACKUP_SIZE');
  }
  const compressed = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of decodedParts) {
    compressed.set(part, offset);
    offset += part.byteLength;
  }
  if (checksumBytes(compressed) !== metadata.checksum) {
    throw new Error('INVALID_BACKUP_CHECKSUM');
  }

  const source = gunzipSync(compressed);
  if (source.byteLength !== metadata.sourceBytes) {
    throw new Error('INVALID_BACKUP_SOURCE_SIZE');
  }
  return strFromU8(source);
}
