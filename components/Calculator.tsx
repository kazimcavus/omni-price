import React, { useState } from 'react';
import { CalculationInputs } from '../types';

interface CalculatorProps {
  inputs: CalculationInputs;
  onChange: (inputs: CalculationInputs) => void;
  onSave?: (modelCode: string) => void;
}

export const Calculator: React.FC<CalculatorProps> = ({ inputs, onChange, onSave }) => {
  const [modelCode, setModelCode] = useState('');

  const handleChange = (field: keyof CalculationInputs, value: any) => {
    onChange({ ...inputs, [field]: value });
  };

  // Number input için özel handler - sıfır başlarını ve boş değerleri düzgün handle eder
  const handleNumberChange = (field: keyof CalculationInputs, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Boş string ise 0
    if (value === '' || value === null || value === undefined) {
      handleChange(field, 0);
      return;
    }
    
    // Parse et, geçerli bir sayı değilse 0
    const numValue = parseFloat(value);
    handleChange(field, isNaN(numValue) ? 0 : numValue);
  };

  const handleSave = () => {
    if (modelCode.trim()) {
      onSave?.(modelCode.trim());
      setModelCode('');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900">Ürün Maliyet Girişi</h2>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Cost */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Ürün Maliyeti (KDV Hariç)</label>
          <div className="relative rounded-lg shadow-sm">
            <input
              type="number"
              min="0"
              step="0.01"
              value={inputs.productCostExKdv === 0 ? '' : inputs.productCostExKdv}
              onChange={(e) => handleNumberChange('productCostExKdv', e)}
              className="block w-full rounded-lg border-slate-300 pl-3 pr-10 py-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 appearance-none transition-all"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">TL</span>
            </div>
          </div>
        </div>

        {/* VAT Rate */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Ürün KDV Oranı</label>
          <div className="relative rounded-lg shadow-sm">
            <input
              type="number"
              min="0"
              step="0.1"
              value={inputs.productKdvRate === 0 ? '' : inputs.productKdvRate}
              onChange={(e) => handleNumberChange('productKdvRate', e)}
              className="block w-full rounded-lg border-slate-300 pl-3 pr-10 py-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 appearance-none transition-all"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>

        {/* Return Rate */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tahmini İade Oranı</label>
          <div className="relative rounded-lg shadow-sm">
            <input
              type="number"
              min="0"
              max="99"
              step="0.1"
              value={inputs.returnRate === 0 ? '' : inputs.returnRate}
              onChange={(e) => handleNumberChange('returnRate', e)}
              className="block w-full rounded-lg border-slate-300 pl-3 pr-10 py-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 appearance-none transition-all"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>

        {/* Target Profit */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Hedef Kâr Oranı</label>
          <div className="relative rounded-lg shadow-sm">
            <input
              type="number"
              step="0.1"
              value={inputs.targetProfitRate === 0 ? '' : inputs.targetProfitRate}
              onChange={(e) => handleNumberChange('targetProfitRate', e)}
              className="block w-full rounded-lg border-slate-300 pl-3 pr-10 py-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 appearance-none transition-all"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Sabit Fiyat Target Profit */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Sabit Fiyat Hedef Kâr Oranı</label>
          <div className="relative rounded-lg shadow-sm">
            <input
              type="number"
              step="0.1"
              value={inputs.sabitFiyatTargetProfitRate === 0 ? '' : inputs.sabitFiyatTargetProfitRate}
              onChange={(e) => handleNumberChange('sabitFiyatTargetProfitRate', e)}
              className="block w-full rounded-lg border-slate-300 pl-3 pr-10 py-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 appearance-none transition-all"
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
          <label className="block text-sm font-medium text-slate-700 mb-2">Kâr Hesaplama Tipi</label>
          <select
            value={inputs.profitType}
            onChange={(e) => handleChange('profitType', e.target.value)}
            className="block w-full rounded-lg border-slate-300 py-2.5 pl-3 pr-10 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 transition-all cursor-pointer"
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
           <label className="block text-sm font-medium text-slate-700 mb-2">Kampanya/İndirim Oranı (Opsiyonel)</label>
            <div className="relative rounded-lg shadow-sm">
            <input
              type="number"
              min="0"
              max="99"
              step="0.1"
              placeholder="0"
              value={inputs.discountRate === 0 ? '' : inputs.discountRate}
              onChange={(e) => handleNumberChange('discountRate', e)}
              className="block w-full rounded-lg border-slate-300 pl-3 pr-10 py-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 appearance-none transition-all placeholder:text-slate-400"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-slate-500 sm:text-sm">%</span>
            </div>
          </div>
        </div>

      </div>

      {/* Model Code and Save Section */}
      {onSave && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-800">Model Kodu Kaydet</h3>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">Model Kodu</label>
              <input
                type="text"
                value={modelCode}
                onChange={(e) => setModelCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && modelCode.trim()) {
                    handleSave();
                  }
                }}
                placeholder="Örn: ABC-123"
                className="block w-full rounded-lg border-slate-300 pl-3 pr-3 py-2.5 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSave}
                disabled={!modelCode.trim()}
                className="inline-flex items-center px-5 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm shadow-sm"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};