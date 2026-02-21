import React, { useState } from 'react';
import { CostSetting, KdvMode } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { Modal } from './Modal';

interface SettingsProps {
  settings: CostSetting[];
  onSave: (newSettings: CostSetting[]) => void;
  onReset: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSave, onReset }) => {
  const [localSettings, setLocalSettings] = useState<CostSetting[]>(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleChange = (key: string, field: keyof CostSetting, value: any) => {
    const updated = localSettings.map(s => {
      if (s.key === key) {
        return { ...s, [field]: value };
      }
      return s;
    });
    setLocalSettings(updated);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localSettings);
    setHasChanges(false);
  };

  const handleReset = () => {
    setShowResetModal(true);
  };

  const confirmReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    onReset();
    setHasChanges(false);
    setShowResetModal(false);
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Maliyet Kalemleri ve Ayarlar</h2>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleReset}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-all border border-red-200"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Varsayılanlara Dön
            </button>
            <button 
              onClick={handleSave}
              disabled={!hasChanges}
              className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg transition-all ${
                hasChanges 
                  ? 'bg-brand-600 hover:bg-brand-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500' 
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Kaydet
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {localSettings.map((item) => (
            <div key={item.key} className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-all">
              <label className="block text-sm font-medium text-slate-700 mb-3 truncate" title={item.label}>
                {item.label}
              </label>
              
              <div className="flex items-center space-x-2 mb-3">
                <input
                  type="number"
                  step="0.01"
                  value={item.value === 0 ? '' : item.value}
                  onChange={(e) => handleChange(item.key, 'value', parseFloat(e.target.value) || 0)}
                  className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm py-2 px-3 border bg-white text-slate-900 appearance-none transition-all"
                />
                <span className="text-slate-600 font-medium text-sm w-10 flex-shrink-0">{item.suffix}</span>
              </div>

              {!item.isPercentage && (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5 font-medium">KDV Modu</label>
                    <select
                      value={item.kdvMode}
                      onChange={(e) => handleChange(item.key, 'kdvMode', e.target.value as KdvMode)}
                      className="block w-full rounded-lg border-slate-300 text-xs py-2 pl-2 pr-6 border bg-white text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all cursor-pointer"
                    >
                      <option value="HARIC">Hariç</option>
                      <option value="DAHIL">Dahil</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1.5 font-medium">KDV %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={item.kdvRate === 0 ? '' : item.kdvRate}
                      onChange={(e) => handleChange(item.key, 'kdvRate', parseFloat(e.target.value) || 0)}
                      className="block w-full rounded-lg border-slate-300 text-xs py-2 px-2 border bg-white text-slate-900 appearance-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={confirmReset}
        title="Ayarları Sıfırla"
        message="Tüm ayarları varsayılan değerlere döndürmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Evet, Sıfırla"
        cancelText="İptal"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </>
  );
};