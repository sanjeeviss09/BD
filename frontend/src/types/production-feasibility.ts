export type FeasibilityResultType =
  | 'FEASIBLE'
  | 'CONDITIONALLY_FEASIBLE'
  | 'FEASIBLE_WITH_DEVELOPMENT'
  | 'CAPACITY_CONSTRAINED'
  | 'TECHNOLOGY_GAP'
  | 'EQUIPMENT_GAP'
  | 'MATERIAL_GAP'
  | 'REGULATORY_CONSTRAINT'
  | 'TIMELINE_CONSTRAINT'
  | 'NOT_FEASIBLE'
  | 'DATA_INSUFFICIENT';

export type FeasibilityStatusType =
  | 'DRAFT'
  | 'DATA_COLLECTION'
  | 'UNDER_EVALUATION'
  | 'TECHNICAL_REVIEW'
  | 'CAPACITY_REVIEW'
  | 'CONDITIONAL'
  | 'READY_FOR_DECISION'
  | 'FINALIZED'
  | 'SUPERSEDED'
  | 'CANCELLED';

export type RiskLevelType = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ScoreFactor {
  factor: string;
  score: number;
  weight: number;
  weightedScore: number;
  evidence: string;
  reason: string;
}

export interface ProductionFacility {
  id: string;
  facility_code: string;
  facility_name: string;
  site_type: string;
  building_block?: string;
  address?: string;
  city?: string;
  state?: string;
  country_iso2?: string;
  site_status: string;
  regulatory_approvals?: string[];
  contact_person?: string;
  contact_email?: string;
  operational_hours_per_day: number;
  operational_days_per_year: number;
  production_lines?: ProductionLine[];
  production_equipment?: ProductionEquipment[];
  production_technologies?: ProductionTechnology[];
}

export interface ProductionLine {
  id: string;
  facility_id: string;
  line_code: string;
  line_name: string;
  manufacturing_type: string;
  applicable_dosage_forms?: string[];
  applicable_technologies?: string[];
  batch_size_min?: number;
  batch_size_max?: number;
  batch_size_unit?: string;
  nominal_hourly_capacity?: number;
  nominal_annual_capacity?: number;
  operating_hours_per_day?: number;
  working_days_per_year?: number;
  qualification_status: string;
  validation_status: string;
  current_utilization_pct: number;
  status: string;
}

export interface ProductionEquipment {
  id: string;
  facility_id: string;
  production_line_id?: string;
  equipment_code: string;
  equipment_name: string;
  equipment_type: string;
  manufacturer?: string;
  model?: string;
  capacity_nominal?: number;
  capacity_unit?: string;
  qualification_status: string;
  iq_status?: string;
  oq_status?: string;
  pq_status?: string;
  calibration_status?: string;
  maintenance_status?: string;
  availability_status: string;
  is_critical?: boolean;
}

export interface ProductionTechnology {
  id: string;
  technology_code: string;
  technology_name: string;
  applicable_dosage_forms?: string[];
  applicable_routes?: string[];
  qualification_status: string;
  validated_products_count?: number;
  description?: string;
  status: string;
}

export interface ProductionGap {
  id: string;
  feasibility_id: string;
  gap_category: string;
  description: string;
  severity: RiskLevelType;
  required_action: string;
  responsible_department?: string;
  responsible_role?: string;
  target_date?: string;
  status: string;
  task_id?: string;
}

export interface ProductionRisk {
  id: string;
  feasibility_id: string;
  risk_category: string;
  risk_title: string;
  description?: string;
  probability: number;
  impact: number;
  risk_score: number;
  risk_level: RiskLevelType;
  mitigation_plan?: string;
  due_date?: string;
  status: string;
}

export interface ProductionMaterial {
  id: string;
  feasibility_id: string;
  material_category: string;
  material_name: string;
  cas_number?: string;
  required_quantity: number;
  required_unit: string;
  available_quantity: number;
  reserved_quantity: number;
  gap_quantity: number;
  supplier_name?: string;
  lead_time_days?: number;
  availability_status: string;
  is_critical?: boolean;
}

