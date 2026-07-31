import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import FinancialReportsModule from '../components/FinancialReportsModule';
import { INITIAL_ERP_STATE, type ERPState } from '../types';
import {
  calculateFinancialReportSources,
  createFinancialReportSnapshot,
  resolveFinancialReportRate,
  upsertFinancialReportRate,
  upsertFinancialReportSnapshot,
} from './financialReports';

const emptyState = (): ERPState => ({
  ...structuredClone(INITIAL_ERP_STATE),
  customers: [],
  cycles: [],
  debtTransactions: [],
  companies: [],
  companyTransactions: [],
  merchants: [],
  merchantTransactions: [],
  treasuryTransactions: [],
  purchases: [],
  purchaseAccounts: [],
  purchaseAuditLog: [],
  trustDeposits: [],
  egyptianCashRecords: [],
  financialReportRates: [],
  financialReportSnapshots: [],
});

const account = (
  merchant: 'baqy' | 'semsem',
  openingBalanceLyd: number,
  openingBalanceEgp: number,
) => ({
  id: `purchase_account_${merchant}`,
  merchant,
  openingBalanceLyd,
  openingBalanceEgp,
  activeDate: '2026-07-31',
  updatedAt: '2026-07-31T10:00:00.000Z',
});

describe('financial report snapshots', () => {
  it('combines both Vodafone merchants and treats negative Egyptian trust as ours', () => {
    const state = emptyState();
    state.treasuryTransactions = [{
      id: 'cash',
      type: 'in',
      amount: 1_000,
      currency: 'د.ل',
      conversionRate: 1,
      date: '2026-07-31T09:00:00.000Z',
      referenceNo: 'cash',
      source: 'manual_deposit',
      description: '',
      createdAt: '2026-07-31T09:00:00.000Z',
    }];
    state.purchaseAccounts = [
      account('baqy', 200, 10_000),
      account('semsem', 300, 20_000),
    ];
    state.egyptianCashRecords = [{
      date: '2026-07-31',
      previousValue: 0,
      receivedValue: 5_000,
      rows: [],
    }];
    state.trustDeposits = [{
      id: 'trust-egp-credit',
      customerName: 'عميل',
      amount: 0,
      amountLyd: 0,
      amountEgp: -2_000,
      currency: 'ج.م',
      date: '2026-07-31',
      referenceNo: 'trust',
      status: 'held',
      note: '',
      createdAt: '2026-07-31T09:00:00.000Z',
    }];

    const sources = calculateFinancialReportSources(state, '2026-07-31');
    expect(sources).toMatchObject({
      treasuryPositivesLyd: 1_000,
      treasuryObligationsLyd: 500,
      egyptianCashRemainderEgp: 5_000,
      vodafoneBaqyRemainderEgp: 10_000,
      vodafoneSemsemRemainderEgp: 20_000,
      vodafoneTotalRemainderEgp: 30_000,
      trustBalanceEgp: -2_000,
      netEgyptianPositionEgp: 37_000,
    });

    const snapshot = createFinancialReportSnapshot(
      state,
      '2026-07-31',
      10,
      '2026-07-31T12:00:00.000Z',
    );
    expect(snapshot).toMatchObject({
      egyptianEquivalentLyd: 3_700,
      totalOwnedLyd: 4_700,
      netPositionLyd: 4_200,
    });
  });

  it('matches the purchase cards and includes timestamped Semsem rows in one total', () => {
    const state = emptyState();
    state.purchaseAccounts = [
      account('baqy', 0, 1_000),
      account('semsem', 0, 0),
    ];
    state.purchases = [{
      id: 'semsem-vodafone',
      merchant: 'semsem',
      date: '2026-07-31T12:30:00.000Z',
      type: 'فودافون كاش',
      value: 7_000,
      consumer: 2_000,
      createdAt: '2026-07-31T12:30:00.000Z',
    }];

    const sources = calculateFinancialReportSources(state, '2026-07-31');
    expect(sources.vodafoneBaqyRemainderEgp).toBe(1_000);
    expect(sources.vodafoneSemsemRemainderEgp).toBe(5_000);
    expect(sources.vodafoneTotalRemainderEgp).toBe(6_000);
    expect(sources.netEgyptianPositionEgp).toBe(6_000);
  });

  it('deducts positive Egyptian trust because it is owed to its owner', () => {
    const state = emptyState();
    state.purchaseAccounts = [
      account('baqy', 0, 10_000),
      account('semsem', 0, 20_000),
    ];
    state.egyptianCashRecords = [{
      date: '2026-07-31',
      previousValue: 0,
      receivedValue: 5_000,
      rows: [],
    }];
    state.trustDeposits = [{
      id: 'trust-egp-obligation',
      customerName: 'عميل',
      amount: 0,
      amountLyd: 0,
      amountEgp: 1_000,
      currency: 'ج.م',
      date: '2026-07-31',
      referenceNo: 'trust',
      status: 'held',
      note: '',
      createdAt: '2026-07-31T09:00:00.000Z',
    }];

    expect(
      calculateFinancialReportSources(state, '2026-07-31')
        .netEgyptianPositionEgp,
    ).toBe(34_000);
  });

  it('truncates conversion fractions instead of rounding them up', () => {
    const state = emptyState();
    state.egyptianCashRecords = [{
      date: '2026-07-31',
      previousValue: 0,
      receivedValue: 52_019,
      rows: [],
    }];

    const snapshot = createFinancialReportSnapshot(
      state,
      '2026-07-31',
      10,
    );
    expect(snapshot.egyptianEquivalentLyd).toBe(5_201);
  });

  it('updates the same day without creating a duplicate or changing its identity', () => {
    const state = emptyState();
    const first = createFinancialReportSnapshot(
      state,
      '2026-07-31',
      10,
      '2026-07-31T10:00:00.000Z',
    );
    state.financialReportSnapshots = [first];

    const updated = createFinancialReportSnapshot(
      state,
      '2026-07-31',
      11,
      '2026-07-31T11:00:00.000Z',
    );
    const snapshots = upsertFinancialReportSnapshot(
      state.financialReportSnapshots,
      updated,
    );

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      id: first.id,
      createdAt: first.createdAt,
      updatedAt: '2026-07-31T11:00:00.000Z',
      egpPerLyd: 11,
    });
  });

  it('requires a rate saved for the exact day and upserts it once', () => {
    const rates = [{
      id: 'old',
      date: '2026-07-30',
      egpPerLyd: 10,
      updatedAt: '2026-07-30T10:00:00.000Z',
    }];
    expect(resolveFinancialReportRate(rates, '2026-07-31')).toBe(0);

    const once = upsertFinancialReportRate(
      rates,
      '2026-07-31',
      11,
      '2026-07-31T10:00:00.000Z',
    );
    const twice = upsertFinancialReportRate(
      once,
      '2026-07-31',
      12,
      '2026-07-31T11:00:00.000Z',
    );
    expect(twice.filter((rate) => rate.date === '2026-07-31')).toHaveLength(1);
    expect(resolveFinancialReportRate(twice, '2026-07-31')).toBe(12);
  });

  it('renders the visible daily ledger without the removed movement report', () => {
    const html = renderToStaticMarkup(
      React.createElement(FinancialReportsModule, {
        state: emptyState(),
        onUpdateState: () => undefined,
      }),
    );
    expect(html).toContain('سجل المركز المالي اليومي');
    expect(html).toContain('سجل النتائج اليومية');
    expect(html).toContain('تسجيل نتيجة اليوم');
    expect(html).not.toContain('حركة اليوم');
  });
});
