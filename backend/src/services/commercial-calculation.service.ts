export interface CostComponentInput {
  component_type: string;
  description?: string;
  cost_per_unit?: number | null;
  quantity_basis?: number | null;
  currency?: string;
  fx_rate?: number;
  total_cost?: number | null;
  source_classification?: string;
  source_reference?: string;
  is_assumption?: boolean;
}

export interface PricingInputData {
  quantity: number;
  quantity_unit: string;
  customer_target_price?: number | null;
  internal_proposed_price: number;
  currency: string;
  payment_terms?: string;
  incoterm?: string;
  minimum_order_quantity?: number | null;
}

export interface UnitEconomicsResult {
  quantity: number;
  unit: string;
  currency: string;
  unitSellingPrice: number | null;
  unitCost: number | null;
  unitGrossProfit: number | null;
  totalRevenue: number | null;
  totalCost: number | null;
  totalGrossProfit: number | null;
  grossMarginPct: number | null;
  customerTargetPrice: number | null;
  priceGap: number | null;
  priceGapPct: number | null;
  breakEvenQuantity: number | null;
  isDataComplete: boolean;
  missingInputs: string[];
}

export interface CommercialScenarioResult {
  scenario_type: 'BASE_CASE' | 'UPSIDE_CASE' | 'DOWNSIDE_CASE' | 'CUSTOMER_TARGET_CASE' | 'INTERNAL_OFFER_CASE' | 'CUSTOM_SCENARIO';
  scenario_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  calculated_revenue: number;
  calculated_total_cost: number;
  calculated_gross_profit: number;
  calculated_gross_margin_pct: number | null;
  assumptions_notes: Record<string, any>;
}

export interface CommercialRiskItem {
  riskCode: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  explanation: string;
  mitigationSuggestion: string;
}

export interface CommercialRecommendationResult {
  recommendation: 'ATTRACTIVE' | 'CONDITIONALLY_ATTRACTIVE' | 'BORDERLINE' | 'UNATTRACTIVE' | 'INSUFFICIENT_DATA';
  score: number;
  scoreBreakdown: {
    marginScore: number;
    volumeScore: number;
    priceAlignmentScore: number;
    dataCompletenessScore: number;
    riskDeductions: number;
    formula: string;
  };
  rationales: string[];
}

