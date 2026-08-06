import type {
  Customer,
  DebtCollectionAssignment,
  DebtCollectionReceipt,
  DebtCollectionSession,
  DebtCollectorPayroll,
  DebtCollectorWithdrawal,
  DebtTransaction,
  ERPState,
  User,
} from '../types';
import {
  calculateActiveCycleBalance,
  synchronizeActiveCustomerCycles,
  upsertCustomerPaymentInTreasury,
} from './customerAccounts';

export const DEFAULT_COLLECTOR_SALARY = 3500;

const makeId = (prefix: string) =>
  `${prefix}_${typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;

const positiveNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const activeCustomerCycle = (state: ERPState, customerId: string) =>
  (state.cycles || []).find(
    (cycle) => cycle.customerId === customerId && cycle.status === 'active',
  );

export function currentCustomerDebt(state: ERPState, customerId: string) {
  return calculateActiveCycleBalance(
    activeCustomerCycle(state, customerId),
    state.debtTransactions || [],
  );
}

export function collectionSession(
  state: ERPState,
  collectorUserId: string,
): DebtCollectionSession | undefined {
  return (state.debtCollectionSessions || []).find(
    (session) => session.collectorUserId === collectorUserId,
  );
}

function newSession(collector: User, now: string): DebtCollectionSession {
  return {
    id: `collector_session_${collector.id}`,
    collectorUserId: collector.id,
    collectorName: collector.name,
    activeBatchId: makeId(`collection_batch_${collector.id}`),
    generation: 1,
    openedAt: now,
    updatedAt: now,
  };
}

export type CollectionDispatchCandidate = {
  customer: Customer;
  balance: number;
};

export function dispatchCustomersToCollector(
  state: ERPState,
  collector: User,
  candidates: CollectionDispatchCandidate[],
  now = new Date().toISOString(),
): { state: ERPState; added: number; duplicates: number; invalid: number } {
  const existingSession = collectionSession(state, collector.id);
  const session = existingSession || newSession(collector, now);
  const activeAssignments = (state.debtCollectionAssignments || []).filter(
    (assignment) =>
      !assignment.isDeleted
      && assignment.collectorUserId === collector.id
      && assignment.batchId === session.activeBatchId,
  );
  const assignedCustomerIds = new Set(
    activeAssignments.map((assignment) => assignment.customerId),
  );
  const uniqueCandidates = new Map(
    candidates.map((candidate) => [candidate.customer.id, candidate]),
  );
  const additions: DebtCollectionAssignment[] = [];
  let duplicates = 0;
  let invalid = 0;

  for (const { customer, balance } of uniqueCandidates.values()) {
    if (customer.isDeleted || !positiveNumber(balance)) {
      invalid += 1;
      continue;
    }
    if (assignedCustomerIds.has(customer.id)) {
      duplicates += 1;
      continue;
    }
    assignedCustomerIds.add(customer.id);
    additions.push({
      id: makeId(`collection_assignment_${customer.id}`),
      batchId: session.activeBatchId,
      collectorUserId: collector.id,
      collectorName: collector.name,
      customerId: customer.id,
      customerName: customer.name,
      phone: customer.phone?.trim() || undefined,
      currentDebt: balance,
      dispatchedAt: now,
      updatedAt: now,
    });
  }

  return {
    state: {
      ...state,
      debtCollectionSessions: existingSession
        ? (state.debtCollectionSessions || []).map((item) =>
            item.id === session.id
              ? { ...item, collectorName: collector.name, updatedAt: now }
              : item)
        : [...(state.debtCollectionSessions || []), session],
      debtCollectionAssignments: [
        ...(state.debtCollectionAssignments || []),
        ...additions,
      ],
    },
    added: additions.length,
    duplicates,
    invalid,
  };
}

export function activeCollectionAssignments(
  state: ERPState,
  collectorUserId: string,
) {
  const session = collectionSession(state, collectorUserId);
  if (!session) return [];
  return (state.debtCollectionAssignments || []).filter(
    (assignment) =>
      !assignment.isDeleted
      && assignment.collectorUserId === collectorUserId
      && assignment.batchId === session.activeBatchId,
  );
}

export function activeCollectionReceipts(
  state: ERPState,
  collectorUserId: string,
) {
  const session = collectionSession(state, collectorUserId);
  if (!session) return [];
  return (state.debtCollectionReceipts || []).filter(
    (receipt) =>
      !receipt.isDeleted
      && receipt.collectorUserId === collectorUserId
      && receipt.batchId === session.activeBatchId,
  );
}

export function assignmentReceiptSummary(
  assignment: DebtCollectionAssignment,
  receipts: DebtCollectionReceipt[],
) {
  const relevant = receipts.filter(
    (receipt) =>
      !receipt.isDeleted
      && receipt.assignmentId === assignment.id
      && receipt.status !== 'rejected',
  );
  const pending = relevant
    .filter((receipt) => receipt.status === 'pending')
    .reduce((sum, receipt) => sum + positiveNumber(receipt.amount), 0);
  const approved = relevant
    .filter((receipt) => receipt.status === 'approved')
    .reduce((sum, receipt) => sum + positiveNumber(receipt.amount), 0);
  return {
    pending,
    approved,
    totalCollected: pending + approved,
    displayedRemaining: assignment.currentDebt - pending,
    hasPending: pending > 0,
  };
}

export function collectionTotal(state: ERPState, collectorUserId: string) {
  return activeCollectionReceipts(state, collectorUserId)
    .filter((receipt) => receipt.status !== 'rejected')
    .reduce((sum, receipt) => sum + positiveNumber(receipt.amount), 0);
}

export function recordCollectionReceipt(
  state: ERPState,
  assignmentId: string,
  mode: 'partial' | 'full',
  requestedAmount?: number,
  now = new Date().toISOString(),
): ERPState {
  const assignment = (state.debtCollectionAssignments || []).find(
    (item) => item.id === assignmentId && !item.isDeleted,
  );
  if (!assignment) throw new Error('تعذر العثور على كارت العميل.');
  const session = collectionSession(state, assignment.collectorUserId);
  if (!session || assignment.batchId !== session.activeBatchId) {
    throw new Error('هذه الدورة أُغلقت. حدّث الصفحة قبل تسجيل التحصيل.');
  }
  const receipts = activeCollectionReceipts(state, assignment.collectorUserId);
  if (receipts.some(
    (receipt) => receipt.assignmentId === assignment.id && receipt.status === 'pending',
  )) {
    throw new Error('توجد عملية لهذا العميل بانتظار مراجعة المدير.');
  }
  const amount = mode === 'full'
    ? positiveNumber(assignment.currentDebt)
    : positiveNumber(requestedAmount);
  if (!amount) throw new Error('أدخل قيمة صحيحة أكبر من صفر.');

  const receipt: DebtCollectionReceipt = {
    id: makeId(`collection_receipt_${assignment.customerId}`),
    assignmentId: assignment.id,
    batchId: assignment.batchId,
    collectorUserId: assignment.collectorUserId,
    customerId: assignment.customerId,
    customerName: assignment.customerName,
    mode,
    amount,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  return {
    ...state,
    debtCollectionReceipts: [...(state.debtCollectionReceipts || []), receipt],
  };
}

export function synchronizeCollectionAssignments(
  state: ERPState,
  now = new Date().toISOString(),
): ERPState {
  const assignments = state.debtCollectionAssignments || [];
  let changed = false;
  const nextAssignments = assignments.map((assignment) => {
    if (assignment.isDeleted) return assignment;
    const session = collectionSession(state, assignment.collectorUserId);
    if (!session || assignment.batchId !== session.activeBatchId) return assignment;
    const customer = (state.customers || []).find(
      (item) => item.id === assignment.customerId,
    );
    if (!customer) return assignment;
    const currentDebt = currentCustomerDebt(state, customer.id);
    const phone = customer.phone?.trim() || undefined;
    if (
      assignment.customerName === customer.name
      && assignment.phone === phone
      && assignment.currentDebt === currentDebt
    ) return assignment;
    changed = true;
    return {
      ...assignment,
      customerName: customer.name,
      phone,
      currentDebt,
      updatedAt: now,
    };
  });
  return changed ? { ...state, debtCollectionAssignments: nextAssignments } : state;
}

export function approveCollectionReceipt(
  state: ERPState,
  receiptId: string,
  admin: User,
  now = new Date().toISOString(),
): ERPState {
  if (admin.role !== 'admin') throw new Error('اعتماد التحصيل متاح للمدير فقط.');
  const receipt = (state.debtCollectionReceipts || []).find(
    (item) => item.id === receiptId && !item.isDeleted,
  );
  if (!receipt) throw new Error('تعذر العثور على عملية التحصيل.');
  if (receipt.status === 'approved') return state;
  if (receipt.status !== 'pending') throw new Error('هذه العملية ليست بانتظار الاعتماد.');
  const assignment = (state.debtCollectionAssignments || []).find(
    (item) => item.id === receipt.assignmentId && !item.isDeleted,
  );
  const customer = (state.customers || []).find(
    (item) => item.id === receipt.customerId && !item.isDeleted,
  );
  const cycle = activeCustomerCycle(state, receipt.customerId);
  if (!assignment || !customer || !cycle) {
    throw new Error('حساب العميل أو دورة الدين الحالية غير متاحة للاعتماد.');
  }

  const sourceTransactionId = receipt.sourceTransactionId
    || `tx_collection_${receipt.id}`;
  const alreadyPosted = (state.debtTransactions || []).some(
    (transaction) => transaction.id === sourceTransactionId && !transaction.isDeleted,
  );
  const payment: DebtTransaction = {
    id: sourceTransactionId,
    customerId: customer.id,
    cycleId: cycle.id,
    type: 'payment',
    paymentMode: receipt.mode,
    amount: receipt.amount,
    currency: 'د.ل',
    conversionRate: 1,
    date: receipt.createdAt,
    referenceNo: `COL-${receipt.id}`,
    note: `استلام ${receipt.mode === 'full' ? 'كلي' : 'جزئي'} بواسطة ${assignment.collectorName}`,
    postedToTreasury: true,
    createdAt: receipt.createdAt,
    updatedAt: now,
  };
  const debtTransactions = alreadyPosted
    ? state.debtTransactions || []
    : [...(state.debtTransactions || []), payment];
  const balance = calculateActiveCycleBalance(cycle, debtTransactions);
  const cycles = synchronizeActiveCustomerCycles(
    (state.cycles || []).map((item) =>
      item.id === cycle.id
        ? {
            ...item,
            status: balance === 0 ? 'closed' as const : 'active' as const,
            currentBalance: balance,
            ...(balance === 0 ? { endDate: now } : { endDate: undefined }),
          }
        : item),
    debtTransactions,
  );
  const customers = (state.customers || []).map((item) =>
    item.id === customer.id ? { ...item, updatedAt: now } : item,
  );
  const treasuryTransactions = alreadyPosted
    ? state.treasuryTransactions || []
    : upsertCustomerPaymentInTreasury(
        state.treasuryTransactions || [],
        payment,
        customer.name,
      );
  const debtCollectionReceipts = (state.debtCollectionReceipts || []).map((item) =>
    item.id === receipt.id
      ? {
          ...item,
          status: 'approved' as const,
          sourceTransactionId,
          approvedAt: now,
          approvedById: admin.id,
          approvedByName: admin.name,
          updatedAt: now,
        }
      : item,
  );

  return synchronizeCollectionAssignments({
    ...state,
    customers,
    cycles,
    debtTransactions,
    treasuryTransactions,
    debtCollectionReceipts,
  }, now);
}

export function rejectCollectionReceipt(
  state: ERPState,
  receiptId: string,
  admin: User,
  now = new Date().toISOString(),
) {
  if (admin.role !== 'admin') throw new Error('رفض التحصيل متاح للمدير فقط.');
  return {
    ...state,
    debtCollectionReceipts: (state.debtCollectionReceipts || []).map((receipt) =>
      receipt.id === receiptId && receipt.status === 'pending'
        ? { ...receipt, status: 'rejected' as const, updatedAt: now }
        : receipt,
    ),
  };
}

export function clearCollectorBatch(
  state: ERPState,
  collectorUserId: string,
  now = new Date().toISOString(),
): ERPState {
  const session = collectionSession(state, collectorUserId);
  if (!session) return state;
  if (activeCollectionReceipts(state, collectorUserId).some(
    (receipt) => receipt.status === 'pending',
  )) {
    throw new Error('لا يمكن مسح الكل قبل مراجعة كل عمليات التحصيل المعلقة.');
  }
  const nextBatchId = makeId(`collection_batch_${collectorUserId}`);
  return {
    ...state,
    debtCollectionSessions: (state.debtCollectionSessions || []).map((item) =>
      item.id === session.id
        ? {
            ...item,
            activeBatchId: nextBatchId,
            generation: item.generation + 1,
            openedAt: now,
            updatedAt: now,
          }
        : item,
    ),
    // Removing current rows keeps the visible section empty. The new batch id
    // also prevents an offline device from making an old row active again.
    debtCollectionAssignments: (state.debtCollectionAssignments || []).filter(
      (assignment) => assignment.batchId !== session.activeBatchId,
    ),
    debtCollectionReceipts: (state.debtCollectionReceipts || []).filter(
      (receipt) => receipt.batchId !== session.activeBatchId,
    ),
  };
}

export function payrollForMonth(
  state: ERPState,
  collector: User,
  month: string,
): DebtCollectorPayroll {
  return (state.debtCollectorPayrolls || []).find(
    (payroll) => payroll.collectorUserId === collector.id && payroll.month === month,
  ) || {
    id: `collector_payroll_${collector.id}_${month}`,
    collectorUserId: collector.id,
    collectorName: collector.name,
    month,
    salary: DEFAULT_COLLECTOR_SALARY,
    updatedAt: new Date().toISOString(),
  };
}

export function payrollSummary(
  payroll: DebtCollectorPayroll,
  withdrawals: DebtCollectorWithdrawal[],
) {
  const withdrawn = withdrawals
    .filter((item) =>
      !item.isDeleted
      && item.collectorUserId === payroll.collectorUserId
      && item.month === payroll.month)
    .reduce((sum, item) => sum + positiveNumber(item.amount), 0);
  return { withdrawn, remaining: payroll.salary - withdrawn };
}
