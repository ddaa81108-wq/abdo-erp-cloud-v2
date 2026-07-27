import type {
  ERPState,
  FinancialReportRate,
  PurchaseRecord,
} from '../types';
import { transactionKind } from './businessAccounts';
import {
  calculateEgyptianWorkTotal,
} from './egyptianCash';
import { isManualTreasuryTransaction } from './treasurySummary';
import {
  calculateTrustAccountBalances,
  trustHistory,
} from './trustAccounts';
import { isVodafonePurchase, purchaseInteger } from './purchaseLedger';

const finite = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

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

const onDay = (value: string | Date, day: string) =>
  reportDayKey(value) === day;

const throughDay = (value: string | Date, day: string) => {
  const key = reportDayKey(value);
  return Boolean(key) && key <= day;
};

const previousCalendarDay = (day: string) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return reportDayKey(date);
};

export function resolveFinancialReportRate(
  rates: FinancialReportRate[] = [],
  day: string,
) {
  return rates
    .filter((rate) => rate.date <= day && finite(rate.egpPerLyd) > 0)
    .sort((left, right) => right.date.localeCompare(left.date))[0]?.egpPerLyd
    || 0;
}

const purchaseLydResult = (row: PurchaseRecord) =>
  purchaseInteger(row.result);

function egyptianClosingBalance(state: ERPState, day: string) {
  const records = (state.egyptianCashRecords || [])
    .filter((record) => record.date <= day)
    .sort((left, right) => left.date.localeCompare(right.date));
  if (!records.length) return 0;
  return records.reduce(
    (balance, record, index) =>
      (index === 0 ? finite(record.previousValue) : balance)
      + finite(record.receivedValue)
      - calculateEgyptianWorkTotal(record.rows || []),
    0,
  );
}

export interface FinancialPosition {
  activeCashLyd: number;
  customerBalanceLyd: number;
  businessBalanceLyd: number;
  purchaseDebtLyd: number;
  trustBalanceLyd: number;
  egyptianRemainderEgp: number;
  vodafoneRemainderEgp: number;
  trustBalanceEgp: number;
  netEgyptianPositionEgp: number;
  egpPerLyd: number;
  egyptianPositionLyd: number;
  conversionReady: boolean;
  netPositionLyd: number | null;
}

