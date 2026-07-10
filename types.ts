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
  influencerCommissionRate: number; // Influencer komisyonu
  influencerChannels: ChannelKey[]; // Influencer komisyonu hangi kanallara uygulanacak
  includeInfluencerInProfit: boolean; // Kar hesaplamasında influencer komisyonu dahil/hariç
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
  influencerCommissionRate: number;
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
  includeOverhead?: boolean;
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
      ambalajBag: number;
    };
    productCostTotal: number; // Including overhead if selected
    platformFee: number;
    invoiceCost: number;
    influencerCommissionAmount: number; // Influencer komisyonu tutarı
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

// Kâr senaryosu: fiyatı verilen ürüne indirim uygulayıp kalan kârı bulma
export interface ProfitScenarioRow {
  modelCode: string;
  price: number;   // Mevcut satış fiyatı (KDV dahil)
  cost: number;    // Maliyet (KDV hariç)
  kdvRate: number;
  returnRate: number;
}

export interface DiscountScenarioOutcome {
  discountRate: number;
  price: number;
  commissionAmount: number;
  netProfit: number;
  profitRate: number;
}

export interface DiscountScenarioSet {
  channelKey: ChannelKey;
  commissionRate: number;
  fixedCosts: number;
  base: DiscountScenarioOutcome;      // indirimsiz hâli
  scenarios: DiscountScenarioOutcome[];
  breakEvenDiscountRate: number | null; // kârın sıfırlandığı indirim oranı
}

export interface ProfitScenarioResultItem extends DiscountScenarioSet {
  modelCode: string;
  cost: number;
  kdvRate: number;
  returnRate: number;
}

export interface SavedPriceItem {
  id: string;
  modelCode: string;
  timestamp: number;
  discountRate: number;
  results: ChannelResult[];
  derivedPrices?: {
    modanisa: number;
    tyAvrupa: number;
    tyAvrupaPsf: number;
  };
}

// Trendyol Komisyon Tarifeleri (4 teklif: aralık + komisyon)
export interface TrendyolOffer {
  priceLower: number;
  priceUpper: number;
  commissionRate: number;
}

export interface KomisyonTeklifRow {
  sellerStockCode: string;
  modelCode: string;
  category: string; // Trendyol KATEGORİ (F)
  categorizasyon?: string; // Opsiyonel; hedef kâr buna göre verilir (örn. ANEW-20)
  cost: number;
  returnRate: number;
  kdvRate: number;
  offers: TrendyolOffer[];
}

export interface KomisyonTeklifResultItem {
  sellerStockCode: string;
  modelCode: string;
  category: string;
  targetProfitRate: number;
  acceptedOfferIndex: number | null;
  acceptedPrice: number | null;
  acceptedCommissionRate: number | null;
  netProfit: number | null;
  profitRate: number | null;
}