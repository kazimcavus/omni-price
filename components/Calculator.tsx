import React from 'react';
import { CalculationInputs } from '../types';

interface CalculatorProps {
  inputs: CalculationInputs;
  onChange: (inputs: CalculationInputs) => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ inputs, onChange }) => {
  const handleChange = (field: keyof CalculationInputs, value: any) => {
    onChange({ ...inputs, [field]: value });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Ürün Maliyet Girişi</h2>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Cost */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ürün Maliyeti (KDV Hariç)</label>
          <div className="relative rounded-md shadow-sm">
            <input
              type="number"
              min="0"
              value={inputs.productCostExKdv}
              onChange={(e) => handleChange('productCostExKdv', parseFloat(e.target.value) || 0)}
              className="block w-full rounded-md border-slate-300 pl-3 pr-8 py-2 focus:border-brand-500 focus:ring-brand-500 sm:text-sm border bg-white text-slate-900 appearance-none"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">TL</span>
            </div>
          </div>
        </div>

        {/* VAT Rate */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ürün KDV Oranı</label>
          <div className="relative rounded-md shadow-sm">
            <input
              type="number"
              min="0"
              value={inputs.productKdvRate}
              onChange={(e) => handleChange('productKdvRate', parseFloat(e.target.value) || 0)}
              className="block w-full rounded-md border-slate-300 pl-3 pr-8 py-2 focus:border-brand-500 focus:ring-brand-500 sm:text-sm border bg-white text-slate-900 appearance-none"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>

        {/* Return Rate */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tahmini İade Oranı</label>
          <div className="relative rounded-md shadow-sm">
            <input
              type="number"
              min="0"
              max="99"
              value={inputs.returnRate}
              onChange={(e) => handleChange('returnRate', parseFloat(e.target.value) || 0)}
              className="block w-full rounded-md border-slate-300 pl-3 pr-8 py-2 focus:border-brand-500 focus:ring-brand-500 sm:text-sm border bg-white text-slate-900 appearance-none"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>

        {/* Target Profit */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Hedef Kâr Oranı</label>
          <div className="relative rounded-md shadow-sm">
            <input
              type="number"
              value={inputs.targetProfitRate}
              onChange={(e) => handleChange('targetProfitRate', parseFloat(e.target.value) || 0)}
              className="block w-full rounded-md border-slate-300 pl-3 pr-8 py-2 focus:border-brand-500 focus:ring-brand-500 sm:text-sm border bg-white text-slate-900 appearance-none"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4 items-end">
        {/* Profit Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Kâr Hesaplama Tipi</label>
          <select
            value={inputs.profitType}
            onChange={(e) => handleChange('profitType', e.target.value)}
            className="block w-full rounded-md border-slate-300 py-2 pl-3 pr-10 focus:border-brand-500 focus:ring-brand-500 sm:text-sm border bg-white text-slate-900"
          >
            <option value="MARGIN">Satış Fiyatından (Margin)</option>
            <option value="MARKUP">Maliyet Üzerine (Markup)</option>
          </select>
        </div>

        {/* Overhead Toggle Switch */}
        <div className="flex items-center h-10 pb-2">
            <button
                type="button"
                role="switch"
                aria-checked={inputs.includeOverhead}
                onClick={() => handleChange('includeOverhead', !inputs.includeOverhead)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                    inputs.includeOverhead ? 'bg-brand-600' : 'bg-slate-200'
                }`}
            >
                <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        inputs.includeOverhead ? 'translate-x-5' : 'translate-x-0'
                    }`}
                />
            </button>
            <span 
                className="ml-3 text-sm text-slate-900 cursor-pointer select-none"
                onClick={() => handleChange('includeOverhead', !inputs.includeOverhead)}
            >
                Firma Genel Gideri Dahil Et
            </span>
        </div>

        {/* Discount (Optional) */}
        <div>
           <label className="block text-sm font-medium text-slate-700 mb-1">Kampanya/İndirim Oranı (Opsiyonel)</label>
            <div className="relative rounded-md shadow-sm">
            <input
              type="number"
              min="0"
              max="99"
              placeholder="0"
              value={inputs.discountRate === 0 ? '' : inputs.discountRate}
              onChange={(e) => handleChange('discountRate', parseFloat(e.target.value) || 0)}
              className="block w-full rounded-md border-slate-300 pl-3 pr-8 py-2 focus:border-brand-500 focus:ring-brand-500 sm:text-sm border bg-white text-slate-900 appearance-none"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};