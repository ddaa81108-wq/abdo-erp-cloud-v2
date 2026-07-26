import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { BackupPoint, ERPState } from '../types';

const ENTITY_ARRAY_KEYS = new Set<keyof ERPState>([
  'customers',
  'cycles',
  'debtTransactions',
  'companies',
  'companyTransactions',
  'merchants',
  'merchantTransactions',
  'treasuryTransactions',
  'purchases',
  'purchaseAccounts',
  'purchaseAuditLog',
  'trustDeposits',
  'safeAudits',
  'backupPoints',
  'users',
  'egyptianCashRecords',
  'notesAndReminders',
  'systemAuditLog',
]);

const CHUNK_ARRAY_KEYS: Array<keyof ERPState> = [
  ...ENTITY_ARRAY_KEYS,
  'delegates',
];

const chunkDocumentId = (key: keyof ERPState) => {
  if (key === 'debtTransactions') return 'chunk_debt_transactions';
  if (key === 'purchases') return 'chunk_purchases';
  return `chunk_${String(key).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`;
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function mergeEntityArray<T extends { id?: string }>(
  base: T[] = [],
  next: T[] = [],
  remote: T[] = [],
): T[] {
  const canMergeById = [...base, ...next, ...remote].every((item) => item && typeof item.id === 'string');
  if (!canMergeById) return next;

  const baseById = new Map(base.map((item) => [item.id as string, item]));
  const nextById = new Map(next.map((item) => [item.id as string, item]));
  const mergedById = new Map(remote.map((item) => [item.id as string, item]));
  const changedIds = new Set([...baseById.keys(), ...nextById.keys()]);

  for (const id of changedIds) {
    if (same(baseById.get(id), nextById.get(id))) continue;
    const nextItem = nextById.get(id);
    if (nextItem) mergedById.set(id, nextItem);
    else mergedById.delete(id);
  }

  const remoteOrder = remote.map((item) => item.id as string);
  const addedOrder = next
    .map((item) => item.id as string)
    .filter((id) => !remoteOrder.includes(id));
  return [...remoteOrder, ...addedOrder]
    .map((id) => mergedById.get(id))
    .filter((item): item is T => Boolean(item));
}

/**
 * Applies only the local changes made between base and next on top of the latest
 * remote snapshot. Separate users adding/updating different records no longer
 * overwrite each other's arrays.
 */
export function mergeErpStateChanges(
  base: ERPState,
  next: ERPState,
  remote: ERPState,
): ERPState {
  const merged = structuredClone(remote) as ERPState;
  for (const key of Object.keys(next) as Array<keyof ERPState>) {
    if (same(base[key], next[key])) continue;
    if (ENTITY_ARRAY_KEYS.has(key) && Array.isArray(next[key])) {
      (merged as any)[key] = mergeEntityArray(
        (base[key] as any[]) || [],
        (next[key] as any[]) || [],
        (remote[key] as any[]) || [],
      );
    } else {
      (merged as any)[key] = structuredClone(next[key]);
    }
  }
  return merged;
}

export function splitErpStateForStorage(state: ERPState) {
  const mainState: any = structuredClone(state);
  const chunks: Partial<Record<keyof ERPState, unknown[]>> = {};

  for (const key of CHUNK_ARRAY_KEYS) {
    const values = Array.isArray(mainState[key]) ? mainState[key] : [];
    chunks[key] = key === 'backupPoints'
      ? values.map(({ dataJson, ...backup }: BackupPoint) => backup)
      : values;
    delete mainState[key];
  }

  return { mainState, chunks };
}

export function assembleErpStateFromStorage(
  mainData: any,
  chunks: Partial<Record<keyof ERPState, any>> = {},
): ERPState {
  const { _syncRevision, _updatedAt, ...cleanMainData } = mainData;
  const assembled: any = { ...cleanMainData };
  for (const key of CHUNK_ARRAY_KEYS) {
    assembled[key] = chunks[key]?.[key] || mainData[key] || [];
  }
  return assembled as ERPState;
}

async function saveBackupDocuments(db: Firestore, backupPoints: BackupPoint[]) {
  await Promise.all(backupPoints.filter((backup) => backup.dataJson).map((backup) =>
    setDoc(doc(db, 'erp_system', `backup_${backup.id}`), backup),
  ));
}

export async function writeMergedErpState(
  db: Firestore,
  base: ERPState,
  next: ERPState,
): Promise<ERPState> {
  await saveBackupDocuments(db, next.backupPoints || []);
  const mainRef = doc(db, 'erp_system', 'main_state');
  const chunkRefs = CHUNK_ARRAY_KEYS.map((key) => ({
    key,
    ref: doc(db, 'erp_system', chunkDocumentId(key)),
  }));

  return runTransaction(db, async (transaction) => {
    const [mainSnapshot, ...chunkSnapshots] = await Promise.all([
      transaction.get(mainRef),
      ...chunkRefs.map(({ ref }) => transaction.get(ref)),
    ]);
    const remoteChunks = Object.fromEntries(
      chunkRefs.map(({ key }, index) => [
        key,
        chunkSnapshots[index]?.exists() ? chunkSnapshots[index].data() : null,
      ]),
    ) as Partial<Record<keyof ERPState, any>>;
    const remote = mainSnapshot.exists()
      ? assembleErpStateFromStorage(mainSnapshot.data(), remoteChunks)
      : base;
    const merged = mergeErpStateChanges(base, next, remote);
    const split = splitErpStateForStorage(merged);
    const revision = (mainSnapshot.data()?._syncRevision || 0) + 1;

    transaction.set(mainRef, {
      ...split.mainState,
      _syncRevision: revision,
      _updatedAt: new Date().toISOString(),
    });
    for (const { key, ref } of chunkRefs) {
      transaction.set(ref, {
        [key]: split.chunks[key] || [],
        _syncRevision: revision,
      });
    }
    return merged;
  });
}

export async function loadCompleteErpState(
  db: Firestore,
  mainData: any,
): Promise<ERPState> {
  const chunkSnapshots = await Promise.all(CHUNK_ARRAY_KEYS.map(async (key) => ({
    key,
    snapshot: await getDoc(
      doc(db, 'erp_system', chunkDocumentId(key)),
    ).catch(() => null),
  })));
  const chunks = Object.fromEntries(chunkSnapshots.map(({ key, snapshot }) => [
    key,
    snapshot?.exists() ? snapshot.data() : null,
  ])) as Partial<Record<keyof ERPState, any>>;
  const assembled = assembleErpStateFromStorage(
    mainData,
    chunks,
  );
  assembled.backupPoints = await Promise.all((assembled.backupPoints || []).map(async (backup) => {
    if (backup.dataJson) return backup;
    try {
      const snapshot = await getDoc(doc(db, 'erp_system', `backup_${backup.id}`));
      return snapshot.exists() ? { ...backup, dataJson: snapshot.data().dataJson } : backup;
    } catch {
      return backup;
    }
  }));
  return assembled;
}
