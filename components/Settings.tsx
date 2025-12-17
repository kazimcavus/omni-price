import React, { useState } from 'react';
import { CostSetting, KdvMode } from '../types';
import { DEFAULT_SETTINGS } from '../constants';

interface SettingsProps {
  settings: CostSetting[];
  onSave: (newSettings: CostSetting[]) => void;
  onReset: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onSave, onReset }) => {
  const [localSettings, setLocalSettings] = useState<CostSetting[]>(settings);
  const [hasChanges, setHasChanges] = useState(false);

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
    if(window.confirm("Tüm ayarları varsayılan değerlere döndürmek istediğinize emin misiniz?")) {
        setLocalSettings(DEFAULT_SETTINGS);
        onSave(DEFAULT_SETTINGS);
        setHasChanges(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800">Maliyet Kalemleri ve Ayarlar</h2>
        <div className="space-x-3">
          <button 
            onClick={handleReset}
            className="px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
          >
            Varsayılanlara Dön
          </button>
          <button 
            onClick={handleSave}
            disabled={!hasChanges}
            className={`px-4 py-2 text-sm text-white rounded-md transition-colors ${hasChanges ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-300 cursor-not-allowed'}`}
          >
            Kaydet
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {localSettings.map((item) => (
          <div key={item.key} className="bg-slate-50 p-4 rounded-md border border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2 truncate" title={item.label}>
              {item.label}
            </label>
            
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="number"
                value={item.value}
                onChange={(e) => handleChange(item.key, 'value', parseFloat(e.target.value) || 0)}
                className="block w-full rounded-md border-slate-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 sm:text-sm p-2 border bg-white text-slate-900 appearance-none"
              />
              <span className="text-slate-500 font-medium w-8">{item.suffix}</span>
            </div>

            {!item.isPercentage && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">KDV Modu</label>
                  <select
                    value={item.kdvMode}
                    onChange={(e) => handleChange(item.key, 'kdvMode', e.target.value as KdvMode)}
                    className="block w-full rounded-md border-slate-300 text-xs py-1 pl-2 pr-6 border bg-white text-slate-900"
                  >
                    <option value="HARIC">Hariç</option>
                    <option value="DAHIL">Dahil</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">KDV %</label>
                  <input
                    type="number"
                    value={item.kdvRate}
                    onChange={(e) => handleChange(item.key, 'kdvRate', parseFloat(e.target.value) || 0)}
                    className="block w-full rounded-md border-slate-300 text-xs py-1 px-2 border bg-white text-slate-900 appearance-none"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};