/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Customer {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
  lastUpdated?: string;
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
  type: 'debt' | 'payment'; // دين أو سداد
  amount: number;
  currency: string;
  conversionRate: number; // conversion factor to primary currency (e.g., 1.0 for LYD)
  date: string;
  referenceNo: string;
  note: string;
  postedToTreasury: boolean;
  createdAt: string;
  isDeleted?: boolean;
}

export interface Company {
  id: string;
  name: string;
  contact?: string;
  balance: number; // current balance
  previousBalance?: number; // الدين القديم / القيمة السابقة
  newDebt?: number; // الدين الجديد / الشغل اليومي
  paymentToday?: number; // المدفوع / تخليص جديد
  lastRolloverDate?: string; // تاريخ آخر ترحيل للـ 12:00
  isDeleted?: boolean; // للأرشفة حتى لو اتمسح
  createdAt?: string;
}

export interface CompanyTransaction {
  id: string;
  companyId: string;
  type: 'purchase_invoice' | 'payment'; // شراء أو دفعة
  amount: number;
  currency: string;
  date: string;
  referenceNo: string;
  note: string;
  postedToTreasury: boolean;
  createdAt: string;
  isDeleted?: boolean;
}

export interface Merchant {
  id: string;
  name: string;
  contact?: string;
  balance: number; // current balance
  previousBalance?: number; // الدين القديم / القيمة السابقة
  newDebt?: number; // الدين الجديد / الشغل اليومي
  paymentToday?: number; // المدفوع / تخليص جديد
  lastRolloverDate?: string; // تاريخ آخر ترحيل للـ 12:00
  isDeleted?: boolean; // للأرشفة حتى لو اتمسح
  createdAt: string;
}

export interface MerchantTransaction {
  id: string;
  merchantId: string;
  type: 'debt' | 'payment'; // دين أو سداد
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
  type: 'in' | 'out'; // وارد أو صادر
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
}

