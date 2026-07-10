import React, { useEffect, useMemo, useState } from 'react';
import { parseExcelToJson, findHeaderKey, getByHeader, toNumber } from '../utils/excel';
import {
  CalculationInputs,
  CostSetting,
  CHANNELS,
  ChannelKey,
  ProfitType,
  ProfitScenarioRow,
  ProfitScenarioResultItem,
} from '../types';
import { calculateDiscountScenarios } from '../utils/math';
import { exportProfitScenarioToExcel, downloadProfitScenarioTemplate } from '../utils/export';
import {
  STORAGE_KEY_PROFIT_SCENARIO_STATE,
  DEFAULT_DISCOUNT_SCENARIOS,
  DISCOUNT_CHIP_OPTIONS,
} from '../constants';

interface ProfitScenarioWizardProps {
  settings: CostSetting[];
  baseInputs: CalculationInputs;
  onToast: (msg: string) => void;
}

interface PersistedState {
  rows: ProfitScenarioRow[];
  channelKey: ChannelKey;
  discountText: string;
  includeOverhead: boolean;
  profitType: ProfitType;
}

const requiredHeaders = ['Model Kodu', 'Fiyat', 'Maliyet', 'KDV Oranı', 'İade Oranı'] as const;

/** "10, 20, 30" -> [10, 20, 30]. Virgül ayırıcı olduğu için ondalık nokta ile yazılır (12.5). */
function parseDiscountList(raw: string): number[] {
  const parts = raw.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);
  const seen = new Set<number>();
  parts.forEach(p => {
    const n = parseFloat(p.replace('%', ''));
    if (!isNaN(n) && n > 0 && n <= 100) seen.add(n);
  });
  return Array.from(seen).sort((a, b) => a - b);
}

