import React, { useState } from 'react';
import { ChannelResult } from '../types';

interface ResultCardProps {
  result: ChannelResult;
  onCopy: (text: string) => void;
  includeInfluencerInProfit: boolean;
}

export const ResultCard: React.FC<ResultCardProps> = ({ result, onCopy, includeInfluencerInProfit }) => {
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
      <div className="bg-gradient-to-r from-red-50 to-red-50/50 border-l-4 border-red-500 rounded-xl shadow-sm p-5 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="ml-4 flex-1">
            <h3 className="text-sm font-semibold text-red-900">{result.channelName}</h3>
            <div className="mt-1.5 text-sm text-red-700">
              <p>{result.error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <div className="p-4 md:p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{result.channelName}</h3>
            <div className="mt-1 flex flex-col">
              {result.listPrice && (
                 <span className="text-sm text-slate-400 line-through decoration-slate-400 decoration-1 mb-0.5">
                   {formatCurrency(result.listPrice)}
                 </span>
              )}
              <span className="text-2xl md:text-3xl font-extrabold text-brand-600 tracking-tight">
                {formatCurrency(result.salePrice)}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 items-end">
            {result.listPrice ? (
              <>
                <button
                  onClick={handleCopyList}
                  className="w-32 min-h-[44px] inline-flex items-center justify-center px-3 py-2.5 md:py-2 border border-slate-200 shadow-sm text-xs font-medium rounded-lg text-slate-600 bg-white hover:bg-slate-50 hover:text-brand-600 hover:border-brand-300 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500"
                  title="Liste fiyatını kopyala"
                >
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Listeyi Kopyala
                </button>
                <button
                  onClick={handleCopySale}
                  className="w-32 min-h-[44px] inline-flex items-center justify-center px-3 py-2.5 md:py-2 border border-transparent shadow-sm text-xs font-medium rounded-lg text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 transition-all"
                  title="Satış fiyatını kopyala"
                >
                  <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Satışı Kopyala
                </button>
              </>
            ) : (
              <button
                onClick={handleCopySale}
                className="min-h-[44px] inline-flex items-center px-3 py-2.5 md:py-2 border border-slate-300 shadow-sm text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-brand-300 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 transition-all"
              >
                <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Kopyala
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-50/50 p-3 rounded-lg border border-emerald-100">
             <span className="block text-xs text-emerald-700 font-medium mb-1">Net Kâr</span>
             <span className="block text-lg font-semibold text-emerald-800">{formatCurrency(result.netProfit)}</span>
          </div>
           <div className="bg-gradient-to-br from-blue-50 to-blue-50/50 p-3 rounded-lg border border-blue-100">
             <span className="block text-xs text-blue-700 font-medium mb-1">Kâr Oranı</span>
             <span className="block text-lg font-semibold text-blue-800">%{result.profitRate.toFixed(2)}</span>
          </div>
        </div>

        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="mt-5 w-full min-h-[44px] flex justify-between items-center px-3 py-3 md:py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
        >
          <span>Detayları {isOpen ? 'Gizle' : 'Göster'}</span>
          <svg className={`h-5 w-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="bg-gradient-to-b from-slate-50 to-white border-t border-slate-200 p-5 text-sm animate-fade-in">
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
                        Kutu: {formatCurrency(result.breakdown.packagingDetails.box)} | Kart: {formatCurrency(result.breakdown.packagingDetails.card)} | Poşet: {formatCurrency(result.breakdown.packagingDetails.bag)} | Ambalaj Poşeti: {formatCurrency(result.breakdown.packagingDetails.ambalajBag ?? 0)}
                    </div>
                </div>
                {result.breakdown.platformFee > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Platform Hizmet Bedeli</span>
                        <span className="font-mono text-red-600">{formatCurrency(result.breakdown.platformFee)}</span>
                    </div>
                )}
                {result.breakdown.influencerCommissionAmount > 0 && includeInfluencerInProfit && (
                    <div className="flex justify-between py-1 border-b border-slate-200">
                        <span className="text-slate-600">Influencer Komisyonu</span>
                        <span className="font-mono text-purple-600">{formatCurrency(result.breakdown.influencerCommissionAmount)}</span>
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