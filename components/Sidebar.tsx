import React from 'react';
import { ChannelKey, ChannelResult, CHANNELS } from '../types';

interface SidebarProps {
  selectedChannels: ChannelKey[];
  onToggleChannel: (key: ChannelKey) => void;
  results: ChannelResult[];
  onToast: (msg: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ selectedChannels, onToggleChannel, results, onToast }) => {
  
  const handleBulkCopy = () => {
    // Format: TY: 1769,99 | HB: 1789,99 ...
    const text = results
      .filter(r => selectedChannels.includes(r.channelKey) && !r.error)
      .map(r => `${r.channelKey}: ${r.salePrice.toFixed(2).replace('.', ',')}`)
      .join(' | ');
    
    if (text) {
      navigator.clipboard.writeText(text);
      onToast("Fiyatlar panoya kopyalandı!");
    } else {
      onToast("Kopyalanacak hesaplanmış fiyat yok.");
    }
  };

  return (
    <div className="bg-white h-fit rounded-lg shadow-sm border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Kanallar</h3>
      
      <div className="space-y-3 mb-8">
        {CHANNELS.map(ch => (
          <label key={ch.key} className="flex items-center space-x-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={selectedChannels.includes(ch.key)}
              onChange={() => onToggleChannel(ch.key)}
              className="h-5 w-5 text-brand-600 rounded border-slate-300 focus:ring-brand-500 transition duration-150 ease-in-out"
            />
            <span className="text-slate-700 group-hover:text-slate-900 transition-colors">{ch.label}</span>
          </label>
        ))}
      </div>

      <div className="pt-6 border-t border-slate-100">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">İşlemler</h3>
        <button
          onClick={handleBulkCopy}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
        >
          <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          Toplu Kopyala
        </button>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Seçili kanalların fiyatlarını tek satırda kopyalar.
        </p>
      </div>
    </div>
  );
};