const fmtTL = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) =>
  `%${n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

export const ProfitScenarioWizard: React.FC<ProfitScenarioWizardProps> = ({
  settings,
  baseInputs,
  onToast,
}) => {
  const [rows, setRows] = useState<ProfitScenarioRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [channelKey, setChannelKey] = useState<ChannelKey>('TY');
  const [discountText, setDiscountText] = useState(DEFAULT_DISCOUNT_SCENARIOS.join(', '));
  const [includeOverhead, setIncludeOverhead] = useState<boolean>(baseInputs.includeOverhead ?? true);
  const [profitType, setProfitType] = useState<ProfitType>(baseInputs.profitType ?? 'MARGIN');

  // Load persisted state
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_PROFIT_SCENARIO_STATE);
    if (!saved) return;
    try {
      const parsed: PersistedState = JSON.parse(saved);
      setRows(parsed.rows || []);
      if (parsed.channelKey) setChannelKey(parsed.channelKey);
      if (typeof parsed.discountText === 'string') setDiscountText(parsed.discountText);
      if (typeof parsed.includeOverhead === 'boolean') setIncludeOverhead(parsed.includeOverhead);
      if (parsed.profitType) setProfitType(parsed.profitType);
    } catch {
      // ignore
    }
  }, []);

  // Persist state
  useEffect(() => {
    const data: PersistedState = { rows, channelKey, discountText, includeOverhead, profitType };
    localStorage.setItem(STORAGE_KEY_PROFIT_SCENARIO_STATE, JSON.stringify(data));
  }, [rows, channelKey, discountText, includeOverhead, profitType]);

  const discountRates = useMemo(() => parseDiscountList(discountText), [discountText]);

  const channelLabel = CHANNELS.find(c => c.key === channelKey)?.label ?? channelKey;

  const results = useMemo<ProfitScenarioResultItem[]>(() => {
    return rows.map(row => {
      const inputs: CalculationInputs = {
        ...baseInputs,
        productCostExKdv: row.cost,
        productKdvRate: row.kdvRate,
        returnRate: row.returnRate,
        includeOverhead,
        profitType,
        // Bu ekran fiyatı verili kabul eder; hedef kâr, indirim ve influencer devre dışı.
        discountRate: 0,
        influencerCommissionRate: 0,
        influencerChannels: [],
        includeInfluencerInProfit: false,
      };
      const set = calculateDiscountScenarios(inputs, settings, channelKey, row.price, discountRates);
      return {
        ...set,
        modelCode: row.modelCode,
        cost: row.cost,
        kdvRate: row.kdvRate,
        returnRate: row.returnRate,
      };
    });
  }, [rows, baseInputs, settings, channelKey, discountRates, includeOverhead, profitType]);

  const summary = useMemo(() => {
    if (!results.length) return [];
    const columns = [
      { discountRate: 0, cells: results.map(r => r.base) },
      ...discountRates.map((d, i) => ({ discountRate: d, cells: results.map(r => r.scenarios[i]) })),
    ];
    return columns.map(col => ({
      discountRate: col.discountRate,
      totalProfit: col.cells.reduce((acc, c) => acc + c.netProfit, 0),
      lossCount: col.cells.filter(c => c.netProfit < 0).length,
    }));
  }, [results, discountRates]);

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
      const parsedRows: ProfitScenarioRow[] = [];

      json.forEach((row, idx) => {
        const lineNo = idx + 2; // başlık satırı 1
        const modelCode = String(getByHeader(row, keys, 'Model Kodu') ?? '').trim();
        const price = toNumber(getByHeader(row, keys, 'Fiyat'));
        const cost = toNumber(getByHeader(row, keys, 'Maliyet'));
        const kdvRate = toNumber(getByHeader(row, keys, 'KDV Oranı'));
        const returnRate = toNumber(getByHeader(row, keys, 'İade Oranı'));

        if (!modelCode) {
          newWarnings.push(`Satır ${lineNo}: Model Kodu boş, atlandı`);
          return;
        }
        if (isNaN(price) || price <= 0) {
          newWarnings.push(`Satır ${lineNo} (${modelCode}): Fiyat geçersiz, atlandı`);
          return;
        }
        if (isNaN(cost) || cost <= 0) {
          newWarnings.push(`Satır ${lineNo} (${modelCode}): Maliyet geçersiz, atlandı`);
          return;
        }
        if (isNaN(kdvRate) || kdvRate < 0) {
          newWarnings.push(`Satır ${lineNo} (${modelCode}): KDV Oranı geçersiz, atlandı`);
          return;
        }
        if (isNaN(returnRate) || returnRate < 0 || returnRate >= 100) {
          newWarnings.push(`Satır ${lineNo} (${modelCode}): İade Oranı 0-99 aralığında olmalı, atlandı`);
          return;
        }

        parsedRows.push({ modelCode, price, cost, kdvRate, returnRate });
      });

      if (!parsedRows.length) {
        onToast('Geçerli satır bulunamadı.');
        setWarnings(newWarnings);
        setLoading(false);
        return false;
      }

      setWarnings(newWarnings);
      setRows(parsedRows);
      onToast(`${parsedRows.length} ürün yüklendi.`);
      setLoading(false);
      return true;
    } catch (e) {
      onToast('Dosya okunamadı.');
      console.error(e);
      setLoading(false);
      return false;
    }
  };

  const toggleChip = (value: number) => {
    const current = parseDiscountList(discountText);
    const next = current.includes(value)
      ? current.filter(d => d !== value)
      : [...current, value].sort((a, b) => a - b);
    setDiscountText(next.join(', '));
  };

  const resetAll = () => {
    setRows([]);
    setWarnings([]);
    onToast('Temizlendi.');
  };

  const handleExport = async () => {
    if (!results.length) {
      onToast('Önce liste yükleyin.');
      return;
    }
    try {
      await exportProfitScenarioToExcel(results, discountRates, channelLabel, profitType);
      onToast('Excel dosyası indirildi!');
    } catch (e) {
      onToast('Excel export hatası!');
      console.error(e);
    }
  };

  const profitClass = (n: number) => (n < 0 ? 'text-rose-700 font-semibold' : 'text-emerald-700');

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6" />
              <circle cx="9.5" cy="9.5" r="1.5" />
              <circle cx="14.5" cy="14.5" r="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Toplu Kâr &amp; İndirim Senaryosu</h2>
            <p className="text-sm text-slate-500">
              Fiyat listesi yükle, indirim oranlarını gir, kalan kârı gör.
            </p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-700 font-medium mb-2">Zorunlu kolonlar</p>
            <div className="flex flex-wrap gap-2">
              {requiredHeaders.map(h => (
                <span key={h} className="px-2 py-1 rounded bg-white border border-slate-200 text-xs text-slate-700">
                  {h}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              <strong>Fiyat</strong>: ürünün mevcut satış fiyatı (KDV dahil). <strong>Maliyet</strong>: KDV hariç alış
              maliyeti. Komisyon, kargo, ambalaj, e-fatura ve platform bedeli Ayarlar'dan alınır.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="file"
              accept=".xlsx"
              disabled={loading}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (file) {
                  const ok = await handleFile(file);
                  if (!ok) e.target.value = '';
                }
              }}
              className="inline-block w-auto text-sm text-slate-700 cursor-pointer"
            />
            <button
              onClick={() => downloadProfitScenarioTemplate()}
              className="min-h-[44px] px-4 py-3 md:py-2 bg-slate-100 text-slate-700 rounded-md text-sm hover:bg-slate-200 self-start"
            >
              Örnek şablon indir
            </button>
          </div>

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
      ) : (
        <div className="space-y-5">
          {/* Kontroller */}
          <div className="bg-white rounded-xl p-4 md:p-5 border border-slate-200 shadow-sm">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Kanal</label>
                <select
                  value={channelKey}
                  onChange={e => setChannelKey(e.target.value as ChannelKey)}
                  className="block w-full rounded-lg border-slate-300 py-2.5 pl-3 pr-10 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:text-sm border bg-white text-slate-900 transition-all cursor-pointer"
                >
                  {CHANNELS.map(ch => (
                    <option key={ch.key} value={ch.key}>
                      {ch.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-1 lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  İndirim Oranları (%)
                </label>
                <input
                  type="text"
                  inputMode="text"
                  value={discountText}
                  onChange={e => setDiscountText(e.target.value)}
                  placeholder="10, 20, 30"
                  className="block w-full rounded-lg border-slate-300 text-sm py-2.5 px-3 shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 border"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {DISCOUNT_CHIP_OPTIONS.map(d => {
                    const active = discountRates.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleChip(d)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        %{d}
                      </button>
                    );
                  })}
                </div>
              </div>

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
                <div className="flex items-center mt-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeOverhead}
                    onClick={() => setIncludeOverhead(!includeOverhead)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                      includeOverhead ? 'bg-brand-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        includeOverhead ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="ml-3 text-sm text-slate-900">Firma Genel Gideri dahil</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4">
              İndirim, dosyadaki satış fiyatının üzerine uygulanır:{' '}
              <span className="font-mono">yeni fiyat = fiyat × (1 − indirim)</span>. Başabaş, kârın sıfırlandığı
              indirim oranıdır.
            </p>
          </div>

          {/* Özet */}
          {summary.length > 0 && (
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {summary.map(s => (
                <div
                  key={s.discountRate}
                  className={`rounded-lg border p-3 ${
                    s.discountRate === 0 ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <p className="text-xs font-medium text-slate-500">
                    {s.discountRate === 0 ? 'İndirimsiz' : `%${s.discountRate} indirim`}
                  </p>
                  <p className={`text-lg font-semibold mt-1 ${profitClass(s.totalProfit)}`}>
                    {fmtTL(s.totalProfit)} ₺
                  </p>
                  <p className={`text-xs mt-0.5 ${s.lossCount > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                    {s.lossCount > 0 ? `${s.lossCount} / ${results.length} ürün zararda` : 'Tümü kârda'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Aksiyonlar */}
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
            <span className="self-center text-sm text-slate-500">
              {results.length} ürün · {channelLabel} · komisyon %{results[0]?.commissionRate ?? 0}
            </span>
          </div>

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

          {/* Tablo */}
          <div className="overflow-auto overflow-touch overscroll-contain max-h-[min(520px,60vh)] border border-slate-200 rounded-lg bg-white [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-slate-300">
            <table className="min-w-full text-sm border-separate border-spacing-0">
              <thead className="text-slate-600">
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky top-0 left-0 z-30 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left"
                  >
                    Model
                  </th>
                  <th rowSpan={2} className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 px-3 py-2 text-right whitespace-nowrap">
                    Fiyat
                  </th>
                  <th rowSpan={2} className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 px-3 py-2 text-right whitespace-nowrap">
                    Maliyet
                  </th>
                  <th rowSpan={2} className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 px-3 py-2 text-right whitespace-nowrap">
                    İade %
                  </th>
                  <th rowSpan={2} className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 px-3 py-2 text-right whitespace-nowrap">
                    Sabit Gider
                  </th>
                  <th rowSpan={2} className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 px-3 py-2 text-right whitespace-nowrap">
                    Net Kâr
                  </th>
                  <th rowSpan={2} className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 px-3 py-2 text-right whitespace-nowrap">
                    Kâr %
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky top-0 z-20 bg-slate-50 border-b border-r-2 border-slate-200 px-3 py-2 text-right whitespace-nowrap"
                    title="Kârın sıfırlandığı indirim oranı"
                  >
                    Başabaş İnd. %
                  </th>
                  {discountRates.map(d => (
                    <th
                      key={d}
                      colSpan={3}
                      className="sticky top-0 z-20 bg-brand-50 text-brand-800 border-b border-l-2 border-slate-200 px-3 py-2 text-center whitespace-nowrap font-semibold"
                    >
                      %{d} indirim
                    </th>
                  ))}
                </tr>
                <tr>
                  {discountRates.map(d => (
                    <React.Fragment key={d}>
                      <th className="sticky top-[37px] z-20 bg-slate-50 border-b border-l-2 border-slate-200 px-3 py-2 text-right text-xs font-medium whitespace-nowrap">
                        Fiyat
                      </th>
                      <th className="sticky top-[37px] z-20 bg-slate-50 border-b border-slate-200 px-3 py-2 text-right text-xs font-medium whitespace-nowrap">
                        Net Kâr
                      </th>
                      <th className="sticky top-[37px] z-20 bg-slate-50 border-b border-slate-200 px-3 py-2 text-right text-xs font-medium whitespace-nowrap">
                        Kâr %
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((item, idx) => {
                  const be = item.breakEvenDiscountRate;
                  return (
                    <tr key={`${item.modelCode}-${idx}`} className="group">
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-b border-r border-slate-100 px-3 py-2 text-slate-800 font-medium whitespace-nowrap">
                        {item.modelCode}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-800">
                        {fmtTL(item.base.price)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-600">
                        {fmtTL(item.cost)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-500">
                        {fmtPct(item.returnRate)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right text-slate-600">
                        {fmtTL(item.fixedCosts)}
                      </td>
                      <td className={`border-b border-slate-100 px-3 py-2 text-right ${profitClass(item.base.netProfit)}`}>
                        {fmtTL(item.base.netProfit)}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-right text-blue-700">
                        {fmtPct(item.base.profitRate)}
                      </td>
                      <td
                        className="border-b border-r-2 border-slate-100 px-3 py-2 text-right text-slate-700"
                        title={be != null && be <= 0 ? 'Ürün indirimsiz hâlde bile zararda' : undefined}
                      >
                        {be != null && be > 0 ? fmtPct(be) : '—'}
                      </td>
                      {item.scenarios.map(s => {
                        const loss = s.netProfit < 0;
                        return (
                          <React.Fragment key={s.discountRate}>
                            <td
                              className={`border-b border-l-2 border-slate-100 px-3 py-2 text-right text-slate-700 ${
                                loss ? 'bg-rose-50' : ''
                              }`}
                            >
                              {fmtTL(s.price)}
                            </td>
                            <td
                              className={`border-b border-slate-100 px-3 py-2 text-right ${profitClass(s.netProfit)} ${
                                loss ? 'bg-rose-50' : ''
                              }`}
                            >
                              {fmtTL(s.netProfit)}
                            </td>
                            <td
                              className={`border-b border-slate-100 px-3 py-2 text-right ${
                                loss ? 'bg-rose-50 text-rose-700' : 'text-blue-700'
                              }`}
                            >
                              {fmtPct(s.profitRate)}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {discountRates.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
              Henüz indirim oranı girilmedi. Yukarıdaki kutuya <span className="font-mono">10, 20, 30</span> gibi
              oranlar yazın veya hazır rozetlerden seçin.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
