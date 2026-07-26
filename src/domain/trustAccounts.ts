import type {
  TreasuryTransaction,
  TrustDeposit,
  TrustDepositTx,
} from '../types';

export type TrustBalances = {
  amountLyd: number;
  amountEgp: number;
};

const safeAmount = (value: number | undefined) =>
  Number.isFinite(value) ? Number(value) : 0;

export function convertLydToEgp(amountLyd: number, exchangeRate: number) {
  if (
    !Number.isFinite(amountLyd) ||
    amountLyd <= 0 ||
    !Number.isFinite(exchangeRate) ||
    exchangeRate <= 0
  ) return 0;
  return amountLyd / exchangeRate;
}

export function trustHistory(deposit: TrustDeposit): TrustDepositTx[] {
  if (deposit.history?.length) return deposit.history;
  const openingLyd = safeAmount(
    deposit.amountLyd !== undefined ? deposit.amountLyd : deposit.amount,
  );
  const openingEgp = safeAmount(deposit.amountEgp);
  if (openingLyd === 0 && openingEgp === 0) return [];
  const base = {
    date: deposit.date || deposit.createdAt,
    note: deposit.note || 'رصيد أمانة افتتاحي مرحّل',
    referenceNo: deposit.referenceNo,
    createdAt: deposit.createdAt,
  };
  return [
    ...(openingLyd !== 0 ? [{
      ...base,
      id: `trust_opening_lyd_${deposit.id}`,
      type: 'deposit_lyd' as const,
      amountLyd: openingLyd,
      amountEgp: 0,
    }] : []),
    ...(openingEgp !== 0 ? [{
      ...base,
      id: `trust_opening_egp_${deposit.id}`,
      type: 'deposit_egp' as const,
      amountLyd: 0,
      amountEgp: openingEgp,
    }] : []),
  ];
}

export function calculateTrustAccountBalances(
  history: TrustDepositTx[] = [],
): TrustBalances {
  return history
    .filter((transaction) => !transaction.isDeleted)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .reduce<TrustBalances>((balance, transaction) => {
      const amountLyd = safeAmount(transaction.amountLyd);
      const amountEgp = safeAmount(transaction.amountEgp);
      switch (transaction.type) {
        case 'deposit_lyd':
          balance.amountLyd += amountLyd;
          break;
        case 'withdraw_lyd':
          balance.amountLyd -= amountLyd;
          break;
        case 'deposit_egp':
          balance.amountEgp += amountEgp;
          break;
        case 'withdraw_egp':
          balance.amountEgp -= amountEgp;
          break;
        case 'convert_to_egp':
          balance.amountLyd -= amountLyd;
          balance.amountEgp += amountEgp;
          break;
      }
      return balance;
    }, { amountLyd: 0, amountEgp: 0 });
}

export function synchronizeTrustDeposit(deposit: TrustDeposit): TrustDeposit {
  const history = trustHistory(deposit);
  const balance = calculateTrustAccountBalances(history);
  const latestActivity = history.reduce(
    (latest, transaction) =>
      Math.max(
        latest,
        new Date(transaction.updatedAt || transaction.date || transaction.createdAt || 0).getTime(),
      ),
    new Date(deposit.updatedAt || deposit.createdAt || deposit.date || 0).getTime(),
  );
  return {
    ...deposit,
    amount: balance.amountLyd,
    amountLyd: balance.amountLyd,
    amountEgp: balance.amountEgp,
    history,
    updatedAt: Number.isFinite(latestActivity)
      ? new Date(latestActivity).toISOString()
      : deposit.updatedAt,
  };
}

export function trustLastActivityAt(deposit: TrustDeposit) {
  return trustHistory(deposit).reduce(
    (latest, transaction) =>
      Math.max(
        latest,
        new Date(transaction.updatedAt || transaction.date || transaction.createdAt || 0).getTime(),
      ),
    new Date(deposit.updatedAt || deposit.createdAt || deposit.date || 0).getTime(),
  );
}

function treasuryEffect(transaction: TrustDepositTx) {
  if (transaction.type === 'deposit_lyd') {
    return { type: 'in' as const, amount: safeAmount(transaction.amountLyd) };
  }
  if (
    transaction.type === 'withdraw_lyd' ||
    transaction.type === 'convert_to_egp'
  ) {
    return { type: 'out' as const, amount: safeAmount(transaction.amountLyd) };
  }
  return null;
}

export function upsertTrustTransactionInTreasury(
  treasuryTransactions: TreasuryTransaction[],
  transaction: TrustDepositTx,
  customerName: string,
  depositId?: string,
): TreasuryTransaction[] {
  const linkedSourceId = depositId
    ? `${depositId}:${transaction.id}`
    : transaction.id;
  const linkedIndex = treasuryTransactions.findIndex(
    (item) =>
      item.source === 'deposit_escrow' &&
      (item.sourceId === linkedSourceId || item.sourceId === transaction.id),
  );
  const effect = treasuryEffect(transaction);
  if (!effect) {
    return linkedIndex < 0
      ? treasuryTransactions
      : treasuryTransactions.map((item, index) =>
          index === linkedIndex ? { ...item, isDeleted: true } : item);
  }
  const linked: TreasuryTransaction = {
    id: linkedIndex >= 0
      ? treasuryTransactions[linkedIndex].id
      : `treasury_trust_${transaction.id}`,
    type: effect.type,
    amount: effect.amount,
    currency: 'د.ل',
    conversionRate: 1,
    date: transaction.date,
    referenceNo: transaction.referenceNo || `TRUST-${transaction.id}`,
    source: 'deposit_escrow',
    sourceId: linkedSourceId,
    description: transaction.type === 'deposit_lyd'
      ? `استلام أمانة ليبية: ${customerName}`
      : transaction.type === 'convert_to_egp'
        ? `تحويل أمانة ليبية إلى مصري: ${customerName}`
        : `سحب أمانة ليبية: ${customerName}`,
    createdAt: linkedIndex >= 0
      ? treasuryTransactions[linkedIndex].createdAt
      : transaction.createdAt || transaction.date,
    isDeleted: Boolean(transaction.isDeleted),
  };
  if (linkedIndex < 0) return [...treasuryTransactions, linked];
  return treasuryTransactions.map((item, index) =>
    index === linkedIndex ? linked : item);
}

export function synchronizeTrustTreasury(
  deposits: TrustDeposit[],
  treasuryTransactions: TreasuryTransaction[],
) {
  let nextTreasury = treasuryTransactions;
  for (const deposit of deposits) {
    for (const transaction of trustHistory(deposit)) {
      nextTreasury = upsertTrustTransactionInTreasury(
        nextTreasury,
        deposit.isDeleted ? { ...transaction, isDeleted: true } : transaction,
        deposit.customerName,
        deposit.id,
      );
    }
  }
  return nextTreasury;
}
