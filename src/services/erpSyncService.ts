import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { BackupPoint, ERPState, SystemAuditEntry } from '../types';

const AUDIT_STORAGE_VERSION = 1;

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

export const CHUNK_ARRAY_KEYS: Array<keyof ERPState> = [
  ...ENTITY_ARRAY_KEYS,
  'delegates',
];

export const chunkDocumentId = (key: keyof ERPState) => {
  if (key === 'debtTransactions') return 'chunk_debt_transactions';
  if (key === 'purchases') return 'chunk_purchases';
  return `chunk_${String(key).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`;
};

export const auditMonthKey = (entry: Pick<SystemAuditEntry, 'occurredAt'>) => {
  const match = String(entry.occurredAt || '').match(/^(\d{4})-(\d{2})/);
  return match ? `${match[1]}_${match[2]}` : 'unknown';
};

export function groupAuditEntriesByMonth(entries: SystemAuditEntry[] = []) {
  const groups = new Map<string, SystemAuditEntry[]>();
  entries.forEach((entry) => {
    const month = auditMonthKey(entry);
    groups.set(month, [...(groups.get(month) || []), entry]);
  });
  return groups;
}

const auditMonthDocumentId = (month: string) =>
  `chunk_system_audit_${month}`;

export function changedAuditMonths(
  base: SystemAuditEntry[] = [],
  next: SystemAuditEntry[] = [],
) {
  const before = groupAuditEntriesByMonth(base);
  const after = groupAuditEntriesByMonth(next);
  return [...new Set([...before.keys(), ...after.keys()])]
    .filter((month) => !same(before.get(month) || [], after.get(month) || []))
    .sort();
}

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
  currentState?: ERPState,
): ERPState {
  const {
    _syncRevision,
    _updatedAt,
    _changedChunks,
    _auditStorageVersion,
    _auditMonths,
    _changedAuditMonths,
    ...cleanMainData
  } = mainData;
  // Old installations may still carry array fields inside main_state. They
  // are valid only as an initial fallback; they must never overwrite newer
  // chunk data during an incremental refresh.
  const scalarMainData: any = { ...cleanMainData };
  CHUNK_ARRAY_KEYS.forEach((key) => delete scalarMainData[key]);
  const assembled: any = currentState
    ? { ...structuredClone(currentState), ...scalarMainData }
    : { ...scalarMainData };
  for (const key of CHUNK_ARRAY_KEYS) {
    if (chunks[key]) {
      assembled[key] = chunks[key]?.[key] || [];
    } else if (!currentState) {
      assembled[key] = mainData[key] || [];
    }
  }
  return assembled as ERPState;
}

export function changedChunkKeys(
  base: ERPState,
  next: ERPState,
): Array<keyof ERPState> {
  return CHUNK_ARRAY_KEYS.filter((key) => !same(base[key], next[key]));
}

async function saveChangedBackupDocuments(
  db: Firestore,
  baseBackups: BackupPoint[],
  nextBackups: BackupPoint[],
) {
  const beforeById = new Map(baseBackups.map((backup) => [backup.id, backup]));
  const changed = nextBackups.filter((backup) => {
    if (!backup.dataJson) return false;
    const previous = beforeById.get(backup.id);
    return !previous || previous.dataJson !== backup.dataJson;
  });
  await Promise.all(changed.map((backup) =>
    setDoc(doc(db, 'erp_system', `backup_${backup.id}`), backup),
  ));
}

