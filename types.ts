export type ChannelKey = 'TY' | 'HB' | 'SITE' | 'PAZARAMA';
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
  profitType: ProfitType;
  includeOverhead: boolean;
  discountRate: number; // Optional
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
];