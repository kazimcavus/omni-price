import React, { useState, useEffect, useMemo } from 'react';
import { Settings } from './components/Settings';
import { Calculator } from './components/Calculator';
import { ResultCard } from './components/ResultCard';
import { Sidebar } from './components/Sidebar';
import { CostSetting, CalculationInputs, ChannelKey, CHANNELS } from './types';
import { DEFAULT_SETTINGS, STORAGE_KEY_SETTINGS, STORAGE_KEY_INPUTS, STORAGE_KEY_CHANNELS } from './constants';
import { calculateAllChannels } from './utils/math';

const App: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'CALC' | 'SETTINGS'>('CALC');
  
  const [settings, setSettings] = useState<CostSetting[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [inputs, setInputs] = useState<CalculationInputs>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_INPUTS);
    return saved ? JSON.parse(saved) : {
      productCostExKdv: 100,
      productKdvRate: 10,
      returnRate: 20,
      targetProfitRate: 20,
      profitType: 'MARGIN',
      includeOverhead: true,
      discountRate: 0
    };
  });

  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CHANNELS);
    return saved ? JSON.parse(saved) : CHANNELS.map(c => c.key);
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_INPUTS, JSON.stringify(inputs));
  }, [inputs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CHANNELS, JSON.stringify(selectedChannels));
  }, [selectedChannels]);

  // Toast Timer
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // --- Handlers ---
  const handleToggleChannel = (key: ChannelKey) => {
    setSelectedChannels(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleCopyToast = (text: string) => {
    navigator.clipboard.writeText(text);
    setToastMsg(`Kopyalandı: ${text}`);
  };

  // --- Calculation ---
  // Memoized to prevent recalculation on unrelated renders, though calculation is cheap here
  const results = useMemo(() => {
    return calculateAllChannels(inputs, settings, CHANNELS.map(c => c.key));
  }, [inputs, settings]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="bg-brand-600 text-white p-1.5 rounded-lg shadow-sm">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 36v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="ml-3 text-xl font-bold text-slate-800 tracking-tight">OmniPrice</h1>
            </div>
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveTab('CALC')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors ${
                  activeTab === 'CALC'
                    ? 'border-brand-500 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                Hesaplama
              </button>
              <button
                onClick={() => setActiveTab('SETTINGS')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors ${
                  activeTab === 'SETTINGS'
                    ? 'border-brand-500 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                Ayarlar
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'SETTINGS' ? (
          <Settings 
            settings={settings} 
            onSave={setSettings} 
            onReset={() => setSettings(DEFAULT_SETTINGS)} 
          />
        ) : (
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Sidebar */}
            <div className="hidden lg:block lg:col-span-3">
              <div className="sticky top-8">
                <Sidebar 
                  selectedChannels={selectedChannels} 
                  onToggleChannel={handleToggleChannel} 
                  results={results}
                  onToast={(msg) => setToastMsg(msg)}
                />
              </div>
            </div>

            {/* Mobile Sidebar (Just simple toggles above content for mobile if needed, or rely on responsive layout) */}
            <div className="lg:hidden mb-6 bg-white p-4 rounded-lg shadow-sm">
                <div className="flex overflow-x-auto space-x-4 pb-2">
                   {CHANNELS.map(ch => (
                      <label key={ch.key} className="flex items-center space-x-2 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedChannels.includes(ch.key)}
                          onChange={() => handleToggleChannel(ch.key)}
                          className="h-4 w-4 text-brand-600 rounded"
                        />
                        <span className="text-sm">{ch.label}</span>
                      </label>
                   ))}
                </div>
            </div>

            {/* Calculator Area */}
            <div className="lg:col-span-9">
              <Calculator inputs={inputs} onChange={setInputs} />
              
              <div className="grid gap-6 md:grid-cols-2">
                 {results
                    .filter(r => selectedChannels.includes(r.channelKey))
                    .map(r => (
                      <ResultCard key={r.channelKey} result={r} onCopy={handleCopyToast} />
                 ))}
                 {results.filter(r => selectedChannels.includes(r.channelKey)).length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-500">
                        Hiçbir kanal seçili değil. Sol menüden kanal seçiniz.
                    </div>
                 )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded-md shadow-lg flex items-center z-50 animate-fade-in-up">
           <svg className="h-5 w-5 text-green-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
           </svg>
           {toastMsg}
        </div>
      )}
    </div>
  );
};

export default App;