import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type SpreadsheetValue = string | number | boolean | null | undefined;
export type SpreadsheetRow = SpreadsheetValue[];

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const MAX_XML_BYTES = 40 * 1024 * 1024;

function escapeXml(value: SpreadsheetValue): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function columnName(index: number): string {
  let result = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function columnIndex(reference: string): number {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() || 'A';
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function worksheetXml(rows: SpreadsheetRow[]): string {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, cellIndex) => {
      const reference = `${columnName(cellIndex)}${rowIndex + 1}`;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `<c r="${reference}"><v>${value}</v></c>`;
      }
      if (typeof value === 'boolean') {
        return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
      }
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${body}</sheetData></worksheet>`;
}

function uniqueSheetName(name: string, used: Set<string>): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let candidate = cleaned;
  let suffix = 2;
  while (used.has(candidate)) {
    const marker = ` (${suffix++})`;
    candidate = `${cleaned.slice(0, 31 - marker.length)}${marker}`;
  }
  used.add(candidate);
  return candidate;
}

export function objectRows(records: Array<Record<string, SpreadsheetValue>>): SpreadsheetRow[] {
  if (records.length === 0) return [];
  const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
  return [headers, ...records.map((record) => headers.map((header) => record[header]))];
}

export function createXlsxArchive(
  sheets: Array<{ name: string; rows: SpreadsheetRow[] }>,
): Uint8Array {
  const usedNames = new Set<string>();
  const normalizedSheets = sheets.map((sheet) => ({
    ...sheet,
    name: uniqueSheetName(sheet.name, usedNames),
  }));
  const workbookSheets = normalizedSheets.map(
    (sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join('');
  const workbookRelations = normalizedSheets.map(
    (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('');
  const worksheetOverrides = normalizedSheets.map(
    (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${worksheetOverrides}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `${workbookRelations}</Relationships>`,
    ),
  };
  normalizedSheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet.rows));
  });
  return zipSync(files, { level: 6 });
}

export function downloadXlsx(
  sheets: Array<{ name: string; rows: SpreadsheetRow[] }>,
  fileName: string,
): void {
  const archive = createXlsxArchive(sheets);
  const blob = new Blob([archive.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseXml(xml: string): Document {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('INVALID_XLSX_XML');
  return document;
}

function readCellValue(cell: Element, sharedStrings: string[]): SpreadsheetValue {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    return [...cell.getElementsByTagName('t')].map((node) => node.textContent || '').join('');
  }
  const rawValue = cell.getElementsByTagName('v')[0]?.textContent || '';
  if (type === 's') return sharedStrings[Number(rawValue)] ?? '';
  if (type === 'b') return rawValue === '1';
  if (type === 'str') return rawValue;
  if (rawValue === '') return '';
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : rawValue;
}

function parseCsv(text: string): SpreadsheetRow[] {
  const rows: SpreadsheetRow[] = [];
  let row: SpreadsheetValue[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export function readSpreadsheetRows(data: ArrayBuffer, fileName: string): SpreadsheetRow[] {
  if (data.byteLength > MAX_IMPORT_BYTES) throw new Error('FILE_TOO_LARGE');
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'csv') return parseCsv(new TextDecoder('utf-8').decode(data));
  if (extension === 'xls') throw new Error('LEGACY_XLS_UNSUPPORTED');
  if (extension !== 'xlsx') throw new Error('UNSUPPORTED_SPREADSHEET');

  const entries = unzipSync(new Uint8Array(data), {
    filter: (file) =>
      file.name === 'xl/sharedStrings.xml'
      || file.name === 'xl/workbook.xml'
      || file.name === 'xl/_rels/workbook.xml.rels'
      || file.name.startsWith('xl/worksheets/'),
  });
  if (Object.values(entries).reduce((total, entry) => total + entry.byteLength, 0) > MAX_XML_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const sharedEntry = entries['xl/sharedStrings.xml'];
  const sharedStrings = sharedEntry
    ? [...parseXml(strFromU8(sharedEntry)).getElementsByTagName('si')].map(
        (item) => [...item.getElementsByTagName('t')].map((node) => node.textContent || '').join(''),
      )
    : [];

  let worksheetEntry = entries['xl/worksheets/sheet1.xml'];
  const workbookEntry = entries['xl/workbook.xml'];
  const relationsEntry = entries['xl/_rels/workbook.xml.rels'];
  if (workbookEntry && relationsEntry) {
    const firstSheet = parseXml(strFromU8(workbookEntry)).getElementsByTagName('sheet')[0];
    const relationId = firstSheet?.getAttribute('r:id');
    const relationship = [...parseXml(strFromU8(relationsEntry)).getElementsByTagName('Relationship')]
      .find((item) => item.getAttribute('Id') === relationId);
    const target = relationship?.getAttribute('Target')?.replace(/^\/?xl\//, '');
    if (target) worksheetEntry = entries[`xl/${target}`];
  }
  if (!worksheetEntry) throw new Error('EMPTY_WORKBOOK');

  return [...parseXml(strFromU8(worksheetEntry)).getElementsByTagName('row')].map((row) => {
    const values: SpreadsheetRow = [];
    for (const cell of [...row.getElementsByTagName('c')]) {
      const index = columnIndex(cell.getAttribute('r') || 'A');
      while (values.length < index) values.push('');
      values[index] = readCellValue(cell, sharedStrings);
    }
    return values;
  });
}
