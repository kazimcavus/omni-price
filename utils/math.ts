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

  const boxKD = toKdvDahil(boxS.value, boxS.kdvMode, boxS.kdvRate);
  const cardKD = toKdvDahil(cardS.value, cardS.kdvMode, cardS.kdvRate);
  const bagKD = toKdvDahil(bagS.value, bagS.kdvMode, bagS.kdvRate);
  const tapeKD = toKdvDahil(tapeS.value, tapeS.kdvMode, tapeS.kdvRate);

  const packTotal = boxKD + cardKD + bagKD + tapeKD;
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
  const shipExpPazarama = calcShippingExpected('pazaramaShip', 'marketplaceRetShip'); // Assuming similar return logic

  const results: ChannelResult[] = [];

  // 3. Process each channel (Order: Web, TY, HB, Pazarama)
  const channelsToProcess: { key: ChannelKey; name: string }[] = [
    { key: 'SITE', name: 'Web' },
    { key: 'TY', name: 'Trendyol' },
    { key: 'HB', name: 'Hepsiburada' },
    { key: 'PAZARAMA', name: 'Pazarama' },
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
        currentInvoice = invoiceMarketplace;
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
        currentInvoice = invoiceMarketplace; // Assuming uses marketplace e-invoice
        currentShip = shipExpPazarama;
        currentPlatformFee = 0; // Usually no per-transaction fee, just comm
        break;
    }

    fixedCosts = currentShip + productCost + packExpected + currentInvoice + currentPlatformFee;
    
    // Solve for Price
    let rawPrice = 0;
    let error: string | undefined = undefined;

    const commDecimal = commissionRate / 100;
    const target = inputs.targetProfitRate / 100;

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
    const finalSalePrice = error ? 0 : roundPrice(rawPrice);

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
    const netProfit = finalSalePrice - commissionAmount - fixedCosts;
    
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
          tape: tapeKD
        },
        productCostTotal: productCost,
        platformFee: currentPlatformFee,
        invoiceCost: currentInvoice,
      },
      error
    });
  });

  return results;
};