import {
  CalculationInputs,
  ChannelResult,
  CostSetting,
  KdvMode,
  ChannelKey,
  DiscountScenarioOutcome,
  DiscountScenarioSet,
} from '../types';

// Helper: Convert to KDV Included
export const toKdvDahil = (value: number, mode: KdvMode | undefined, rate: number | undefined): number => {
  if (value === 0) return 0;
  const effectiveRate = rate ?? 20; // Default to 20 if undefined
  if (mode === 'DAHIL') {
    return value;
  }
  return value * (1 + effectiveRate / 100);
};

// Helper: Rounding Rule (Ends in X9.99)
// Ex: 87.99 -> 89.99, 102.50 -> 109.99
export const roundPrice = (price: number): number => {
  if (price <= 0) return 0;
  // ceil(price / 10) * 10 - 0.01
  return Math.ceil(price / 10) * 10 - 0.01;
};

// --- Shared cost model ---
// Costs that do not depend on the channel, computed once per product.

interface PackagingDetails {
  box: number;
  card: number;
  bag: number;
  tape: number;
  ambalajBag: number;
}

interface CommonCosts {
  productCost: number;
  packExpected: number;
  packagingDetails: PackagingDetails;
  invoiceMarketplace: number;
  invoiceSite: number;
  platformFeeVal: number;
  shipExpMarketplace: number;
  shipExpSite: number;
  shipExpPazarama: number;
}

function computeCommonCosts(inputs: CalculationInputs, settings: CostSetting[]): CommonCosts {
  const getSetting = (key: string) => settings.find(s => s.key === key)!;
  const r = inputs.returnRate / 100;

  // Product Cost
  let productCost = inputs.productCostExKdv * (1 + inputs.productKdvRate / 100);
  if (inputs.includeOverhead) {
    const fgRate = getSetting('fgRate').value;
    productCost = productCost * (1 + fgRate / 100);
  }

  // Packaging (Expected with Returns)
  const boxS = getSetting('box');
  const cardS = getSetting('card');
  const bagS = getSetting('bag');
  const tapeS = getSetting('tape');
  const ambalajBagS = getSetting('ambalajBag');

  const box = toKdvDahil(boxS.value, boxS.kdvMode, boxS.kdvRate);
  const card = toKdvDahil(cardS.value, cardS.kdvMode, cardS.kdvRate);
  const bag = toKdvDahil(bagS.value, bagS.kdvMode, bagS.kdvRate);
  const tape = toKdvDahil(tapeS.value, tapeS.kdvMode, tapeS.kdvRate);
  const ambalajBag = toKdvDahil(ambalajBagS.value, ambalajBagS.kdvMode, ambalajBagS.kdvRate);

  const packTotal = box + card + bag + tape + ambalajBag;
  // packExpected = (pack * 100) / (100 - iadeOrani) = pack / (1 - r)
  const packExpected = r >= 1 ? 999999 : packTotal / (1 - r);

  // E-Invoice
  const invMpS = getSetting('invoiceMp');
  const invSiteS = getSetting('invoiceSite');

  // Platform Fee
  const platS = getSetting('platformFee');

  // Shipping Helper
  const calcShippingExpected = (shipKey: string, retShipKey: string | null) => {
    const sVal = getSetting(shipKey);
    const cost = toKdvDahil(sVal.value, sVal.kdvMode, sVal.kdvRate);

    let retCost = cost;
    if (retShipKey) {
      const rsVal = getSetting(retShipKey);
      retCost = toKdvDahil(rsVal.value, rsVal.kdvMode, rsVal.kdvRate);
    }

    if (r >= 1) return 999999;
    return (cost + retCost * r) / (1 - r);
  };

  return {
    productCost,
    packExpected,
    packagingDetails: { box, card, bag, tape, ambalajBag },
    invoiceMarketplace: toKdvDahil(invMpS.value, invMpS.kdvMode, invMpS.kdvRate),
    invoiceSite: toKdvDahil(invSiteS.value, invSiteS.kdvMode, invSiteS.kdvRate),
    platformFeeVal: toKdvDahil(platS.value, platS.kdvMode, platS.kdvRate),
    shipExpMarketplace: calcShippingExpected('marketplaceShip', 'marketplaceRetShip'),
    shipExpSite: calcShippingExpected('siteShip', null), // Usually returns are same for site or defined simply
    shipExpPazarama: calcShippingExpected('pazaramaShip', 'pazaramaShip'), // Pazarama için giden ve iade kargo aynı
  };
}