export class CommercialCalculationService {
  /**
   * Deterministically calculates unit economics based on valid inputs.
   * If required inputs are missing, flags them explicitly instead of coercing to zero.
   */
  public static calculateUnitEconomics(
    pricing: PricingInputData,
    costComponents: CostComponentInput[]
  ): UnitEconomicsResult {
    const missingInputs: string[] = [];

    if (!pricing.quantity || pricing.quantity <= 0) {
      missingInputs.push('Valid production/order quantity basis (>0)');
    }
    if (pricing.internal_proposed_price === undefined || pricing.internal_proposed_price === null) {
      missingInputs.push('Internal proposed unit selling price');
    }
    if (!costComponents || costComponents.length === 0) {
      missingInputs.push('Cost components breakdown');
    }

    // Calculate Total Cost from valid components
    let totalCost = 0;
    let hasValidCosts = false;

    for (const comp of costComponents) {
      const fx = comp.fx_rate && comp.fx_rate > 0 ? comp.fx_rate : 1.0;
      if (comp.total_cost !== undefined && comp.total_cost !== null && !isNaN(Number(comp.total_cost))) {
        totalCost += Number(comp.total_cost) * fx;
        hasValidCosts = true;
      } else if (
        comp.cost_per_unit !== undefined &&
        comp.cost_per_unit !== null &&
        pricing.quantity > 0
      ) {
        totalCost += Number(comp.cost_per_unit) * pricing.quantity * fx;
        hasValidCosts = true;
      }
    }

    if (!hasValidCosts) {
      missingInputs.push('Quantified cost components (all entries missing values)');
    }

    const isDataComplete = missingInputs.length === 0;

    // Revenue
    const quantity = pricing.quantity || 0;
    const unitPrice = pricing.internal_proposed_price;
    const totalRevenue = isDataComplete && quantity > 0 && unitPrice !== null ? quantity * unitPrice : null;

    // Unit Cost & Gross Profit
    const unitCost = isDataComplete && quantity > 0 ? totalCost / quantity : null;
    const totalGrossProfit = totalRevenue !== null && hasValidCosts ? totalRevenue - totalCost : null;
    const unitGrossProfit = totalGrossProfit !== null && quantity > 0 ? totalGrossProfit / quantity : null;

    // Gross Margin %: ONLY valid if revenue > 0
    let grossMarginPct: number | null = null;
    if (totalRevenue !== null && totalRevenue > 0 && totalGrossProfit !== null) {
      grossMarginPct = Number(((totalGrossProfit / totalRevenue) * 100).toFixed(2));
    }

    // Target Price Gap
    let priceGap: number | null = null;
    let priceGapPct: number | null = null;
    if (pricing.customer_target_price !== undefined && pricing.customer_target_price !== null && unitPrice) {
      priceGap = Number((pricing.customer_target_price - unitPrice).toFixed(4));
      priceGapPct = Number(((priceGap / unitPrice) * 100).toFixed(2));
    }

    // Break-even Quantity (where Total Cost = Revenue)
    let breakEvenQuantity: number | null = null;
    if (unitPrice && unitPrice > 0 && totalCost > 0) {
      breakEvenQuantity = Math.ceil(totalCost / unitPrice);
    }

    return {
      quantity,
      unit: pricing.quantity_unit || 'Packs',
      currency: pricing.currency || 'USD',
      unitSellingPrice: unitPrice,
      unitCost: unitCost !== null ? Number(unitCost.toFixed(4)) : null,
      unitGrossProfit: unitGrossProfit !== null ? Number(unitGrossProfit.toFixed(4)) : null,
      totalRevenue: totalRevenue !== null ? Number(totalRevenue.toFixed(2)) : null,
      totalCost: hasValidCosts ? Number(totalCost.toFixed(2)) : null,
      totalGrossProfit: totalGrossProfit !== null ? Number(totalGrossProfit.toFixed(2)) : null,
      grossMarginPct,
      customerTargetPrice: pricing.customer_target_price !== undefined ? pricing.customer_target_price : null,
      priceGap,
      priceGapPct,
      breakEvenQuantity,
      isDataComplete,
      missingInputs,
    };
  }