export function calculateFinancialPosition(
  state: ERPState,
  day: string,
  requestedRate?: number,
): FinancialPosition {
  const activeCashLyd = (state.treasuryTransactions || [])
    .filter((transaction) =>
      isManualTreasuryTransaction(transaction)
      && !transaction.isDeleted
      && throughDay(transaction.date, day))
    .reduce(
      (sum, transaction) =>
        sum
        + (transaction.type === 'in' ? 1 : -1)
        * finite(transaction.amount)
        * finite(transaction.conversionRate || 1),
      0,
    );

  const activeCustomerIds = new Set(
    (state.customers || [])
      .filter((customer) => !customer.isDeleted)
      .map((customer) => customer.id),
  );
  const customerBalanceLyd = (state.cycles || [])
    .filter((cycle) =>
      activeCustomerIds.has(cycle.customerId)
      && throughDay(cycle.startDate, day))
    .reduce((total, cycle) => {
      const movement = (state.debtTransactions || [])
        .filter((transaction) =>
          transaction.cycleId === cycle.id
          && !transaction.isDeleted
          && throughDay(transaction.date, day))
        .reduce(
          (sum, transaction) =>
            sum
            + (transaction.type === 'debt' ? 1 : -1)
            * finite(transaction.amount)
            * finite(transaction.conversionRate || 1),
          0,
        );
      return total + finite(cycle.initialBalance) + movement;
    }, 0);

  const activeBusinessIds = new Set(
    (state.companies || [])
      .filter((account) => !account.isDeleted)
      .map((account) => account.id),
  );
  const businessBalanceLyd = (state.companyTransactions || [])
    .filter((transaction) =>
      activeBusinessIds.has(transaction.companyId)
      && !transaction.isDeleted
      && throughDay(transaction.date, day))
    .reduce(
      (sum, transaction) =>
        sum
        + (transactionKind(transaction) === 'payment' ? -1 : 1)
        * finite(transaction.amount),
      0,
    );

  const rowsThroughDay = (state.purchases || [])
    .filter((row) => !row.isDeleted && throughDay(row.date, day));
  const purchaseDebtLyd = (state.purchaseAccounts || [])
    .reduce(
      (sum, account) => sum + finite(account.openingBalanceLyd),
      0,
    )
    + rowsThroughDay.reduce(
      (sum, row) =>
        sum + purchaseLydResult(row) - purchaseInteger(row.paid),
      0,
    );
  const vodafoneRemainderEgp = (state.purchaseAccounts || [])
    .reduce(
      (sum, account) => sum + finite(account.openingBalanceEgp),
      0,
    )
    + rowsThroughDay.reduce(
      (sum, row) =>
        sum
        + (isVodafonePurchase(row.type || '') ? purchaseInteger(row.value) : 0)
        - purchaseInteger(row.consumer),
      0,
    );

  const trustBalances = (state.trustDeposits || [])
    .filter((deposit) => !deposit.isDeleted)
    .reduce(
      (totals, deposit) => {
        const balance = calculateTrustAccountBalances(
          trustHistory(deposit).filter((transaction) =>
            throughDay(
              transaction.date || transaction.createdAt || deposit.date,
              day,
            )),
        );
        totals.amountLyd += balance.amountLyd;
        totals.amountEgp += balance.amountEgp;
        return totals;
      },
      { amountLyd: 0, amountEgp: 0 },
    );

  const egyptianRemainderEgp = egyptianClosingBalance(state, day);
  // Positive Masraweya and Vodafone balances belong to us. Positive trust
  // balances belong to their owners and are therefore obligations.
  const netEgyptianPositionEgp =
    egyptianRemainderEgp
    + vodafoneRemainderEgp
    - trustBalances.amountEgp;
  const egpPerLyd = finite(
    requestedRate
    || resolveFinancialReportRate(state.financialReportRates || [], day),
  );
  const conversionReady = netEgyptianPositionEgp === 0 || egpPerLyd > 0;
  const egyptianPositionLyd = egpPerLyd > 0
    ? netEgyptianPositionEgp / egpPerLyd
    : 0;
  const netPositionLyd = conversionReady
    ? activeCashLyd
      + customerBalanceLyd
      + businessBalanceLyd
      - purchaseDebtLyd
      - trustBalances.amountLyd
      + egyptianPositionLyd
    : null;

  return {
    activeCashLyd,
    customerBalanceLyd,
    businessBalanceLyd,
    purchaseDebtLyd,
    trustBalanceLyd: trustBalances.amountLyd,
    egyptianRemainderEgp,
    vodafoneRemainderEgp,
    trustBalanceEgp: trustBalances.amountEgp,
    netEgyptianPositionEgp,
    egpPerLyd,
    egyptianPositionLyd,
    conversionReady,
    netPositionLyd,
  };
}

export interface DailyFinancialMovement {
  customerDebtsAddedLyd: number;
  customerPaymentsLyd: number;
  businessDebtsAddedLyd: number;
  businessPaymentsLyd: number;
  trustDepositsLyd: number;
  trustWithdrawalsLyd: number;
  trustDepositsEgp: number;
  trustWithdrawalsEgp: number;
  purchaseWorkLyd: number;
  purchasePaidLyd: number;
  baqyWorkLyd: number;
  semsemWorkLyd: number;
  egyptianWorkEgp: number;
  egyptianReceivedEgp: number;
  treasuryDepositsLyd: number;
  treasuryWithdrawalsLyd: number;
}

