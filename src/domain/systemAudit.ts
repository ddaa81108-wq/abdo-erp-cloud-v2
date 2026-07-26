import type { ERPState, SystemAuditEntry, User } from '../types';

type AuditActor = Pick<User, 'id' | 'name' | 'username'> | null;

type AuditConfig = {
  key: keyof ERPState;
  section: string;
  entityType: string;
  label: string;
  id: (item: any) => string;
};

const CONFIGS: AuditConfig[] = [
  { key: 'customers', section: 'ديون العملاء', entityType: 'customer', label: 'عميل', id: (item) => item.id },
  { key: 'cycles', section: 'ديون العملاء', entityType: 'customer_cycle', label: 'دورة دين عميل', id: (item) => item.id },
  { key: 'debtTransactions', section: 'ديون العملاء', entityType: 'customer_transaction', label: 'معاملة عميل', id: (item) => item.id },
  { key: 'companies', section: 'الشركات والتجار', entityType: 'business_account', label: 'حساب شركة أو تاجر', id: (item) => item.id },
  { key: 'companyTransactions', section: 'الشركات والتجار', entityType: 'business_transaction', label: 'معاملة شركة أو تاجر', id: (item) => item.id },
  { key: 'merchants', section: 'الشركات والتجار', entityType: 'legacy_merchant', label: 'حساب تاجر قديم', id: (item) => item.id },
  { key: 'merchantTransactions', section: 'الشركات والتجار', entityType: 'legacy_merchant_transaction', label: 'معاملة تاجر قديمة', id: (item) => item.id },
  { key: 'trustDeposits', section: 'الأمانات', entityType: 'trust_account', label: 'حساب أمانة', id: (item) => item.id },
  { key: 'purchases', section: 'المشتريات', entityType: 'purchase_transaction', label: 'معاملة مشتريات', id: (item) => item.id },
  { key: 'purchaseAccounts', section: 'المشتريات', entityType: 'purchase_account', label: 'دورة مشتريات', id: (item) => item.id },
  { key: 'treasuryTransactions', section: 'الخزينة', entityType: 'treasury_transaction', label: 'حركة خزينة', id: (item) => item.id },
  { key: 'safeAudits', section: 'الخزينة', entityType: 'treasury_audit', label: 'مراجعة خزينة', id: (item) => item.id },
  { key: 'egyptianCashRecords', section: 'المصراوية', entityType: 'egyptian_cash_day', label: 'سجل يوم مصراوية', id: (item) => item.date },
  { key: 'users', section: 'صلاحيات الموظفين', entityType: 'user', label: 'حساب موظف', id: (item) => item.id },
  { key: 'delegates', section: 'صلاحيات الموظفين', entityType: 'delegate', label: 'مندوب', id: (item) => String(item) },
  { key: 'notesAndReminders', section: 'التنبيهات', entityType: 'note', label: 'تنبيه أو ملاحظة', id: (item) => item.id },
  { key: 'backupPoints', section: 'النسخ الاحتياطي', entityType: 'backup', label: 'نسخة احتياطية', id: (item) => item.id },
];

const same = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

const itemName = (item: any) =>
  item?.name
  || item?.customerName
  || item?.type
  || item?.description
  || item?.referenceNo
  || item?.date
  || String(item || '');

const itemAmount = (item: any) => {
  const value = item?.amount ?? item?.result ?? item?.value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const itemTime = (item: any, fallback: string) =>
  item?.updatedAt
  || item?.deletedAt
  || item?.createdAt
  || item?.date
  || fallback;

const makeEntry = (
  config: AuditConfig,
  item: any,
  action: SystemAuditEntry['action'],
  actor: AuditActor,
  fallbackTime: string,
): SystemAuditEntry => {
  const entityId = config.id(item);
  const name = itemName(item);
  const actionLabel = {
    create: 'إضافة',
    update: 'تعديل',
    delete: 'مسح',
    restore: 'استرجاع',
  }[action];
  return {
    id: `system_audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    occurredAt: itemTime(item, fallbackTime),
    action,
    section: config.section,
    entityType: config.entityType,
    entityId,
    title: `${actionLabel} ${config.label}`,
    details: name ? `${config.label}: ${name}` : `${actionLabel} داخل قسم ${config.section}`,
    amount: itemAmount(item),
    actorId: actor?.id,
    actorName: actor?.name || actor?.username,
  };
};

export function collectSystemAuditEntries(
  base: ERPState,
  next: ERPState,
  actor: AuditActor,
  now = new Date().toISOString(),
): SystemAuditEntry[] {
  const entries: SystemAuditEntry[] = [];

  for (const config of CONFIGS) {
    const before = Array.isArray(base[config.key]) ? base[config.key] as any[] : [];
    const after = Array.isArray(next[config.key]) ? next[config.key] as any[] : [];
    const beforeById = new Map(before.map((item) => [config.id(item), item]));
    const afterById = new Map(after.map((item) => [config.id(item), item]));
    const ids = new Set([...beforeById.keys(), ...afterById.keys()]);

    for (const id of ids) {
      const oldItem = beforeById.get(id);
      const newItem = afterById.get(id);
      if (!oldItem && newItem) {
        entries.push(makeEntry(
          config,
          newItem,
          newItem.isDeleted ? 'delete' : 'create',
          actor,
          now,
        ));
      } else if (oldItem && !newItem) {
        entries.push(makeEntry(config, oldItem, 'delete', actor, now));
      } else if (oldItem && newItem && !same(oldItem, newItem)) {
        const action =
          !oldItem.isDeleted && newItem.isDeleted
            ? 'delete'
            : oldItem.isDeleted && !newItem.isDeleted
              ? 'restore'
              : 'update';
        entries.push(makeEntry(config, newItem, action, actor, now));
      }
    }
  }

  return entries;
}

export function seedSystemAuditLog(
  state: ERPState,
  actor: AuditActor,
): SystemAuditEntry[] {
  const entries: SystemAuditEntry[] = [];
  const now = new Date().toISOString();
  for (const config of CONFIGS) {
    const items = Array.isArray(state[config.key])
      ? state[config.key] as any[]
      : [];
    for (const item of items) {
      entries.push(makeEntry(
        config,
        item,
        item?.isDeleted ? 'delete' : 'create',
        actor,
        now,
      ));
    }
  }
  return entries.sort(
    (left, right) =>
      new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  );
}
