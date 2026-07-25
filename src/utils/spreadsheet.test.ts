import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { createXlsxArchive, objectRows, readSpreadsheetRows } from './spreadsheet';

describe('safe spreadsheet utilities', () => {
  it('parses quoted CSV values without executing formulas', () => {
    const csv = new TextEncoder().encode('name,note\nAhmed,"one,two"\nFormula,=1+1');
    const rows = readSpreadsheetRows(csv.buffer as ArrayBuffer, 'import.csv');
    expect(rows).toEqual([
      ['name', 'note'],
      ['Ahmed', 'one,two'],
      ['Formula', '=1+1'],
    ]);
  });

  it('creates a valid XLSX package with escaped user content', () => {
    const archive = createXlsxArchive([
      { name: 'Customers', rows: objectRows([{ Name: 'A&B', Balance: 25 }]) },
    ]);
    const files = unzipSync(archive);
    expect(Object.keys(files)).toContain('[Content_Types].xml');
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml');
    const sheetXml = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheetXml).toContain('A&amp;B');
    expect(sheetXml).toContain('<v>25</v>');
  });

  it('rejects the legacy XLS format', () => {
    expect(() => readSpreadsheetRows(new ArrayBuffer(1), 'legacy.xls'))
      .toThrow('LEGACY_XLS_UNSUPPORTED');
  });
});
