import type { User, UserPermissions } from '../types';

export const DENIED_PERMISSIONS: UserPermissions = {
  canViewDebts: false,
  canViewDebtCollections: false,
  canViewCompanies: false,
  canViewTreasury: false,
  canViewPurchases: false,
  canViewDeposits: false,
  canViewArchive: false,
  canViewBackup: false,
  canViewMailManual: false,
  canViewFinancialReports: false,
  canViewTrash: false,
  canUseSmartCards: false,
  canImportExcel: false,
  canExportExcel: false,
};

export const FULL_PERMISSIONS: UserPermissions = Object.fromEntries(
  Object.keys(DENIED_PERMISSIONS).map((key) => [key, true]),
) as unknown as UserPermissions;

export function resolvePermissions(
  role: User['role'],
  permissions?: Partial<UserPermissions>,
): UserPermissions {
  return {
    ...(role === 'admin' ? FULL_PERMISSIONS : DENIED_PERMISSIONS),
    ...(permissions || {}),
  };
}

const TAB_PERMISSION: Record<string, keyof UserPermissions> = {
  debts: 'canViewDebts',
  debt_collections: 'canViewDebtCollections',
  archive: 'canViewArchive',
  companies: 'canViewCompanies',
  merchants: 'canViewCompanies',
  deposits: 'canViewDeposits',
  mail_manual: 'canViewMailManual',
  purchases: 'canViewPurchases',
  treasury: 'canViewTreasury',
  financial_reports: 'canViewFinancialReports',
  trash_can: 'canViewTrash',
  backup: 'canViewBackup',
};

export function canAccessTab(user: User | null, tabId: string): boolean {
  if (!user) return false;
  if (tabId === 'settings' || tabId === 'backup') return user.role === 'admin';

  const permission = TAB_PERMISSION[tabId];
  return permission ? user.permissions[permission] === true : false;
}

export const NAVIGATION_ORDER = [
  'debts',
  'debt_collections',
  'companies',
  'deposits',
  'mail_manual',
  'purchases',
  'treasury',
  'financial_reports',
  'trash_can',
  'settings',
  'backup',
];

export function firstAllowedTab(user: User): string {
  return NAVIGATION_ORDER.find((tabId) => canAccessTab(user, tabId)) || '';
}
