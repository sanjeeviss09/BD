export interface CostComponent {
  id: string;
  component_type: string;
  description?: string;
  cost_per_unit?: number | null;
  quantity_basis?: number | null;
  currency: string;
  fx_rate: number;
  total_cost?: number | null;
  source_classification: string;
  source_reference?: string;
  is_assumption: boolean;
}

export interface PricingInputs {
  quantity: number;
  quantity_unit: string;
  customer_target_price?: number | null;
  internal_proposed_price: number;
  currency: string;
  payment_terms?: string;
  incoterm?: string;
  contract_duration_months?: number;
  minimum_order_quantity?: number | null;
}

export interface UnitEconomics {
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

export interface CommercialScenario {
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

export interface CommercialRisk {
  id?: string;
  riskCode?: string;
  risk_code?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  explanation: string;
  mitigationSuggestion?: string;
  mitigation_suggestion?: string;
}

export interface CommercialAssumption {
  id: string;
  assumption_key: string;
  assumption_label: string;
  assumption_value: string;
  source_type: string;
}

export interface CommercialEvaluation {
  id: string;
  evaluation_number: string;
  title: string;
  rfq_id?: string | null;
  opportunity_id?: string | null;
  product_id?: string | null;
  customer_name?: string;
  target_market_country: string;
  currency: string;
  status: 'DRAFT' | 'DATA_COLLECTION' | 'UNDER_EVALUATION' | 'INTERNAL_REVIEW' | 'READY_FOR_DECISION' | 'FINALIZED' | 'SUPERSEDED' | 'ON_HOLD' | 'CANCELLED' | 'CLOSED';
  version_number: number;
  validity_date?: string;
  notes?: string;
  commercial_recommendation: 'ATTRACTIVE' | 'CONDITIONALLY_ATTRACTIVE' | 'BORDERLINE' | 'UNATTRACTIVE' | 'INSUFFICIENT_DATA';
  commercial_score: number;
  score_breakdown?: any;
  is_finalized: boolean;
  finalized_at?: string;
  finalized_by?: string;
  created_at: string;
  updated_at: string;
  pricing: PricingInputs;
  costs: CostComponent[];
  assumptions: CommercialAssumption[];
  risks?: CommercialRisk[];
  evaluatedRisks?: CommercialRisk[];
  economics?: UnitEconomics;
  scenarios?: CommercialScenario[];
  sensitivity?: any[];
  recommendation?: {
    recommendation: string;
    score: number;
    scoreBreakdown: any;
    rationales: string[];
  };
  product?: any;
  rfq?: any;
}
