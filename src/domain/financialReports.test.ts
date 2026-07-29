import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_ERP_STATE, type ERPState } from '../types';
import FinancialReportsModule from '../components/FinancialReportsModule';
import {
  calculateDailyFinancialReport,
  calculateFinancialPosition,
  resolveFinancialReportRate,
} from './financialReports';

const state = (): ERPState => ({
  ...structuredClone(INITIAL_ERP_STATE),
  customers: [{ id: 'customer', name: 'عميل', createdAt: '2026-07-01' }],
  cycles: [{
    id: 'cycle',
    customerId: 'customer',
    startDate: '2026-07-01',
    status: 'active',
    initialBalance: 100,
    currentBalance: 999_999,
  }],
  debtTransactions: [],
  companies: [{ id: 'business', name: 'شركة', balance: 0 }],
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
});

describe('daily financial reports', () => {
  it('calculates the signed closing position from the original ledgers', () => {
    const data = state();
    data.treasuryTransactions = [{
      id: 'cash',
      type: 'in',
      amount: 1_000,
      currency: 'د.ل',
      conversionRate: 1,
      date: '2026-07-27T10:00:00+02:00',
      referenceNo: 'cash',
      source: 'manual_deposit',
      description: '',
      createdAt: '2026-07-27T10:00:00+02:00',
    }];
    data.debtTransactions = [{
      id: 'customer-debt',
      customerId: 'customer',
      cycleId: 'cycle',
      type: 'debt',
      amount: 400,
      currency: 'د.ل',
      conversionRate: 1,
      date: '2026-07-27T10:00:00+02:00',
      referenceNo: 'd',
      note: '',
      postedToTreasury: false,
      createdAt: '2026-07-27T10:00:00+02:00',
    }];
    data.companyTransactions = [{
      id: 'business-debt',
      companyId: 'business',
      type: 'purchase_invoice',
      entryKind: 'debt',
      amount: 300,
      currency: 'د.ل',
      date: '2026-07-27T10:00:00+02:00',
      referenceNo: 'b',
      note: '',
      postedToTreasury: false,
      createdAt: '2026-07-27T10:00:00+02:00',
    }];
    data.purchaseAccounts = [{
      id: 'purchase_account_baqy',
      merchant: 'baqy',
      openingBalanceLyd: 200,
      openingBalanceEgp: 10_000,
      activeDate: '2026-07-27',
      updatedAt: '2026-07-27',
    }];
    data.trustDeposits = [{
      id: 'trust',
      customerName: 'صاحب أمانة',
      amount: 100,
      amountLyd: 100,
      amountEgp: 2_000,
      currency: 'د.ل',
      date: '2026-07-27',
      referenceNo: 't',
      status: 'held',
      note: '',
      createdAt: '2026-07-27',
    }];
    data.egyptianCashRecords = [{
      date: '2026-07-27',
      previousValue: 0,
      receivedValue: 5_000,
      rows: [],
    }];

    const position = calculateFinancialPosition(data, '2026-07-27', 1_000);
    expect(position).toMatchObject({
      activeCashLyd: 1_000,
      customerBalanceLyd: 500,
      businessBalanceLyd: 300,
      purchaseDebtLyd: 200,
      trustBalanceLyd: 100,
      netEgyptianPositionEgp: 13_000,
      egyptianPositionLyd: 13,
      netPositionLyd: 1_513,
    });
  });

  it('reports exact daily movements and ignores soft-deleted rows', () => {
    const data = state();
    data.debtTransactions = [
      {
        id: 'd',
        customerId: 'customer',
        cycleId: 'cycle',
        type: 'debt',
        amount: 500,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-07-27T10:00:00+02:00',
        referenceNo: 'd',
        note: '',
        postedToTreasury: false,
        createdAt: '2026-07-27T10:00:00+02:00',
      },
      {
        id: 'deleted',
        customerId: 'customer',
        cycleId: 'cycle',
        type: 'debt',
        amount: 9_000,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-07-27T10:00:00+02:00',
        referenceNo: 'x',
        note: '',
        postedToTreasury: false,
        createdAt: '2026-07-27T10:00:00+02:00',
        isDeleted: true,
      },
    ];
    data.purchases = [{
      id: 'p',
      merchant: 'semsem',
      date: '2026-07-27',
      result: 700,
      paid: 200,
      createdAt: '2026-07-27',
    }];
    data.companyTransactions = [
      {
        id: 'business-debt',
        companyId: 'business',
        type: 'purchase_invoice',
        entryKind: 'debt',
        amount: 300,
        currency: 'د.ل',
        date: '2026-07-27T11:00:00+02:00',
        referenceNo: 'bd',
        note: '',
        postedToTreasury: false,
        createdAt: '2026-07-27T11:00:00+02:00',
      },
      {
        id: 'business-payment',
        companyId: 'business',
        type: 'payment',
        entryKind: 'payment',
        amount: 50,
        currency: 'د.ل',
        date: '2026-07-27T12:00:00+02:00',
        referenceNo: 'bp',
        note: '',
        postedToTreasury: false,
        createdAt: '2026-07-27T12:00:00+02:00',
      },
    ];
    data.trustDeposits = [{
      id: 'trust',
      customerName: 'صاحب أمانة',
      amount: 0,
      amountLyd: 0,
      amountEgp: 0,
      currency: 'د.ل',
      date: '2026-07-27',
      referenceNo: 'trust',
      status: 'held',
      note: '',
      createdAt: '2026-07-27',
      history: [
        {
          id: 'trust-in-lyd',
          type: 'deposit_lyd',
          amountLyd: 400,
          amountEgp: 0,
          date: '2026-07-27',
          note: '',
        },
        {
          id: 'trust-out-lyd',
          type: 'withdraw_lyd',
          amountLyd: 100,
          amountEgp: 0,
          date: '2026-07-27',
          note: '',
        },
        {
          id: 'trust-convert',
          type: 'convert_to_egp',
          amountLyd: 50,
          amountEgp: 5_000,
          date: '2026-07-27',
          note: '',
        },
        {
          id: 'trust-in-egp',
          type: 'deposit_egp',
          amountLyd: 0,
          amountEgp: 2_000,
          date: '2026-07-27',
          note: '',
        },
        {
          id: 'trust-out-egp',
          type: 'withdraw_egp',
          amountLyd: 0,
          amountEgp: 1_000,
          date: '2026-07-27',
          note: '',
        },
      ],
    }];
    data.treasuryTransactions = [
      {
        id: 'cash-in',
        type: 'in',
        amount: 1_000,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-07-27T09:00:00+02:00',
        referenceNo: 'cash-in',
        source: 'manual_deposit',
        description: '',
        createdAt: '2026-07-27T09:00:00+02:00',
      },
      {
        id: 'cash-out',
        type: 'out',
        amount: 100,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-07-27T10:00:00+02:00',
        referenceNo: 'cash-out',
        source: 'manual_withdraw',
        description: '',
        createdAt: '2026-07-27T10:00:00+02:00',
      },
      {
        id: 'linked-payment',
        type: 'in',
        amount: 9_999,
        currency: 'د.ل',
        conversionRate: 1,
        date: '2026-07-27T12:00:00+02:00',
        referenceNo: 'linked',
        source: 'customer_payment',
        description: '',
        createdAt: '2026-07-27T12:00:00+02:00',
      },
    ];
    data.egyptianCashRecords = [{
      date: '2026-07-27',
      previousValue: 10,
      receivedValue: 1_000,
      rows: [{ value: 700, commission: 30 }],
    }];

    const report = calculateDailyFinancialReport(data, '2026-07-27');
    expect(report.movement.customerDebtsAddedLyd).toBe(500);
    expect(report.movement.businessDebtsAddedLyd).toBe(300);
    expect(report.movement.businessPaymentsLyd).toBe(50);
    expect(report.movement.purchaseWorkLyd).toBe(700);
    expect(report.movement.semsemWorkLyd).toBe(700);
    expect(report.movement.purchasePaidLyd).toBe(200);
    expect(report.movement.trustDepositsLyd).toBe(400);
    expect(report.movement.trustWithdrawalsLyd).toBe(150);
    expect(report.movement.trustDepositsEgp).toBe(7_000);
    expect(report.movement.trustWithdrawalsEgp).toBe(1_000);
    expect(report.movement.treasuryDepositsLyd).toBe(1_000);
    expect(report.movement.treasuryWithdrawalsLyd).toBe(100);
    expect(report.movement.egyptianReceivedEgp).toBe(1_000);
    expect(report.movement.egyptianWorkEgp).toBe(730);
  });

  it('does not claim a final result while Egyptian money lacks a rate', () => {
    const data = state();
    data.egyptianCashRecords = [{
      date: '2026-07-27',
      previousValue: 0,
      receivedValue: 10_000,
      rows: [],
    }];
    const position = calculateFinancialPosition(data, '2026-07-27');
    expect(position.conversionReady).toBe(false);
    expect(position.netPositionLyd).toBeNull();
  });

  it('uses the nearest saved Masraweya closing snapshot without double counting prior days', () => {
    const data = state();
    data.egyptianCashRecords = [
      {
        date: '2026-07-20',
        previousValue: 10,
        receivedValue: 100,
        rows: [{ value: 30, commission: 0 }],
      },
      {
        date: '2026-07-21',
        previousValue: 999_999,
        receivedValue: 50,
        rows: [{ value: 20, commission: 0 }],
      },
    ];

    const position = calculateFinancialPosition(data, '2026-07-22', 1_000);
    expect(position.egyptianRemainderEgp).toBe(1_000_029);
  });

  it('uses the exact or nearest earlier saved exchange rate', () => {
    expect(resolveFinancialReportRate([
      { id: 'a', date: '2026-07-20', egpPerLyd: 9, updatedAt: '' },
      { id: 'b', date: '2026-07-25', egpPerLyd: 10, updatedAt: '' },
    ], '2026-07-27')).toBe(10);
  });

  it('renders the compact report without a runtime exception', () => {
    const html = renderToStaticMarkup(
      React.createElement(FinancialReportsModule, {
        state: state(),
        onUpdateState: () => undefined,
      }),
    );
    expect(html).toContain('التقرير المالي اليومي');
    expect(html).toContain('حركة اليوم');
    expect(html).toContain('المركز المالي في نهاية اليوم');
    expect(html).toContain('النتيجة النهائية');
  });
});
