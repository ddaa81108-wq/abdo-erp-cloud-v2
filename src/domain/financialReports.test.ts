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
    const report = calculateDailyFinancialReport(data, '2026-07-27');
    expect(report.movement.customerDebtsAddedLyd).toBe(500);
    expect(report.movement.purchaseWorkLyd).toBe(700);
    expect(report.movement.semsemWorkLyd).toBe(700);
    expect(report.movement.purchasePaidLyd).toBe(200);
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
