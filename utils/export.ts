import { downloadExcel } from './excel';
import { SavedPriceItem, CHANNELS, BulkResultItem, KomisyonTeklifResultItem } from '../types';

export const exportToExcel = async (items: SavedPriceItem[]) => {
  if (items.length === 0) return;

  const hasDiscount = items.some(item => item.discountRate > 0);
  const headers: (string | number)[] = ['Model Kodu', 'Tarih'];

  if (hasDiscount) {
    CHANNELS.forEach(ch => {
      headers.push(`${ch.label} Liste Fiyatı`);
      headers.push(`${ch.label} Satış Fiyatı`);
    });
  } else {
    CHANNELS.forEach(ch => headers.push(ch.label));
  }

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

    const getChannelResult = (channelKey: string) =>
      item.results.find(r => r.channelKey === channelKey && !r.error);

    if (hasDiscount) {
      CHANNELS.forEach(ch => {
        const result = getChannelResult(ch.key);
        row.push(
          result?.listPrice != null ? round2(result.listPrice) : '',
          result?.salePrice != null ? round2(result.salePrice) : ''
        );
      });
    } else {
      CHANNELS.forEach(ch => {
        const result = getChannelResult(ch.key);
        row.push(result?.salePrice != null ? round2(result.salePrice) : '');
      });
    }

    rows.push(row);
  });

  const colWidths = headers.map((_, idx) => ({
    wch: idx === 0 ? 20 : idx === 1 ? 18 : 15,
  }));
  await downloadExcel(rows, 'Fiyat Listesi', `fiyat_listesi_${new Date().toISOString().split('T')[0]}.xlsx`, colWidths);
};

export const exportBulkToExcel = async (items: BulkResultItem[]) => {
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
      row.push(res?.listPrice != null ? round2(res.listPrice) : '');
      row.push(res?.salePrice != null ? round2(res.salePrice) : '');
    });

    rows.push(row);
  });

  const colWidths = headers.map((_, idx) => ({
    wch: idx === 0 ? 18 : idx === 1 ? 16 : idx === 6 ? 18 : 14,
  }));
  await downloadExcel(rows, 'Toplu Fiyatlar', `toplu_fiyatlar_${new Date().toISOString().split('T')[0]}.xlsx`, colWidths);
};

function findHeaderKey(keys: string[], name: string): string | undefined {
  const u = name.trim().toUpperCase();
  return keys.find(k => k.trim().toUpperCase() === u);
}

/** Fiyat/komisyon için virgülden sonra 2 rakam (1 kuruş hassasiyeti) */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function exportKomisyonTarifeToExcel(
  originalSheetRows: Record<string, unknown>[],
  results: KomisyonTeklifResultItem[],
  _rows: { sellerStockCode: string }[]
): Promise<void> {
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

  await downloadExcel(rowsAoa, 'Komisyon Tarifeleri', `trendyol_komisyon_tarifeleri_${new Date().toISOString().split('T')[0]}.xlsx`);
}

