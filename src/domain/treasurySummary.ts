import type { ERPState, TreasuryTransaction } from '../types';
import { calculateBusinessSummary } from './businessAccounts';
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
      const activeCycle = (state.cycles || []).find(
        (cycle) =>
          cycle.customerId === customer.id
          && cycle.status === 'active',
      );
      return sum + Math.max(activeCycle?.currentBalance || 0, 0);
    }, 0);

  const companyDebts = (state.companies || [])
    .filter((company) => !company.isDeleted)
    .reduce(
      (sum, company) =>
        sum + calculateBusinessSummary(
          state.companyTransactions || [],
          company.id,
        ).finalBalance,
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
