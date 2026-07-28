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
  const priorRecord = records
    .filter((record) => record.date < selectedDay)
    .sort((left, right) => right.date.localeCompare(left.date))[0];

  // A new day starts from the nearest saved day's closing balance. Existing
  // days keep their own saved opening snapshot and must never be rewritten
  // merely because the module was opened again.
  return priorRecord ? calculateEgyptianRemainder(priorRecord) : 0;
}
