import type {
  Customer,
  CustomerCycle,
  DebtTransaction,
  TreasuryTransaction,
} from '../types';
import { calculateCustomerCycleBalance } from './financialCalculations';

const amount = (value: number | undefined) =>
  Number.isFinite(value) ? Number(value) : 0;

export function cycleTransactions(
  transactions: DebtTransaction[],
  cycleId: string,
) {
  return transactions.filter(
    (transaction) => transaction.cycleId === cycleId && !transaction.isDeleted,
  );
}

export function calculateActiveCycleBalance(
  cycle: CustomerCycle | undefined,
  transactions: DebtTransaction[],
) {
  return cycle ? calculateCustomerCycleBalance(cycle, transactions) : 0;
}

export function oldestOutstandingDebtDate(
  cycle: CustomerCycle | undefined,
  transactions: DebtTransaction[],
): string | null {
  if (!cycle) return null;
  const rows = cycleTransactions(transactions, cycle.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const debtQueue: Array<{ date: string; remaining: number }> = [];
  let availableCredit = Math.max(0, -amount(cycle.initialBalance));

  if (amount(cycle.initialBalance) > 0) {
    debtQueue.push({ date: cycle.startDate, remaining: amount(cycle.initialBalance) });
  }

  for (const row of rows) {
    const localAmount = amount(row.amount) * amount(row.conversionRate || 1);
    if (row.type === 'debt') {
      const appliedCredit = Math.min(availableCredit, localAmount);
      availableCredit -= appliedCredit;
      debtQueue.push({ date: row.date, remaining: localAmount - appliedCredit });
      continue;
    }
    let payment = localAmount;
    for (const debt of debtQueue) {
      if (payment <= 0) break;
      const consumed = Math.min(debt.remaining, payment);
      debt.remaining -= consumed;
      payment -= consumed;
    }
    availableCredit += payment;
  }
  return debtQueue.find((debt) => debt.remaining > 0)?.date || null;
}

export function debtAgeInDays(date: string | null, now = new Date()) {
  if (!date) return 0;
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(date).getTime()) / 86_400_000),
  );
}

export function customerLastActivityAt(
  customer: Customer,
  transactions: DebtTransaction[],
) {
  return transactions
    .filter((transaction) => transaction.customerId === customer.id)
    .reduce(
      (latest, transaction) =>
        Math.max(
          latest,
          new Date(transaction.updatedAt || transaction.createdAt || transaction.date).getTime(),
        ),
      new Date(customer.updatedAt || customer.createdAt).getTime(),
    );
}

export function synchronizeActiveCustomerCycles(
  cycles: CustomerCycle[],
  transactions: DebtTransaction[],
) {
  return cycles.map((cycle) => {
    if (cycle.status !== 'active') return cycle;
    const currentBalance = calculateCustomerCycleBalance(cycle, transactions);
    return { ...cycle, currentBalance };
  });
}

export function upsertCustomerPaymentInTreasury(
  treasuryTransactions: TreasuryTransaction[],
  payment: DebtTransaction,
  customerName: string,
): TreasuryTransaction[] {
  if (payment.type !== 'payment') return treasuryTransactions;
  const linkedIndex = treasuryTransactions.findIndex(
    (transaction) =>
      transaction.source === 'customer_payment' &&
      transaction.sourceId === payment.id,
  );
  const linked: TreasuryTransaction = {
    id: linkedIndex >= 0
      ? treasuryTransactions[linkedIndex].id
      : `tx_treasury_${payment.id}`,
    type: 'in',
    amount: amount(payment.amount),
    currency: payment.currency || 'د.ل',
    conversionRate: amount(payment.conversionRate || 1),
    date: payment.date,
    referenceNo: payment.referenceNo,
    source: 'customer_payment',
    sourceId: payment.id,
    description: `${payment.paymentMode === 'full' ? 'تسديد كلي' : 'دفعة'} من العميل ${customerName}`,
    createdAt: linkedIndex >= 0
      ? treasuryTransactions[linkedIndex].createdAt
      : payment.createdAt,
    isDeleted: Boolean(payment.isDeleted),
  };
  if (linkedIndex < 0) return [...treasuryTransactions, linked];
  return treasuryTransactions.map((transaction, index) =>
    index === linkedIndex ? linked : transaction);
}

export function repairLegacyCustomerCycles(
  cycles: CustomerCycle[],
  transactions: DebtTransaction[],
) {
  const repaired = cycles.map((cycle) => {
    const rows = cycleTransactions(transactions, cycle.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!rows.length && !cycle.initialBalance && cycle.currentBalance) {
      return { ...cycle, initialBalance: cycle.currentBalance };
    }
    if (!cycle.initialBalance) return cycle;
    const first = rows[0];
    const duplicatedOpening =
      first?.type === 'debt' &&
      amount(first.amount) === amount(cycle.initialBalance) &&
      Math.abs(new Date(first.date).getTime() - new Date(cycle.startDate).getTime()) < 60_000;
    return duplicatedOpening ? { ...cycle, initialBalance: 0 } : cycle;
  });
  return synchronizeActiveCustomerCycles(repaired, transactions);
}