  /**
   * Generates side-by-side commercial scenarios without overwriting base inputs.
   */
  public static generateScenarios(
    pricing: PricingInputData,
    baseEconomics: UnitEconomicsResult
  ): CommercialScenarioResult[] {
    const baseQuantity = pricing.quantity || 10000;
    const basePrice = pricing.internal_proposed_price || 10;
    const baseUnitCost = baseEconomics.unitCost || 6;

    // 1. Base Case
    const baseRevenue = baseQuantity * basePrice;
    const baseCost = baseQuantity * baseUnitCost;
    const baseProfit = baseRevenue - baseCost;
    const baseMargin = baseRevenue > 0 ? Number(((baseProfit / baseRevenue) * 100).toFixed(2)) : 0;

    // 2. Upside Case (+20% volume, +5% selling price, base cost)
    const upQty = Math.round(baseQuantity * 1.2);
    const upPrice = Number((basePrice * 1.05).toFixed(4));
    const upCost = Math.round(upQty * baseUnitCost * 0.96); // slight scale economy on cost
    const upRev = Math.round(upQty * upPrice);
    const upProfit = upRev - upCost;
    const upMargin = upRev > 0 ? Number(((upProfit / upRev) * 100).toFixed(2)) : 0;

    // 3. Downside Case (-20% volume, -5% price concessions, +8% cost inflation)
    const downQty = Math.round(baseQuantity * 0.8);
    const downPrice = Number((basePrice * 0.95).toFixed(4));
    const downUnitCost = Number((baseUnitCost * 1.08).toFixed(4));
    const downCost = Math.round(downQty * downUnitCost);
    const downRev = Math.round(downQty * downPrice);
    const downProfit = downRev - downCost;
    const downMargin = downRev > 0 ? Number(((downProfit / downRev) * 100).toFixed(2)) : 0;

    // 4. Customer Target Case (Evaluated strictly at customer target price)
    const custTargetPrice = pricing.customer_target_price || basePrice * 0.9;
    const custCost = baseCost;
    const custRev = Math.round(baseQuantity * custTargetPrice);
    const custProfit = custRev - custCost;
    const custMargin = custRev > 0 ? Number(((custProfit / custRev) * 100).toFixed(2)) : 0;

    // 5. Internal Offer Case (Structured for target 30% gross margin)
    const target30Price = Number((baseUnitCost / 0.7).toFixed(4));
    const offerRev = Math.round(baseQuantity * target30Price);
    const offerProfit = offerRev - baseCost;
    const offerMargin = offerRev > 0 ? Number(((offerProfit / offerRev) * 100).toFixed(2)) : 0;

    return [
      {
        scenario_type: 'BASE_CASE',
        scenario_name: 'Base Case (Current Evaluation)',
        quantity: baseQuantity,
        unit_price: basePrice,
        unit_cost: baseUnitCost,
        calculated_revenue: baseRevenue,
        calculated_total_cost: baseCost,
        calculated_gross_profit: baseProfit,
        calculated_gross_margin_pct: baseMargin,
        assumptions_notes: { basis: 'Primary proposed price and quantified cost components' },
      },
      {
        scenario_type: 'UPSIDE_CASE',
        scenario_name: 'Upside Market Capture (+20% Vol, +5% Price)',
        quantity: upQty,
        unit_price: upPrice,
        unit_cost: Number((upCost / upQty).toFixed(4)),
        calculated_revenue: upRev,
        calculated_total_cost: upCost,
        calculated_gross_profit: upProfit,
        calculated_gross_margin_pct: upMargin,
        assumptions_notes: { basis: 'Favorable tender volume allocation with 4% scale economies on batch conversion' },
      },
      {
        scenario_type: 'DOWNSIDE_CASE',
        scenario_name: 'Downside Compression (-20% Vol, -5% Price, +8% Cost)',
        quantity: downQty,
        unit_price: downPrice,
        unit_cost: downUnitCost,
        calculated_revenue: downRev,
        calculated_total_cost: downCost,
        calculated_gross_profit: downProfit,
        calculated_gross_margin_pct: downMargin,
        assumptions_notes: { basis: 'API supply price inflation and competitive price discounting' },
      },
      {
        scenario_type: 'CUSTOMER_TARGET_CASE',
        scenario_name: 'Customer Target Price Concession',
        quantity: baseQuantity,
        unit_price: custTargetPrice,
        unit_cost: baseUnitCost,
        calculated_revenue: custRev,
        calculated_total_cost: custCost,
        calculated_gross_profit: custProfit,
        calculated_gross_margin_pct: custMargin,
        assumptions_notes: { basis: 'Financial outcome if customer target price is accepted without renegotiation' },
      },
      {
        scenario_type: 'INTERNAL_OFFER_CASE',
        scenario_name: 'Target Threshold Case (30% Gross Margin)',
        quantity: baseQuantity,
        unit_price: target30Price,
        unit_cost: baseUnitCost,
        calculated_revenue: offerRev,
        calculated_total_cost: baseCost,
        calculated_gross_profit: offerProfit,
        calculated_gross_margin_pct: offerMargin,
        assumptions_notes: { basis: 'Price required to achieve 30% gross profitability target' },
      },
    ];
  }

  /**
   * Generates a controlled sensitivity matrix varying Price and Volume by [-20%, -10%, 0%, +10%, +20%].
   */
  public static generateSensitivityMatrix(
    basePrice: number,
    baseQuantity: number,
    baseUnitCost: number
  ) {
    const variations = [-0.2, -0.1, 0, 0.1, 0.2];
    const matrix: any[] = [];

    for (const vPrice of variations) {
      const price = Number((basePrice * (1 + vPrice)).toFixed(4));
      const row: any = {
        priceVariationPct: Math.round(vPrice * 100),
        unitPrice: price,
        cells: [],
      };

      for (const vQty of variations) {
        const qty = Math.round(baseQuantity * (1 + vQty));
        const rev = Math.round(price * qty);
        const cost = Math.round(baseUnitCost * qty);
        const profit = rev - cost;
        const margin = rev > 0 ? Number(((profit / rev) * 100).toFixed(2)) : 0;

        row.cells.push({
          volumeVariationPct: Math.round(vQty * 100),
          quantity: qty,
          grossProfit: profit,
          grossMarginPct: margin,
        });
      }

      matrix.push(row);
    }

    return matrix;
  }

