import ExcelJS from 'exceljs';

/** Başlıkları büyük/küçük harf, fazla boşluk ve Türkçe İ/ı farklarından bağımsız karşılaştırır */
export function normalizeHeaderForMatch(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .toUpperCase()
    .replace(/İ/g, 'I');
}

export function findHeaderKey(keys: string[], canonicalName: string): string | undefined {
  const wantNorm = normalizeHeaderForMatch(canonicalName);
  return keys.find(k => normalizeHeaderForMatch(k) === wantNorm);
}

export function getByHeader(row: Record<string, unknown>, keys: string[], canonicalName: string): unknown {
  const key = findHeaderKey(keys, canonicalName);
  return key !== undefined ? row[key] : undefined;
}

/**
 * Hücre değerini sayıya çevirir. Excel hücresi zaten sayıysa doğrudan döner.
 * Metin hücrelerde Türkçe biçim varsayılır: virgül ondalık, nokta binlik.
 * "1.234,56" -> 1234.56 | "1.299" -> 1299 | "499.99" -> 499.99 | "12,5" -> 12.5
 */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return isFinite(value) ? value : NaN;
  if (value == null) return NaN;

  let s = String(value).trim();
  if (!s) return NaN;

  s = s.replace(/[^\d.,-]/g, ''); // ₺, %, boşluk vb.
  if (!s) return NaN;

  const commas = (s.match(/,/g) || []).length;
  const dots = (s.match(/\./g) || []).length;

  if (commas > 0 && dots > 0) {
    // İki ayırıcı da var: sağdaki ondalıktır, soldakiler binliktir.
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousandSep = decimalSep === ',' ? '.' : ',';
    s = s.split(thousandSep).join('').replace(decimalSep, '.');
  } else if (commas > 1) {
    s = s.split(',').join(''); // "1,234,567"
  } else if (commas === 1) {
    s = s.replace(',', '.'); // TR ondalık
  } else if (dots > 1) {
    s = s.split('.').join(''); // "1.234.567"
  } else if (dots === 1) {
    // Tek nokta belirsiz: "499.99" ondalık ama "1.299" binlik.
    // Noktadan sonra tam 3 hane ve öncesinde en fazla 3 hane varsa binlik say.
    const [intPart, frac] = s.split('.');
    const intDigits = intPart.replace('-', '');
    if (frac.length === 3 && intDigits.length >= 1 && intDigits.length <= 3) {
      s = intPart + frac;
    }
  }

  const n = parseFloat(s);
  return isFinite(n) ? n : NaN;
}

/** Excel buffer'dan ilk sayfayı JSON satırlarına çevirir (sheet_to_json eşdeğeri) */
export async function parseExcelToJson(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: Record<string, unknown>[] = [];
  let headers: (string | number)[] = [];

  const toSimpleValue = (v: unknown): string | number => {
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (v instanceof Date) return v.toISOString();
    return String(v);
  };

  worksheet.eachRow((row, rowNumber) => {
    const values: (string | number)[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber - 1] = toSimpleValue(cell.value);
    });

    if (rowNumber === 1) {
      headers = values.map((v, idx) => (v == null ? '' : String(v).trim()) || `Col${idx}`);
      return;
    }

    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? '';
    });
    rows.push(obj);
  });

  return rows;
}

/** 2D dizi (satırlar) ile Excel oluşturup indirir */
export async function downloadExcel(
  rows: (string | number)[][],
  sheetName: string,
  fileName: string,
  colWidths?: { wch: number }[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  rows.forEach((row, rowIdx) => {
    const excelRow = worksheet.getRow(rowIdx + 1);
    row.forEach((val, colIdx) => {
      excelRow.getCell(colIdx + 1).value = val;
    });
  });

  if (colWidths?.length) {
    colWidths.forEach((w, i) => {
      worksheet.getColumn(i + 1).width = w.wch;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