export interface PurchaseRecord {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  conversionRate?: number; // سعر التحويل - if undefined or null, triggers an alert!
  date: string;
  companyId?: string; // linked supplier
  referenceNo: string;
  postedToTreasury: boolean; // تحصيل مرحل / مدفوع من الخزينة
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

export interface AdvancePerson {
  id: string;
  name: string;
  balanceLYD: number;
  balanceEGP: number;
}

export interface AdvanceTransaction {
  id: string;
  personId: string;
  type: "add" | "repay";
  amount: number;
  currency: "LYD" | "EGP";
  date: string;
  note: string;
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
  canViewAdvances: boolean;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'accountant' | 'cashier' | 'warehouse' | 'assistant';
  permissions: UserPermissions;
  createdAt: string;
}

export interface EgyptianCashRow {
  value: number;
  commission: number;
}

export interface EgyptianCashRecord {
  date: string; // "YYYY-MM-DD"
  rows: EgyptianCashRow[]; // Array of 25 rows
  previousValue: number;
  receivedValue: number;
  isPostedToTreasury?: boolean;
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
  purchases: PurchaseRecord[];
  trustDeposits: TrustDeposit[];
  safeAudits: SafeAudit[];
  backupPoints: BackupPoint[];
  managerPasswordHash?: string; // ⚠️ قديم — غير مستخدم حالياً
  users: User[];
  egyptianCashRecords: EgyptianCashRecord[];
  delegates?: string[]; // Custom delegates list
  notesAndReminders: NoteReminder[];
  advancePersons: AdvancePerson[];
  advanceTransactions: AdvanceTransaction[];
  sectionLabels?: Record<string, string>; // Custom section labels
}

// ----------------------------------------------------
// DEMO DATA GENERATOR FOR REALISTIC LYBYAN ERP DISPLAY
// ----------------------------------------------------

export const INITIAL_ERP_STATE: ERPState = {
  customers: [
    { id: 'cust_1', name: 'أحمد المحمودي', phone: '091-2345678', createdAt: '2026-05-10T10:00:00' },
    { id: 'cust_2', name: 'محمد الفيتوري', phone: '092-8765432', createdAt: '2026-06-01T11:00:00' },
    { id: 'cust_3', name: 'أنيس الورفلي', phone: '091-5553322', createdAt: '2026-06-05T09:30:00' },
    { id: 'cust_4', name: 'شركة المدائن للمقاولات', phone: '094-1112233', createdAt: '2026-06-10T14:45:00' },
  ],
  merchants: [
    { id: 'mer_1', name: 'التاجر صلاح بوكتف', contact: '091-7776655', balance: 5400, previousBalance: 3000, newDebt: 2400, paymentToday: 0, lastRolloverDate: '2026-06-14', createdAt: '2026-06-01T10:00:00' },
    { id: 'mer_2', name: 'شركة الشروق للمواد الكهربائية', contact: '092-3334455', balance: 0, previousBalance: 0, newDebt: 0, paymentToday: 0, lastRolloverDate: '2026-06-14', createdAt: '2026-06-03T11:00:00' },
  ],
  merchantTransactions: [
    { id: 'tx_m_1', merchantId: 'mer_1', type: 'debt', amount: 3000, currency: 'د.ل', date: '2026-06-10T11:00:00', referenceNo: 'TX-2026-000300', note: 'شراء بكرات سلك رئيسية', postedToTreasury: true, createdAt: '2026-06-10T11:00:00' },
    { id: 'tx_m_2', merchantId: 'mer_1', type: 'debt', amount: 2400, currency: 'د.ل', date: '2026-06-15T09:00:00', referenceNo: 'TX-2026-000451', note: 'توريد كوابل فرعية بالآجل', postedToTreasury: true, createdAt: '2026-06-15T09:00:00' },
  ],
  cycles: [
    // احمد's first cycle is closed (100 debt, 100 paid -> Balance 0 -> closed)
    { id: 'cycle_1_1', customerId: 'cust_1', startDate: '2026-05-10T10:15:00', endDate: '2026-05-20T17:00:00', status: 'closed', initialBalance: 0, currentBalance: 0 },
    // احمد's second active cycle (started with new active debt 50, now active)
    { id: 'cycle_1_2', customerId: 'cust_1', startDate: '2026-06-12T09:15:00', status: 'active', initialBalance: 0, currentBalance: 50 },
    
    // محمد الفيتوري has an active cycle with dynamic items
    { id: 'cycle_2_1', customerId: 'cust_2', startDate: '2026-06-01T11:15:00', status: 'active', initialBalance: 0, currentBalance: 8400 },
    
    // أنيس الورفلي has an active cycle
    { id: 'cycle_3_1', customerId: 'cust_3', startDate: '2026-06-05T10:00:00', status: 'active', initialBalance: 0, currentBalance: 3100 },
    
    // شركة المدائن has a closed cycle (balanced to 0)
    { id: 'cycle_4_1', customerId: 'cust_4', startDate: '2026-06-10T15:00:00', endDate: '2026-06-13T12:00:00', status: 'closed', initialBalance: 0, currentBalance: 0 }
  ],
  debtTransactions: [
    // Ahmad Cycle 1: Debt 100, payment 100
    { id: 'tx_d_1', customerId: 'cust_1', cycleId: 'cycle_1_1', type: 'debt', amount: 100, currency: 'د.ل', conversionRate: 1, date: '2026-05-10T10:20:00', referenceNo: 'TX-2026-000101', note: 'شراء كوابل كهربائية ومقابس', postedToTreasury: true, createdAt: '2026-05-10T10:20:00' },
    { id: 'tx_d_2', customerId: 'cust_1', cycleId: 'cycle_1_1', type: 'payment', amount: 100, currency: 'د.ل', conversionRate: 1, date: '2026-05-20T16:45:00', referenceNo: 'TX-2026-000184', note: 'سداد نقدي لتصفية الدورة الأولى', postedToTreasury: true, createdAt: '2026-05-20T16:45:00' },
    
    // Ahmad Cycle 2: New debt of 50
    { id: 'tx_d_3', customerId: 'cust_1', cycleId: 'cycle_1_2', type: 'debt', amount: 50, currency: 'د.ل', conversionRate: 1, date: '2026-06-12T09:30:00', referenceNo: 'TX-2026-000412', note: 'شراء قاطع كهربائي رئيسي', postedToTreasury: true, createdAt: '2026-06-12T09:30:00' },
    
    // محمد الفيتوري: Debt 12000, Paid 3600 -> Balance 8400
    { id: 'tx_d_4', customerId: 'cust_2', cycleId: 'cycle_2_1', type: 'debt', amount: 12000, currency: 'د.ل', conversionRate: 1, date: '2026-06-01T11:30:00', referenceNo: 'TX-2026-000305', note: 'شراء محول تيار بقوة 100 ك.ف.أ', postedToTreasury: true, createdAt: '2026-06-01T11:30:00' },
    { id: 'tx_d_5', customerId: 'cust_2', cycleId: 'cycle_2_1', type: 'payment', amount: 3600, currency: 'د.ل', conversionRate: 1, date: '2026-06-08T13:10:00', referenceNo: 'TX-2026-000350', note: 'دفعة أولى صك مصدق - التجاري الوطني', postedToTreasury: true, createdAt: '2026-06-08T13:10:00' },
    
    // أنيس الورفلي: Debt 4500, Paid 1400 -> Balance 3100
    { id: 'tx_d_6', customerId: 'cust_3', cycleId: 'cycle_3_1', type: 'debt', amount: 4500, currency: 'د.ل', conversionRate: 1, date: '2026-06-05T10:15:00', referenceNo: 'TX-2026-000320', note: 'شراء تمديدات طاقة نفاثة', postedToTreasury: true, createdAt: '2026-06-05T10:15:00' },
    { id: 'tx_d_7', customerId: 'cust_3', cycleId: 'cycle_3_1', type: 'payment', amount: 1400, currency: 'د.ل', conversionRate: 1, date: '2026-06-11T12:00:00', referenceNo: 'TX-2026-000392', note: 'دفعة سداد نقدية من حساب الخزينة الفرعية', postedToTreasury: false, createdAt: '2026-06-11T12:00:00' }, // Notice: Not posted to treasury (alert trigger!)
    
    // شركة المدائن: Debt 5000, Paid 5000 -> Closed
    { id: 'tx_d_8', customerId: 'cust_4', cycleId: 'cycle_4_1', type: 'debt', amount: 5000, currency: 'د.ل', conversionRate: 1, date: '2026-06-10T15:15:00', referenceNo: 'TX-2026-000378', note: 'توريد كراتين مغلفة ومعدات مناولة', postedToTreasury: true, createdAt: '2026-06-10T15:15:00' },
    { id: 'tx_d_9', customerId: 'cust_4', cycleId: 'cycle_4_1', type: 'payment', amount: 5000, currency: 'د.ل', conversionRate: 1, date: '2026-06-13T12:00:00', referenceNo: 'TX-2026-000420', note: 'سداد كامل الحساب بقيمة 5,000 د.ل', postedToTreasury: true, createdAt: '2026-06-13T12:00:00' },
  ],
  companies: [
    { id: 'comp_1', name: 'مجموعة التضامن للاستيراد', contact: '091-9998877', balance: 25000 },
    { id: 'comp_2', name: 'الشركة الليبية للالكترونيات', contact: '092-4445566', balance: 8200 },
    { id: 'comp_3', name: 'مصنع السلام للكابلات وبكرات السلك', contact: '091-3332211', balance: 0 },
  ],
  companyTransactions: [
    { id: 'tx_c_1', companyId: 'comp_1', type: 'purchase_invoice', amount: 35000, currency: 'د.ل', date: '2026-05-15T11:00:00', referenceNo: 'TX-2026-000140', note: 'فاتورة توريد كوابل نحاس بكرة 50م', postedToTreasury: true, createdAt: '2026-05-15T11:00:00' },
    { id: 'tx_c_2', companyId: 'comp_1', type: 'payment', amount: 10000, currency: 'د.ل', date: '2026-05-25T14:30:00', referenceNo: 'TX-2026-000210', note: 'دفعة سداد نقدي للمندوب', postedToTreasury: true, createdAt: '2026-05-25T14:30:00' },
    { id: 'tx_c_3', companyId: 'comp_2', type: 'purchase_invoice', amount: 8200, currency: 'د.ل', date: '2026-06-03T09:15:00', referenceNo: 'TX-2026-000310', note: 'توريد أجهزة كشف الأعطال الرقمية', postedToTreasury: true, createdAt: '2026-06-03T09:15:00' },
  ],
  treasuryTransactions: [
    // Historical posted cash transactions
    { id: 'tx_t_1', type: 'in', amount: 100, currency: 'د.ل', conversionRate: 1, date: '2026-05-20T16:45:00', referenceNo: 'TX-2026-000184', source: 'customer_payment', sourceId: 'tx_d_2', description: 'سداد مقبوضات العميل: أحمد المحمودي', createdAt: '2026-05-20T16:45:00' },
    { id: 'tx_t_2', type: 'out', amount: 10000, currency: 'د.ل', conversionRate: 1, date: '2026-05-25T14:30:00', referenceNo: 'TX-2026-000210', source: 'company_payment', sourceId: 'tx_c_2', description: 'سداد دفعة للمورد: مجموعة التضامن للاستيراد', createdAt: '2026-05-25T14:30:00' },
    { id: 'tx_t_3', type: 'in', amount: 3600, currency: 'د.ل', conversionRate: 1, date: '2026-06-08T13:10:00', referenceNo: 'TX-2026-000350', source: 'customer_payment', sourceId: 'tx_d_5', description: 'سداد مقبوضات العميل: محمد الفيتوري', createdAt: '2026-06-08T13:10:00' },
    { id: 'tx_t_4', type: 'in', amount: 5000, currency: 'د.ل', conversionRate: 1, date: '2026-06-13T12:00:00', referenceNo: 'TX-2026-000420', source: 'customer_payment', sourceId: 'tx_d_9', description: 'سداد مقبوضات العميل: شركة المدائن للمقاولات', createdAt: '2026-06-13T12:00:00' },
    { id: 'tx_t_5', type: 'in', amount: 50, currency: 'د.ل', conversionRate: 1, date: '2026-06-12T09:30:00', referenceNo: 'TX-2026-000412', source: 'customer_payment', sourceId: 'tx_d_3', description: 'سداد دفعة جديدة للعميل: أحمد المحمودي', createdAt: '2026-06-12T09:30:00' },
    
    // Initial bank injection manual deposit to avoid negative treasury start
    { id: 'tx_t_0', type: 'in', amount: 150000, currency: 'د.ل', conversionRate: 1, date: '2026-05-01T08:00:00', referenceNo: 'TX-2026-000001', source: 'manual_deposit', description: 'رأس مال إيداع تأسيسي نقدي بالخزينة', createdAt: '2026-05-01T08:00:00' },
    
    // Purchase transaction posted (will decrease safe balance)
    { id: 'tx_t_6', type: 'out', amount: 12000, currency: 'د.ل', conversionRate: 1, date: '2026-06-02T10:00:00', referenceNo: 'TX-2026-000295', source: 'purchase', sourceId: 'p_1', description: 'مشتريات مسددة: كابلات ضغط عالي مجلفцة', createdAt: '2026-06-02T10:00:00' }
  ],
  purchases: [],
  trustDeposits: [
    { 
      id: 'dep_1', 
      customerName: 'أكرم بوعجيله', 
      amount: 5000, 
      amountLyd: 5000,
      amountEgp: 0,
      currency: 'د.ل', 
      date: '2026-06-04T12:00:00', 
      referenceNo: 'TX-2026-000315', 
      status: 'held', 
      note: 'أمانة دفعة حجز كوابل لشبكة جبل نفوسة', 
      createdAt: '2026-06-04T12:00:00',
      history: [
        { id: 'tx_sub_1', type: 'deposit_lyd', amountLyd: 5000, amountEgp: 0, date: '2026-06-04T12:00:00', note: 'إيداع أمانة أولية بالدينار الليبي' }
      ]
    },
    { 
      id: 'dep_2', 
      customerName: 'سعيد الترهوني', 
      amount: 0, 
      amountLyd: 0,
      amountEgp: 0,
      currency: 'د.ل', 
      date: '2026-06-10T11:20:00', 
      referenceNo: 'TX-2026-000371', 
      status: 'refunded', 
      note: 'أمانة مسترجعة لعدم توفر قطع تحويل كلي', 
      createdAt: '2026-06-10T11:20:00',
      history: [
        { id: 'tx_sub_2', type: 'deposit_lyd', amountLyd: 3000, amountEgp: 0, date: '2026-06-10T10:00:00', note: 'إيداع أمانة أولية بالدينار الليبي' },
        { id: 'tx_sub_3', type: 'withdraw_lyd', amountLyd: 3000, amountEgp: 0, date: '2026-06-10T11:20:00', note: 'استرجاع كامل قيمة الأمانة نقداً بطلب م؆ المردع' }
      ]
    }
  ],
  safeAudits: [
    { id: 'aud_1', date: '2026-06-13T18:00:00', expectedBalance: 148750, actualBalance: 148700, difference: -50, referenceNo: 'TX-2026-000425', auditor: 'المدير عبدو', note: 'عجز طفيف بقيمة 50 دينار تسوية نهاية أسبوع مصاريف بوفيه ضيافة' }
  ],
  backupPoints: [
    { id: 'point_1', name: 'التهيئة الأساسية للنظام', date: '2026-06-14T00:00:00', description: 'نسخة احتياطية تلقائية عند التشغيل لأول مرة بعد تهيئة الداتا المحاسبية', dataJson: '' }
  ],
  managerPasswordHash: undefined,
  users: [
    {
      id: 'u_1',
      username: 'abdo',
      name: 'المدير عبدو (المالك)',
      role: 'admin',
      permissions: {
        canViewDebts: true,
        canViewCompanies: true,
        canViewTreasury: true,
        canViewPurchases: true,
        canViewDeposits: true,
        canViewArchive: true,
        canViewBackup: true,
        canViewAdvances: true
      },
      createdAt: '2026-06-15T00:00:00'
    },
    {
      id: 'u_2',
      username: 'tareq',
      name: 'المحاسب طارق (المالية)',
      role: 'accountant',
      permissions: {
        canViewDebts: true,
        canViewCompanies: true,
        canViewTreasury: true,
        canViewPurchases: true,
        canViewDeposits: true,
        canViewArchive: true,
        canViewBackup: false,
        canViewAdvances: true
      },
      createdAt: '2026-06-15T00:00:00'
    },
    {
      id: 'u_3',
      username: 'mohamed',
      name: 'الكاشير محمد (المبيعات)',
      role: 'cashier',
      permissions: {
        canViewDebts: true,
        canViewCompanies: false,
        canViewTreasury: true,
        canViewPurchases: false,
        canViewDeposits: true,
        canViewArchive: false,
        canViewBackup: false,
        canViewAdvances: false
      },
      createdAt: '2026-06-15T00:00:00'
    },
    {
      id: 'u_4',
      username: 'ali',
      name: 'أمين المخزن علي (التجهيز)',
      role: 'warehouse',
      permissions: {
        canViewDebts: false,
        canViewCompanies: false,
        canViewTreasury: false,
        canViewPurchases: true,
        canViewDeposits: false,
        canViewArchive: true,
        canViewBackup: false,
        canViewAdvances: false
      },
      createdAt: '2026-06-15T00:00:00'
    },
    {
      id: 'u_5',
      username: 'salem',
      name: 'المساعد سالم (المتابعة)',
      role: 'assistant',
      permissions: {
        canViewDebts: true,
        canViewCompanies: false,
        canViewTreasury: false,
        canViewPurchases: false,
        canViewDeposits: false,
        canViewArchive: true,
        canViewBackup: false,
        canViewAdvances: false
      },
      createdAt: '2026-06-15T00:00:00'
    }
  ],
  egyptianCashRecords: [],
  delegates: [],
  notesAndReminders: [],
  advancePersons: [],
  advanceTransactions: [],
};
