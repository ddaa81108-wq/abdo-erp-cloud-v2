/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Customer {
  id: string;
  name: string;
  nameAliases?: string[];
  createdAt: string;
  updatedAt?: string;
  phone?: string;
  collector?: 'abdullah' | 'ali'; // To divide debts into two sections
  isDeleted?: boolean; // track soft deleted accounts for archive discovery
  type?: 'customer' | 'employee' | 'partner'; // support the 3 parallel sections
}

export interface CustomerCycle {
  id: string;
  customerId: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'closed';
  initialBalance: number; // typically 0
  currentBalance: number; // calculated from active cycle txs
}

export interface DebtTransaction {
  id: string;
  customerId: string;
  cycleId: string;
  type: 'debt' | 'payment'; // ط¯ظٹظ† ط£ظˆ ط³ط¯ط§ط¯
  amount: number;
  currency: string;
  conversionRate: number; // conversion factor to primary currency (e.g., 1.0 for LYD)
  date: string;
  referenceNo: string;
  note: string;
  postedToTreasury: boolean;
  createdAt: string;
  isDeleted?: boolean;
  paymentMode?: 'partial' | 'full';
  updatedAt?: string;
}

export interface Company {
  id: string;
  name: string;
  /** The only business distinction in the unified companies/merchants section. */
  accountType?: 'company' | 'merchant';
  nameAliases?: string[];
  contact?: string;
  balance: number; // current balance
  previousBalance?: number; // ط§ظ„ط¯ظٹظ† ط§ظ„ظ‚ط¯ظٹظ… / ط§ظ„ظ‚ظٹظ…ط© ط§ظ„ط³ط§ط¨ظ‚ط©
  newDebt?: number; // ط§ظ„ط¯ظٹظˆظ† ط§ظ„ظ…ط¶ط§ظپط© ظپظٹ طھط§ط±ظٹط® ط§ظ„ظٹظˆظ…طŒ ظ…ط´طھظ‚ط© ظ…ظ† ط§ظ„ط³ط¬ظ„
  paymentToday?: number; // ط§ظ„ظ…ط¯ظپظˆط¹ / طھط®ظ„ظٹطµ ط¬ط¯ظٹط¯
  lastRolloverDate?: string; // طھط§ط±ظٹط® ط¢ط®ط± طھط±ط­ظٹظ„ ظ„ظ„ظ€ 12:00
  isDeleted?: boolean; // ظ„ظ„ط£ط±ط´ظپط© ط­طھظ‰ ظ„ظˆ ط§طھظ…ط³ط­
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyTransaction {
  id: string;
  companyId: string;
  type: 'purchase_invoice' | 'payment'; // ط´ط±ط§ط، ط£ظˆ ط¯ظپط¹ط©
  amount: number;
  currency: string;
  date: string;
  referenceNo: string;
  note: string;
  postedToTreasury: boolean;
  createdAt: string;
  isDeleted?: boolean;
  /** Classifies the row without creating a second ledger. */
  entryKind?: 'opening_balance' | 'debt' | 'payment';
  paymentMode?: 'partial' | 'full';
  updatedAt?: string;
}

export interface Merchant {
  id: string;
  name: string;
  contact?: string;
  balance: number; // current balance
  previousBalance?: number; // ط§ظ„ط¯ظٹظ† ط§ظ„ظ‚ط¯ظٹظ… / ط§ظ„ظ‚ظٹظ…ط© ط§ظ„ط³ط§ط¨ظ‚ط©
  newDebt?: number; // ط§ظ„ط¯ظٹظˆظ† ط§ظ„ظ…ط¶ط§ظپط© ظپظٹ طھط§ط±ظٹط® ط§ظ„ظٹظˆظ…طŒ ظ…ط´طھظ‚ط© ظ…ظ† ط§ظ„ط³ط¬ظ„
  paymentToday?: number; // ط§ظ„ظ…ط¯ظپظˆط¹ / طھط®ظ„ظٹطµ ط¬ط¯ظٹط¯
  lastRolloverDate?: string; // طھط§ط±ظٹط® ط¢ط®ط± طھط±ط­ظٹظ„ ظ„ظ„ظ€ 12:00
  isDeleted?: boolean; // ظ„ظ„ط£ط±ط´ظپط© ط­طھظ‰ ظ„ظˆ ط§طھظ…ط³ط­
  createdAt: string;
}

export interface MerchantTransaction {
  id: string;
  merchantId: string;
  type: 'debt' | 'payment'; // ط¯ظٹظ† ط£ظˆ ط³ط¯ط§ط¯
  amount: number;
  currency: string;
  date: string;
  referenceNo: string;
  note: string;
  postedToTreasury: boolean;
  createdAt: string;
  isDeleted?: boolean;
}

export interface TreasuryTransaction {
  id: string;
  type: 'in' | 'out'; // ظˆط§ط±ط¯ ط£ظˆ طµط§ط¯ط±
  amount: number; 
  currency: string;
  conversionRate: number;
  date: string;
  referenceNo: string;
  source: 'customer_payment' | 'company_payment' | 'purchase' | 'manual_deposit' | 'manual_withdraw' | 'deposit_escrow';
  sourceId?: string;
  description: string;
  createdAt: string;
  isDeleted?: boolean;
  actorName?: string;
  note?: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface PurchaseRecord {
  id: string;
  itemName?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  currency?: string;
  conversionRate?: number; // ط³ط¹ط± ط§ظ„طھط­ظˆظٹظ„ - if undefined or null, triggers an alert!
  date: string;
  companyId?: string; // linked supplier
  referenceNo?: string;
  postedToTreasury?: boolean; // طھط­طµظٹظ„ ظ…ط±ط­ظ„ / ظ…ط¯ظپظˆط¹ ظ…ظ† ط§ظ„ط®ط²ظٹظ†ط©
  createdAt: string;
  merchant?: 'baqy' | 'semsem';
  seq?: number;
  type?: string;
  value?: number | string;
  op?: 'multiply' | 'divide';
  rate?: number | string;
  result?: number;
  paid?: number | string;
  remaining?: number;
  consumer?: number | string;
  isDeleted?: boolean;
  deletedAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface PurchaseAccountState {
  id: string;
  merchant: 'baqy' | 'semsem';
  openingBalanceLyd: number;
  openingBalanceEgp: number;
  activeDate: string;
  updatedAt: string;
}

export interface PurchaseAuditEntry {
  id: string;
  purchaseId?: string;
  merchant: 'baqy' | 'semsem';
  date: string;
  action: 'create' | 'update' | 'delete' | 'restore' | 'archive';
  actorId?: string;
  actorName?: string;
  details: string;
  createdAt: string;
}

export interface TrustDepositTx {
  id: string;
  type: 'deposit_lyd' | 'withdraw_lyd' | 'convert_to_egp' | 'withdraw_egp' | 'deposit_egp';
  amountLyd: number;
  amountEgp: number;
  rate?: number;
  date: string;
  note: string;
  referenceNo?: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface TrustDeposit {
  id: string;
  customerName: string;
  amount: number; // total LYD custody balance (for master level compatibility)
  amountLyd: number; // current active LYD balance
  amountEgp: number; // current active EGP balance
  currency: string;
  date: string;
  referenceNo: string;
  status: 'held' | 'refunded' | 'released_to_debt'; // 'held' if active, 'refunded' if fully cleared
  note: string;
  createdAt: string;
  history?: TrustDepositTx[];
  nameAliases?: string[];
  updatedAt?: string;
  isDeleted?: boolean;
}

export interface NoteReminder {
  id: string;
  text: string;
  date: string;
  isReminder: boolean;
  reminderDate?: string;
  isCompleted: boolean;
}

export interface SafeAudit {
  id: string;
  date: string;
  expectedBalance: number;
  actualBalance: number;
  difference: number;
  referenceNo: string;
  auditor: string;
  note: string;
}

export interface BackupPoint {
  id: string;
  name: string;
  date: string;
  description: string;
  dataJson: string; // Serialized complete state
}

export interface UserPermissions {
  canViewDebts: boolean;
  canViewCompanies: boolean;
  canViewTreasury: boolean;
  canViewPurchases: boolean;
  canViewDeposits: boolean;
  canViewArchive: boolean;
  canViewBackup: boolean;
  canViewMailManual?: boolean;
  canViewFinancialReports?: boolean;
  canViewTrash?: boolean;
  canUseSmartCards?: boolean;
  canImportExcel?: boolean;
  canExportExcel?: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'accountant' | 'cashier' | 'warehouse' | 'assistant';
  password: string;
  permissions: UserPermissions;
  createdAt: string;
  isActive?: boolean;
}

export interface EgyptianCashRow {
  value: number;
  commission: number;
}

export interface EgyptianCashRecord {
  date: string; // "YYYY-MM-DD"
  rows: EgyptianCashRow[];
  previousValue: number;
  receivedValue: number;
}

export interface FinancialReportRate {
  id: string;
  date: string; // "YYYY-MM-DD"
  /** Number of Egyptian pounds equivalent to one Libyan dinar. */
  egpPerLyd: number;
  updatedAt: string;
}

export interface FinancialReportSnapshot {
  id: string;
  date: string; // "YYYY-MM-DD"
  treasuryPositivesLyd: number;
  treasuryObligationsLyd: number;
  egyptianCashRemainderEgp: number;
  vodafoneBaqyRemainderEgp: number;
  vodafoneSemsemRemainderEgp: number;
  vodafoneTotalRemainderEgp?: number;
  /** Positive means custody owed to its owner; negative means money owed to us. */
  trustBalanceEgp: number;
  netEgyptianPositionEgp: number;
  egpPerLyd: number;
  egyptianEquivalentLyd: number;
  totalOwnedLyd: number;
  netPositionLyd: number;
  createdAt: string;
  updatedAt: string;
}

export interface ERPState {
  customers: Customer[];
  cycles: CustomerCycle[];
  debtTransactions: DebtTransaction[];
  companies: Company[];
  companyTransactions: CompanyTransaction[];
  merchants: Merchant[];
  merchantTransactions: MerchantTransaction[];
  treasuryTransactions?: any[];
  treasuryLedgerVersion?: number;
  purchases: PurchaseRecord[];
  purchaseAccounts?: PurchaseAccountState[];
  purchaseAuditLog?: PurchaseAuditEntry[];
  purchaseLedgerMigrationVersion?: number;
  trustDeposits: TrustDeposit[];
  safeAudits: SafeAudit[];
  backupPoints: BackupPoint[];
  managerPasswordHash: string;
  users: User[];
  egyptianCashRecords: EgyptianCashRecord[];
  financialReportRates?: FinancialReportRate[];
  financialReportSnapshots?: FinancialReportSnapshot[];
  delegates?: string[]; // Custom delegates list
  notesAndReminders: NoteReminder[];
}

// Empty by design: real business data is loaded from Firestore or a user backup.
export const INITIAL_ERP_STATE: ERPState = {
  customers: [],
  cycles: [],
  debtTransactions: [],
  companies: [],
  companyTransactions: [],
  merchants: [],
  merchantTransactions: [],
  treasuryTransactions: [],
  treasuryLedgerVersion: 0,
  purchases: [],
  purchaseAccounts: [],
  purchaseAuditLog: [],
  purchaseLedgerMigrationVersion: 0,
  trustDeposits: [],
  safeAudits: [],
  backupPoints: [],
  managerPasswordHash: '',
  users: [],
  egyptianCashRecords: [],
  financialReportRates: [],
  financialReportSnapshots: [],
  delegates: [],
  notesAndReminders: [],
};
