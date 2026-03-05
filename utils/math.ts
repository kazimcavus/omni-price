import { CalculationInputs, ChannelResult, CostSetting, KdvMode, ChannelKey } from '../types';

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

// Main Calculation Logic
export const calculateAllChannels = (
  inputs: CalculationInputs,
  settings: CostSetting[],
  activeChannels: ChannelKey[]
): ChannelResult[] => {
  
  // 1. Map settings for easy access
  const getSetting = (key: string) => settings.find(s => s.key === key)!;

  // 2. Common Calculations
  const r = inputs.returnRate / 100;

  // Product Cost
  let productCost = inputs.productCostExKdv * (1 + inputs.productKdvRate / 100);
  if (inputs.includeOverhead) {
    const fgRate = getSetting('fgRate').value;
    productCost = productCost * (1 + fgRate / 100);
  }

  // Packaging (Expected with Returns)
  // Get Raw KDV Included Values
  const boxS = getSetting('box');
  const cardS = getSetting('card');
  const bagS = getSetting('bag');
  const tapeS = getSetting('tape');
  const ambalajBagS = getSetting('ambalajBag');

  const boxKD = toKdvDahil(boxS.value, boxS.kdvMode, boxS.kdvRate);
  const cardKD = toKdvDahil(cardS.value, cardS.kdvMode, cardS.kdvRate);
  const bagKD = toKdvDahil(bagS.value, bagS.kdvMode, bagS.kdvRate);
  const tapeKD = toKdvDahil(tapeS.value, tapeS.kdvMode, tapeS.kdvRate);
  const ambalajBagKD = toKdvDahil(ambalajBagS.value, ambalajBagS.kdvMode, ambalajBagS.kdvRate);

  const packTotal = boxKD + cardKD + bagKD + tapeKD + ambalajBagKD;
  // packExpected = (pack * 100) / (100 - iadeOrani) = pack / (1 - r)
  const packExpected = r >= 1 ? 999999 : packTotal / (1 - r);

  // E-Invoice
  const invMpS = getSetting('invoiceMp');
  const invSiteS = getSetting('invoiceSite');
  const invoiceMarketplace = toKdvDahil(invMpS.value, invMpS.kdvMode, invMpS.kdvRate);
  const invoiceSite = toKdvDahil(invSiteS.value, invSiteS.kdvMode, invSiteS.kdvRate);

  // Platform Fee
  const platS = getSetting('platformFee');
  const platformFeeVal = toKdvDahil(platS.value, platS.kdvMode, platS.kdvRate);

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

  const shipExpMarketplace = calcShippingExpected('marketplaceShip', 'marketplaceRetShip');
  const shipExpSite = calcShippingExpected('siteShip', null); // Usually returns are same for site or defined simply
  const shipExpPazarama = calcShippingExpected('pazaramaShip', 'pazaramaShip'); // Pazarama için giden ve iade kargo aynı

  const results: ChannelResult[] = [];

  // 3. Process each channel (Order: Web, TY, HB, Pazarama, Sabit Fiyat)
  const channelsToProcess: { key: ChannelKey; name: string }[] = [
    { key: 'SITE', name: 'Web' },
    { key: 'TY', name: 'Trendyol' },
    { key: 'HB', name: 'Hepsiburada' },
    { key: 'PAZARAMA', name: 'Pazarama' },
    { key: 'SABIT_FIYAT', name: 'Sabit Fiyat' },
  ];

  channelsToProcess.forEach(ch => {
    if (!activeChannels.includes(ch.key)) return;

    let commissionRate = 0;
    let fixedCosts = 0;
    let currentInvoice = 0;
    let currentShip = 0;
    let currentPlatformFee = 0;

    // Set Channel Specifics
    switch (ch.key) {
      case 'TY':
        commissionRate = getSetting('tyCommission').value;
        currentInvoice = invoiceMarketplace;
        currentShip = shipExpMarketplace;
        currentPlatformFee = platformFeeVal;
        break;
      case 'HB':
        commissionRate = getSetting('hbCommission').value;
        currentInvoice = invoiceSite; // HB için e-fatura site fiyatından
        currentShip = shipExpMarketplace;
        currentPlatformFee = 0; // HB has no platform fee
        break;
      case 'SITE':
        commissionRate = getSetting('sitePos').value;
        currentInvoice = invoiceSite;
        currentShip = shipExpSite;
        currentPlatformFee = 0;
        break;
      case 'PAZARAMA':
        commissionRate = getSetting('pazaramaCommission').value;
        currentInvoice = invoiceSite; // Pazarama için e-fatura site fiyatından
        currentShip = shipExpPazarama;
        currentPlatformFee = 0; // Usually no per-transaction fee, just comm
        break;
      case 'SABIT_FIYAT':
        // Sabit Fiyat: Trendyol ile aynı hesaplama mantığı
        commissionRate = getSetting('tyCommission').value;
        currentInvoice = invoiceMarketplace;
        currentShip = shipExpMarketplace;
        currentPlatformFee = platformFeeVal;
        break;
    }

    fixedCosts = currentShip + productCost + packExpected + currentInvoice + currentPlatformFee;
    
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
        shippingTotal: currentShip,
        packagingTotal: packExpected,
        packagingDetails: {
          box: boxKD,
          card: cardKD,
          bag: bagKD,
          tape: tapeKD,
          ambalajBag: ambalajBagKD
        },
        productCostTotal: productCost,
        platformFee: currentPlatformFee,
        invoiceCost: currentInvoice,
        influencerCommissionAmount,
      },
      error
    });
  });

  return results;
};

