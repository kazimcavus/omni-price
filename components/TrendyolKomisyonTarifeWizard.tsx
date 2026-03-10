import React, { useMemo, useState, useEffect } from 'react';
import { parseExcelToJson } from '../utils/excel';
import {
  CalculationInputs,
  CostSetting,
  CategoryRateMap,
  CategoryRate,
  KomisyonTeklifRow,
  KomisyonTeklifResultItem,
  TrendyolOffer,
  ProfitType,
} from '../types';
import {
  calculateProfitForGivenPriceAndCommission,
  calculatePriceForTargetProfit,
} from '../utils/math';
import { exportKomisyonTarifeToExcel } from '../utils/export';
import { STORAGE_KEY_KOMISYON_TARIFE_STATE } from '../constants';

type Step = 1 | 2 | 3;

interface TrendyolKomisyonTarifeWizardProps {
  settings: CostSetting[];
  baseInputs: CalculationInputs;
  onToast: (msg: string) => void;
}

interface PersistedTarifeState {
  rows: KomisyonTeklifRow[];
  categoryRates: CategoryRateMap;
  results: KomisyonTeklifResultItem[];
  originalSheetRows: Record<string, unknown>[];
  useAltLimitFallback: boolean;
  includeOverhead?: boolean;
}

const TRENDYOL_HEADERS = [
  'SATICI STOK KODU',
  'MODEL KODU',
  'KATEGORİ',
  '1.Fiyat Alt Limiti',
  '1.Fiyat Üst Limiti',
  '2.Fiyat Alt Limiti',
  '2.Fiyat Üst Limiti',
  '3.Fiyat Alt Limiti',
  '3.Fiyat Üst Limiti',
  '4.Fiyat Alt Limiti',
  '4.Fiyat Üst Limiti',
  '1.KOMİSYON',
  '2.KOMİSYON',
  '3.KOMİSYON',
  '4.KOMİSYON',
  'Maliyet',
  'İade Oranı',
  'KDV Oranı',
] as const;

function normalizeHeaderForMatch(s: string): string {
  return s
    .trim()
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s+/g, ' ')
    .replace(/\u0130/g, 'I')
    .replace(/\u0131/g, 'i')
    .toUpperCase()
    .replace(/\u0130/g, 'I') // Türkçe locale'de toUpperCase "i"→"İ" yapıyor; ASCII'ye çevir
    .replace(/LIMITI/g, 'LIMIT')   // "Limiti" → "Limit" (Excel bazen "Limit" yazıyor)
    .replace(/L\u0130M\u0130T\u0130/g, 'LIMIT'); // LİMİTİ → LIMIT (İ henüz I olmamışsa)
}

/** "Limit" ve "Limiti" aynı sayılır (Excel bazen Limit yazıyor). */
function normEq(a: string, b: string): boolean {
  if (a === b) return true;
  const canon = (s: string) => s.replace(/LIMITI/g, 'LIMIT');
  return canon(a) === canon(b);
}

function findHeaderKey(keys: string[], name: string): string | undefined {
  // "N.Fiyat Alt Limiti" / "N.Fiyat Üst Limiti" — Excel bazen "Limit" yazıyor; doğrudan key ara (regex/cache bağımsız)
  const numPrefix = name.match(/^(\d+)\./);
  if (numPrefix && name.includes('Fiyat') && name.includes('Limit')) {
    const num = numPrefix[1];
    const wantAlt = name.includes('Alt');
    const found = keys.find(k => {
      if (!k.startsWith(num + '.')) return false;
      const lower = k.toLowerCase().replace(/\u0130/g, 'i').replace(/\u0131/g, 'i');
      if (!lower.includes('fiyat') || !lower.includes('limit')) return false;
      return wantAlt ? lower.includes('alt') : lower.includes('üst');
    });
    if (found) return found;
  }

  const u = normalizeHeaderForMatch(name);
  let exact = keys.find(k => normalizeHeaderForMatch(k) === u);
  if (!exact) exact = keys.find(k => normEq(normalizeHeaderForMatch(k), u));
  if (exact) return exact;
  if (name === 'İade Oranı' || name === 'KDV Oranı') {
    return keys.find(k => normalizeHeaderForMatch(k).startsWith(u));
  }
  // Esnek eşleşme: "1.KOMİSYON" vb.
  const numPfx = u.match(/^(\d+)\./);
  if (numPfx) {
    const num = numPfx[1];
    const rest = u.slice(num.length + 1);
    return keys.find(k => {
      const n = normalizeHeaderForMatch(k);
      if (!n.startsWith(num + '.')) return false;
      const restParts = rest.split(/\s+/).filter(Boolean);
      const pNorm = (p: string) => p.replace(/\u0130/g, 'I');
      const nHasLimit = n.includes('LIMIT') || n.includes('L\u0130M\u0130T');
      return restParts.every(p => n.includes(p) || n.includes(pNorm(p)) || (pNorm(p) === 'LIMITI' && nHasLimit));
    });
  }
  return undefined;
}

