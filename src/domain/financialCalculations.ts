import type {
  CompanyTransaction,
  CustomerCycle,
  DebtTransaction,
  MerchantTransaction,
  TreasuryTransaction,
  TrustDepositTx,
} from '../types';

const amount = (value: number) => Number.isFinite(value) ? value : 0;

export function calculateCustomerCycleBalance(
  cycle: Pick<CustomerCycle, 'id' | 'initialBalance'>,
  transactions: DebtTransaction[],
): number {
  return transactions
    .filter((transaction) => transaction.cycleId === cycle.id && !transaction.isDeleted)
    .reduce((balance, transaction) => {
      const localAmount = amount(transaction.amount) * amount(transaction.conversionRate || 1);
      return transaction.type === 'debt' ? balance + localAmount : balance - localAmount;
    }, amount(cycle.initialBalance));
}

export function calculateCompanyLedgerBalance(
  transactions: CompanyTransaction[],
  companyId: string,
  openingBalance = 0,
): number {
  return transactions
    .filter((transaction) => transaction.companyId === companyId && !transaction.isDeleted)
    .reduce(
      (balance, transaction) => transaction.type === 'purchase_invoice'
        ? balance + amount(transaction.amount)
        : balance - amount(transaction.amount),
      amount(openingBalance),
    );
}

export function calculateMerchantLedgerBalance(
  transactions: MerchantTransaction[],
  merchantId: string,
  openingBalance = 0,
): number {
  return transactions
    .filter((transaction) => transaction.merchantId === merchantId && !transaction.isDeleted)
    .reduce(
      (balance, transaction) => transaction.type === 'debt'
        ? balance + amount(transaction.amount)
        : balance - amount(transaction.amount),
      amount(openingBalance),
    );
}

export function calculateTreasuryBalance(transactions: TreasuryTransaction[]): number {
  return transactions
    .filter((transaction) => !transaction.isDeleted)
    .reduce((balance, transaction) => {
      const localAmount = amount(transaction.amount) * amount(transaction.conversionRate || 1);
      return transaction.type === 'in' ? balance + localAmount : balance - localAmount;
    }, 0);
}

export function calculateTrustBalances(history: TrustDepositTx[]) {
  return history.reduce(
    (balance, transaction) => {
      switch (transaction.type) {
        case 'deposit_lyd':
          balance.amountLyd += amount(transaction.amountLyd);
          break;
        case 'withdraw_lyd':
          balance.amountLyd -= amount(transaction.amountLyd);
          break;
        case 'deposit_egp':
          balance.amountEgp += amount(transaction.amountEgp);
          break;
        case 'withdraw_egp':
          balance.amountEgp -= amount(transaction.amountEgp);
          break;
        case 'convert_to_egp':
          balance.amountLyd -= amount(transaction.amountLyd);
          balance.amountEgp += amount(transaction.amountEgp);
          break;
      }
      return balance;
    },
    { amountLyd: 0, amountEgp: 0 },
  );
}
