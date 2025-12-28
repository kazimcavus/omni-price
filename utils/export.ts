import * as XLSX from 'xlsx';
import { SavedPriceItem, CHANNELS } from '../types';

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
          listPrice !== null ? listPrice : '',
          salePrice !== null ? salePrice : ''
        );
      });
    } else {
      CHANNELS.forEach(ch => {
        const result = getChannelResult(ch.key);
        const salePrice = result?.salePrice ?? null;
        row.push(salePrice !== null ? salePrice : '');
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