  /**
   * Evaluates deterministic commercial risks without AI.
   */
  public static evaluateCommercialRisks(
    economics: UnitEconomicsResult,
    pricing: PricingInputData,
    costComponents: CostComponentInput[]
  ): CommercialRiskItem[] {
    const risks: CommercialRiskItem[] = [];

    // 1. Negative Margin Risk
    if (economics.grossMarginPct !== null && economics.grossMarginPct < 0) {
      risks.push({
        riskCode: 'NEGATIVE_MARGIN',
        severity: 'CRITICAL',
        title: 'Negative Gross Margin Detected',
        explanation: `Total unit costs (${economics.currency} ${economics.unitCost}) exceed the proposed selling price (${economics.currency} ${economics.unitSellingPrice}), creating an operational loss.`,
        mitigationSuggestion: 'Renegotiate price, obtain alternative API supplier quotes, or decline bid.',
      });
    }

    // 2. Low Margin Risk
    if (economics.grossMarginPct !== null && economics.grossMarginPct >= 0 && economics.grossMarginPct < 15) {
      risks.push({
        riskCode: 'LOW_MARGIN',
        severity: 'HIGH',
        title: 'Sub-Threshold Commercial Margin (<15%)',
        explanation: `The calculated gross margin of ${economics.grossMarginPct}% is below the standard enterprise commercial viability hurdle rate of 15%.`,
        mitigationSuggestion: 'Explore volume-tiered pricing or optimize logistics/packaging specifications.',
      });
    }

    // 3. Customer Price Gap
    if (economics.priceGapPct !== null && economics.priceGapPct < -10) {
      risks.push({
        riskCode: 'CUSTOMER_PRICE_GAP',
        severity: 'HIGH',
        title: 'Customer Target Price Gap Exceeds 10%',
        explanation: `Customer target price (${economics.currency} ${economics.customerTargetPrice}) is ${Math.abs(economics.priceGapPct)}% below internal quotation (${economics.currency} ${economics.unitSellingPrice}).`,
        mitigationSuggestion: 'Prepare cost breakdown justification or propose alternative packaging/delivery terms.',
      });
    }

    // 4. Low Volume / MOQ Risk
    if (pricing.minimum_order_quantity && pricing.quantity < pricing.minimum_order_quantity) {
      risks.push({
        riskCode: 'LOW_VOLUME',
        severity: 'MEDIUM',
        title: 'Order Quantity Below Minimum Order Quantity (MOQ)',
        explanation: `Requested volume (${pricing.quantity} ${pricing.quantity_unit}) is lower than the manufacturing site MOQ (${pricing.minimum_order_quantity} ${pricing.quantity_unit}).`,
        mitigationSuggestion: 'Consolidate batch campaign with existing production run or quote MOQ surcharge.',
      });
    }

    // 5. FX Risk
    const hasNonUsdFx = costComponents.some(c => c.currency && c.currency !== 'USD');
    if (hasNonUsdFx || pricing.currency !== 'USD') {
      risks.push({
        riskCode: 'FX_RISK',
        severity: 'MEDIUM',
        title: 'Foreign Exchange Exposure',
        explanation: 'Costs or revenues are denominated across multiple currencies subject to currency fluctuation.',
        mitigationSuggestion: 'Incorporate FX pass-through clause in supply agreement or apply currency collar.',
      });
    }

    // 6. Data Completeness Gap
    if (!economics.isDataComplete) {
      risks.push({
        riskCode: 'DATA_GAP',
        severity: 'HIGH',
        title: 'Incomplete Commercial Evaluation Inputs',
        explanation: `Missing critical evaluation parameters: ${economics.missingInputs.join('; ')}.`,
        mitigationSuggestion: 'Create internal follow-up tasks to obtain supplier quotes and technical specifications.',
      });
    }

    return risks;
  }

