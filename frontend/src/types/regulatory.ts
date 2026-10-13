export interface RegulatoryAuthority {
  id: string;
  code: string;
  name: string;
  short_name: string;
  country_iso2: string;
  authority_type: string;
  website_url?: string;
}

export interface RegulatorySource {
  id: string;
  source_code: string;
  source_name: string;
  provider: string;
  source_type: string;
  jurisdiction_code: string;
  description?: string;
  access_type: string;
  license_status: string;
  refresh_frequency: string;
  reliability_tier: string;
  last_verified_at: string;
  status: string;
}

export interface RegulatoryRecord {
  id: string;
  source_id?: string;
  dataset_version_id?: string;
  jurisdiction_code: string;
  raw_product_name: string;
  raw_molecule_name?: string;
  raw_strength?: string;
  raw_dosage_form?: string;
  raw_route?: string;
  application_number?: string;
  application_type?: string;
  marketing_authorization_number?: string;
  raw_status: string;
  normalized_status: string;
  approval_date?: string;
  effective_date?: string;
  expiry_date?: string;
  marketing_authorization_holder?: string;
  manufacturer_name?: string;
  product_id?: string;
  match_status: 'AUTO_MATCHED_HIGH_CONFIDENCE' | 'MATCHED_BY_USER' | 'CANDIDATE_REVIEW' | 'UNMATCHED' | 'REJECTED_MATCH';
  match_confidence?: number;
  data_quality_status: 'PASSED' | 'WARNING' | 'FAILED' | 'NEEDS_REVIEW';
  ingested_at?: string;
  created_at: string;
  source?: RegulatorySource;
  product?: any;
}

export interface JurisdictionMatrixItem {
  jurisdiction: string;
  status: string;
  rawStatus: string;
  authorizationNumber?: string | null;
  approvalDate?: string | null;
  holder?: string | null;
  hasData: boolean;
  recordCount: number;
  confidence: number;
  sourceName?: string | null;
}

export interface RegulatoryRisk {
  id: string;
  riskCode: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  explanation: string;
  mitigationSuggestion: string;
  jurisdiction_code?: string;
}

export interface RegulatoryProfile {
  product: {
    id: string;
    product_name: string;
    product_code: string;
    strength_raw?: string;
    generic_name?: string;
    molecules?: { canonical_name: string };
    dosage_forms?: { name: string };
    routes_of_administration?: { name: string };
  };
  jurisdictionMatrix: Record<string, JurisdictionMatrixItem>;
  records: RegulatoryRecord[];
  risks: RegulatoryRisk[];
  readiness: {
    score: number;
    approvedJurisdictionsCount: number;
    totalJurisdictionsCount: number;
    dataFreshnessDays: number;
    formula: string;
  };
}

export interface RegulatoryAssessment {
  id: string;
  assessment_number: string;
  title: string;
  product_id: string;
  opportunity_id?: string | null;
  target_jurisdictions: string[];
  overall_status: string;
  readiness_score: number;
  readiness_breakdown?: any;
  key_findings: string;
  recommendations: string;
  assessed_by: string;
  created_at: string;
}
