import * as XLSX from 'xlsx';
import { SavedPriceItem, CHANNELS, BulkResultItem, KomisyonTeklifResultItem } from '../types';

export const exportToExcel = (items: SavedPriceItem[]) => {
  if (items.length === 0) return;

  // Determine format: if any item has discount, use discount format for consistency
  const hasDiscount = items.some(item => item.discountRate > 0);

  // Build header row
  const headers: (string | number)[] = ['Model Kodu', 'Tarih'];
  
  if (hasDiscount) {
    // Format: Model Kodu, Tarih, Trendyol Liste Fiyatı, Trendyol Satış Fiyatı, ...
    CHANNELS.forEach(ch => {
      headers.push(`${ch.label} Liste Fiyatı`);
      headers.push(`${ch.label} Satış Fiyatı`);
    });
  } else {
    // Format: Model Kodu, Tarih, Trendyol, Web, ...
    CHANNELS.forEach(ch => {
      headers.push(ch.label);
    });
  }

  // Build data rows
  const rows: (string | number)[][] = [headers];

  items.forEach(item => {
    const row: (string | number)[] = [
      item.modelCode,
      new Date(item.timestamp).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    ];

    const getChannelResult = (channelKey: string) => {
      return item.results.find(r => r.channelKey === channelKey && !r.error);
    };

    if (hasDiscount) {
      CHANNELS.forEach(ch => {
        const result = getChannelResult(ch.key);
        const listPrice = result?.listPrice ?? null;
        const salePrice = result?.salePrice ?? null;

        row.push(
          listPrice !== null ? round2(listPrice) : '',
          salePrice !== null ? round2(salePrice) : ''
        );
      });
    } else {
      CHANNELS.forEach(ch => {
        const result = getChannelResult(ch.key);
        const salePrice = result?.salePrice ?? null;
        row.push(salePrice !== null ? round2(salePrice) : '');
      });
    }

    rows.push(row);
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  const colWidths = headers.map((_, idx) => {
    if (idx === 0) return { wch: 20 }; // Model Kodu
    if (idx === 1) return { wch: 18 }; // Tarih
    return { wch: 15 }; // Fiyat sütunları
  });
  ws['!cols'] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Fiyat Listesi');

  // Write file
  const fileName = `fiyat_listesi_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const exportBulkToExcel = (items: BulkResultItem[]) => {
  if (items.length === 0) return;

  const headers: (string | number)[] = [
    'Model Kodu',
    'Kategori',
    'Maliyet (KDV Hariç)',
    'İade Oranı',
    'KDV Oranı',
    'İndirim Oranı',
    'Tarih',
  ];

  // Always include both list and sale columns for clarity
  CHANNELS.forEach(ch => {
    headers.push(`${ch.label} Liste Fiyatı`);
    headers.push(`${ch.label} Satış Fiyatı`);
  });

  const rows: (string | number)[][] = [headers];

  items.forEach(item => {
    const row: (string | number)[] = [
      item.modelCode,
      item.category,
      item.cost,
      item.returnRate,
      item.kdvRate,
      item.discountRate,
      new Date(item.timestamp).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    ];

    CHANNELS.forEach(ch => {
      const res = item.results.find(r => r.channelKey === ch.key && !r.error);
      const listPrice = res?.listPrice ?? null;
      const salePrice = res?.salePrice ?? null;
      row.push(listPrice !== null ? round2(listPrice) : '');
      row.push(salePrice !== null ? round2(salePrice) : '');
    });

    rows.push(row);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = headers.map((_, idx) => {
    if (idx === 0) return { wch: 18 }; // Model Kodu
    if (idx === 1) return { wch: 16 }; // Kategori
    if (idx === 6) return { wch: 18 }; // Tarih
    return { wch: 14 };
  });

  XLSX.utils.book_append_sheet(wb, ws, 'Toplu Fiyatlar');
  const fileName = `toplu_fiyatlar_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

function findHeaderKey(keys: string[], name: string): string | undefined {
  const u = name.trim().toUpperCase();
  return keys.find(k => k.trim().toUpperCase() === u);
}

/** Fiyat/komisyon için virgülden sonra 2 rakam (1 kuruş hassasiyeti) */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function exportKomisyonTarifeToExcel(
  originalSheetRows: Record<string, unknown>[],
  results: KomisyonTeklifResultItem[],
  _rows: { sellerStockCode: string }[]
): void {
  if (originalSheetRows.length === 0 || results.length === 0) return;

  const keys = Object.keys(originalSheetRows[0] || {});
  const stockKey = findHeaderKey(keys, 'SATICI STOK KODU') ?? 'SATICI STOK KODU';
  const newTsFKey = findHeaderKey(keys, 'YENİ TSF (FİYAT GÜNCELLE)') ?? 'YENİ TSF (FİYAT GÜNCELLE)';
  const komisyonKey = findHeaderKey(keys, 'HESAPLANAN KOMİSYON') ?? 'HESAPLANAN KOMİSYON';
  const teklifKey = 'SEÇİLEN TEKLİF';

  const resultMap = new Map(results.map(r => [r.sellerStockCode, r]));

  let headersFinal = keys.includes(newTsFKey) ? [...keys] : [...keys, newTsFKey];
  if (!headersFinal.includes(komisyonKey)) headersFinal.push(komisyonKey);
  if (!headersFinal.includes(teklifKey)) headersFinal.push(teklifKey);

  const rowsAoa: (string | number)[][] = [headersFinal];
  originalSheetRows.forEach(row => {
    const stockVal = String(row[stockKey] ?? '').trim();
    const result = resultMap.get(stockVal);
    const rowArr = headersFinal.map(h => {
      if (h === newTsFKey)
        return result?.acceptedPrice != null ? round2(result.acceptedPrice) : (row[h] as string | number) ?? '';
      if (h === komisyonKey)
        return result?.acceptedCommissionRate != null ? round2(result.acceptedCommissionRate) : (row[h] as string | number) ?? '';
      if (h === teklifKey)
        return result?.acceptedOfferIndex != null ? result.acceptedOfferIndex + 1 : '';
      return (row[h] as string | number) ?? '';
    });
    rowsAoa.push(rowArr);
  });

  const ws = XLSX.utils.aoa_to_sheet(rowsAoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Komisyon Tarifeleri');
  const fileName = `trendyol_komisyon_tarifeleri_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