export interface ChannelCostProfile {
  channelKey: ChannelKey;
  commissionRate: number;
  fixedCosts: number;
  shippingTotal: number;
  packagingTotal: number;
  packagingDetails: PackagingDetails;
  productCostTotal: number;
  platformFee: number;
  invoiceCost: number;
}

function profileFromCommon(
  common: CommonCosts,
  settings: CostSetting[],
  channelKey: ChannelKey
): ChannelCostProfile {
  const getSetting = (key: string) => settings.find(s => s.key === key)!;

  let commissionRate = 0;
  let invoiceCost = 0;
  let shippingTotal = 0;
  let platformFee = 0;

  switch (channelKey) {
    case 'TY':
      commissionRate = getSetting('tyCommission').value;
      invoiceCost = common.invoiceMarketplace;
      shippingTotal = common.shipExpMarketplace;
      platformFee = common.platformFeeVal;
      break;
    case 'HB':
      commissionRate = getSetting('hbCommission').value;
      invoiceCost = common.invoiceSite; // HB için e-fatura site fiyatından
      shippingTotal = common.shipExpMarketplace;
      platformFee = 0; // HB has no platform fee
      break;
    case 'SITE':
      commissionRate = getSetting('sitePos').value;
      invoiceCost = common.invoiceSite;
      shippingTotal = common.shipExpSite;
      platformFee = 0;
      break;
    case 'PAZARAMA':
      commissionRate = getSetting('pazaramaCommission').value;
      invoiceCost = common.invoiceSite; // Pazarama için e-fatura site fiyatından
      shippingTotal = common.shipExpPazarama;
      platformFee = 0; // Usually no per-transaction fee, just comm
      break;
    case 'SABIT_FIYAT':
      // Sabit Fiyat: Trendyol ile aynı hesaplama mantığı
      commissionRate = getSetting('tyCommission').value;
      invoiceCost = common.invoiceMarketplace;
      shippingTotal = common.shipExpMarketplace;
      platformFee = common.platformFeeVal;
      break;
  }

  return {
    channelKey,
    commissionRate,
    fixedCosts: shippingTotal + common.productCost + common.packExpected + invoiceCost + platformFee,
    shippingTotal,
    packagingTotal: common.packExpected,
    packagingDetails: common.packagingDetails,
    productCostTotal: common.productCost,
    platformFee,
    invoiceCost,
  };
}

/** Bir kanalın komisyon oranı ve fiyattan bağımsız sabit giderleri. */
export function getChannelCostProfile(
  inputs: CalculationInputs,
  settings: CostSetting[],
  channelKey: ChannelKey
): ChannelCostProfile {
  return profileFromCommon(computeCommonCosts(inputs, settings), settings, channelKey);
}

