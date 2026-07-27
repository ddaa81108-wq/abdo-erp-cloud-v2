import type { ERPState, TreasuryTransaction } from '../types';
import { calculateBusinessSummary } from './businessAccounts';
import { calculateActiveCycleBalance } from './customerAccounts';
import { calculateTreasuryBalance } from './financialCalculations';
import { calculatePurchaseTotals } from './purchaseLedger';
import {
  calculateTrustAccountBalances,
  trustHistory,
} from './trustAccounts';

export const isManualTreasuryTransaction = (
  transaction: TreasuryTransaction,
) =>
  transaction.source === 'manual_deposit'
  || transaction.source === 'manual_withdraw';

export const manualTreasuryTransactions = (state: ERPState) =>
  (state.treasuryTransactions || []).filter(isManualTreasuryTransaction);

export function calculateTreasurySummary(state: ERPState) {
  const manualTransactions = manualTreasuryTransactions(state);
  const activeCash = calculateTreasuryBalance(manualTransactions);

  const customerDebts = (state.customers || [])
    .filter((customer) => !customer.isDeleted)
    .reduce((sum, customer) => {
      const activeBalance = (state.cycles || [])
        .filter((cycle) =>
          cycle.customerId === customer.id
          && cycle.status === 'active')
        .reduce(
          (cycleSum, cycle) => {
            const cycleRows = (state.debtTransactions || []).filter(
              (transaction) =>
                transaction.cycleId === cycle.id
                && !transaction.isDeleted,
            );
            // Preserve an old account that has only a cached balance, while
            // always preferring its real ledger as soon as rows exist.
            const balance = cycleRows.length === 0
              && !cycle.initialBalance
              && cycle.currentBalance
              ? cycle.currentBalance
              : calculateActiveCycleBalance(
                  cycle,
                  state.debtTransactions || [],
                );
            return cycleSum + balance;
          },
          0,
        );
      return sum + Math.max(activeBalance, 0);
    }, 0);

  const companyDebts = (state.companies || [])
    .filter((company) => !company.isDeleted)
    .reduce(
      (sum, company) =>
        sum + Math.max(
          calculateBusinessSummary(
            state.companyTransactions || [],
            company.id,
          ).finalBalance,
          0,
        ),
      0,
    );

  // Use the same net LYD total shown by the trust section card. EGP stays out.
  const trustObligations = (state.trustDeposits || [])
    .filter((deposit) => !deposit.isDeleted)
    .reduce(
      (sum, deposit) =>
        sum + calculateTrustAccountBalances(trustHistory(deposit)).amountLyd,
      0,
    );

  const purchaseObligations = (state.purchaseAccounts || []).reduce(
    (sum, account) =>
      sum
      + calculatePurchaseTotals(
        state.purchases || [],
        account,
      ).totalDebtLyd,
    0,
  );

  const totalPositives = activeCash + customerDebts + companyDebts;
  const totalObligations = trustObligations + purchaseObligations;

  return {
    activeCash,
    customerDebts,
    companyDebts,
    trustObligations,
    purchaseObligations,
    totalPositives,
    totalObligations,
    netTreasury: totalPositives - totalObligations,
  };
}
