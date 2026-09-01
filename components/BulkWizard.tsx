import React, { useMemo, useState, useEffect } from 'react';
import { parseExcelToJson, findHeaderKey, getByHeader } from '../utils/excel';
import { safeSetItem } from '../utils/storage';
import {
  CalculationInputs,
  CostSetting,
  UploadedRow,
  CategoryRateMap,
  CategoryRate,
  BulkResultItem,
  CHANNELS,
  ChannelKey,
  ProfitType,
} from '../types';
import { calculateAllChannels, calculateDerivedPricesFromTrendyol } from '../utils/math';
import { exportBulkToExcel } from '../utils/export';
import { STORAGE_KEY_BULK_STATE } from '../constants';

type Step = 1 | 2 | 3;

interface BulkWizardProps {
  settings: CostSetting[];
  baseInputs: CalculationInputs;
  onToast: (msg: string) => void;
  onAppend: (items: BulkResultItem[]) => void;
  onReplace: (items: BulkResultItem[]) => void;
  hasSavedItems: boolean;
}

interface PersistedBulkState {
  rows: UploadedRow[];
  categoryRates: CategoryRateMap;
  results: BulkResultItem[];
  includeOverhead?: boolean;
}

const requiredHeaders = [
  'Model Kodu',
  'Kategorizasyon',
  'Maliyet',
  'İade Oranı',
  'KDV Oranı',
] as const;