export function calculateDailyFinancialMovement(
  state: ERPState,
  day: string,
): DailyFinancialMovement {
  const customerRows = (state.debtTransactions || [])
    .filter((row) => !row.isDeleted && onDay(row.date, day));
  const businessRows = (state.companyTransactions || [])
    .filter((row) => !row.isDeleted && onDay(row.date, day));
  const purchaseRows = (state.purchases || [])
    .filter((row) => !row.isDeleted && onDay(row.date, day));
  const trustRows = (state.trustDeposits || [])
    .filter((deposit) => !deposit.isDeleted)
    .flatMap((deposit) => trustHistory(deposit))
    .filter((row) => !row.isDeleted && onDay(row.date || row.createdAt || '', day));
  const treasuryRows = (state.treasuryTransactions || [])
    .filter((row) =>
      isManualTreasuryTransaction(row)
      && !row.isDeleted
      && onDay(row.date, day));
  const egyptianRecord = (state.egyptianCashRecords || [])
    .find((record) => record.date === day);

  const customerAmount = (type: 'debt' | 'payment') =>
    customerRows
      .filter((row) => row.type === type)
      .reduce(
        (sum, row) =>
          sum + finite(row.amount) * finite(row.conversionRate || 1),
        0,
      );
  const businessAmount = (kind: 'debt' | 'payment') =>
    businessRows
      .filter((row) => {
        const rowKind = transactionKind(row);
        return kind === 'debt'
          ? rowKind === 'debt' || rowKind === 'opening_balance'
          : rowKind === 'payment';
      })
      .reduce((sum, row) => sum + finite(row.amount), 0);
  const purchaseWork = (merchant?: PurchaseRecord['merchant']) =>
    purchaseRows
      .filter((row) => !merchant || row.merchant === merchant)
      .reduce((sum, row) => sum + purchaseLydResult(row), 0);

  return {
    customerDebtsAddedLyd: customerAmount('debt'),
    customerPaymentsLyd: customerAmount('payment'),
    businessDebtsAddedLyd: businessAmount('debt'),
    businessPaymentsLyd: businessAmount('payment'),
    trustDepositsLyd: trustRows
      .filter((row) => row.type === 'deposit_lyd')
      .reduce((sum, row) => sum + finite(row.amountLyd), 0),
    trustWithdrawalsLyd: trustRows
      .filter((row) =>
        row.type === 'withdraw_lyd' || row.type === 'convert_to_egp')
      .reduce((sum, row) => sum + finite(row.amountLyd), 0),
    trustDepositsEgp: trustRows
      .filter((row) =>
        row.type === 'deposit_egp' || row.type === 'convert_to_egp')
      .reduce((sum, row) => sum + finite(row.amountEgp), 0),
    trustWithdrawalsEgp: trustRows
      .filter((row) => row.type === 'withdraw_egp')
      .reduce((sum, row) => sum + finite(row.amountEgp), 0),
    purchaseWorkLyd: purchaseWork(),
    purchasePaidLyd: purchaseRows
      .reduce((sum, row) => sum + purchaseInteger(row.paid), 0),
    baqyWorkLyd: purchaseWork('baqy'),
    semsemWorkLyd: purchaseWork('semsem'),
    egyptianWorkEgp: egyptianRecord
      ? calculateEgyptianWorkTotal(egyptianRecord.rows || [])
      : 0,
    egyptianReceivedEgp: finite(egyptianRecord?.receivedValue),
    treasuryDepositsLyd: treasuryRows
      .filter((row) => row.type === 'in')
      .reduce(
        (sum, row) =>
          sum + finite(row.amount) * finite(row.conversionRate || 1),
        0,
      ),
    treasuryWithdrawalsLyd: treasuryRows
      .filter((row) => row.type === 'out')
      .reduce(
        (sum, row) =>
          sum + finite(row.amount) * finite(row.conversionRate || 1),
        0,
      ),
  };
}

export function calculateDailyFinancialReport(
  state: ERPState,
  day: string,
  requestedRate?: number,
) {
  const position = calculateFinancialPosition(state, day, requestedRate);
  const previousDay = previousCalendarDay(day);
  const previousPosition = calculateFinancialPosition(state, previousDay);
  const positionChangeLyd =
    position.netPositionLyd !== null
    && previousPosition.netPositionLyd !== null
      ? position.netPositionLyd - previousPosition.netPositionLyd
      : null;

  return {
    day,
    previousDay,
    movement: calculateDailyFinancialMovement(state, day),
    position,
    previousNetPositionLyd: previousPosition.netPositionLyd,
    positionChangeLyd,
  };
}
