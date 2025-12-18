import { CostSetting } from './types';

export const DEFAULT_SETTINGS: CostSetting[] = [
  // Oranlar
  { key: 'fgRate', label: 'Firma Genel Gider Oranı', value: 30, suffix: '%', isPercentage: true },
  { key: 'tyCommission', label: 'Trendyol Komisyon', value: 21.5, suffix: '%', isPercentage: true },
  { key: 'hbCommission', label: 'Hepsiburada Komisyon', value: 18, suffix: '%', isPercentage: true },
  { key: 'sitePos', label: 'Site Sanal POS', value: 3, suffix: '%', isPercentage: true },
  { key: 'pazaramaCommission', label: 'Pazarama Komisyon', value: 12, suffix: '%', isPercentage: true },

  // TL Kalemleri (Hizmet Bedelleri)
  { key: 'platformFee', label: 'Platform Hizmet Bedeli (Trendyol)', value: 10.2, suffix: 'TL', isPercentage: false, kdvMode: 'DAHIL', kdvRate: 20 },
  
  // Kargo
  { key: 'marketplaceShip', label: 'Trendyol Kargo', value: 81.08, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },
  { key: 'marketplaceRetShip', label: 'Trendyol İade Kargo', value: 99.99, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },
  { key: 'siteShip', label: 'Site Kargo', value: 118.9, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },
  { key: 'pazaramaShip', label: 'Pazarama Kargo', value: 140.69, suffix: 'TL', isPercentage: false, kdvMode: 'DAHIL', kdvRate: 20 },

  // Ambalaj
  { key: 'box', label: 'Kutu', value: 12.75, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },
  { key: 'card', label: 'Teşekkür Kartı', value: 1.2, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },
  { key: 'bag', label: 'Kutu Poşeti', value: 2.6, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },
  { key: 'tape', label: 'İade Emniyet Şeridi', value: 7.5, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },

  // E-Fatura
  { key: 'invoiceMp', label: 'e-Fatura (Pazaryeri)', value: 0.19, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },
  { key: 'invoiceSite', label: 'e-Fatura (Site)', value: 1.2, suffix: 'TL', isPercentage: false, kdvMode: 'HARIC', kdvRate: 20 },
];

export const STORAGE_KEY_SETTINGS = 'sales_price_calc_settings_v1';
export const STORAGE_KEY_INPUTS = 'sales_price_calc_inputs_v1';
export const STORAGE_KEY_CHANNELS = 'sales_price_calc_channels_v1';