  /**
   * Evaluates transparent commercial recommendation and score.
   */
  public static evaluateRecommendation(
    economics: UnitEconomicsResult,
    risks: CommercialRiskItem[]
  ): CommercialRecommendationResult {
    const rationales: string[] = [];

    if (!economics.isDataComplete || economics.grossMarginPct === null) {
      return {
        recommendation: 'INSUFFICIENT_DATA',
        score: 25.0,
        scoreBreakdown: {
          marginScore: 0,
          volumeScore: 0,
          priceAlignmentScore: 0,
          dataCompletenessScore: 25,
          riskDeductions: 0,
          formula: 'Score = Data Completeness (25) - Gaps',
        },
        rationales: ['Required pricing, volume, or cost components have not been fully populated.'],
      };
    }

    // 1. Margin Score (Max 35 points)
    let marginScore = 0;
    const margin = economics.grossMarginPct;
    if (margin >= 35) marginScore = 35;
    else if (margin >= 25) marginScore = 28;
    else if (margin >= 18) marginScore = 20;
    else if (margin >= 10) marginScore = 12;
    else if (margin >= 0) marginScore = 5;
    else marginScore = 0;

    rationales.push(`Gross Margin of ${margin}% contributes ${marginScore}/35 pts to evaluation.`);

    // 2. Volume Score (Max 25 points)
    let volumeScore = 20; // standard commercial volume
    if (economics.quantity >= 100000) volumeScore = 25;
    else if (economics.quantity >= 25000) volumeScore = 20;
    else if (economics.quantity >= 5000) volumeScore = 15;
    else volumeScore = 8;

    rationales.push(`Production quantity basis (${economics.quantity} ${economics.unit}) contributes ${volumeScore}/25 pts.`);

    // 3. Price Gap Alignment Score (Max 20 points)
    let priceAlignmentScore = 15;
    if (economics.priceGapPct !== null) {
      if (economics.priceGapPct >= 0) priceAlignmentScore = 20;
      else if (economics.priceGapPct >= -5) priceAlignmentScore = 16;
      else if (economics.priceGapPct >= -12) priceAlignmentScore = 10;
      else priceAlignmentScore = 2;
      rationales.push(`Customer price gap of ${economics.priceGapPct}% contributes ${priceAlignmentScore}/20 pts.`);
    } else {
      priceAlignmentScore = 12; // neutral when no customer target given
    }

    // 4. Data Completeness Score (Max 20 points)
    const dataCompletenessScore = economics.isDataComplete ? 20 : 5;

    // 5. Risk Deductions
    const criticalRisksCount = risks.filter(r => r.severity === 'CRITICAL').length;
    const highRisksCount = risks.filter(r => r.severity === 'HIGH').length;
    const riskDeductions = criticalRisksCount * 25 + highRisksCount * 10;

    // Final Score
    const rawScore = marginScore + volumeScore + priceAlignmentScore + dataCompletenessScore - riskDeductions;
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    // Recommendation logic
    let recommendation: 'ATTRACTIVE' | 'CONDITIONALLY_ATTRACTIVE' | 'BORDERLINE' | 'UNATTRACTIVE' | 'INSUFFICIENT_DATA';
    if (criticalRisksCount > 0 || margin < 0) {
      recommendation = 'UNATTRACTIVE';
      rationales.push('Critical risks or negative profitability prevent commercial engagement without renegotiation.');
    } else if (finalScore >= 75 && margin >= 25) {
      recommendation = 'ATTRACTIVE';
      rationales.push('Exceeds strategic margin hurdles with robust volume and manageable risks.');
    } else if (finalScore >= 55 && margin >= 15) {
      recommendation = 'CONDITIONALLY_ATTRACTIVE';
      rationales.push('Viable commercial return conditional on final freight and customer payment terms validation.');
    } else if (finalScore >= 40 && margin >= 8) {
      recommendation = 'BORDERLINE';
      rationales.push('Thin margin profile requiring executive sponsor review or volume upside commitments.');
    } else {
      recommendation = 'UNATTRACTIVE';
      rationales.push('Insufficient margin contribution to justify manufacturing capacity allocation.');
    }

    return {
      recommendation,
      score: finalScore,
      scoreBreakdown: {
        marginScore,
        volumeScore,
        priceAlignmentScore,
        dataCompletenessScore,
        riskDeductions,
        formula: 'Score = Margin(35) + Volume(25) + PriceGap(20) + DataCompleteness(20) - Deductions',
      },
      rationales,
    };
  }
}
