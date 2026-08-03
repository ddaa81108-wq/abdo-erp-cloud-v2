import { describe, expect, it } from 'vitest';
import {
  decodeBackupPayload,
  encodeBackupPayload,
} from './backupPayload';

describe('chunked compressed backup payload', () => {
  it('splits a source larger than one MiB into Firestore-safe parts', () => {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
    const segments: string[] = [];
    let seed = 0x12345678;
    let segment = '';
    for (let index = 0; index < 1_100_000; index++) {
      seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
      segment += alphabet[(seed >>> 24) % alphabet.length];
      if (segment.length === 8192) {
        segments.push(segment);
        segment = '';
      }
    }
    segments.push(segment);
    const dataJson = JSON.stringify({ payload: segments.join('') });
    const encoded = encodeBackupPayload(dataJson);

    expect(encoded.metadata.sourceBytes).toBeGreaterThan(1024 * 1024);
    expect(encoded.parts.length).toBeGreaterThan(1);
    encoded.parts.forEach((part) => {
      const documentBytes = new TextEncoder().encode(
        JSON.stringify({ payload: part }),
      ).byteLength;
      expect(documentBytes).toBeLessThan(600 * 1024);
    });
    expect(decodeBackupPayload(encoded.metadata, encoded.parts)).toBe(dataJson);
  });

  it('round-trips Arabic JSON through multiple ordered parts', () => {
    const dataJson = JSON.stringify({
      name: 'نسخة كاملة',
      rows: Array.from({ length: 40 }, (_, index) => ({
        id: index,
        note: `معاملة رقم ${index}`,
      })),
    });
    const encoded = encodeBackupPayload(dataJson, 32);

    expect(encoded.parts.length).toBeGreaterThan(1);
    expect(decodeBackupPayload(encoded.metadata, encoded.parts)).toBe(dataJson);
  });

  it('rejects a missing part before decompression', () => {
    const encoded = encodeBackupPayload(JSON.stringify({ value: 'بيانات' }), 8);
    expect(() => decodeBackupPayload(
      encoded.metadata,
      encoded.parts.slice(0, -1),
    )).toThrow('INCOMPLETE_BACKUP_PARTS');
  });

  it('rejects a corrupted part using the stored integrity checksum', () => {
    const encoded = encodeBackupPayload(JSON.stringify({ value: 'بيانات مهمة' }), 8);
    const corrupted = [...encoded.parts];
    corrupted[0] = `${corrupted[0].slice(0, -2)}AA`;
    expect(() => decodeBackupPayload(encoded.metadata, corrupted)).toThrow();
  });
});
