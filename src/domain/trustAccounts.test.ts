import { describe, expect, it } from 'vitest';
import type { TrustDepositTx } from '../types';
import {
  calculateTrustAccountBalances,
  upsertTrustTransactionInTreasury,
} from './trustAccounts';

const transaction = (
  id: string,
  type: TrustDepositTx['type'],
  amountLyd: number,
  amountEgp: number,
): TrustDepositTx => ({
  id,
  type,
  amountLyd,
  amountEgp,
  date: `2026-07-0${id.length}T10:00:00.000Z`,
  note: id,
  referenceNo: `TR-${id}`,
});

describe('trust account ledger', () => {
  it('derives both balances from every ledger row', () => {
    expect(calculateTrustAccountBalances([
      transaction('a', 'deposit_lyd', 5_000, 0),
      transaction('b', 'withdraw_lyd', 1_000, 0),
      transaction('c', 'deposit_egp', 0, 12_000),
      transaction('d', 'withdraw_egp', 0, 2_000),
    ])).toEqual({ amountLyd: 4_000, amountEgp: 10_000 });
  });

  it('allows a withdrawal to create a customer debt', () => {
    expect(calculateTrustAccountBalances([
      transaction('a', 'deposit_lyd', 5_000, 0),
      transaction('b', 'withdraw_lyd', 6_000, 0),
    ])).toEqual({ amountLyd: -1_000, amountEgp: 0 });
  });

  it('recalculates after edit and soft delete', () => {
    const deposit = transaction('a', 'deposit_lyd', 5_000, 0);
    const withdrawal = transaction('b', 'withdraw_lyd', 2_000, 0);
    expect(calculateTrustAccountBalances([deposit, { ...withdrawal, amountLyd: 3_000 }]).amountLyd).toBe(2_000);
    expect(calculateTrustAccountBalances([deposit, { ...withdrawal, isDeleted: true }]).amountLyd).toBe(5_000);
  });

  it('posts only LYD cash movements to treasury and updates by source id', () => {
    const deposit = transaction('a', 'deposit_lyd', 5_000, 0);
    const created = upsertTrustTransactionInTreasury([], deposit, 'أحمد', 'trust-1');
    expect(created[0]).toMatchObject({
      type: 'in',
      amount: 5_000,
      source: 'deposit_escrow',
      sourceId: 'trust-1:a',
    });
    const updated = upsertTrustTransactionInTreasury(
      created,
      { ...deposit, amountLyd: 6_000 },
      'أحمد',
      'trust-1',
    );
    expect(updated).toHaveLength(1);
    expect(updated[0].amount).toBe(6_000);
    const egpOnly = upsertTrustTransactionInTreasury(
      updated,
      transaction('e', 'deposit_egp', 0, 20_000),
      'أحمد',
      'trust-1',
    );
    expect(egpOnly).toHaveLength(1);
  });
});