// Main Calculation Logic
export const calculateAllChannels = (
  inputs: CalculationInputs,
  settings: CostSetting[],
  activeChannels: ChannelKey[]
): ChannelResult[] => {
  const common = computeCommonCosts(inputs, settings);
  const results: ChannelResult[] = [];

  // Process each channel (Order: Web, TY, HB, Pazarama, Sabit Fiyat)
  const channelsToProcess: { key: ChannelKey; name: string }[] = [
    { key: 'SITE', name: 'Web' },
    { key: 'TY', name: 'Trendyol' },
    { key: 'HB', name: 'Hepsiburada' },
    { key: 'PAZARAMA', name: 'Pazarama' },
    { key: 'SABIT_FIYAT', name: 'Sabit Fiyat' },
  ];

  channelsToProcess.forEach(ch => {
    if (!activeChannels.includes(ch.key)) return;

    const profile = profileFromCommon(common, settings, ch.key);
    const { commissionRate, fixedCosts } = profile;

    // Solve for Price
    let rawPrice = 0;
    let error: string | undefined = undefined;

    const commDecimal = commissionRate / 100;
    // Sabit Fiyat için ayrı kar oranı kullan
    const target = ch.key === 'SABIT_FIYAT'
      ? inputs.sabitFiyatTargetProfitRate / 100
      : inputs.targetProfitRate / 100;

    if (inputs.profitType === 'MARGIN') {
      // Price = Fixed / (1 - Comm - TargetMargin)
      const denominator = (1 - commDecimal) - target;
      if (denominator <= 0) {
        error = "Hedef kâr bu komisyon oranıyla imkansız.";
        rawPrice = 0;
      } else {
        rawPrice = fixedCosts / denominator;
      }
    } else {
      // MARKUP
      // TargetNet = Fixed * (1 + TargetMarkup)
      // Price = TargetNet / (1 - Comm)
      const targetNet = fixedCosts * (1 + target);
      if (commDecimal >= 1) {
         error = "Komisyon %100 veya daha fazla olamaz.";
         rawPrice = 0;
      } else {
        rawPrice = targetNet / (1 - commDecimal);
      }
    }

    // Rounding
    let baseSalePrice = error ? 0 : roundPrice(rawPrice);
    let finalSalePrice = baseSalePrice;

    // Apply Influencer Commission (only to selected channels)
    let influencerCommissionAmount = 0;
    const influencerChannels = inputs.influencerChannels || [];
    if (!error && inputs.influencerCommissionRate > 0 && influencerChannels.includes(ch.key)) {
      // Apply influencer commission to price first
      finalSalePrice = baseSalePrice * (1 + inputs.influencerCommissionRate / 100);
      // Round after influencer commission
      finalSalePrice = roundPrice(finalSalePrice);
      // Calculate influencer commission amount from final price (after rounding)
      influencerCommissionAmount = finalSalePrice * (inputs.influencerCommissionRate / 100);
    }

    // Discount Calculation
    let finalListPrice: number | null = null;
    if (!error && inputs.discountRate > 0) {
      // ListPrice = SalePrice / (1 - discount/100)
      const discountDec = inputs.discountRate / 100;
      if (discountDec < 1) {
        finalListPrice = roundPrice(finalSalePrice / (1 - discountDec));
      }
    }

    // Breakdown Calculation based on Final Price
    const commissionAmount = finalSalePrice * commDecimal;
    const netAfterCommission = finalSalePrice - commissionAmount;

    // Calculate net profit: if includeInfluencerInProfit is true, subtract influencer commission from profit
    let netProfit: number;
    if (inputs.includeInfluencerInProfit && influencerCommissionAmount > 0) {
      netProfit = finalSalePrice - commissionAmount - influencerCommissionAmount - fixedCosts;
    } else {
      netProfit = finalSalePrice - commissionAmount - fixedCosts;
    }

    let calculatedProfitRate = 0;
    if (!error && finalSalePrice > 0) {
        if (inputs.profitType === 'MARGIN') {
            calculatedProfitRate = (netProfit / finalSalePrice) * 100;
        } else {
            calculatedProfitRate = (netProfit / fixedCosts) * 100;
        }
    }

    results.push({
      channelKey: ch.key,
      channelName: ch.name,
      salePrice: finalSalePrice,
      listPrice: finalListPrice,
      netProfit,
      profitRate: calculatedProfitRate,
      breakdown: {
        commissionAmount,
        netAfterCommission,
        shippingTotal: profile.shippingTotal,
        packagingTotal: profile.packagingTotal,
        packagingDetails: profile.packagingDetails,
        productCostTotal: profile.productCostTotal,
        platformFee: profile.platformFee,
        invoiceCost: profile.invoiceCost,
        influencerCommissionAmount,
      },
      error
    });
  });

  return results;
};

// --- İndirim senaryoları: verilen fiyattan kâr (ters yön) ---
// calculateAllChannels maliyetten fiyat üretir; burada fiyat verilir, kalan kâr bulunur.

/** Verilen satış fiyatı için net kâr ve kâr oranı. */
export function calculateProfitAtPrice(
  profile: ChannelCostProfile,
  price: number,
  profitType: CalculationInputs['profitType']
): { commissionAmount: number; netProfit: number; profitRate: number } {
  const commissionAmount = price * (profile.commissionRate / 100);
  const netProfit = price - commissionAmount - profile.fixedCosts;

  let profitRate = 0;
  if (profitType === 'MARGIN') {
    profitRate = price > 0 ? (netProfit / price) * 100 : 0;
  } else {
    profitRate = profile.fixedCosts > 0 ? (netProfit / profile.fixedCosts) * 100 : 0;
  }

  return { commissionAmount, netProfit, profitRate };
}

/**
 * Bir ürünün mevcut satış fiyatına ardışık indirim oranları uygulayıp kalan kârı hesaplar.
 * İndirim satış fiyatı üzerinden uygulanır: yeniFiyat = fiyat * (1 - indirim/100)
 */
