import { describe, expect, it } from 'vitest';
import {
  calculateEgyptianRemainder,
  calculateEgyptianRowTotal,
  calculateEgyptianWorkTotal,
  getEgyptianPreviousValue,
} from './egyptianCash';

describe('Egyptian cash calculations', () => {
  it('adds value and commission for every row', () => {
    expect(calculateEgyptianRowTotal({ value: 250_000, commission: 5_000 })).toBe(255_000);
    expect(calculateEgyptianWorkTotal([
      { value: 250_000, commission: 5_000 },
      { value: 180_000, commission: 3_000 },
    ])).toBe(438_000);
  });

  it('calculates the final remainder from previous, received, and work total', () => {
    expect(calculateEgyptianRemainder({
      previousValue: -50_000,
      receivedValue: 1_000_000,
      rows: [
        { value: 250_000, commission: 5_000 },
        { value: 180_000, commission: 3_000 },
      ],
    })).toBe(512_000);
  });

  it('carries a negative remainder to the next day without converting it to zero', () => {
    expect(getEgyptianPreviousValue([{
      date: '2026-07-25',
      previousValue: 0,
      receivedValue: 50_000,
      rows: [{ value: 60_000, commission: 2_000 }],
    }], '2026-07-26')).toBe(-12_000);
  });

  it('uses the nearest prior calendar day even if records are not ordered', () => {
    expect(getEgyptianPreviousValue([
      {
        date: '2026-07-20',
        previousValue: 0,
        receivedValue: 100,
        rows: [],
      },
      {
        date: '2026-07-25',
        previousValue: 100,
        receivedValue: 100,
        rows: [{ value: 25, commission: 5 }],
      },
    ], '2026-07-26')).toBe(170);
  });

  it('uses the saved closing balance of the nearest prior day without rebuilding all history', () => {
    expect(getEgyptianPreviousValue([
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
    ], '2026-07-22')).toBe(1_000_029);
  });

  it('matches the reported day when its opening value is zero', () => {
    expect(calculateEgyptianRemainder({
      previousValue: 0,
      receivedValue: 880_000,
      rows: [{ value: 793_860, commission: 0 }],
    })).toBe(86_140);
  });
});
