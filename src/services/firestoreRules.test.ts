import rules from '../../firestore.rules?raw';
import { describe, expect, it } from 'vitest';
import type { ERPState } from '../types';
import { CHUNK_ARRAY_KEYS, chunkDocumentId } from './erpSyncService';

const permissionByChunk: Partial<Record<string, string>> = {
  customers: 'canViewDebts',
  cycles: 'canViewDebts',
  debtTransactions: 'canViewDebts',
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
  backupPoints: 'canViewBackup',
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
  });
});
