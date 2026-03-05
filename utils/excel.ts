import ExcelJS from 'exceljs';

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