export async function writeMergedErpState(
  db: Firestore,
  base: ERPState,
  next: ERPState,
): Promise<ERPState> {
  const changedChunks = changedChunkKeys(base, next);
  const changedMainKeys = (Object.keys(next) as Array<keyof ERPState>)
    .filter((key) => !CHUNK_ARRAY_KEYS.includes(key) && !same(base[key], next[key]));
  if (changedChunks.length === 0 && changedMainKeys.length === 0) return next;

  if (changedChunks.includes('backupPoints')) {
    await saveChangedBackupDocuments(
      db,
      base.backupPoints || [],
      next.backupPoints || [],
    );
  }
  const mainRef = doc(db, 'erp_system', 'main_state');
  const chunkRefs = changedChunks
    .filter((key) => key !== 'systemAuditLog')
    .map((key) => ({
    key,
    ref: doc(db, 'erp_system', chunkDocumentId(key)),
  }));

  return runTransaction(db, async (transaction) => {
    const mainSnapshot = await transaction.get(mainRef);
    const mainData = mainSnapshot.data() || {};
    const needsAuditMigration =
      changedChunks.includes('systemAuditLog')
      && Number(mainData._auditStorageVersion || 0) < AUDIT_STORAGE_VERSION;
    const auditMonths = changedChunks.includes('systemAuditLog')
      ? (
          needsAuditMigration
            ? [...groupAuditEntriesByMonth([
                ...(base.systemAuditLog || []),
                ...(next.systemAuditLog || []),
              ]).keys()]
            : changedAuditMonths(
                base.systemAuditLog || [],
                next.systemAuditLog || [],
              )
        )
      : [];
    const auditRefs = auditMonths.map((month) => ({
      month,
      ref: doc(db, 'erp_system', auditMonthDocumentId(month)),
    }));
    const [chunkSnapshots, auditSnapshots] = await Promise.all([
      Promise.all(chunkRefs.map(({ ref }) => transaction.get(ref))),
      Promise.all(auditRefs.map(({ ref }) => transaction.get(ref))),
    ]);
    const remoteChunks = Object.fromEntries(
      chunkRefs.map(({ key }, index) => [
        key,
        chunkSnapshots[index]?.exists() ? chunkSnapshots[index].data() : null,
      ]),
    ) as Partial<Record<keyof ERPState, any>>;
    const remote = mainSnapshot.exists()
      ? assembleErpStateFromStorage(mainData, remoteChunks, base)
      : base;
    if (changedChunks.includes('systemAuditLog') && !needsAuditMigration) {
      const remoteAuditGroups = groupAuditEntriesByMonth(
        remote.systemAuditLog || [],
      );
      auditRefs.forEach(({ month }, index) => {
        const snapshot = auditSnapshots[index];
        remoteAuditGroups.set(
          month,
          snapshot?.exists()
            ? (snapshot.data().systemAuditLog || [])
            : [],
        );
      });
      remote.systemAuditLog = [...remoteAuditGroups.values()].flat();
    }
    const merged = mergeErpStateChanges(base, next, remote);
    const split = splitErpStateForStorage(merged);
    const revision = (mainData._syncRevision || 0) + 1;
    const mergedAuditGroups = groupAuditEntriesByMonth(
      merged.systemAuditLog || [],
    );
    const auditStorageVersion =
      Number(mainData._auditStorageVersion || 0) >= AUDIT_STORAGE_VERSION
      || changedChunks.includes('systemAuditLog')
        ? AUDIT_STORAGE_VERSION
        : 0;

    transaction.set(mainRef, {
      ...split.mainState,
      _syncRevision: revision,
      _updatedAt: new Date().toISOString(),
      _changedChunks: changedChunks.map(String),
      _auditStorageVersion: auditStorageVersion,
      _auditMonths: [...mergedAuditGroups.keys()].sort(),
      _changedAuditMonths: auditMonths,
    });
    for (const { key, ref } of chunkRefs) {
      transaction.set(ref, {
        [key]: split.chunks[key] || [],
        _syncRevision: revision,
      });
    }
    for (const { month, ref } of auditRefs) {
      transaction.set(ref, {
        systemAuditLog: mergedAuditGroups.get(month) || [],
        month,
        _syncRevision: revision,
      });
    }
    return merged;
  });
}

export async function loadCompleteErpState(
  db: Firestore,
  mainData: any,
  options: {
    currentState?: ERPState;
    chunkKeys?: Array<keyof ERPState>;
  } = {},
): Promise<ERPState> {
  const keys = options.chunkKeys || CHUNK_ARRAY_KEYS;
  const wantsAudit = keys.includes('systemAuditLog');
  const usesMonthlyAudit =
    Number(mainData._auditStorageVersion || 0) >= AUDIT_STORAGE_VERSION;
  const regularKeys = keys.filter(
    (key) => key !== 'systemAuditLog' || !usesMonthlyAudit,
  );
  const chunkSnapshots = await Promise.all(regularKeys.map(async (key) => ({
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
    options.currentState,
  );
  if (wantsAudit && usesMonthlyAudit) {
    const months = options.currentState
      ? (Array.isArray(mainData._changedAuditMonths)
          ? mainData._changedAuditMonths
          : mainData._auditMonths || [])
      : (mainData._auditMonths || []);
    const auditSnapshots = await Promise.all(
      months.map((month: string) =>
        getDoc(doc(db, 'erp_system', auditMonthDocumentId(month)))
          .catch(() => null),
      ),
    );
    const groups = groupAuditEntriesByMonth(
      options.currentState?.systemAuditLog || [],
    );
    months.forEach((month: string, index: number) => {
      const snapshot = auditSnapshots[index];
      groups.set(
        month,
        snapshot?.exists()
          ? (snapshot.data().systemAuditLog || [])
          : [],
      );
    });
    assembled.systemAuditLog = [...groups.values()].flat();
  }
  const shouldHydrateBackups = !options.currentState || keys.includes('backupPoints');
  if (shouldHydrateBackups) assembled.backupPoints = await Promise.all((assembled.backupPoints || []).map(async (backup) => {
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
