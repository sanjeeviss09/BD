import React, { useState, useEffect } from 'react';
import { 
  X, 
  Building2, 
  MapPin, 
  ShieldCheck, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Sparkles, 
  Factory, 
  DollarSign, 
  ArrowRight, 
  HelpCircle, 
  Search, 
  BarChart3, 
  Layers, 
  AlertCircle,
  Eye,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../../lib/api';
import { SourceProofModal, type EvidenceRecord } from './SourceProofModal';

export interface CustomerProduct {
  id: string;
  product_name: string;
  generic_name: string;
  brand_name?: string;
  dosage_form: string;
  strength: string;
  route: string;
  target_markets: string[];
  regulatory_status: string;
  source_proof: {
    source_title: string;
    source_url: string;
    source_date: string;
  };
  manufacturing_requirements: string[];
  axxelent_capability_match: 'FULL_MATCH' | 'HIGH_MATCH' | 'PARTIAL_MATCH' | 'GAP_IDENTIFIED';
  match_rationale: string;
}

export interface FitDimensionScore {
  key: string;
  name: string;
  weight: number;
  score: number;
  weighted_score: number;
  rule_applied: string;
  supporting_evidence_ids: string[];
  status: 'VERIFIED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' | 'ASSUMPTION';
  missing_information?: string;
  explanation: string;
}

export interface CustomerProfileData {
  candidate: {
    id: string;
    company_id: string;
    subject_type: string;
    subject_id: string;
    customer_type: string;
    relationship_type: string;
    candidate_status: string;
    intent_status: string;
    intent_evidence_summary?: string;
    fit_score: number;
    fit_level: 'HIGH' | 'MEDIUM' | 'LOW';
    completeness_score: number;
    discovery_source: string;
    source_origin_type: string;
    reason: string;
    created_at: string;
    updated_at: string;
  };
  company: {
    id: string;
    name: string;
    legal_name?: string;
    headquarters: string;
    countries_of_operation: string[];
    company_type: string;
    business_segments: string[];
    website: string;
    corporate_identifiers?: {
      ticker?: string;
      exchange?: string;
      lei?: string;
    };
    therapeutic_areas: string[];
    relationship_with_axxelent: string;
    last_source_refresh_at: string;
    source: string;
  };
  products: CustomerProduct[];
  evidence: EvidenceRecord[];
  scoring_breakdown: {
    methodology_version: string;
    calculated_at: string;
    total_score: number;
    fit_level: 'HIGH' | 'MEDIUM' | 'LOW';
    evidence_completeness_score: number;
    dimensions: FitDimensionScore[];
    summary: string;
    is_provisional: boolean;
  };
  discovery_explanation: {
    query: {
      subject_type: string;
      subject_id: string;
      target_market: string;
      timestamp: string;
    };
    match_rationale: string;
    source_origin: string;
    rules_applied: string[];
    known_facts: string[];
    unknown_information: string[];
    is_demonstration_data: boolean;
    bd_recommended_next_action: string;
  };
  linked_evaluations: {
    production_feasibility?: {
      status: string;
      score: number;
      target_facility: string;
      equipment_lines_compatible: string[];
      batch_capacity_available: string;
      lead_time_months: number;
    };
    commercial_evaluation?: {
      status: string;
      suggested_currency: string;
      target_ebitda_margin_percent: number;
      estimated_annual_batch_value: string;
      api_pass_through: string;
    };
  };
}

interface CustomerProfileDrawerProps {
  candidateId: string;
  sessionToken?: string;
  onClose: () => void;
  onCandidateUpdated?: () => void;
}

export const CustomerProfileDrawer: React.FC<CustomerProfileDrawerProps> = ({
  candidateId,
  sessionToken,
  onClose,
  onCandidateUpdated
}) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'evidence' | 'score' | 'intent' | 'evaluation'>('overview');
  
  // Proof inspector modal state
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);

  // NVIDIA AI Synthesis state
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Evidence status filter
  const [evidenceFilter, setEvidenceFilter] = useState<string>('ALL');

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/customer-intelligence/candidates/${candidateId}/profile`, {
        headers: { Authorization: `Bearer ${sessionToken || 'dev-admin-token'}` }
      });
      if (!res.ok) {
        throw new Error('Failed to load customer profile');
      }
      const data = await res.json();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching customer profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [candidateId]);

  const handleRunAiSynthesis = async () => {
    try {
      setAiGenerating(true);
      setAiError(null);
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/customer-intelligence/candidates/${candidateId}/ai-synthesis`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken || 'dev-admin-token'}` }
      });
      if (!res.ok) {
        throw new Error('AI synthesis failed. NVIDIA endpoint unavailable.');
      }
      const data = await res.json();
      setAiResult(data);
    } catch (err: any) {
      setAiError(err.message || 'Failed to generate AI synthesis');
    } finally {
      setAiGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
        <div className="bg-card p-8 rounded-2xl border border-border shadow-2xl flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-semibold text-foreground">Traceable Customer Profile Loading...</p>
          <p className="text-[11px] text-muted-foreground mt-1">Fetching verified regulatory & internal evidence</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
        <div className="bg-card p-6 rounded-2xl border border-border shadow-2xl max-w-md w-full">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm mb-2">
            <AlertCircle className="w-5 h-5" />
            Unable to load profile
          </div>
          <p className="text-xs text-muted-foreground mb-4">{error || 'Record not found'}</p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { candidate, company, products, evidence, scoring_breakdown, discovery_explanation, linked_evaluations } = profile;
  const isDemo = discovery_explanation.is_demonstration_data || candidate.source_origin_type === 'DEMONSTRATION_FIXTURE';

  const filteredEvidence = evidence.filter(ev => {
    if (evidenceFilter === 'ALL') return true;
    return ev.verification_status === evidenceFilter;
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="w-full max-w-4xl bg-card border-l border-border h-full flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-border bg-muted/20">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-6 w-6 rounded-md bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
                    {company.name.substring(0, 2).toUpperCase()}
                  </span>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">{company.name}</h1>
                  <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                    ID: {company.id}
                  </span>
                  {isDemo ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Demonstration Fixture
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Traceable Master Record
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {company.headquarters}
                  </span>
                  <span>•</span>
                  <span>{company.company_type.replace('_', ' ')}</span>
                  <span>•</span>
                  <span className="text-foreground font-medium">Relationship: {company.relationship_with_axxelent}</span>
                  {company.website && (
                    <>
                      <span>•</span>
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-primary hover:underline flex items-center gap-0.5"
                      >
                        Official Website
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-border/60">
              <div className="p-2.5 rounded-lg bg-background border border-border">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">Deterministic Fit</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-base font-bold font-mono text-foreground">{scoring_breakdown.total_score}/100</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                    scoring_breakdown.fit_level === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {scoring_breakdown.fit_level}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-background border border-border">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">Customer Intent</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[11px] font-semibold text-foreground truncate" title={candidate.intent_status}>
                    {candidate.intent_status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-background border border-border">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">Evidence Completeness</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base font-bold font-mono text-foreground">{scoring_breakdown.evidence_completeness_score}%</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full" 
                      style={{ width: `${scoring_breakdown.evidence_completeness_score}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-background border border-border">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">Verified Proofs</span>
                <div className="text-base font-bold font-mono text-foreground mt-0.5">
                  {evidence.filter(e => e.verification_status === 'VERIFIED').length} / {evidence.length} Records
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 mt-4 overflow-x-auto text-xs border-b border-border/80 pb-0.5">
              {[
                { key: 'overview', label: '1. Overview & Discovery', icon: Search },
                { key: 'products', label: `2. Products (${products.length})`, icon: Layers },
                { key: 'evidence', label: `3. Evidence Archive (${evidence.length})`, icon: FileText },
                { key: 'score', label: '4. Score Breakdown', icon: BarChart3 },
                { key: 'intent', label: '5. Sourcing Intent', icon: TrendingUp },
                { key: 'evaluation', label: '6. CDMO Evaluation', icon: Factory },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
            {/* TAB 1: OVERVIEW & DISCOVERY EXPLANATION */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 1. Why did BDIQ identify this company? */}
                <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 font-mono">
                      <HelpCircle className="w-4 h-4" />
                      1. Why Did BDIQ Identify This Company?
                    </h3>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Source Origin: {discovery_explanation.source_origin}
                    </span>
                  </div>
                  <p className="text-foreground leading-relaxed text-xs">
                    {discovery_explanation.match_rationale}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-[11px]">
                    <div className="p-3 rounded-lg bg-background border border-border">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                        Discovery Trigger & Target
                      </span>
                      <div className="font-semibold text-foreground">
                        Subject: {discovery_explanation.query.subject_type} ({discovery_explanation.query.subject_id})
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        Target Market: {discovery_explanation.query.target_market}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-background border border-border">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
                        Applied Deterministic Rules
                      </span>
                      <ul className="space-y-1 list-disc list-inside text-foreground">
                        {discovery_explanation.rules_applied.map((rule, idx) => (
                          <li key={idx} className="truncate" title={rule}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Known Facts vs Unknown Gaps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified Known Facts
                    </span>
                    <ul className="space-y-2 text-[11px] text-foreground">
                      {discovery_explanation.known_facts.map((fact, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Critical Unknown Information & Gaps
                    </span>
                    <ul className="space-y-2 text-[11px] text-foreground">
                      {discovery_explanation.unknown_information.map((gap, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* BD Recommended Next Action */}
                <div className="p-4 rounded-xl bg-background border border-primary/30 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                      Recommended BD Next Action
                    </span>
                    <p className="text-xs font-semibold text-foreground mt-0.5">
                      {discovery_explanation.bd_recommended_next_action}
                    </p>
                  </div>
                </div>

                {/* Company Master Card */}
                <div className="p-4 rounded-xl bg-card border border-border">
                  <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-primary" />
                    Canonical Enterprise Master Attributes
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-mono">Countries of Operation:</span>
                      <span className="font-medium text-foreground">{company.countries_of_operation?.join(', ') || 'Global'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-mono">Therapeutic Areas:</span>
                      <span className="font-medium text-foreground">{company.therapeutic_areas?.join(', ') || 'Pharmaceutical'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-mono">Business Segments:</span>
                      <span className="font-medium text-foreground">{company.business_segments?.join(', ') || 'General Pharma'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-mono">Corporate Ticker / LEI:</span>
                      <span className="font-mono text-foreground">{company.corporate_identifiers?.ticker || 'N/A'} (LEI: {company.corporate_identifiers?.lei || 'N/A'})</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-mono">Master Verification Source:</span>
                      <span className="font-medium text-foreground">{company.source}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] font-mono">Last Synchronized:</span>
                      <span className="font-medium text-foreground">{new Date(company.last_source_refresh_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* NVIDIA Nemotron 3 Ultra Strategic Synthesis Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 via-background to-muted/20 border border-primary/30">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">NVIDIA Nemotron 3 Ultra 550B Synthesis</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/20 text-primary">
                          Evidence-Guardrailed
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Synthesizes capability fit without hallucinating citations, altering scores, or fabricating RFQs.
                      </p>
                    </div>

                    <button
                      onClick={handleRunAiSynthesis}
                      disabled={aiGenerating}
                      className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${aiGenerating ? 'animate-spin' : ''}`} />
                      {aiGenerating ? 'Reasoning with Nemotron...' : 'Run Nemotron Synthesis'}
                    </button>
                  </div>

                  {aiError && (
                    <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 text-destructive text-xs border border-destructive/20 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" />
                      {aiError}
                    </div>
                  )}

                  {aiResult && (
                    <div className="mt-4 p-4 rounded-xl bg-background border border-border space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border/50 pb-2">
                        <span className="font-mono text-primary font-semibold">{aiResult.ai_model_used}</span>
                        <span>{new Date(aiResult.generated_at).toLocaleTimeString()}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground block">Executive Strategic Assessment:</span>
                          <p className="text-xs font-medium text-foreground">{aiResult.synthesis?.executive_summary}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground block">Capability Alignment:</span>
                          <p className="text-xs text-foreground/90">{aiResult.synthesis?.capability_alignment_analysis}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-mono uppercase text-muted-foreground block">Sourcing Intent Evaluation:</span>
                          <p className="text-xs text-foreground/90">{aiResult.synthesis?.sourcing_intent_evaluation}</p>
                        </div>
                        {aiResult.synthesis?.recommended_bd_action_plan && (
                          <div>
                            <span className="text-[10px] font-mono uppercase text-muted-foreground block">Actionable BD Roadmap:</span>
                            <ul className="list-decimal list-inside text-xs text-foreground/90 space-y-0.5 mt-0.5">
                              {aiResult.synthesis.recommended_bd_action_plan.map((step: string, i: number) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="text-[10px] italic text-muted-foreground pt-1 border-t border-border/40 font-mono">
                        {aiResult.disclaimer}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CUSTOMER PRODUCT PORTFOLIO */}
            {activeTab === 'products' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Customer Commercial Portfolio & CDMO Capability Fit</h3>
                    <p className="text-xs text-muted-foreground">
                      Portfolio products analyzed for manufacturing suitability across Axxelent cleanroom facilities.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg border border-border">
                    {products.length} Products Monitored
                  </span>
                </div>

                <div className="space-y-3">
                  {products.map((p) => {
                    const matchColor = 
                      p.axxelent_capability_match === 'FULL_MATCH' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      p.axxelent_capability_match === 'HIGH_MATCH' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20';

                    return (
                      <div key={p.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-foreground">{p.product_name}</span>
                              <span className="text-[11px] text-muted-foreground">({p.generic_name})</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              Dosage: <strong className="text-foreground">{p.dosage_form}</strong> • Strength: <strong className="text-foreground">{p.strength}</strong> • Route: {p.route}
                            </div>
                          </div>

                          <span className={`inline-flex items-center px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase border ${matchColor}`}>
                            {p.axxelent_capability_match.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="p-3 bg-muted/20 rounded-lg border border-border/60 text-[11px] space-y-1">
                          <span className="font-semibold text-foreground block">Facility Capability Match Rationale:</span>
                          <p className="text-muted-foreground">{p.match_rationale}</p>
                          <div className="pt-1 flex flex-wrap gap-1.5">
                            {p.manufacturing_requirements.map((req, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-foreground">
                                {req}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-border/50">
                          <div className="text-muted-foreground flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                            <span>Proof Source: <strong className="text-foreground">{p.source_proof?.source_title}</strong></span>
                            <span>({p.source_proof?.source_date})</span>
                          </div>

                          {p.source_proof?.source_url && (
                            <a
                              href={p.source_proof.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                            >
                              <span>Inspect Filing Record</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: EVIDENCE & PROOF ARCHIVE */}
            {activeTab === 'evidence' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Traceable Evidence & Proof Archive</h3>
                    <p className="text-xs text-muted-foreground">
                      Every claim is backed by inspectable citations with excerpt locations and verification status.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Filter:</span>
                    <select
                      value={evidenceFilter}
                      onChange={(e) => setEvidenceFilter(e.target.value)}
                      className="bg-background border border-border rounded-lg text-xs py-1 px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="ALL">All Records ({evidence.length})</option>
                      <option value="VERIFIED">Verified Only</option>
                      <option value="SOURCE_LINKED_NOT_REVIEWED">Source-Linked (Not Reviewed)</option>
                      <option value="PARTIALLY_VERIFIED">Partially Verified</option>
                      <option value="DEMONSTRATION_DATA">Demonstration Data</option>
                      <option value="UNVERIFIED">Unverified / Unsupported</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredEvidence.map((ev) => {
                    const isVerified = ev.verification_status === 'VERIFIED';
                    const isDemoEv = ev.verification_status === 'DEMONSTRATION_DATA';

                    return (
                      <div 
                        key={ev.id}
                        className="p-4 rounded-xl border border-border bg-card hover:border-border/80 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                                isVerified ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                isDemoEv ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {ev.verification_status.replace(/_/g, ' ')}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {ev.claim_category}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-foreground pt-1">
                              "{ev.claim}"
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedEvidence(ev)}
                            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-semibold text-xs transition-colors shrink-0 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect Proof</span>
                          </button>
                        </div>

                        <div className="p-3 bg-muted/20 rounded-lg border-l-2 border-primary/40 text-[11px] italic font-serif text-foreground/90">
                          "{ev.source_excerpt}"
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
                          <div>
                            Source: <strong className="text-foreground">{ev.source_organization}</strong> - {ev.source_title}
                          </div>
                          <div>
                            Ref: {ev.location_reference} ({ev.source_date || 'Date Undisclosed'})
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: TRANSPARENT SCORE BREAKDOWN */}
            {activeTab === 'score' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/20 border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Deterministic Fit Score Calculation Engine
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Methodology: <strong className="text-foreground font-mono">{scoring_breakdown.methodology_version}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase block">Calculated Total</span>
                      <span className="text-2xl font-bold font-mono text-foreground">{scoring_breakdown.total_score}/100</span>
                    </div>
                    {scoring_breakdown.is_provisional && (
                      <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                        Provisional Score
                      </span>
                    )}
                  </div>
                </div>

                {/* Dimensions Table */}
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="min-w-full divide-y divide-border text-xs">
                    <thead className="bg-muted/40 font-mono text-[11px]">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase">Dimension</th>
                        <th className="px-3 py-2.5 text-center font-bold text-muted-foreground uppercase">Weight</th>
                        <th className="px-3 py-2.5 text-center font-bold text-muted-foreground uppercase">Score</th>
                        <th className="px-3 py-2.5 text-center font-bold text-muted-foreground uppercase">Weighted</th>
                        <th className="px-3 py-2.5 text-left font-bold text-muted-foreground uppercase">Applied Rule & Evidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-card">
                      {scoring_breakdown.dimensions.map((dim) => (
                        <tr key={dim.key} className="hover:bg-muted/20">
                          <td className="px-3 py-3 font-semibold text-foreground whitespace-nowrap">
                            {dim.name}
                          </td>
                          <td className="px-3 py-3 text-center font-mono text-muted-foreground">
                            {dim.weight}%
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-bold text-foreground">
                            {dim.score}/100
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-bold text-primary">
                            +{dim.weighted_score}
                          </td>
                          <td className="px-3 py-3 text-[11px] text-muted-foreground">
                            <div className="font-medium text-foreground">{dim.rule_applied}</div>
                            <div className="mt-0.5">{dim.explanation}</div>
                            {dim.missing_information && (
                              <div className="mt-1 text-amber-400 flex items-center gap-1 text-[10px] font-mono">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>Gap: {dim.missing_information}</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-muted/30 rounded-xl text-[11px] text-muted-foreground border border-border/50">
                  <strong>Scoring Audit Policy:</strong> Final fit scores are computed deterministically from verified evidence across the 6 dimensions. AI models are strictly prohibited from inventing scores or overriding deterministic weights.
                </div>
              </div>
            )}

            {/* TAB 5: SOURCING INTENT */}
            {activeTab === 'intent' && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Mandatory Separation: Customer Fit vs. Commercial Intent
                  </div>
                  <p className="text-amber-200/90 leading-relaxed">
                    <strong>Customer Fit</strong> reflects technological synergy between the customer's molecule requirements and Axxelent manufacturing suites.
                    <br />
                    <strong>Customer Intent</strong> requires real, verifiable evidence of an active outsourcing need (such as a public tender notice, corporate CMO disclosure, or bilateral RFQ). A high fit score does NOT imply commercial readiness.
                  </p>
                </div>

                <div className="p-5 rounded-xl border border-border bg-card space-y-3">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                    Current Verified Intent Status
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-foreground">
                      {candidate.intent_status.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-muted text-muted-foreground border border-border">
                      Source Verified
                    </span>
                  </div>

                  <div className="p-3.5 bg-muted/20 rounded-lg border border-border text-xs text-foreground/90 space-y-1">
                    <span className="font-semibold block text-[11px] text-muted-foreground font-mono">
                      Intent Evidence Summary:
                    </span>
                    <p className="leading-relaxed">
                      {candidate.intent_evidence_summary || 'No direct bilateral RFQ or commercial request has been submitted to date.'}
                    </p>
                  </div>
                </div>

                {/* Sourcing Signals from Evidence */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                    Monitored Sourcing Signals
                  </h4>
                  {evidence.filter(e => e.claim_category === 'SOURCING_SIGNAL' || e.claim_category === 'RELATIONSHIP_HISTORY').map(ev => (
                    <div key={ev.id} className="p-3.5 rounded-lg border border-border bg-card text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{ev.source_title}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{ev.source_date}</span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">"{ev.claim}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: CDMO EVALUATION */}
            {activeTab === 'evaluation' && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">CDMO Production Feasibility & Commercial Bridge</h3>
                    <p className="text-xs text-muted-foreground">
                      Direct integration with Axxelent's deterministic manufacturing and commercial modules.
                    </p>
                  </div>
                </div>

                {/* Production Feasibility Card */}
                {linked_evaluations.production_feasibility && (
                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Factory className="w-4 h-4 text-primary" />
                        <span className="font-bold text-xs text-foreground">Production Feasibility Platform</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        {linked_evaluations.production_feasibility.status} ({linked_evaluations.production_feasibility.score}%)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-[10px] font-mono text-muted-foreground block">Facility Assignment:</span>
                        <span className="font-semibold text-foreground">{linked_evaluations.production_feasibility.target_facility}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-[10px] font-mono text-muted-foreground block">Available Capacity:</span>
                        <span className="font-semibold text-foreground">{linked_evaluations.production_feasibility.batch_capacity_available}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      Compatible Suites: {linked_evaluations.production_feasibility.equipment_lines_compatible.join(' • ')}
                    </div>

                    <button
                      onClick={() => navigate('/production-feasibility')}
                      className="w-full py-2 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg text-xs transition-colors border border-border flex items-center justify-center gap-1.5"
                    >
                      <span>Open Production Feasibility Platform</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Commercial Evaluation Card */}
                {linked_evaluations.commercial_evaluation && (
                  <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-xs text-foreground">Commercial Evaluation Engine</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                        {linked_evaluations.commercial_evaluation.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-[10px] font-mono text-muted-foreground block">Estimated Annual Value:</span>
                        <span className="font-semibold text-foreground">{linked_evaluations.commercial_evaluation.estimated_annual_batch_value}</span>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-[10px] font-mono text-muted-foreground block">Target EBITDA:</span>
                        <span className="font-semibold text-foreground">{linked_evaluations.commercial_evaluation.target_ebitda_margin_percent}%</span>
                      </div>
                      <div className="p-3 rounded-lg bg-background border border-border">
                        <span className="text-[10px] font-mono text-muted-foreground block">API Pass-Through:</span>
                        <span className="font-semibold text-foreground">{linked_evaluations.commercial_evaluation.api_pass_through}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate('/commercial-evaluation')}
                      className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition-colors shadow-xs flex items-center justify-center gap-1.5"
                    >
                      <span>Open Commercial Evaluation Engine</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Traceable Source Proof Inspector Modal */}
      {selectedEvidence && (
        <SourceProofModal
          evidence={selectedEvidence}
          candidateId={candidate.id}
          companyName={company.name}
          sessionToken={sessionToken}
          onClose={() => setSelectedEvidence(null)}
          onVerificationUpdated={(updated) => {
            // Update local evidence item and refetch profile to reflect updated score
            setProfile(prev => {
              if (!prev) return null;
              return {
                ...prev,
                evidence: prev.evidence.map(e => e.id === updated.id ? updated : e)
              };
            });
            fetchProfile();
            if (onCandidateUpdated) onCandidateUpdated();
          }}
        />
      )}
    </>
  );
};
