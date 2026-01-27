import React, { useState, useEffect, useMemo } from 'react';
import { Settings } from './components/Settings';
import { Calculator } from './components/Calculator';
import { ResultCard } from './components/ResultCard';
import { Sidebar } from './components/Sidebar';
import { SavedItems } from './components/SavedItems';
import { Modal } from './components/Modal';
import { DuplicateModelModal } from './components/DuplicateModelModal';
import { CostSetting, CalculationInputs, ChannelKey, CHANNELS, SavedPriceItem, BulkResultItem } from './types';
import { DEFAULT_SETTINGS, STORAGE_KEY_SETTINGS, STORAGE_KEY_INPUTS, STORAGE_KEY_CHANNELS, STORAGE_KEY_SAVED_ITEMS } from './constants';
import { calculateAllChannels } from './utils/math';
import { exportToExcel } from './utils/export';
import { BulkWizard } from './components/BulkWizard';

const App: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'CALC' | 'BULK' | 'SETTINGS'>('CALC');
  
  const [settings, setSettings] = useState<CostSetting[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [inputs, setInputs] = useState<CalculationInputs>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_INPUTS);
    const defaultInputs = {
      productCostExKdv: 100,
      productKdvRate: 10,
      returnRate: 20,
      targetProfitRate: 20,
      sabitFiyatTargetProfitRate: 20,
      profitType: 'MARGIN' as const,
      includeOverhead: true,
      discountRate: 0,
      influencerCommissionRate: 15,
      influencerChannels: ['TY'] as ChannelKey[], // Varsayılan: sadece Trendyol
      includeInfluencerInProfit: false // Varsayılan: hariç
    };
    if (saved) {
      const parsed = JSON.parse(saved);
      // Eski localStorage verilerinde yeni alanlar olmayabilir
      return {
        ...defaultInputs,
        ...parsed,
        sabitFiyatTargetProfitRate: parsed.sabitFiyatTargetProfitRate ?? defaultInputs.sabitFiyatTargetProfitRate,
        influencerCommissionRate: parsed.influencerCommissionRate ?? defaultInputs.influencerCommissionRate,
        influencerChannels: parsed.influencerChannels ?? defaultInputs.influencerChannels,
        includeInfluencerInProfit: parsed.includeInfluencerInProfit ?? defaultInputs.includeInfluencerInProfit
      };
    }
    return defaultInputs;
  });

  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CHANNELS);
    return saved ? JSON.parse(saved) : CHANNELS.map(c => c.key);
  });

  const [savedItems, setSavedItems] = useState<SavedPriceItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SAVED_ITEMS);
    return saved ? JSON.parse(saved) : [];
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingModelCode, setPendingModelCode] = useState<string | null>(null);
  const [pendingItem, setPendingItem] = useState<SavedPriceItem | null>(null);

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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAVED_ITEMS, JSON.stringify(savedItems));
  }, [savedItems]);

  // Toast Timer
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Prevent number input value change on scroll
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        const input = target as HTMLInputElement;
        if (document.activeElement === input) {
          e.preventDefault();
          input.blur();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

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

  const handleSaveModel = (modelCode: string) => {
    const newItem: SavedPriceItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      modelCode,
      timestamp: Date.now(),
      discountRate: inputs.discountRate,
      results: results.filter(r => !r.error)
    };

    // Check for duplicate model code (case-insensitive)
    const existingItem = savedItems.find(
      item => item.modelCode.toLowerCase() === modelCode.toLowerCase()
    );

    if (existingItem) {
      // Show duplicate modal
      setPendingModelCode(modelCode);
      setPendingItem(newItem);
      setShowDuplicateModal(true);
    } else {
      // Save directly
      setSavedItems(prev => [newItem, ...prev]);
      setToastMsg(`Model "${modelCode}" kaydedildi!`);
    }
  };

  const handleReplaceModel = () => {
    if (pendingItem && pendingModelCode) {
      setSavedItems(prev => {
        // Remove existing item with same model code and add new one
        const filtered = prev.filter(
          item => item.modelCode.toLowerCase() !== pendingModelCode.toLowerCase()
        );
        return [pendingItem, ...filtered];
      });
      setToastMsg(`Model "${pendingModelCode}" güncellendi!`);
      setPendingItem(null);
      setPendingModelCode(null);
    }
  };

  const handleKeepBoth = () => {
    if (pendingItem) {
      setSavedItems(prev => [pendingItem, ...prev]);
      setToastMsg(`Model "${pendingItem.modelCode}" kaydedildi!`);
      setPendingItem(null);
      setPendingModelCode(null);
    }
  };

  const handleDeleteItem = (id: string) => {
    setSavedItems(prev => prev.filter(item => item.id !== id));
    setToastMsg('Model silindi!');
  };

  const bulkResultsToSavedItems = (items: BulkResultItem[]): SavedPriceItem[] => {
    return items.map(item => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      modelCode: item.modelCode,
      timestamp: item.timestamp,
      discountRate: item.discountRate,
      results: item.results.filter(r => !r.error),
    }));
  };

  const handleBulkAppend = (items: BulkResultItem[]) => {
    const mapped = bulkResultsToSavedItems(items);
    setSavedItems(prev => [...mapped, ...prev]);
    setToastMsg('Toplu fiyatlar listeye eklendi.');
  };

  const handleBulkReplace = (items: BulkResultItem[]) => {
    const mapped = bulkResultsToSavedItems(items);
    setSavedItems(mapped);
    setToastMsg('Liste temizlendi ve yeni fiyatlar eklendi.');
  };

  const handleExport = (items: SavedPriceItem[]) => {
    try {
      exportToExcel(items);
      setToastMsg('Excel dosyası indirildi!');
    } catch (error) {
      setToastMsg('Excel export hatası!');
      console.error(error);
    }
  };

  const handleClearAll = () => {
    setShowClearModal(true);
  };

  const confirmClearAll = () => {
    setSavedItems([]);
    setToastMsg('Tüm modeller silindi!');
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
              <h1 className="ml-3 text-xl font-bold text-slate-900 tracking-tight">OmniPrice</h1>
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
                onClick={() => setActiveTab('BULK')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors ${
                  activeTab === 'BULK'
                    ? 'border-brand-500 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                Liste Yükle
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
        {activeTab === 'SETTINGS' && (
          <Settings 
            settings={settings} 
            onSave={setSettings} 
            onReset={() => setSettings(DEFAULT_SETTINGS)} 
          />
        )}

        {activeTab === 'CALC' && (
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

            {/* Mobile Sidebar */}
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
              <Calculator inputs={inputs} onChange={setInputs} onSave={handleSaveModel} />
              
              <div className="grid gap-6 md:grid-cols-2 mb-6">
                 {results
                    .filter(r => selectedChannels.includes(r.channelKey))
                    .map(r => (
                      <ResultCard key={r.channelKey} result={r} onCopy={handleCopyToast} includeInfluencerInProfit={inputs.includeInfluencerInProfit} />
                 ))}
                 {results.filter(r => selectedChannels.includes(r.channelKey)).length === 0 && (
                    <div className="col-span-full text-center py-16">
                      <svg className="mx-auto h-12 w-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <p className="text-sm font-medium text-slate-500">Hiçbir kanal seçili değil</p>
                      <p className="text-xs text-slate-400 mt-1">Sol menüden kanal seçiniz</p>
                    </div>
                 )}
              </div>

              <SavedItems 
                items={savedItems} 
                onDelete={handleDeleteItem}
                onExport={handleExport}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        )}

        {activeTab === 'BULK' && (
          <div className="max-w-7xl mx-auto">
            <BulkWizard
              settings={settings}
              baseInputs={inputs}
              onToast={(msg) => setToastMsg(msg)}
              onAppend={handleBulkAppend}
              onReplace={handleBulkReplace}
              hasSavedItems={savedItems.length > 0}
            />
            <div className="mt-6">
              <SavedItems 
                items={savedItems} 
                onDelete={handleDeleteItem}
                onExport={handleExport}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        )}
      </main>

      {/* Clear Confirmation Modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={confirmClearAll}
        title="Tüm Modelleri Sil"
        message="Tüm kaydedilmiş modelleri silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmText="Tamam"
        cancelText="İptal"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      {/* Duplicate Model Modal */}
      {pendingModelCode && (
        <DuplicateModelModal
          isOpen={showDuplicateModal}
          onClose={() => {
            setShowDuplicateModal(false);
            setPendingModelCode(null);
            setPendingItem(null);
          }}
          onReplace={handleReplaceModel}
          onKeepBoth={handleKeepBoth}
          modelCode={pendingModelCode}
        />
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50 animate-fade-in-up min-w-[280px] max-w-md">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-100 flex-1">{toastMsg}</p>
          <button
            onClick={() => setToastMsg(null)}
            className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
            aria-label="Kapat"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;