export interface ProductionProcessStep {
  id: string;
  feasibility_id: string;
  step_number: number;
  operation_name: string;
  equipment_type_required?: string;
  equipment_id?: string;
  setup_time_hours: number;
  processing_time_hours: number;
  cleaning_time_hours: number;
  changeover_time_hours: number;
  inspection_time_hours?: number;
  waiting_time_hours?: number;
  total_step_hours: number;
  step_yield_pct: number;
  responsible_department?: string;
}

export interface ProductionVersion {
  id: string;
  version_number: number;
  status: string;
  snapshot_data: any;
  change_summary?: string;
  is_immutable: boolean;
  finalized_at: string;
}

export interface ProductionFeasibility {
  id: string;
  organization_id: string;
  feasibility_code: string;
  rfq_id?: string;
  rfq_line_item_id?: string;
  opportunity_id?: string;
  customer_id?: string;
  customer_name?: string;
  product_id?: string;
  product_name: string;
  product_version_id?: number;
  molecule_id?: string;
  dosage_form?: string;
  route?: string;
  strength?: string;
  presentation?: string;
  pack_size?: string;
  status: FeasibilityStatusType;
  feasibility_result: FeasibilityResultType;
  feasibility_score?: number;
  score_breakdown?: ScoreFactor[];
  facility_id?: string;
  production_line_id?: string;
  production_facilities?: ProductionFacility;
  production_lines?: ProductionLine;
  evaluation_date?: string;
  required_quantity: number;
  required_quantity_unit?: string;
  annual_volume?: number;
  customer_required_date?: string;
  estimated_available_date?: string;
  batch_size: number;
  batch_size_unit?: string;
  estimated_batches: number;
  expected_yield_pct: number;
  yield_source?: string;
  required_manufacturing_quantity: number;
  setup_time_hours?: number;
  processing_time_hours?: number;
  cleaning_time_hours?: number;
  changeover_time_hours?: number;
  testing_release_time_days?: number;
  manufacturing_lead_time_days?: number;
  total_customer_lead_time_days?: number;
  development_required?: boolean;
  development_category?: string;
  technology_transfer_required?: boolean;
  technology_transfer_status?: string;
  technology_transfer_duration_weeks?: number;
  validation_required?: boolean;
  regulatory_assessment_required?: boolean;
  regulatory_status?: string;
  sterile_manufacturing_required?: boolean;
  sterile_status?: string;
  packaging_feasibility_status?: string;
  capacity_status: string;
  equipment_status: string;
  material_status: string;
  quality_status: string;
  supply_chain_status: string;
  overall_risk: RiskLevelType;
  recommendation: string;
  recommendation_reason?: string;
  data_completeness_pct?: number;
  is_finalized: boolean;
  version_number: number;
  active_version_id?: string;
  finalized_at?: string;
  created_at: string;
  updated_at: string;
  production_gaps?: ProductionGap[];
  production_risks?: ProductionRisk[];
  production_materials?: ProductionMaterial[];
  production_process_steps?: ProductionProcessStep[];
  production_feasibility_versions?: ProductionVersion[];
  production_documents?: any[];
}

export interface ProductionAnalytics {
  kpis: {
    totalAssessments: number;
    feasibleCount: number;
    conditionallyFeasibleCount: number;
    notFeasibleCount: number;
    capacityConstrainedCount: number;
    equipmentGapsCount: number;
    materialGapsCount: number;
    technologyGapsCount: number;
    highRiskCount: number;
    developmentRequiredCount: number;
  };
  byFacility: Record<string, number>;
  recentAssessments: ProductionFeasibility[];
}

export interface FacilityComparisonItem {
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  siteType: string;
  city?: string;
  countryIso2?: string;
  siteStatus: string;
  regulatoryApprovals: string[];
  linesCount: number;
  equipmentCount: number;
  qualifiedEquipmentCount: number;
  totalAvailableCapacity: number;
  averageUtilizationPct: number;
  remainingCapacity: number;
  supportsDosageForm: boolean;
  supportsTechnology: boolean;
  isCapacityFeasible: boolean;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
  recommendationReason: string;
}

