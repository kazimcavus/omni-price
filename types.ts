export type ChannelKey = 'TY' | 'HB' | 'SITE' | 'PAZARAMA' | 'SABIT_FIYAT';
export type KdvMode = 'DAHIL' | 'HARIC';
export type ProfitType = 'MARGIN' | 'MARKUP'; // MARGIN = Satıştan, MARKUP = Maliyetten

export interface CostSetting {
  key: string;
  label: string;
  value: number;
  kdvMode?: KdvMode; // Only for currency values
  kdvRate?: number;  // Only for currency values
  suffix: string;    // '%' or 'TL'
  isPercentage: boolean;
}

export interface CalculationInputs {
  productCostExKdv: number;
  productKdvRate: number;
  returnRate: number;
  targetProfitRate: number;
  sabitFiyatTargetProfitRate: number; // Ayrı kar oranı for Sabit Fiyat
  profitType: ProfitType;
  includeOverhead: boolean;
  discountRate: number; // Optional
}

// Bulk upload types
export interface UploadedRow {
  modelCode: string;
  category: string;
  cost: number;
  returnRate: number;
  kdvRate: number;
}

export interface CategoryRate {
  category: string;
  targetProfitRate: number;
  sabitFiyatTargetProfitRate: number;
  discountRate: number;
}

export type CategoryRateMap = Record<string, CategoryRate>;

export interface BulkResultItem {
  modelCode: string;
  category: string;
  cost: number;
  returnRate: number;
  kdvRate: number;
  discountRate: number;
  timestamp: number;
  results: ChannelResult[];
}

export interface CalculatedCostDetail {
  label: string;
  value: number;
}

export interface ChannelResult {
  channelKey: ChannelKey;
  channelName: string;
  salePrice: number;
  listPrice: number | null; // Null if no discount
  netProfit: number;
  profitRate: number; // Based on profitType
  breakdown: {
    commissionAmount: number;
    netAfterCommission: number;
    shippingTotal: number; // Expected (inc. returns)
    packagingTotal: number; // Expected (inc. returns)
    packagingDetails: {
      box: number;
      card: number;
      bag: number;
      tape: number;
    };
    productCostTotal: number; // Including overhead if selected
    platformFee: number;
    invoiceCost: number;
  };
  error?: string;
}

export const CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: 'SITE', label: 'Web' },
  { key: 'TY', label: 'Trendyol' },
  { key: 'HB', label: 'Hepsiburada' },
  { key: 'PAZARAMA', label: 'Pazarama' },
  { key: 'SABIT_FIYAT', label: 'Sabit Fiyat' },
];

export interface SavedPriceItem {
  id: string;
  modelCode: string;
  timestamp: number;
  discountRate: number;
  results: ChannelResult[];
}