export const BulkWizard: React.FC<BulkWizardProps> = ({
  settings,
  baseInputs,
  onToast,
  onAppend,
  onReplace,
  hasSavedItems,
}) => {
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<UploadedRow[]>([]);
  const [categoryRates, setCategoryRates] = useState<CategoryRateMap>({});
  const [results, setResults] = useState<BulkResultItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showSaveChoice, setShowSaveChoice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkInfluencerChannels, setBulkInfluencerChannels] = useState<ChannelKey[]>(baseInputs.influencerChannels || ['TY']);
  const [bulkIncludeInfluencerInProfit, setBulkIncludeInfluencerInProfit] = useState<boolean>(baseInputs.includeInfluencerInProfit ?? false);
  const [profitType, setProfitType] = useState<ProfitType>('MARGIN');
  const [bulkIncludeOverhead, setBulkIncludeOverhead] = useState<boolean>(baseInputs.includeOverhead ?? true);

  // Load persisted state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BULK_STATE);
    if (saved) {
      try {
        const parsed: PersistedBulkState = JSON.parse(saved);
        setRows(parsed.rows || []);
        setCategoryRates(parsed.categoryRates || {});
        setResults(parsed.results || []);
        setBulkIncludeOverhead(parsed.includeOverhead ?? baseInputs.includeOverhead ?? true);
        if ((parsed.rows || []).length) {
          setStep(3);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  // Persist state
  useEffect(() => {
    const data: PersistedBulkState = { rows, categoryRates, results, includeOverhead: bulkIncludeOverhead };
    if (!safeSetItem(STORAGE_KEY_BULK_STATE, data)) {
      onToast('Depolama limiti aşıldı: liste kaydedilemedi, hesaplama devam ediyor.');
    }
  }, [rows, categoryRates, results, bulkIncludeOverhead]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.category));
    return Array.from(set);
  }, [rows]);

  const handleFile = async (file: File): Promise<boolean> => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const json = await parseExcelToJson(buf);

      const keys = Object.keys(json[0] || {});
      const missingHeaders = requiredHeaders.filter(h => !findHeaderKey(keys, h));
      if (missingHeaders.length) {
        onToast(`Eksik kolonlar: ${missingHeaders.join(', ')}`);
        setLoading(false);
        return false;
      }

      const newWarnings: string[] = [];
      const parsedRows: UploadedRow[] = [];
      json.forEach((row, idx) => {
        const modelCode = String(getByHeader(row, keys, 'Model Kodu') ?? '').trim();
        const category = String(getByHeader(row, keys, 'Kategorizasyon') ?? '').trim();
        const cost = Number(getByHeader(row, keys, 'Maliyet')) || 0;
        const returnRate = Number(getByHeader(row, keys, 'İade Oranı'));
        const kdvRate = Number(getByHeader(row, keys, 'KDV Oranı'));

        if (!modelCode || !category || cost <= 0) {
          newWarnings.push(`Satır ${idx + 2}: Model/Kategori/Maliyet eksik`);
          return;
        }
        if (isNaN(returnRate) || isNaN(kdvRate)) {
          newWarnings.push(`Satır ${idx + 2}: İade/KDV oranı eksik, satır atlandı`);
          return;
        }

        parsedRows.push({ modelCode, category, cost, returnRate, kdvRate });
      });

      if (!parsedRows.length) {
        onToast('Geçerli satır bulunamadı.');
        setWarnings(newWarnings);
        setLoading(false);
        return false;
      }

      // Init category rates from base inputs
      const newRates: CategoryRateMap = {};
      parsedRows.forEach(r => {
        if (!newRates[r.category]) {
          newRates[r.category] = {
            category: r.category,
            targetProfitRate: baseInputs.targetProfitRate,
            sabitFiyatTargetProfitRate: baseInputs.sabitFiyatTargetProfitRate,
            discountRate: baseInputs.discountRate,
            influencerCommissionRate: baseInputs.influencerCommissionRate,
          };
        }
      });

      setWarnings(newWarnings);
      setRows(parsedRows);
      setCategoryRates(newRates);
      setResults([]);
      setStep(2);
      onToast('Dosya yüklendi, kategorileri kontrol edin.');
      setLoading(false);
      return true;
    } catch (e) {
      onToast('Dosya okunamadı.');
      console.error(e);
      setLoading(false);
      return false;
    }
  };

  const handleRateChange = (category: string, field: keyof CategoryRate, value: number) => {
    setCategoryRates(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || {
          category,
          targetProfitRate: baseInputs.targetProfitRate,
          sabitFiyatTargetProfitRate: baseInputs.sabitFiyatTargetProfitRate,
          discountRate: baseInputs.discountRate,
          influencerCommissionRate: baseInputs.influencerCommissionRate,
        }),
        [field]: value,
      },
    }));
  };

  const handleToggleBulkInfluencerChannel = (channelKey: ChannelKey) => {
    if (bulkInfluencerChannels.includes(channelKey)) {
      setBulkInfluencerChannels(bulkInfluencerChannels.filter(k => k !== channelKey));
    } else {
      setBulkInfluencerChannels([...bulkInfluencerChannels, channelKey]);
    }
  };

  const handleCompute = () => {
    if (!rows.length) {
      onToast('Önce dosya yükleyin.');
      return;
    }
    const now = Date.now();
    const computed: BulkResultItem[] = rows.map(row => {
      const catRate = categoryRates[row.category] || {
        category: row.category,
        targetProfitRate: baseInputs.targetProfitRate,
        sabitFiyatTargetProfitRate: baseInputs.sabitFiyatTargetProfitRate,
        discountRate: baseInputs.discountRate,
        influencerCommissionRate: baseInputs.influencerCommissionRate,
      };

      const inputs: CalculationInputs = {
        ...baseInputs,
        profitType,
        includeOverhead: bulkIncludeOverhead,
        productCostExKdv: row.cost,
        productKdvRate: row.kdvRate,
        returnRate: row.returnRate,
        targetProfitRate: catRate.targetProfitRate,
        sabitFiyatTargetProfitRate: catRate.sabitFiyatTargetProfitRate,
        discountRate: catRate.discountRate,
        influencerCommissionRate: catRate.influencerCommissionRate,
        influencerChannels: bulkInfluencerChannels,
        includeInfluencerInProfit: bulkIncludeInfluencerInProfit,
      };

      const res = calculateAllChannels(inputs, settings, CHANNELS.map(c => c.key));
      return {
        modelCode: row.modelCode,
        category: row.category,
        cost: row.cost,
        returnRate: row.returnRate,
        kdvRate: row.kdvRate,
        discountRate: catRate.discountRate,
        timestamp: now,
        results: res,
        includeOverhead: bulkIncludeOverhead,
      };
    });
    setResults(computed);
    setStep(3);
    onToast('Hesaplama tamamlandı.');
  };

  const handleSaveAction = (mode: 'append' | 'replace') => {
    if (!results.length) {
      onToast('Önce hesaplama yapın.');
      return;
    }
    if (mode === 'append') {
      onAppend(results);
      onToast('Listeye eklendi.');
    } else {
      onReplace(results);
      onToast('Liste güncellendi.');
    }
    setShowSaveChoice(false);
  };

  const resetAll = () => {
    setRows([]);
    setCategoryRates({});
    setResults([]);
    setWarnings([]);
    setStep(1);
    onToast('Temizlendi.');
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              XLSX yükleyin. Zorunlu kolonlar: Model Kodu, Kategorizasyon, Maliyet, İade Oranı, KDV Oranı
            </p>
            <input
              type="file"
              accept=".xlsx"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const ok = await handleFile(file);
                  if (!ok) e.target.value = '';
                }
              }}
              className="inline-block w-auto text-sm text-slate-700 cursor-pointer"
            />
            {warnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded">
                <p className="font-semibold mb-1">Atlanan satırlar:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Kategorilere özel Hedef Kâr, Sabit Fiyat Hedef Kâr, İndirim ve Influencer Komisyon oranlarını girin.
            </p>
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
              <div className="overflow-auto overflow-touch overscroll-contain max-h-[min(350px,45vh)] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-300">
              <div className="grid grid-cols-5 gap-4 min-w-[600px] bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600 sticky top-0 z-10">
                <div>Kategori</div>
                <div>Hedef Kâr Oranı (%)</div>
                <div>Sabit Fiyat Hedef Kâr Oranı (%)</div>
                <div>Kampanya/İndirim Oranı (%)</div>
                <div>Influencer Komisyonu (%)</div>
              </div>
              <div className="divide-y divide-slate-100">
                {uniqueCategories.map(cat => {
                  const rate = categoryRates[cat] || {
                    category: cat,
                    targetProfitRate: baseInputs.targetProfitRate,
                    sabitFiyatTargetProfitRate: baseInputs.sabitFiyatTargetProfitRate,
                    discountRate: baseInputs.discountRate,
                    influencerCommissionRate: baseInputs.influencerCommissionRate,
                  };
                  return (
                    <div key={cat} className="grid grid-cols-5 gap-4 px-4 py-3 items-center bg-white hover:bg-slate-50">
                      <div className="text-sm font-semibold text-slate-800 truncate">{cat}</div>
                      <input
                        type="number"
                        value={rate.targetProfitRate != null ? String(rate.targetProfitRate) : ''}
                        onChange={(e) => handleRateChange(cat, 'targetProfitRate', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border-slate-300 text-sm py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                      <input
                        type="number"
                        value={rate.sabitFiyatTargetProfitRate != null ? String(rate.sabitFiyatTargetProfitRate) : ''}
                        onChange={(e) => handleRateChange(cat, 'sabitFiyatTargetProfitRate', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border-slate-300 text-sm py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                      <input
                        type="number"
                        value={rate.discountRate != null ? String(rate.discountRate) : ''}
                        onChange={(e) => handleRateChange(cat, 'discountRate', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border-slate-300 text-sm py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                      <input
                        type="number"
                        value={rate.influencerCommissionRate != null ? String(rate.influencerCommissionRate) : ''}
                        onChange={(e) => handleRateChange(cat, 'influencerCommissionRate', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border-slate-300 text-sm py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
            <div className="mt-6 bg-white rounded-xl p-4 md:p-6 shadow-sm border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 mb-4">Hesaplama Ayarları</h4>
              <div className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Kâr Hesaplama Tipi</label>
                    <select
                      value={profitType}
                      onChange={e => setProfitType(e.target.value as ProfitType)}
                      className="block w-full rounded-lg border-slate-300 py-2.5 pl-3 pr-10 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 transition-all cursor-pointer"
                    >
                      <option value="MARGIN">Satış Fiyatından (Margin)</option>
                      <option value="MARKUP">Maliyet Üzerine (Markup)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Firma Genel Gider Oranı</label>
                    <div className="flex items-center pt-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={bulkIncludeOverhead}
                        onClick={() => setBulkIncludeOverhead(!bulkIncludeOverhead)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                          bulkIncludeOverhead ? 'bg-brand-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            bulkIncludeOverhead ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-sm text-slate-900">Dahil</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">Influencer Komisyonu Uygulanacak Kanallar (Tüm Kategoriler İçin)</label>
                  <div className="flex flex-wrap gap-4">
                    {CHANNELS.map(channel => (
                      <label key={channel.key} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bulkInfluencerChannels.includes(channel.key)}
                          onChange={() => handleToggleBulkInfluencerChannel(channel.key)}
                          className="h-4 w-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700">{channel.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bulkIncludeInfluencerInProfit}
                    onClick={() => setBulkIncludeInfluencerInProfit(!bulkIncludeInfluencerInProfit)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                      bulkIncludeInfluencerInProfit ? 'bg-brand-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        bulkIncludeInfluencerInProfit ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="ml-3 text-sm text-slate-900">
                    Kar Hesaplaması Influencer Komisyonu Dahil
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if (results.length === 0) {
                    onToast('Önce hesaplama yapın.');
                    return;
                  }
                  if (hasSavedItems) {
                    setShowSaveChoice(true);
                  } else {
                    onReplace(results);
                    onToast('Liste eklendi.');
                  }
                }}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
              >
                Listeye ekle
              </button>
              <button
                onClick={resetAll}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
              >
                Yeni yükle
              </button>
              <button
                onClick={() => exportBulkToExcel(results, settings, baseInputs)}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700"
              >
                XLSX indir
              </button>
            </div>
            <div className="overflow-auto overflow-touch overscroll-contain max-h-[min(450px,55vh)] border border-slate-200 rounded-lg bg-white [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-300">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Model</th>
                    <th className="px-3 py-2 text-left">Kategori</th>
                    <th className="px-3 py-2 text-right">Maliyet</th>
                    <th className="px-3 py-2 text-right">İade %</th>
                    <th className="px-3 py-2 text-right">KDV %</th>
                    <th className="px-3 py-2 text-right">İndirim %</th>
                    {CHANNELS.map(ch => (
                      <React.Fragment key={ch.key}>
                        <th className="px-3 py-2 text-right whitespace-nowrap">
                          {ch.label} Satış
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">
                          {ch.label} Net Kâr
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">
                          {ch.label} Kâr %
                        </th>
                      </React.Fragment>
                    ))}
                    <th className="px-3 py-2 text-right whitespace-nowrap">Modanisa (TL)</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">TY Avrupa (EUR)</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">TY Avrupa Ü.Ç. (EUR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-slate-800">{item.modelCode}</td>
                      <td className="px-3 py-2 text-slate-600">{item.category}</td>
                      <td className="px-3 py-2 text-right">{item.cost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{item.returnRate.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{item.kdvRate.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{item.discountRate.toFixed(2)}</td>
                      {CHANNELS.map(ch => {
                        const res = item.results.find(r => r.channelKey === ch.key && !r.error);
                        return (
                          <React.Fragment key={ch.key}>
                            <td className="px-3 py-2 text-right font-semibold text-slate-800">
                              {res ? res.salePrice.toFixed(2).replace('.', ',') : '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-700">
                              {res ? res.netProfit.toFixed(2).replace('.', ',') : '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-blue-700">
                              {res ? `%${res.profitRate.toFixed(2)}` : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      {(() => {
                        const tyRes = item.results.find(r => r.channelKey === 'TY' && !r.error);
                        const rowInputs: CalculationInputs = { ...baseInputs, productCostExKdv: item.cost, productKdvRate: item.kdvRate, returnRate: item.returnRate, includeOverhead: item.includeOverhead ?? baseInputs.includeOverhead };
                        const derived = tyRes ? calculateDerivedPricesFromTrendyol(tyRes.salePrice, settings, rowInputs) : null;
                        return (
                          <>
                            <td className="px-3 py-2 text-right font-semibold text-slate-800">{derived ? derived.modanisa.toFixed(2).replace('.', ',') : '-'}</td>
                            <td className="px-3 py-2 text-right text-slate-700">{derived ? derived.tyAvrupa.toFixed(2).replace('.', ',') : '-'}</td>
                            <td className="px-3 py-2 text-right text-slate-500">{derived ? derived.tyAvrupaPsf.toFixed(2).replace('.', ',') : '-'}</td>
                          </>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 9l5-5 5 5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Toplu Fiyat Sihirbazı</h2>
            <p className="text-sm text-slate-500">Excel yükle, kategorilere oran gir, hesapla ve indir.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {[1, 2, 3].map(s => (
            <span
              key={s}
              className={`px-2 py-1 rounded-full ${step === s ? 'bg-brand-100 text-brand-700 font-semibold' : 'bg-slate-100'}`}
            >
              {s}. Adım
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {step > 1 && (
          <div className="flex gap-3">
            <button
              onClick={() => setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as Step)))}
              className="min-h-[44px] px-4 py-3 md:py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
            >
              Geri
            </button>
            {step === 2 && (
              <button
                onClick={handleCompute}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
              >
                Hesapla
              </button>
            )}
          </div>
        )}

        <div className="min-h-[140px]">{renderStepContent()}</div>

        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as Step)))}
              className="min-h-[44px] px-4 py-3 md:py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
            >
              Geri
            </button>
          )}
          {step === 1 && (
            <button
              disabled={loading}
              onClick={() => rows.length ? setStep(2) : null}
              className="min-h-[44px] px-4 py-3 md:py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              İlerle
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleCompute}
              className="min-h-[44px] px-4 py-3 md:py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
            >
              Hesapla
            </button>
          )}
        </div>
      </div>

      {showSaveChoice && hasSavedItems && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Listeye ekle</h3>
            <p className="text-sm text-slate-600 mb-4">
              Mevcut liste kalsın mı yoksa temizleyip bu sonuçları mı ekleyelim?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleSaveAction('append')}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
              >
                Üzerine ekle
              </button>
              <button
                onClick={() => handleSaveAction('replace')}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-rose-50 text-rose-700 rounded-md text-sm hover:bg-rose-100 border border-rose-200"
              >
                Listeyi boşalt ve ekle
              </button>
              <button
                onClick={() => setShowSaveChoice(false)}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

