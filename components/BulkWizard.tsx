import React, { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  CalculationInputs,
  CostSetting,
  UploadedRow,
  CategoryRateMap,
  CategoryRate,
  BulkResultItem,
  CHANNELS,
} from '../types';
import { calculateAllChannels } from '../utils/math';
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

  // Load persisted state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BULK_STATE);
    if (saved) {
      try {
        const parsed: PersistedBulkState = JSON.parse(saved);
        setRows(parsed.rows || []);
        setCategoryRates(parsed.categoryRates || {});
        setResults(parsed.results || []);
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
    const data: PersistedBulkState = { rows, categoryRates, results };
    localStorage.setItem(STORAGE_KEY_BULK_STATE, JSON.stringify(data));
  }, [rows, categoryRates, results]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.category));
    return Array.from(set);
  }, [rows]);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Header check
      const missingHeaders = requiredHeaders.filter(
        h => !Object.keys(json[0] || {}).includes(h)
      );
      if (missingHeaders.length) {
        onToast(`Eksik kolonlar: ${missingHeaders.join(', ')}`);
        setLoading(false);
        return;
      }

      const newWarnings: string[] = [];
      const parsedRows: UploadedRow[] = [];
      json.forEach((row, idx) => {
        const modelCode = String(row['Model Kodu']).trim();
        const category = String(row['Kategorizasyon']).trim();
        const cost = Number(row['Maliyet']) || 0;
        const returnRate = Number(row['İade Oranı']);
        const kdvRate = Number(row['KDV Oranı']);

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
        return;
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
          };
        }
      });

      setWarnings(newWarnings);
      setRows(parsedRows);
      setCategoryRates(newRates);
      setResults([]);
      setStep(2);
      onToast('Dosya yüklendi, kategorileri kontrol edin.');
    } catch (e) {
      onToast('Dosya okunamadı.');
      console.error(e);
    } finally {
      setLoading(false);
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
        }),
        [field]: value,
      },
    }));
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
      };

      const inputs: CalculationInputs = {
        ...baseInputs,
        productCostExKdv: row.cost,
        productKdvRate: row.kdvRate,
        returnRate: row.returnRate,
        targetProfitRate: catRate.targetProfitRate,
        sabitFiyatTargetProfitRate: catRate.sabitFiyatTargetProfitRate,
        discountRate: catRate.discountRate,
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
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
              Kategorilere özel Hedef Kâr, Sabit Fiyat Hedef Kâr ve İndirim oranlarını girin.
            </p>
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
              <div className="grid grid-cols-4 gap-4 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">
                <div>Kategori</div>
                <div>Hedef Kâr Oranı (%)</div>
                <div>Sabit Fiyat Hedef Kâr Oranı (%)</div>
                <div>Kampanya/İndirim Oranı (%)</div>
              </div>
              <div className="divide-y divide-slate-100">
                {uniqueCategories.map(cat => {
                  const rate = categoryRates[cat] || {
                    category: cat,
                    targetProfitRate: baseInputs.targetProfitRate,
                    sabitFiyatTargetProfitRate: baseInputs.sabitFiyatTargetProfitRate,
                    discountRate: baseInputs.discountRate,
                  };
                  return (
                    <div key={cat} className="grid grid-cols-4 gap-4 px-4 py-3 items-center bg-white hover:bg-slate-50">
                      <div className="text-sm font-semibold text-slate-800 truncate">{cat}</div>
                      <input
                        type="number"
                        value={rate.targetProfitRate}
                        onChange={(e) => handleRateChange(cat, 'targetProfitRate', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border-slate-300 text-sm py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                      <input
                        type="number"
                        value={rate.sabitFiyatTargetProfitRate}
                        onChange={(e) => handleRateChange(cat, 'sabitFiyatTargetProfitRate', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border-slate-300 text-sm py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                      <input
                        type="number"
                        value={rate.discountRate}
                        onChange={(e) => handleRateChange(cat, 'discountRate', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border-slate-300 text-sm py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                    </div>
                  );
                })}
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
                className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
              >
                Listeye ekle
              </button>
              <button
                onClick={resetAll}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
              >
                Yeni yükle
              </button>
              <button
                onClick={() => exportBulkToExcel(results)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700"
              >
                XLSX indir
              </button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Model</th>
                    <th className="px-3 py-2 text-left">Kategori</th>
                    <th className="px-3 py-2 text-right">Maliyet</th>
                    <th className="px-3 py-2 text-right">İade %</th>
                    <th className="px-3 py-2 text-right">KDV %</th>
                    <th className="px-3 py-2 text-right">İndirim %</th>
                    {CHANNELS.map(ch => (
                      <th key={ch.key} className="px-3 py-2 text-right whitespace-nowrap">
                        {ch.label} Satış
                      </th>
                    ))}
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
                          <td key={ch.key} className="px-3 py-2 text-right font-semibold text-slate-800">
                            {res ? res.salePrice.toFixed(2).replace('.', ',') : '-'}
                          </td>
                        );
                      })}
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
    <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
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
        <div className="min-h-[140px]">{renderStepContent()}</div>

        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep((prev) => (prev === 1 ? 1 : ((prev - 1) as Step)))}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
            >
              Geri
            </button>
          )}
          {step === 1 && (
            <button
              disabled={loading}
              onClick={() => rows.length ? setStep(2) : null}
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700 disabled:opacity-50"
            >
              İlerle
            </button>
          )}
          {step === 2 && (
            <button
              onClick={handleCompute}
              className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
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
                className="px-4 py-2 bg-brand-600 text-white rounded-md text-sm hover:bg-brand-700"
              >
                Üzerine ekle
              </button>
              <button
                onClick={() => handleSaveAction('replace')}
                className="px-4 py-2 bg-rose-50 text-rose-700 rounded-md text-sm hover:bg-rose-100 border border-rose-200"
              >
                Listeyi boşalt ve ekle
              </button>
              <button
                onClick={() => setShowSaveChoice(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
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

