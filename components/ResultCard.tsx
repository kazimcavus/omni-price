import React, { useState } from 'react';
import { ChannelResult } from '../types';

interface ResultCardProps {
  result: ChannelResult;
  onCopy: (text: string) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, onCopy }) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  const handleCopySale = () => {
    onCopy(`${result.salePrice.toFixed(2).replace('.', ',')}`);
  };

  const handleCopyList = () => {
    if (result.listPrice) {
      onCopy(`${result.listPrice.toFixed(2).replace('.', ',')}`);
    }
  };

  if (result.error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow-sm mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{result.channelName}</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{result.error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4 transition-all hover:shadow-md">
      <div className="p-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{result.channelName}</h3>
            <div className="mt-1 flex flex-col">
              {result.listPrice && (
                 <span className="text-sm text-slate-400 line-through decoration-slate-400 decoration-1 mb-0.5">
                   {formatCurrency(result.listPrice)}
                 </span>
              )}
              <span className="text-3xl font-extrabold text-brand-600 tracking-tight">
                {formatCurrency(result.salePrice)}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 items-end">
            {result.listPrice ? (
              <>
                <button
                  onClick={handleCopyList}
                  className="w-32 inline-flex items-center justify-center px-2 py-1.5 border border-slate-200 shadow-sm text-xs font-medium rounded text-slate-500 bg-slate-50 hover:bg-white hover:text-brand-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400"
                  title="Liste fiyatını kopyala"
                >
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Listeyi Kopyala
                </button>
                <button
                  onClick={handleCopySale}
                  className="w-32 inline-flex items-center justify-center px-2 py-1.5 border border-transparent shadow-sm text-xs font-medium rounded text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-colors"
                  title="Satış fiyatını kopyala"
                >
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Satışı Kopyala
                </button>
              </>
            ) : (
              <button
                onClick={handleCopySale}
                className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
              >
                <svg className="-ml-0.5 mr-2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Kopyala
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-green-50 p-2 rounded border border-green-100">
             <span className="block text-xs text-green-800 font-medium">Net Kâr</span>
             <span className="block text-lg font-bold text-green-700">{formatCurrency(result.netProfit)}</span>
          </div>
           <div className="bg-blue-50 p-2 rounded border border-blue-100">
             <span className="block text-xs text-blue-800 font-medium">Kâr Oranı</span>
             <span className="block text-lg font-bold text-blue-700">%{result.profitRate.toFixed(2)}</span>
          </div>
        </div>

        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="mt-4 w-full flex justify-between items-center text-sm text-slate-500 hover:text-slate-700"
        >
          <span>Detayları {isOpen ? 'Gizle' : 'Göster'}</span>
          <svg className={`h-5 w-5 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-sm">
            <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Komisyon Tutarı</span>
                    <span className="font-mono">{formatCurrency(result.breakdown.commissionAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Komisyon Sonrası Net</span>
                    <span className="font-mono text-slate-800 font-medium">{formatCurrency(result.breakdown.netAfterCommission)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Ürün Maliyeti (KDV+Gider Dahil)</span>
                    <span className="font-mono">{formatCurrency(result.breakdown.productCostTotal)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-600">Kargo (Beklenen, İade Dahil)</span>
                    <span className="font-mono text-amber-700">{formatCurrency(result.breakdown.shippingTotal)}</span>
                </div>
                <div className="py-1 border-b border-slate-200">
                    <div className="flex justify-between">
                        <span className="text-slate-600">Ambalaj (Beklenen, İade Dahil)</span>
                        <span className="font-mono text-amber-700">{formatCurrency(result.breakdown.packagingTotal)}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1 pl-2">
                        Kutu: {formatCurrency(result.breakdown.packagingDetails.box)} | Kart: {formatCurrency(result.breakdown.packagingDetails.card)} | Poşet: {formatCurrency(result.breakdown.packagingDetails.bag)}
                    </div>
                </div>
                {result.breakdown.platformFee > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Platform Hizmet Bedeli</span>
                        <span className="font-mono text-red-600">{formatCurrency(result.breakdown.platformFee)}</span>
                    </div>
                )}
                <div className="flex justify-between py-1">
                    <span className="text-slate-600">e-Fatura</span>
                    <span className="font-mono">{formatCurrency(result.breakdown.invoiceCost)}</span>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};