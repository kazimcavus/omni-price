import React, { useState, useEffect, useMemo } from 'react';
import { Settings } from './components/Settings';
import { Calculator } from './components/Calculator';
import { ResultCard } from './components/ResultCard';
import { DerivedPricesCard } from './components/DerivedPricesCard';
import { Sidebar } from './components/Sidebar';
import { SavedItems } from './components/SavedItems';
import { Modal } from './components/Modal';
import { DuplicateModelModal } from './components/DuplicateModelModal';
import { CostSetting, CalculationInputs, ChannelKey, CHANNELS, SavedPriceItem, BulkResultItem } from './types';
import { DEFAULT_SETTINGS, STORAGE_KEY_SETTINGS, STORAGE_KEY_INPUTS, STORAGE_KEY_CHANNELS, STORAGE_KEY_SAVED_ITEMS } from './constants';
import { calculateAllChannels, calculateDerivedPricesFromTrendyol } from './utils/math';
import { exportToExcel } from './utils/export';
import { BulkWizard } from './components/BulkWizard';
import { ProfitScenarioWizard } from './components/ProfitScenarioWizard';
import { TrendyolKomisyonTarifeWizard } from './components/TrendyolKomisyonTarifeWizard';

const App: React.FC = () => {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'CALC' | 'BULK' | 'KAR_SENARYO' | 'KOMISYON_TARIFE' | 'SETTINGS'>('CALC');
  
  const [settings, setSettings] = useState<CostSetting[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      const parsed: CostSetting[] = JSON.parse(saved);
      return DEFAULT_SETTINGS.map(def => {
        const found = parsed.find(p => p.key === def.key);
        return found ? { ...def, ...found } : def;
      });
    }
    return DEFAULT_SETTINGS;
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
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SAVED_ITEMS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
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
    try {
      const json = JSON.stringify(savedItems);
      localStorage.setItem(STORAGE_KEY_SAVED_ITEMS, json);
    } catch (e) {
      const isQuotaExceeded = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
      if (isQuotaExceeded) {
        setToastMsg('Depolama limiti aşıldı. Listeyi Excel\'e aktarıp temizleyin veya bir kısmını silin.');
      } else {
        setToastMsg('Kayıt depolama hatası.');
        console.error(e);
      }
    }
  }, [savedItems]);

  // Toast Timer
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  // Scroll-to-top button visibility
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    const tyResult = results.find(r => r.channelKey === 'TY' && !r.error);
    const derived = tyResult ? calculateDerivedPricesFromTrendyol(tyResult.salePrice, settings, inputs) : null;
    const newItem: SavedPriceItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      modelCode,
      timestamp: Date.now(),
      discountRate: inputs.discountRate,
      results: results.filter(r => !r.error),
      ...(derived && { derivedPrices: derived }),
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

  const bulkResultsToSavedItems = (items: BulkResultItem[], settingsArg: CostSetting[], baseInputsArg: CalculationInputs): SavedPriceItem[] => {
    return items.map(item => {
      const tyRes = item.results.find(r => r.channelKey === 'TY' && !r.error);
      const rowInputs: CalculationInputs = {
        ...baseInputsArg,
        productCostExKdv: item.cost,
        productKdvRate: item.kdvRate,
        returnRate: item.returnRate,
        includeOverhead: item.includeOverhead ?? baseInputsArg.includeOverhead,
      };
      const derived = tyRes ? calculateDerivedPricesFromTrendyol(tyRes.salePrice, settingsArg, rowInputs) : null;
      return {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        modelCode: item.modelCode,
        timestamp: item.timestamp,
        discountRate: item.discountRate,
        results: item.results.filter(r => !r.error),
        ...(derived && { derivedPrices: derived }),
      };
    });
  };

  const handleBulkAppend = (items: BulkResultItem[]) => {
    const mapped = bulkResultsToSavedItems(items, settings, inputs);
    setSavedItems(prev => [...mapped, ...prev]);
    setToastMsg('Toplu fiyatlar listeye eklendi.');
  };

  const handleBulkReplace = (items: BulkResultItem[]) => {
    const mapped = bulkResultsToSavedItems(items, settings, inputs);
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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16">
            <button
              type="button"
              onClick={() => setActiveTab('CALC')}
              className="flex items-center hover:opacity-90 transition-opacity cursor-pointer min-h-[44px]"
            >
              <div className="bg-brand-600 text-white p-1.5 rounded-lg shadow-sm">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 36v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="ml-3 text-xl font-bold text-slate-900 tracking-tight">OmniPrice</h1>
            </button>
            <nav className="hidden md:flex space-x-4">
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
                onClick={() => setActiveTab('KAR_SENARYO')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors ${
                  activeTab === 'KAR_SENARYO'
                    ? 'border-brand-500 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                Kâr Senaryosu
              </button>
              <button
                onClick={() => setActiveTab('KOMISYON_TARIFE')}
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full transition-colors ${
                  activeTab === 'KOMISYON_TARIFE'
                    ? 'border-brand-500 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                Trendyol Komisyon Tarifeleri
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

      {/* Bottom Tab Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_6px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => setActiveTab('CALC')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors ${activeTab === 'CALC' ? 'text-brand-600' : 'text-slate-500'}`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-xs mt-0.5 font-medium">Hesaplama</span>
          </button>
          <button
            onClick={() => setActiveTab('BULK')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors ${activeTab === 'BULK' ? 'text-brand-600' : 'text-slate-500'}`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-xs mt-0.5 font-medium">Liste Yükle</span>
          </button>
          <button
            onClick={() => setActiveTab('KAR_SENARYO')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors ${activeTab === 'KAR_SENARYO' ? 'text-brand-600' : 'text-slate-500'}`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 5L5 19" />
              <circle cx="7.5" cy="7.5" r="2.5" />
              <circle cx="16.5" cy="16.5" r="2.5" />
            </svg>
            <span className="text-xs mt-0.5 font-medium">Senaryo</span>
          </button>
          <button
            onClick={() => setActiveTab('KOMISYON_TARIFE')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors ${activeTab === 'KOMISYON_TARIFE' ? 'text-brand-600' : 'text-slate-500'}`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs mt-0.5 font-medium">Komisyon</span>
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-2 transition-colors ${activeTab === 'SETTINGS' ? 'text-brand-600' : 'text-slate-500'}`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs mt-0.5 font-medium">Ayarlar</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-8 pb-20 md:pb-8">
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
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Kanallar</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                   {CHANNELS.map(ch => (
                      <label
                        key={ch.key}
                        className={`flex items-center min-h-[44px] px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selectedChannels.includes(ch.key) ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedChannels.includes(ch.key)}
                          onChange={() => handleToggleChannel(ch.key)}
                          className="h-5 w-5 text-brand-600 rounded shrink-0 mr-2"
                        />
                        <span className="text-sm font-medium">{ch.label}</span>
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

              {(() => {
                const tyResult = results.find(r => r.channelKey === 'TY' && !r.error);
                const derived = tyResult ? calculateDerivedPricesFromTrendyol(tyResult.salePrice, settings, inputs) : null;
                return derived ? <DerivedPricesCard derived={derived} onCopy={handleCopyToast} /> : null;
              })()}

              <SavedItems 
                items={savedItems} 
                onDelete={handleDeleteItem}
                onExport={handleExport}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        )}

        {activeTab === 'KAR_SENARYO' && (
          <div className="max-w-7xl mx-auto">
            <ProfitScenarioWizard
              settings={settings}
              baseInputs={inputs}
              onToast={(msg) => setToastMsg(msg)}
            />
          </div>
        )}

        {activeTab === 'KOMISYON_TARIFE' && (
          <div className="max-w-7xl mx-auto">
            <TrendyolKomisyonTarifeWizard
              settings={settings}
              baseInputs={inputs}
              onToast={(msg) => setToastMsg(msg)}
            />
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

      {/* Scroll to Top */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 flex items-center justify-center transition-all"
          aria-label="Sayfa başına dön"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-24 md:bottom-6 right-3 md:right-6 left-3 md:left-auto bg-slate-900 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50 animate-fade-in-up min-w-0 max-w-md mx-auto md:mx-0">
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