export interface AIProviderConfig {
  id?: string;
  organization_id?: string;
  provider_name: 'NVIDIA' | 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'AZURE_OPENAI' | 'CUSTOM_LLM' | 'LOCAL' | 'COPILOT_PROXY';
  provider_display_name: string;
  api_endpoint?: string;
  api_key_masked?: string;
  model_name: string;
  is_default: boolean;
  is_enabled: boolean;
  max_output_tokens: number;
  temperature: number;
  last_test_status: 'NOT_TESTED' | 'SUCCESS' | 'FAILED';
  last_test_message?: string;
  last_test_at?: string;
  usage_count: number;
  discovered_models?: string[];
  verified_capabilities?: {
    chat: boolean;
    embeddings: boolean;
    structuredOutput: boolean;
    embeddingDimensions?: number;
    testedModel?: string;
    testedAt?: string;
  };
  embedding_dimensions?: number;
  max_concurrency?: number;
  request_timeout_seconds?: number;
}

export interface AssessmentScenario {
  id?: string;
  feasibility_id: string;
  scenario_key: string;
  scenario_name: string;
  quantity: number;
  quantity_unit: string;
  batch_size?: number;
  estimated_batches?: number;
  expected_yield_pct?: number;
  total_manufacturing_cost: number;
  unit_cost: number;
  cost_per_batch?: number;
  proposed_unit_price: number;
  projected_revenue: number;
  projected_gross_profit: number;
  gross_margin_pct: number;
  break_even_quantity?: number;
  break_even_unit_price?: number;
  target_margin_price?: number;
  lead_time_days: number;
  feasibility_status: string;
  is_base_case: boolean;
}

export interface ProductionCostBreakdown {
  id?: string;
  component_type: string;
  description: string;
  cost_type: string;
  cost_per_unit?: number;
  quantity_basis?: number;
  total_cost: number;
  currency: string;
  source_basis?: string;
}

export interface DecisionSnapshot {
  id?: string;
  version_number: number;
  decision_outcome: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | 'NEEDS_DATA' | 'ON_HOLD';
  reviewer_name?: string;
  reviewer_role?: string;
  reviewer_comments?: string;
  conditions?: string[];
  created_at: string;
}

export interface StructuredAIAnalysis {
  source: 'AI_PROVIDER' | 'DETERMINISTIC_ENGINE';
  providerName?: string;
  modelName?: string;
  executiveSummary: string;
  feasibilityConclusion: string;
  commercialConclusion: string;
  keySupportingEvidence: string[];
  criticalConstraints: string[];
  missingInformation: string[];
  contradictions: string[];
  capacityBottlenecks: string[];
  scheduleRisks: string[];
  materialRisks: string[];
  qualityAndRegulatoryConcerns: string[];
  mainCostDrivers: string[];
  pricingAndMarginObservations: string[];
  alternativeScenarios: Array<{
    scenarioName: string;
    description: string;
    feasibilityImpact: string;
    marginImpact: string;
  }>;
  recommendedNextActions: Array<{
    action: string;
    responsibleDepartment: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
  confidenceExplanation: string;
  evidenceReferences: string[];
}

export interface ComprehensiveEvaluation extends ProductionFeasibility {
  scenarios: AssessmentScenario[];
  cost_breakdowns: ProductionCostBreakdown[];
  decision_snapshots: DecisionSnapshot[];
  ai_analysis: StructuredAIAnalysis;
  ai_config?: AIProviderConfig;
}

export interface FacilityImportPreview {
  sessionId: string;
  fileName: string;
  totalFacilities: number;
  totalLines: number;
  totalEquipment: number;
  facilities: any[];
  lines: any[];
  equipment: any[];
  errors: Array<{ sheet: string; row: number; field: string; message: string }>;
  warnings: Array<{ sheet: string; row: number; field: string; message: string }>;
  status: 'PREVIEW' | 'VALIDATED';
}

