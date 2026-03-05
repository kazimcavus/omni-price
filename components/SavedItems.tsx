import React, { useState, useMemo } from 'react';
import { SavedPriceItem, ChannelResult, CHANNELS } from '../types';

interface SavedItemsProps {
  items: SavedPriceItem[];
  onDelete: (id: string) => void;
  onExport: (items: SavedPriceItem[]) => void;
  onClearAll: () => void;
}

export const SavedItems: React.FC<SavedItemsProps> = ({ items, onDelete, onExport, onClearAll }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items;
    }
    const query = searchQuery.toLowerCase().trim();
    return items.filter(item => 
      item.modelCode.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
  const formatEur = (val: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChannelResult = (results: ChannelResult[], channelKey: string): ChannelResult | undefined => {
    return results.find(r => r.channelKey === channelKey && !r.error);
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-slate-900">Henüz kaydedilmiş model yok</h3>
          <p className="mt-1 text-sm text-slate-500">Hesaplama yapıp model kodu kaydettiğinizde burada görünecek.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Kaydedilen Modeller ({filteredItems.length}{filteredItems.length !== items.length ? ` / ${items.length}` : ''})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={onClearAll}
              className="inline-flex items-center px-4 py-2.5 border border-red-300 shadow-sm text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 hover:border-red-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all"
            >
              <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Listeyi Sıfırla
            </button>
            <button
              onClick={() => onExport(items)}
              className="inline-flex items-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all"
            >
              <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel'e Aktar
            </button>
          </div>
        </div>
        
        {/* Search Box */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Model kodu ile ara..."
            className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-400 focus:outline-none focus:placeholder-slate-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 sm:text-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg className="h-5 w-5 text-slate-400 hover:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto overflow-touch overscroll-contain max-h-[min(450px,55vh)] rounded-lg border border-slate-200 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-300">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Model Kodu</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tarih</th>
              {(() => {
                // Check if any item has discount to determine table format
                const hasAnyDiscount = items.some(item => item.discountRate > 0);
                if (hasAnyDiscount) {
                  return (
                    <>
                      {CHANNELS.map(ch => (
                        <React.Fragment key={ch.key}>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{ch.label} Liste</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{ch.label} Satış</th>
                        </React.Fragment>
                      ))}
                    </>
                  );
                } else {
                  return CHANNELS.map(ch => (
                    <th key={ch.key} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{ch.label}</th>
                  ));
                }
              })()}
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Modanisa (TL)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">TY Avrupa (EUR)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">TY Avrupa Ü.Ç. (EUR)</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">İşlem</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={CHANNELS.length * (items.some(item => item.discountRate > 0) ? 2 : 1) + 6} className="px-4 py-8 text-center text-sm text-slate-500">
                  Arama sonucu bulunamadı.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
              const hasDiscount = items.some(i => i.discountRate > 0);
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{item.modelCode}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{formatDate(item.timestamp)}</td>
                  {hasDiscount ? (
                    <>
                      {CHANNELS.map(ch => {
                        const result = getChannelResult(item.results, ch.key);
                        return (
                          <React.Fragment key={ch.key}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                              {result?.listPrice ? formatCurrency(result.listPrice) : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                              {result ? formatCurrency(result.salePrice) : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </>
                  ) : (
                    CHANNELS.map(ch => {
                      const result = getChannelResult(item.results, ch.key);
                      return (
                        <td key={ch.key} className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                          {result ? formatCurrency(result.salePrice) : '-'}
                        </td>
                      );
                    })
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.derivedPrices ? formatCurrency(item.derivedPrices.modanisa) : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{item.derivedPrices ? formatEur(item.derivedPrices.tyAvrupa) : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{item.derivedPrices ? formatEur(item.derivedPrices.tyAvrupaPsf) : '-'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                      title="Sil"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

