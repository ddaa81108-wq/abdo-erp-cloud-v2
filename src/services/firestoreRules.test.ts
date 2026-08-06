import rules from '../../firestore.rules?raw';
import { describe, expect, it } from 'vitest';
import type { ERPState } from '../types';
import {
  CHUNK_ARRAY_KEYS,
  chunkDocumentId,
  chunkKeysForUser,
} from './erpSyncService';
import { DENIED_PERMISSIONS, FULL_PERMISSIONS } from '../utils/permissions';

const permissionByChunk: Partial<Record<string, string>> = {
  customers: 'canViewDebts',
  cycles: 'canViewDebts',
  debtTransactions: 'canViewDebts',
  debtCollectionSessions: 'canViewDebtCollections',
  debtCollectionAssignments: 'canViewDebtCollections',
  debtCollectionReceipts: 'canViewDebtCollections',
  debtCollectorPayrolls: 'canViewDebtCollections',
  debtCollectorWithdrawals: 'canViewDebtCollections',
  delegates: 'canViewDebts',
  companies: 'canViewCompanies',
  companyTransactions: 'canViewCompanies',
  merchants: 'canViewCompanies',
  merchantTransactions: 'canViewCompanies',
  trustDeposits: 'canViewDeposits',
  egyptianCashRecords: 'canViewMailManual',
  purchases: 'canViewPurchases',
  purchaseAccounts: 'canViewPurchases',
  purchaseAuditLog: 'canViewPurchases',
  treasuryTransactions: 'canViewTreasury',
  safeAudits: 'canViewTreasury',
  financialReportRates: 'canViewFinancialReports',
  financialReportSnapshots: 'canViewFinancialReports',
};

describe('Firestore section security map', () => {
  it('mentions every synchronized chunk in the rules', () => {
    for (const key of CHUNK_ARRAY_KEYS) {
      expect(rules, `${String(key)} is missing from Firestore rules`)
        .toContain(chunkDocumentId(key));
    }
  });

  it('binds every business chunk to its section permission', () => {
    for (const [key, permission] of Object.entries(permissionByChunk)) {
      expect(rules).toContain(chunkDocumentId(key as keyof ERPState));
      expect(rules).toContain(`hasPermission('${permission}')`);
    }
  });

  it('does not leave the old unrestricted ERP wildcard in place', () => {
    expect(rules).not.toContain('match /erp_system/{document=**}');
  });

  it('keeps user mirrors admin-only and limits employee main-state writes', () => {
    expect(rules).toContain('match /erp_system/chunk_users');
    expect(rules).toContain('allow read, write: if isAdmin();');
    expect(rules).toContain('changesOnlySyncMetadata()');
    expect(rules).toContain('changesOnlyPurchaseSyncState()');
    expect(rules).toContain('changesOnlyTreasurySyncState()');
  });

  it('keeps backup indexes, manifests, and parts admin-only', () => {
    expect(rules).toContain('match /erp_system/chunk_backup_points');
    expect(rules).toContain("backupDocument.matches('backup_.*')");
    const backupRules = rules.slice(
      rules.indexOf('match /erp_system/chunk_backup_points'),
      rules.indexOf('// User mirrors are administrative data'),
    );
    expect(backupRules).toContain('allow read, write: if isAdmin();');
    expect(backupRules).not.toContain("hasPermission('canViewBackup')");
  });

  it('subscribes employees only to the chunks allowed by their permissions', () => {
    const keys = chunkKeysForUser({
      role: 'assistant',
      permissions: { ...DENIED_PERMISSIONS, canViewDebts: true },
    });
    expect(keys).toEqual([
      'customers',
      'cycles',
      'debtTransactions',
      'notesAndReminders',
      'delegates',
    ]);
  });

  it('subscribes administrators to every synchronized chunk', () => {
    expect(chunkKeysForUser({
      role: 'admin',
      permissions: FULL_PERMISSIONS,
    })).toEqual(CHUNK_ARRAY_KEYS);
  });

  it('subscribes a collector only to collection data and shared reminders', () => {
    const keys = chunkKeysForUser({
      role: 'assistant',
      permissions: { ...DENIED_PERMISSIONS, canViewDebtCollections: true },
    });
    expect(keys).toEqual([
      'debtCollectionSessions',
      'debtCollectionAssignments',
      'debtCollectionReceipts',
      'debtCollectorPayrolls',
      'debtCollectorWithdrawals',
      'notesAndReminders',
    ]);
    expect(keys).not.toContain('customers');
    expect(keys).not.toContain('debtTransactions');
  });

  it('never subscribes a limited employee to backup payloads', () => {
    const keys = chunkKeysForUser({
      role: 'assistant',
      permissions: { ...DENIED_PERMISSIONS, canViewBackup: true },
    });
    expect(keys).not.toContain('backupPoints');
  });
});