// --- Trendyol Komisyon Tarifeleri: TY giderleri ile hesaplama (indirim/influencer yok) ---

function getTrendyolFixedCosts(inputs: CalculationInputs, settings: CostSetting[]): number {
  const getSetting = (key: string) => settings.find(s => s.key === key)!;
  const r = inputs.returnRate / 100;

  let productCost = inputs.productCostExKdv * (1 + inputs.productKdvRate / 100);
  if (inputs.includeOverhead) {
    const fgRate = getSetting('fgRate').value;
    productCost = productCost * (1 + fgRate / 100);
  }

  const boxS = getSetting('box');
  const cardS = getSetting('card');
  const bagS = getSetting('bag');
  const tapeS = getSetting('tape');
  const ambalajBagS = getSetting('ambalajBag');
  const boxKD = toKdvDahil(boxS.value, boxS.kdvMode, boxS.kdvRate);
  const cardKD = toKdvDahil(cardS.value, cardS.kdvMode, cardS.kdvRate);
  const bagKD = toKdvDahil(bagS.value, bagS.kdvMode, bagS.kdvRate);
  const tapeKD = toKdvDahil(tapeS.value, tapeS.kdvMode, tapeS.kdvRate);
  const ambalajBagKD = toKdvDahil(ambalajBagS.value, ambalajBagS.kdvMode, ambalajBagS.kdvRate);
  const packTotal = boxKD + cardKD + bagKD + tapeKD + ambalajBagKD;
  const packExpected = r >= 1 ? 999999 : packTotal / (1 - r);

  const invMpS = getSetting('invoiceMp');
  const invoiceMarketplace = toKdvDahil(invMpS.value, invMpS.kdvMode, invMpS.kdvRate);
  const platS = getSetting('platformFee');
  const platformFeeVal = toKdvDahil(platS.value, platS.kdvMode, platS.kdvRate);

  const shipVal = getSetting('marketplaceShip');
  const retShipVal = getSetting('marketplaceRetShip');
  const shipCost = toKdvDahil(shipVal.value, shipVal.kdvMode, shipVal.kdvRate);
  const retCost = toKdvDahil(retShipVal.value, retShipVal.kdvMode, retShipVal.kdvRate);
  const shipExpMarketplace = r >= 1 ? 999999 : (shipCost + retCost * r) / (1 - r);

  return shipExpMarketplace + productCost + packExpected + invoiceMarketplace + platformFeeVal;
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