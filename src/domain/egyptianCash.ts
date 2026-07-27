import type { EgyptianCashRecord, EgyptianCashRow } from '../types';

const amount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function calculateEgyptianRowTotal(row: EgyptianCashRow): number {
  return amount(row.value) + amount(row.commission);
}

export function calculateEgyptianWorkTotal(rows: EgyptianCashRow[]): number {
  return rows.reduce((sum, row) => sum + calculateEgyptianRowTotal(row), 0);
}

export function calculateEgyptianRemainder(
  record: Pick<EgyptianCashRecord, 'rows' | 'previousValue' | 'receivedValue'>,
): number {
  return amount(record.previousValue)
    + amount(record.receivedValue)
    - calculateEgyptianWorkTotal(record.rows);
}

export function getEgyptianPreviousValue(
  records: EgyptianCashRecord[],
  selectedDay: string,
): number {
  const priorRecords = records
    .filter((record) => record.date < selectedDay)
    .sort((left, right) => left.date.localeCompare(right.date));

  if (!priorRecords.length) return 0;

  // Only the first record owns an opening value. Every following day's
  // previous value is derived from the preceding ledger movements, so editing
  // an old day immediately repairs all later balances.
  return priorRecords.reduce(
    (balance, record, index) =>
      (index === 0 ? amount(record.previousValue) : balance)
      + amount(record.receivedValue)
      - calculateEgyptianWorkTotal(record.rows),
    0,
  );
}
