import type {
  ERPState,
  FinancialReportRate,
  FinancialReportSnapshot,
  PurchaseAccountState,
} from '../types';
import { calculateEgyptianRemainder } from './egyptianCash';
import {
  calculatePurchaseTotals,
  type PurchaseMerchant,
} from './purchaseLedger';
import { calculateTreasurySummary } from './treasurySummary';
import {
  calculateTrustAccountBalances,
  trustHistory,
} from './trustAccounts';

const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const integer = (value: unknown) => Math.trunc(finite(value));

export const reportDayKey = (value: string | Date) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const throughDay = (value: string | Date | undefined, day: string) => {
  if (!value) return false;
  const key = reportDayKey(value);
  return Boolean(key) && key <= day;
};

export function resolveFinancialReportRate(
  rates: FinancialReportRate[] = [],
  day: string,
) {
  return rates.find((rate) => rate.date === day && finite(rate.egpPerLyd) > 0)
    ?.egpPerLyd || 0;
}

function egyptianClosingBalance(state: ERPState, day: string) {
  const record = (state.egyptianCashRecords || [])
    .filter((item) => item.date <= day)
    .sort((left, right) => right.date.localeCompare(left.date))[0];
  return record ? integer(calculateEgyptianRemainder(record)) : 0;
}

function purchaseAccount(
  state: ERPState,
  merchant: PurchaseMerchant,
): PurchaseAccountState {
  const existing = (state.purchaseAccounts || [])
    .find((account) => account.merchant === merchant);
  if (existing) return existing;

  const latestRowDate = (state.purchases || [])
    .filter((row) => row.merchant === merchant && !row.isDeleted)
    .sort((left, right) => right.date.localeCompare(left.date))[0]?.date;
  return {
    id: `purchase_account_${merchant}`,
    merchant,
    openingBalanceLyd: 0,
    openingBalanceEgp: 0,
    activeDate: latestRowDate || reportDayKey(new Date()),
    updatedAt: latestRowDate || new Date().toISOString(),
  };
}

function vodafoneRemainder(
  state: ERPState,
  merchant: PurchaseMerchant,
) {
  return integer(
    calculatePurchaseTotals(
      state.purchases || [],
      purchaseAccount(state, merchant),
    ).remainingEgp,
  );
}

function trustEgyptianBalance(state: ERPState, day: string) {
  return integer(
    (state.trustDeposits || [])
      .filter((deposit) => !deposit.isDeleted)
      .reduce((sum, deposit) => {
        const history = trustHistory(deposit).filter((transaction) =>
          !transaction.isDeleted
          && throughDay(
            transaction.date || transaction.createdAt || deposit.date,
            day,
          ));
        return sum + calculateTrustAccountBalances(history).amountEgp;
      }, 0),
  );
}

export interface FinancialReportSources {
  treasuryPositivesLyd: number;
  treasuryObligationsLyd: number;
  egyptianCashRemainderEgp: number;
  vodafoneBaqyRemainderEgp: number;
  vodafoneSemsemRemainderEgp: number;
  vodafoneTotalRemainderEgp: number;
  trustBalanceEgp: number;
  netEgyptianPositionEgp: number;
}

export function calculateFinancialReportSources(
  state: ERPState,
  day: string,
): FinancialReportSources {
  const treasury = calculateTreasurySummary(state);
  const egyptianCashRemainderEgp = egyptianClosingBalance(state, day);
  // Use the exact same full-ledger calculation shown by each merchant card in
  // Purchases. A separate text-date filter could omit timestamped rows.
  const vodafoneBaqyRemainderEgp = vodafoneRemainder(state, 'baqy');
  const vodafoneSemsemRemainderEgp = vodafoneRemainder(state, 'semsem');
  const vodafoneTotalRemainderEgp = integer(
    vodafoneBaqyRemainderEgp + vodafoneSemsemRemainderEgp,
  );
  const trustBalanceEgp = trustEgyptianBalance(state, day);

  // Positive trust is money owed to custody owners and must be deducted.
  // Negative trust is money owed to us, so subtracting it correctly adds it.
  const netEgyptianPositionEgp = integer(
    egyptianCashRemainderEgp
    + vodafoneTotalRemainderEgp
    - trustBalanceEgp,
  );

  return {
    treasuryPositivesLyd: integer(treasury.totalPositives),
    treasuryObligationsLyd: integer(treasury.totalObligations),
    egyptianCashRemainderEgp,
    vodafoneBaqyRemainderEgp,
    vodafoneSemsemRemainderEgp,
    vodafoneTotalRemainderEgp,
    trustBalanceEgp,
    netEgyptianPositionEgp,
  };
}

export function createFinancialReportSnapshot(
  state: ERPState,
  day: string,
  egpPerLyd: number,
  now = new Date().toISOString(),
): FinancialReportSnapshot {
  const rate = finite(egpPerLyd);
  if (rate <= 0) {
    throw new Error('سعر الصرف يجب أن يكون أكبر من صفر.');
  }
  const sources = calculateFinancialReportSources(state, day);
  const egyptianEquivalentLyd = Math.trunc(
    sources.netEgyptianPositionEgp / rate,
  );
  const totalOwnedLyd = integer(
    sources.treasuryPositivesLyd + egyptianEquivalentLyd,
  );
  const netPositionLyd = integer(
    totalOwnedLyd - sources.treasuryObligationsLyd,
  );
  const existing = (state.financialReportSnapshots || [])
    .find((snapshot) => snapshot.date === day);

  return {
    id: existing?.id || `financial_snapshot_${day}`,
    date: day,
    ...sources,
    egpPerLyd: rate,
    egyptianEquivalentLyd,
    totalOwnedLyd,
    netPositionLyd,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function upsertFinancialReportSnapshot(
  snapshots: FinancialReportSnapshot[] = [],
  nextSnapshot: FinancialReportSnapshot,
) {
  const withoutDay = snapshots.filter(
    (snapshot) => snapshot.date !== nextSnapshot.date,
  );
  return [...withoutDay, nextSnapshot]
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function upsertFinancialReportRate(
  rates: FinancialReportRate[] = [],
  day: string,
  egpPerLyd: number,
  updatedAt: string,
) {
  const existing = rates.find((rate) => rate.date === day);
  const next: FinancialReportRate = {
    id: existing?.id || `financial_rate_${day}`,
    date: day,
    egpPerLyd,
    updatedAt,
  };
  return [
    ...rates.filter((rate) => rate.date !== day),
    next,
  ].sort((left, right) => left.date.localeCompare(right.date));
}