export function calculateDiscountScenarios(
  inputs: CalculationInputs,
  settings: CostSetting[],
  channelKey: ChannelKey,
  basePrice: number,
  discountRates: number[]
): DiscountScenarioSet {
  const profile = getChannelCostProfile(inputs, settings, channelKey);

  const outcome = (discountRate: number): DiscountScenarioOutcome => {
    const price = basePrice * (1 - discountRate / 100);
    const { commissionAmount, netProfit, profitRate } = calculateProfitAtPrice(profile, price, inputs.profitType);
    return { discountRate, price, commissionAmount, netProfit, profitRate };
  };

  // Kâr sıfırlanana kadar uygulanabilecek en yüksek indirim:
  // price*(1-d)*(1-comm) - fixed = 0  =>  d = 1 - fixed / (price * (1-comm))
  const netMultiplier = 1 - profile.commissionRate / 100;
  const breakEvenDiscountRate =
    basePrice > 0 && netMultiplier > 0
      ? (1 - profile.fixedCosts / (basePrice * netMultiplier)) * 100
      : null;

  return {
    channelKey,
    commissionRate: profile.commissionRate,
    fixedCosts: profile.fixedCosts,
    base: outcome(0),
    scenarios: discountRates.map(outcome),
    breakEvenDiscountRate,
  };
}

// --- Trendyol Komisyon Tarifeleri: TY giderleri ile hesaplama (indirim/influencer yok) ---

function getTrendyolFixedCosts(inputs: CalculationInputs, settings: CostSetting[]): number {
  return getChannelCostProfile(inputs, settings, 'TY').fixedCosts;
}

export interface ProfitForPriceResult {
  netProfit: number;
  profitRate: number;
  fixedCosts: number;
  commissionAmount: number;
}

export function calculateProfitForGivenPriceAndCommission(
  inputs: CalculationInputs,
  settings: CostSetting[],
  salePrice: number,
  commissionRate: number
): ProfitForPriceResult {
  const fixedCosts = getTrendyolFixedCosts(inputs, settings);
  const commissionAmount = salePrice * (commissionRate / 100);
  const netProfit = salePrice - commissionAmount - fixedCosts;
  const profitRate =
    inputs.profitType === 'MARGIN'
      ? (salePrice > 0 ? (netProfit / salePrice) * 100 : 0)
      : (netProfit / fixedCosts) * 100;
  return { netProfit, profitRate, fixedCosts, commissionAmount };
}

export interface PriceForTargetResult {
  price: number;
  error?: string;
}

export function calculatePriceForTargetProfit(
  inputs: CalculationInputs,
  settings: CostSetting[],
  commissionRate: number,
  targetProfitRate: number
): PriceForTargetResult {
  const fixedCosts = getTrendyolFixedCosts(inputs, settings);
  const commDecimal = commissionRate / 100;
  const target = targetProfitRate / 100;

  if (inputs.profitType === 'MARGIN') {
    const denominator = (1 - commDecimal) - target;
    if (denominator <= 0) {
      return { price: 0, error: 'Hedef kâr bu komisyon oranıyla imkansız.' };
    }
    return { price: fixedCosts / denominator };
  } else {
    const targetNet = fixedCosts * (1 + target);
    if (commDecimal >= 1) {
      return { price: 0, error: 'Komisyon %100 veya daha fazla olamaz.' };
    }
    return { price: targetNet / (1 - commDecimal) };
  }
}

// --- Modanisa & Trendyol Avrupa (TY fiyatından türetilmiş fiyatlar) ---

export interface DerivedPricesResult {
  modanisa: number;
  tyAvrupa: number;
  tyAvrupaPsf: number;
}

export function calculateDerivedPricesFromTrendyol(
  tySalePrice: number,
  settings: CostSetting[],
  _inputs: CalculationInputs
): DerivedPricesResult | null {
  if (tySalePrice <= 0 || !isFinite(tySalePrice)) return null;

  const getSetting = (key: string) => settings.find(s => s.key === key);
  const tyCommissionS = getSetting('tyCommission');
  const euroKuruS = getSetting('euroKuru');
  if (!tyCommissionS || !euroKuruS) return null;

  const tyCommission = tyCommissionS.value;
  const euroKuru = euroKuruS.value;
  if (euroKuru <= 0) return null;

  const shipVal = getSetting('marketplaceShip');
  if (!shipVal) return null;
  const tyShipCost = toKdvDahil(shipVal.value, shipVal.kdvMode, shipVal.kdvRate);

  const modanisa = Math.ceil((tySalePrice * 1.1) / 10) * 10 - 0.01;

  const netAfterComm = tySalePrice * (1 - tyCommission / 100);
  const rawTyAvrupa = ((netAfterComm - tyShipCost) * 0.9) / euroKuru;
  const tyAvrupa = Math.ceil(rawTyAvrupa * 10) / 10;

  const tyAvrupaPsf = Math.ceil((tyAvrupa * 1.8) / 5) * 5 - 0.01;

  return { modanisa, tyAvrupa, tyAvrupaPsf };
}