function parseNum(v: unknown): number {
  if (typeof v === 'number' && !isNaN(v)) return v;
  const s = String(v ?? '')
    .trim()
    .replace(',', '.');
  return Number(s) || 0;
}

function getRateKey(row: KomisyonTeklifRow): string {
  return row.categorizasyon?.trim() || row.category;
}

export const TrendyolKomisyonTarifeWizard: React.FC<TrendyolKomisyonTarifeWizardProps> = ({
  settings,
  baseInputs,
  onToast,
}) => {
  const [step, setStep] = useState<Step>(1);
  const [rows, setRows] = useState<KomisyonTeklifRow[]>([]);
  const [categoryRates, setCategoryRates] = useState<CategoryRateMap>({});
  const [results, setResults] = useState<KomisyonTeklifResultItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [originalSheetRows, setOriginalSheetRows] = useState<Record<string, unknown>[]>([]);
  const [useAltLimitFallback, setUseAltLimitFallback] = useState(false);
  const [profitType, setProfitType] = useState<ProfitType>('MARGIN');
  const [komisyonIncludeOverhead, setKomisyonIncludeOverhead] = useState<boolean>(baseInputs.includeOverhead ?? true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_KOMISYON_TARIFE_STATE);
    if (saved) {
      try {
        const parsed: PersistedTarifeState = JSON.parse(saved);
        setRows(parsed.rows || []);
        setCategoryRates(parsed.categoryRates || {});
        setResults(parsed.results || []);
        setOriginalSheetRows(parsed.originalSheetRows || []);
        setUseAltLimitFallback(parsed.useAltLimitFallback ?? false);
        setKomisyonIncludeOverhead(parsed.includeOverhead ?? baseInputs.includeOverhead ?? true);
        if ((parsed.rows || []).length) setStep(3);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const data: PersistedTarifeState = {
      rows,
      categoryRates,
      results,
      originalSheetRows,
      useAltLimitFallback,
      includeOverhead: komisyonIncludeOverhead,
    };
    localStorage.setItem(STORAGE_KEY_KOMISYON_TARIFE_STATE, JSON.stringify(data));
  }, [rows, categoryRates, results, originalSheetRows, useAltLimitFallback, komisyonIncludeOverhead]);

  const uniqueCategories = useMemo(
    () => [...new Set(rows.map(r => getRateKey(r)))],
    [rows]
  );

  const handleFile = async (file: File): Promise<boolean> => {
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const json = await parseExcelToJson(buf);
      const keys = Object.keys(json[0] || {});

      // "N.Fiyat Alt/Üst Limiti" — Excel bazen "Limit" yazıyor; findHeaderKey cache sorunlarına girmeden burada eşle
      const resolveLimitKey = (name: string): string | undefined => {
        const m = name.match(/^(\d+)\./);
        if (!m || !name.includes('Fiyat') || !name.includes('Limit')) return undefined;
        const num = m[1];
        const wantAlt = name.includes('Alt');
        return keys.find(k => {
          if (!k.startsWith(num + '.')) return false;
          const lower = k.toLowerCase().replace(/\u0130/g, 'i').replace(/\u0131/g, 'i');
          return lower.includes('fiyat') && lower.includes('limit') && (wantAlt ? lower.includes('alt') : lower.includes('üst'));
        });
      };

      const headerToKey: Record<string, string | undefined> = {};
      for (const h of TRENDYOL_HEADERS) {
        headerToKey[h] = findHeaderKey(keys, h) ?? resolveLimitKey(h);
      }

      const missing: string[] = [];
      const matchResults: Record<string, string | null> = {};
      for (const h of TRENDYOL_HEADERS) {
        const found = headerToKey[h];
        matchResults[h] = found ?? null;
        const isLimitHeader = h.includes('Fiyat') && h.includes('Limit');
        if (!found && !isLimitHeader) missing.push(h);
      }

      if (missing.length) {
        onToast(`Eksik kolonlar: ${missing.join(', ')}`);
        setLoading(false);
        return false;
      }

      const get = (row: Record<string, unknown>, header: string) =>
        row[headerToKey[header]!];

      const kategorizasyonKey = findHeaderKey(keys, 'Kategorizasyon');

      const newWarnings: string[] = [];
      const parsedRows: KomisyonTeklifRow[] = [];
      json.forEach((row, idx) => {
        const sellerStockCode = String(get(row, 'SATICI STOK KODU')).trim();
        const modelCode = String(get(row, 'MODEL KODU')).trim();
        const category = String(get(row, 'KATEGORİ')).trim();
        const categorizasyonRaw = kategorizasyonKey
          ? String(row[kategorizasyonKey] ?? '').trim()
          : '';
        const categorizasyon = categorizasyonRaw || undefined;
        const cost = parseNum(get(row, 'Maliyet'));
        const returnRate = parseNum(get(row, 'İade Oranı'));
        const kdvRate = parseNum(get(row, 'KDV Oranı'));

        if (!sellerStockCode || !category || cost <= 0) {
          newWarnings.push(`Satır ${idx + 2}: Satıcı Stok Kodu/Kategori/Maliyet eksik`);
          return;
        }
        if (isNaN(returnRate) || isNaN(kdvRate)) {
          newWarnings.push(`Satır ${idx + 2}: İade/KDV oranı eksik, satır atlandı`);
          return;
        }

        const tier1UpperKey = headerToKey['1.Fiyat Üst Limiti'];
        const offers: TrendyolOffer[] = [
          {
            priceLower: parseNum(get(row, '1.Fiyat Alt Limiti')),
            priceUpper: tier1UpperKey ? parseNum(row[tier1UpperKey]) : 1e9,
            commissionRate: parseNum(get(row, '1.KOMİSYON')),
          },
          {
            priceLower: parseNum(get(row, '2.Fiyat Alt Limiti')),
            priceUpper: parseNum(get(row, '2.Fiyat Üst Limiti')),
            commissionRate: parseNum(get(row, '2.KOMİSYON')),
          },
          {
            priceLower: parseNum(get(row, '3.Fiyat Alt Limiti')),
            priceUpper: parseNum(get(row, '3.Fiyat Üst Limiti')),
            commissionRate: parseNum(get(row, '3.KOMİSYON')),
          },
          {
            priceLower: parseNum(get(row, '4.Fiyat Alt Limiti')),
            priceUpper: parseNum(get(row, '4.Fiyat Üst Limiti')),
            commissionRate: parseNum(get(row, '4.KOMİSYON')),
          },
        ];

        parsedRows.push({
          sellerStockCode,
          modelCode,
          category,
          categorizasyon,
          cost,
          returnRate,
          kdvRate,
          offers,
        });
      });

      if (!parsedRows.length) {
        onToast('Geçerli satır bulunamadı.');
        setWarnings(newWarnings);
        setLoading(false);
        return false;
      }

      const newRates: CategoryRateMap = {};
      parsedRows.forEach(r => {
        const rateKey = r.categorizasyon?.trim() || r.category;
        if (!newRates[rateKey]) {
          newRates[rateKey] = {
            category: rateKey,
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
      setOriginalSheetRows(json);
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

  const handleCompute = () => {
    if (!rows.length) {
      onToast('Önce dosya yükleyin.');
      return;
    }

    const computed: KomisyonTeklifResultItem[] = rows.map(row => {
      const rateKey = getRateKey(row);
      const catRate = categoryRates[rateKey] ?? {
        category: rateKey,
        targetProfitRate: baseInputs.targetProfitRate,
        sabitFiyatTargetProfitRate: baseInputs.sabitFiyatTargetProfitRate,
        discountRate: baseInputs.discountRate,
        influencerCommissionRate: baseInputs.influencerCommissionRate,
      };
      const targetProfitRate = catRate.targetProfitRate;

      const inputs: CalculationInputs = {
        ...baseInputs,
        profitType,
        includeOverhead: komisyonIncludeOverhead,
        productCostExKdv: row.cost,
        productKdvRate: row.kdvRate,
        returnRate: row.returnRate,
        targetProfitRate,
        discountRate: 0,
        influencerCommissionRate: 0,
        influencerChannels: [],
        includeInfluencerInProfit: false,
      };

      type Candidate = { offerIndex: number; price: number; commissionRate: number; profitRate: number };
      const candidates: Candidate[] = [];

      // Normal TY komisyon oranı — bu oran zaten mevcut fiyatlamada kullanılıyor, teklife gerek yok
      const normalTyCommission = settings.find(s => s.key === 'tyCommission')?.value ?? 0;

      for (let i = 0; i < row.offers.length; i++) {
        const offer = row.offers[i];
        if (i === 0) continue; // Teklif 1 seçilmez — sadece indirimli teklifler (2,3,4) kabul edilir
        if (offer.commissionRate <= 0 || offer.priceUpper <= 0) continue;
        if (offer.commissionRate >= normalTyCommission) continue;

        const { price: idealPrice } = calculatePriceForTargetProfit(
          inputs,
          settings,
          offer.commissionRate,
          targetProfitRate
        );

        let priceToUse: number;
        const effectiveLower = offer.priceLower > 0 ? offer.priceLower : 0;

        if (useAltLimitFallback) {
          // Checkbox açık: her zaman üst limiti kullan → en düşük komisyon, en yüksek fiyat, kâr hedefin üstünde
          priceToUse = offer.priceUpper;
        } else if (idealPrice >= effectiveLower && idealPrice <= offer.priceUpper) {
          // Checkbox kapalı: ideal fiyat aralığa sığıyor → tam hedef kâr
          priceToUse = idealPrice;
        } else {
          continue;
        }

        const { profitRate } = calculateProfitForGivenPriceAndCommission(
          inputs,
          settings,
          priceToUse,
          offer.commissionRate
        );

        if (profitRate >= targetProfitRate - 0.001) {
          candidates.push({
            offerIndex: i,
            price: priceToUse,
            commissionRate: offer.commissionRate,
            profitRate,
          });
        }
      }

      if (candidates.length === 0) {
        return {
          sellerStockCode: row.sellerStockCode,
          modelCode: row.modelCode,
          category: rateKey,
          targetProfitRate,
          acceptedOfferIndex: null,
          acceptedPrice: null,
          acceptedCommissionRate: null,
          netProfit: null,
          profitRate: null,
        };
      }

      candidates.sort((a, b) => a.price - b.price);
      const best = candidates[0];
      const { netProfit } = calculateProfitForGivenPriceAndCommission(
        inputs,
        settings,
        best.price,
        best.commissionRate
      );

      return {
        sellerStockCode: row.sellerStockCode,
        modelCode: row.modelCode,
        category: rateKey,
        targetProfitRate,
        acceptedOfferIndex: best.offerIndex,
        acceptedPrice: best.price,
        acceptedCommissionRate: best.commissionRate,
        netProfit,
        profitRate: best.profitRate,
      };
    });

    setResults(computed);
    setStep(3);
    onToast('Hesaplama tamamlandı.');
  };

  const handleExport = () => {
    if (!results.length) {
      onToast('Önce hesaplama yapın.');
      return;
    }
    exportKomisyonTarifeToExcel(originalSheetRows, results, rows);
    onToast('Excel indirildi.');
  };

  const resetAll = () => {
    setRows([]);
    setCategoryRates({});
    setResults([]);
    setOriginalSheetRows([]);
    setStep(1);
    onToast('Temizlendi.');
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Trendyol komisyon tarifesi XLSX dosyasını yükleyin. Zorunlu kolonlar: Satıcı Stok Kodu, Model Kodu, Kategori, 1.–4. Fiyat Alt/Üst Limiti, 1.–4. KOMİSYON, Maliyet, İade Oranı, KDV Oranı. Kategorizasyon (isteğe bağlı; hedef kâr buna göre verilir).
            </p>
            <input
              type="file"
              accept=".xlsx"
              onChange={async e => {
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
              Hedef kâr verilecek gruba göre Hedef Kâr Oranı (%) girin. Grup: Kategorizasyon varsa Kategorizasyon, yoksa Trendyol Kategori.
            </p>
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">
              <div className="overflow-auto overflow-touch overscroll-contain max-h-[min(350px,45vh)] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-300">
              <div className="grid grid-cols-2 gap-4 min-w-[280px] bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600 sticky top-0 z-10">
                <div>Kategorizasyon / Kategori</div>
                <div>Hedef Kâr Oranı (%)</div>
              </div>
              <div className="divide-y divide-slate-100">
                {uniqueCategories.map(cat => {
                  const rate = categoryRates[cat] ?? {
                    category: cat,
                    targetProfitRate: baseInputs.targetProfitRate,
                    sabitFiyatTargetProfitRate: baseInputs.sabitFiyatTargetProfitRate,
                    discountRate: baseInputs.discountRate,
                    influencerCommissionRate: baseInputs.influencerCommissionRate,
                  };
                  return (
                    <div
                      key={cat}
                      className="grid grid-cols-2 gap-4 px-4 py-3 items-center bg-white hover:bg-slate-50"
                    >
                      <div className="text-sm font-semibold text-slate-800 truncate">{cat}</div>
                      <input
                        type="number"
                        value={rate.targetProfitRate != null ? String(rate.targetProfitRate) : ''}
                        onChange={e =>
                          handleRateChange(cat, 'targetProfitRate', parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded-lg border-slate-300 text-sm py-2 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                      />
                    </div>
                  );
                })}
              </div>
              </div>
            </div>
            <div className="mt-4 bg-white rounded-xl p-4 md:p-6 shadow-sm border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-800 mb-4">Hesaplama Ayarları</h4>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
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
                        aria-checked={komisyonIncludeOverhead}
                        onClick={() => setKomisyonIncludeOverhead(!komisyonIncludeOverhead)}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                          komisyonIncludeOverhead ? 'bg-brand-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            komisyonIncludeOverhead ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="ml-3 text-sm text-slate-900">Dahil</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useAltLimitFallback"
                    checked={useAltLimitFallback}
                    onChange={e => setUseAltLimitFallback(e.target.checked)}
                    className="h-4 w-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                  />
                  <label htmlFor="useAltLimitFallback" className="ml-2 text-sm text-slate-700">
                    Hedef aralığa uymuyorsa Üst Limiti kullan (komisyon indirimini al, kâr hedefin üstünde olabilir)
                  </label>
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
                onClick={handleExport}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-emerald-600 text-white rounded-md text-sm hover:bg-emerald-700"
              >
                XLSX indir
              </button>
              <button
                onClick={resetAll}
                className="min-h-[44px] px-4 py-3 md:py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
              >
                Yeni yükle
              </button>
            </div>
            <div className="overflow-auto overflow-touch overscroll-contain max-h-[min(450px,55vh)] border border-slate-200 rounded-lg bg-white [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-300">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Stok Kodu</th>
                    <th className="px-3 py-2 text-left">Model</th>
                    <th className="px-3 py-2 text-left">Grup (hedef kâr)</th>
                    <th className="px-3 py-2 text-right">Hedef %</th>
                    <th className="px-3 py-2 text-right">YENİ TSF</th>
                    <th className="px-3 py-2 text-right">Komisyon %</th>
                    <th className="px-3 py-2 text-right">Net Kâr</th>
                    <th className="px-3 py-2 text-right">Kâr %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2 text-slate-800">{item.sellerStockCode}</td>
                      <td className="px-3 py-2 text-slate-600">{item.modelCode}</td>
                      <td className="px-3 py-2 text-slate-600">{item.category}</td>
                      <td className="px-3 py-2 text-right">{item.targetProfitRate.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800">
                        {item.acceptedPrice != null
                          ? item.acceptedPrice.toFixed(2).replace('.', ',')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {item.acceptedCommissionRate != null
                          ? item.acceptedCommissionRate.toFixed(2).replace('.', ',')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700">
                        {item.netProfit != null
                          ? item.netProfit.toFixed(2).replace('.', ',')
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-700">
                        {item.profitRate != null ? `%${item.profitRate.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-brand-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Trendyol Komisyon Tarifeleri</h2>
            <p className="text-sm text-slate-500">
              Liste yükle, kategorilere hedef kâr ver, en uygun teklifi seçtir ve X/Y doldurulmuş Excel indir.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {([1, 2, 3] as const).map(s => (
            <span
              key={s}
              className={`px-2 py-1 rounded-full ${
                step === s ? 'bg-brand-100 text-brand-700 font-semibold' : 'bg-slate-100'
              }`}
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
              onClick={() => setStep(prev => (prev === 1 ? 1 : ((prev - 1) as Step)))}
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
              onClick={() => setStep(prev => (prev === 1 ? 1 : ((prev - 1) as Step)))}
              className="min-h-[44px] px-4 py-3 md:py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200"
            >
              Geri
            </button>
          )}
          {step === 1 && (
            <button
              disabled={loading}
              onClick={() => rows.length && setStep(2)}
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
    </section>
  );
};
