import React from 'react';
import { DerivedPricesResult } from '../utils/math';

interface DerivedPricesCardProps {
  derived: DerivedPricesResult;
  onCopy: (text: string) => void;
}

const formatTry = (val: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2 }).format(val);
const formatEur = (val: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(val);

const copyValue = (val: number) => val.toFixed(2).replace('.', ',');

export const DerivedPricesCard: React.FC<DerivedPricesCardProps> = ({ derived, onCopy }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-4 transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <div className="p-4 md:p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Modanisa & Trendyol Avrupa</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-xs text-slate-500 block">Modanisa</span>
              <span className="text-xl font-bold text-brand-600">{formatTry(derived.modanisa)}</span>
            </div>
            <button
              onClick={() => onCopy(copyValue(derived.modanisa))}
              className="min-h-[44px] inline-flex items-center px-3 py-2.5 md:py-2 border border-slate-300 shadow-sm text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-brand-300 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Kopyala
            </button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
            <div>
              <span className="text-xs text-slate-500 block">Trendyol Avrupa</span>
              <span className="text-xl font-bold text-slate-800">{formatEur(derived.tyAvrupa)}</span>
              <span className="ml-2 text-slate-400 line-through text-lg">{formatEur(derived.tyAvrupaPsf)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onCopy(copyValue(derived.tyAvrupa))}
                className="min-h-[44px] inline-flex items-center px-3 py-2.5 md:py-2 border border-slate-300 shadow-sm text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-brand-300 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500"
              >
                <svg className="mr-2 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Satış
              </button>
              <button
                onClick={() => onCopy(copyValue(derived.tyAvrupaPsf))}
                className="min-h-[44px] inline-flex items-center px-3 py-2.5 md:py-2 border border-slate-300 shadow-sm text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 hover:border-brand-300 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500"
              >
                <svg className="mr-2 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Liste
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
