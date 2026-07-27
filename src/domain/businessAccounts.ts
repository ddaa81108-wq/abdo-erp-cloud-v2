import type {
  Company,
  CompanyTransaction,
  Merchant,
  MerchantTransaction,
  TreasuryTransaction,
} from '../types';

export type BusinessAccountType = 'company' | 'merchant';

const finiteAmount = (value: number | undefined) =>
  Number.isFinite(value) ? Number(value) : 0;

export function inferLegacyAccountType(name: string): BusinessAccountType {
  return /(?:شركة|شركه|شركات|company)/i.test(name) ? 'company' : 'merchant';
}

export function transactionKind(transaction: CompanyTransaction) {
  if (transaction.entryKind) return transaction.entryKind;
  if (transaction.type === 'payment') return 'payment' as const;
  return /^tx_comp_init_/.test(transaction.id)
    ? 'opening_balance' as const
    : 'debt' as const;
}

export function calculateBusinessBalance(
  transactions: CompanyTransaction[],
  companyId: string,
) {
  return transactions
    .filter((transaction) =>
      transaction.companyId === companyId && !transaction.isDeleted)
    .reduce((balance, transaction) => {
      const value = finiteAmount(transaction.amount);
      return transactionKind(transaction) === 'payment'
        ? balance - value
        : balance + value;
    }, 0);
}

export function calculateBusinessSummary(
  transactions: CompanyTransaction[],
  companyId: string,
  now = new Date(),
) {
  const dayKey = now.toLocaleDateString('en-CA');
  let balanceBeforeToday = 0;
  let debtAddedToday = 0;
  let allPayments = 0;
  let paymentsToday = 0;

  for (const transaction of transactions) {
    if (transaction.companyId !== companyId || transaction.isDeleted) continue;
    const value = finiteAmount(transaction.amount);
    const kind = transactionKind(transaction);
    const transactionDay = new Date(transaction.date).toLocaleDateString('en-CA');
    const isToday = transactionDay === dayKey;

    if (kind === 'opening_balance') {
      balanceBeforeToday += value;
    } else if (kind === 'debt') {
      if (isToday) debtAddedToday += value;
      else balanceBeforeToday += value;
    } else {
      allPayments += value;
      if (isToday) paymentsToday += value;
      else balanceBeforeToday -= value;
    }
  }

  const finalBalance = balanceBeforeToday + debtAddedToday - paymentsToday;
  const isSettled = Math.abs(finalBalance) < 0.000001;

  return {
    // Backward-compatible names now represent the current daily ledger view.
    // They are derived from transactions, never accumulated cache fields.
    oldDebt: isSettled ? 0 : balanceBeforeToday,
    newDebt: isSettled ? 0 : debtAddedToday,
    balanceBeforeToday: isSettled ? 0 : balanceBeforeToday,
    debtAddedToday: isSettled ? 0 : debtAddedToday,
    allPayments,
    paymentsToday,
    finalBalance: isSettled ? 0 : finalBalance,
  };
}

export function synchronizeBusinessBalances(
  companies: Company[],
  transactions: CompanyTransaction[],
) {
  return companies.map((company) => {
    const summary = calculateBusinessSummary(transactions, company.id);
    return {
      ...company,
      accountType: company.accountType || inferLegacyAccountType(company.name),
      previousBalance: summary.oldDebt,
      newDebt: summary.newDebt,
      paymentToday: summary.paymentsToday,
      balance: summary.finalBalance,
    };
  });
}

export function upsertBusinessPaymentInTreasury(
  treasuryTransactions: TreasuryTransaction[],
  payment: CompanyTransaction,
  accountName: string,
): TreasuryTransaction[] {
  if (transactionKind(payment) !== 'payment') return treasuryTransactions;
  const linkedIndex = treasuryTransactions.findIndex(
    (transaction) =>
      transaction.source === 'company_payment' &&
      transaction.sourceId === payment.id,
  );
  const linked: TreasuryTransaction = {
    id: linkedIndex >= 0
      ? treasuryTransactions[linkedIndex].id
      : `tx_treasury_${payment.id}`,
    type: 'out',
    amount: finiteAmount(payment.amount),
    currency: payment.currency || 'د.ل',
    conversionRate: 1,
    date: payment.date,
    referenceNo: payment.referenceNo,
    source: 'company_payment',
    sourceId: payment.id,
    description: `${payment.paymentMode === 'full' ? 'تسديد كلي' : 'دفعة'} إلى ${accountName}`,
    createdAt: linkedIndex >= 0
      ? treasuryTransactions[linkedIndex].createdAt
      : payment.createdAt,
    isDeleted: Boolean(payment.isDeleted),
  };
  if (linkedIndex < 0) return [...treasuryTransactions, linked];
  return treasuryTransactions.map((transaction, index) =>
    index === linkedIndex ? linked : transaction);
}

export function migrateLegacyBusinessAccounts(
  companies: Company[] = [],
  companyTransactions: CompanyTransaction[] = [],
  merchants: Merchant[] = [],
  merchantTransactions: MerchantTransaction[] = [],
) {
  const accountById = new Map<string, Company>();
  for (const company of companies) {
    accountById.set(company.id, {
      ...company,
      accountType: company.accountType || inferLegacyAccountType(company.name),
    });
  }
  for (const merchant of merchants) {
    if (!accountById.has(merchant.id)) {
      accountById.set(merchant.id, { ...merchant, accountType: 'merchant' });
    }
  }

  const transactionById = new Map<string, CompanyTransaction>();
  for (const transaction of companyTransactions) {
    transactionById.set(transaction.id, {
      ...transaction,
      entryKind: transactionKind(transaction),
    });
  }
  for (const transaction of merchantTransactions) {
    if (!transactionById.has(transaction.id)) {
      transactionById.set(transaction.id, {
        ...transaction,
        companyId: transaction.merchantId,
        type: transaction.type === 'debt' ? 'purchase_invoice' : 'payment',
        entryKind: transaction.type === 'debt' ? 'debt' : 'payment',
      });
    }
  }

  const migratedTransactions = [...transactionById.values()];
  const migratedCompanies = [...accountById.values()];

  // Accounts from very old versions can have a stored balance but no ledger.
  // Preserve that value as one auditable opening row instead of silently losing it.
  for (const company of migratedCompanies) {
    const hasLedger = migratedTransactions.some(
      (transaction) => transaction.companyId === company.id && !transaction.isDeleted,
    );
    const storedBalance = finiteAmount(company.balance);
    if (!hasLedger && storedBalance !== 0) {
      migratedTransactions.push({
        id: `tx_opening_${company.id}`,
        companyId: company.id,
        type: storedBalance >= 0 ? 'purchase_invoice' : 'payment',
        entryKind: storedBalance >= 0 ? 'opening_balance' : 'payment',
        amount: Math.abs(storedBalance),
        currency: 'د.ل',
        date: company.createdAt || new Date(0).toISOString(),
        referenceNo: `OPEN-${company.id}`,
        note: 'رصيد افتتاحي مرحّل من النظام القديم',
        postedToTreasury: false,
        createdAt: company.createdAt || new Date(0).toISOString(),
      });
    }
  }

  return {
    companies: synchronizeBusinessBalances(migratedCompanies, migratedTransactions),
    companyTransactions: migratedTransactions,
    merchants: [] as Merchant[],
    merchantTransactions: [] as MerchantTransaction[],
  };
}
