import { downloadExcel } from './excel';
import { SavedPriceItem, CHANNELS, BulkResultItem, KomisyonTeklifResultItem, CalculationInputs, CostSetting, ProfitScenarioResultItem, ProfitType } from '../types';
import { calculateDerivedPricesFromTrendyol } from './math';

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

  headers.push('Modanisa (TL)', 'TY Avrupa (EUR)', 'TY Avrupa Üstü Çizili (EUR)');

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

    row.push(item.derivedPrices ? round2(item.derivedPrices.modanisa) : '');
    row.push(item.derivedPrices ? round2(item.derivedPrices.tyAvrupa) : '');
    row.push(item.derivedPrices ? round2(item.derivedPrices.tyAvrupaPsf) : '');

    rows.push(row);
  });

  const colWidths = headers.map((_, idx) => ({
    wch: idx === 0 ? 20 : idx === 1 ? 18 : 15,
  }));
  await downloadExcel(rows, 'Fiyat Listesi', `fiyat_listesi_${new Date().toISOString().split('T')[0]}.xlsx`, colWidths);
};

export const exportBulkToExcel = async (
  items: BulkResultItem[],
  settings: CostSetting[],
  baseInputs: CalculationInputs
) => {
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

  headers.push('Modanisa (TL)', 'TY Avrupa (EUR)', 'TY Avrupa Üstü Çizili (EUR)');

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

    const tyRes = item.results.find(r => r.channelKey === 'TY' && !r.error);
    const rowInputs: CalculationInputs = { ...baseInputs, productCostExKdv: item.cost, productKdvRate: item.kdvRate, returnRate: item.returnRate, includeOverhead: item.includeOverhead ?? baseInputs.includeOverhead };
    const derived = tyRes ? calculateDerivedPricesFromTrendyol(tyRes.salePrice, settings, rowInputs) : null;
    row.push(derived ? round2(derived.modanisa) : '');
    row.push(derived ? round2(derived.tyAvrupa) : '');
    row.push(derived ? round2(derived.tyAvrupaPsf) : '');

    rows.push(row);
  });

  const colWidths = headers.map((_, idx) => ({
    wch: idx === 0 ? 18 : idx === 1 ? 16 : idx === 6 ? 18 : 14,
  }));
  await downloadExcel(rows, 'Toplu Fiyatlar', `toplu_fiyatlar_${new Date().toISOString().split('T')[0]}.xlsx`, colWidths);
};

/** Kâr senaryosu için boş örnek dosya */
export const downloadProfitScenarioTemplate = async () => {
  const rows: (string | number)[][] = [
    ['Model Kodu', 'Fiyat', 'Maliyet', 'KDV Oranı', 'İade Oranı'],
    ['ABC-01', 1299.9, 350, 10, 15],
    ['ABC-02', 899.9, 220, 20, 22],
    ['ABC-03', 1899.9, 520, 10, 15],
  ];
  const colWidths = [{ wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }];
  await downloadExcel(rows, 'Şablon', 'kar_senaryo_sablonu.xlsx', colWidths);
};

export const exportProfitScenarioToExcel = async (
  items: ProfitScenarioResultItem[],
  discountRates: number[],
  channelLabel: string,
  profitType: ProfitType
) => {
  if (items.length === 0) return;

  const profitRateLabel = profitType === 'MARGIN' ? 'Kâr % (Satıştan)' : 'Kâr % (Maliyetten)';

  const headers: (string | number)[] = [
    'Model Kodu',
    'Kanal',
    'Fiyat',
    'Maliyet (KDV Hariç)',
    'KDV Oranı',
    'İade Oranı',
    'Sabit Gider',
    'Komisyon Oranı',
    'Net Kâr',
    profitRateLabel,
    'Başabaş İndirim %',
  ];

  discountRates.forEach(d => {
    headers.push(`%${d} İndirimli Fiyat`, `%${d} Net Kâr`, `%${d} ${profitRateLabel}`);
  });

  const rows: (string | number)[][] = [headers];

  items.forEach(item => {
    const row: (string | number)[] = [
      item.modelCode,
      channelLabel,
      round2(item.base.price),
      item.cost,
      item.kdvRate,
      item.returnRate,
      round2(item.fixedCosts),
      item.commissionRate,
      round2(item.base.netProfit),
      round2(item.base.profitRate),
      item.breakEvenDiscountRate != null && item.breakEvenDiscountRate > 0
        ? round2(item.breakEvenDiscountRate)
        : '',
    ];

    item.scenarios.forEach(s => {
      row.push(round2(s.price), round2(s.netProfit), round2(s.profitRate));
    });

    rows.push(row);
  });

  const colWidths = headers.map((_, idx) => ({ wch: idx === 0 ? 18 : 16 }));
  await downloadExcel(
    rows,
    'Kâr Senaryosu',
    `kar_senaryosu_${new Date().toISOString().split('T')[0]}.xlsx`,
    colWidths
  );
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

