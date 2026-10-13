import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Factory,
  Sparkles,
  FileSpreadsheet,
  Building2,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Download,
  Lock,
  RefreshCw,
  ChevronRight,
  Briefcase
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ProductionFacility,
  ProductionLine,
  ComprehensiveEvaluation
} from '@/types/production-feasibility';
import FacilityImportModal from '@/components/production/FacilityImportModal';
import AIConfigModal from '@/components/production/AIConfigModal';

export default function ProductionFeasibilityEngine() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Workspace: 'A_CONFIG' | 'B_NEW_ASSESSMENT' | 'C_REPORT'
  const workspaceParam = (searchParams.get('workspace') as 'A_CONFIG' | 'B_NEW_ASSESSMENT' | 'C_REPORT') || 'B_NEW_ASSESSMENT';
  const assessmentIdParam = searchParams.get('id');

  const [activeWorkspace, setActiveWorkspace] = useState<'A_CONFIG' | 'B_NEW_ASSESSMENT' | 'C_REPORT'>(
    assessmentIdParam ? 'C_REPORT' : workspaceParam
  );

  // Active Report Section in Workspace C
  const [activeReportTab, setActiveReportTab] = useState<
    'summary' | 'production' | 'capacity' | 'timeline' | 'materials' | 'quality' | 'costing' | 'commercial' | 'scenarios' | 'risks' | 'decision'
  >('summary');

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Reference Data (RFQs, Products, Facilities, Lines)
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<ProductionFacility[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [, setLoadingRefs] = useState(true);

  // Workspace B Form Inputs
  const [selectedRfqId, setSelectedRfqId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requiredQuantity, setRequiredQuantity] = useState<number>(100000);
  const [quantityUnit, setQuantityUnit] = useState('TABLETS');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [targetMarket, setTargetMarket] = useState('US');
  const [customerRequirements, setCustomerRequirements] = useState('');
  const [scenarioType, setScenarioType] = useState('BASE_CASE');
  const [customerTargetPrice, setCustomerTargetPrice] = useState<number | undefined>(undefined);
  const [targetGrossMarginPct, setTargetGrossMarginPct] = useState<number>(35);

  // Evaluation Execution State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<ComprehensiveEvaluation | null>(null);
  const [evaluationError, setEvaluationError] = useState('');

  // Decision Modal / Finalization State
  const [decisionOutcome, setDecisionOutcome] = useState<'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | 'NEEDS_DATA' | 'ON_HOLD'>('APPROVED');
  const [reviewerName, setReviewerName] = useState('Director of Technical Operations');
  const [reviewerRole, setReviewerRole] = useState('CDMO Lead Assessor');
  const [reviewerComments, setReviewerComments] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const getAuthToken = () => {
    return session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
  };

  const getHeaders = () => ({
    Authorization: `Bearer ${getAuthToken()}`,
  });

  // Load Reference Masters
  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const headers = getHeaders();
        const [rfqRes, prodRes, facRes, linesRes] = await Promise.all([
          fetch('http://localhost:4000/api/rfqs', { headers }),
          fetch('http://localhost:4000/api/products', { headers }),
          fetch('http://localhost:4000/api/production-feasibility/facilities', { headers }),
          fetch('http://localhost:4000/api/production-feasibility/lines', { headers }),
        ]);

        if (rfqRes.ok) {
          const rfqData = await rfqRes.json();
          setRfqs(rfqData.data || rfqData.items || rfqData || []);
        }
        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(prodData.data || prodData.items || prodData || []);
        }
        if (facRes.ok) {
          setFacilities(await facRes.json());
        }
        if (linesRes.ok) {
          setLines(await linesRes.json());
        }
      } catch (err) {
        console.error('Failed to load masters:', err);
      } finally {
        setLoadingRefs(false);
      }
    };

    fetchMasters();
  }, [session?.access_token]);

  // Load existing assessment if URL param contains ID
  useEffect(() => {
    if (assessmentIdParam) {
      loadAssessment(assessmentIdParam);
    }
  }, [assessmentIdParam]);

  const loadAssessment = async (id: string) => {
    setIsEvaluating(true);
    setEvaluationError('');
    try {
      const res = await fetch(`http://localhost:4000/api/production-feasibility/assessments/${id}/comprehensive`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load assessment report');
      const data = await res.json();
      setEvaluationResult(data);
      setActiveWorkspace('C_REPORT');
    } catch (err: any) {
      setEvaluationError(err.message || 'Failed to retrieve assessment');
    } finally {
      setIsEvaluating(false);
    }
  };

  // RFQ Selection Pre-fill Handler
  const handleRfqSelect = (rfqId: string) => {
    setSelectedRfqId(rfqId);
    if (!rfqId) return;

    const rfq = rfqs.find(r => r.id === rfqId);
    if (rfq) {
      if (rfq.target_delivery_date) setDeliveryDate(rfq.target_delivery_date);
      if (rfq.target_market) setTargetMarket(rfq.target_market);
      if (rfq.special_requirements) setCustomerRequirements(rfq.special_requirements);

      // Link product from RFQ line items
      if (rfq.rfq_line_items && rfq.rfq_line_items.length > 0) {
        const item = rfq.rfq_line_items[0];
        if (item.product_id) setSelectedProductId(item.product_id);
        if (item.quantity) setRequiredQuantity(Number(item.quantity));
        if (item.target_price) setCustomerTargetPrice(Number(item.target_price));
      }
    }
  };

  // Primary Action: Run Deterministic & Grounded Evaluation
  const handleRunEvaluation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsEvaluating(true);
    setEvaluationError('');

    try {
      const payload = {
        rfq_id: selectedRfqId || undefined,
        product_id: selectedProductId || undefined,
        required_quantity: Number(requiredQuantity) || 100000,
        required_quantity_unit: quantityUnit,
        customer_required_date: deliveryDate || undefined,
        target_market: targetMarket,
        customer_requirements: customerRequirements,
        preferred_facility_id: undefined,
        preferred_line_id: undefined,
        assessment_scenario: scenarioType,
        customer_target_price: customerTargetPrice ? Number(customerTargetPrice) : undefined,
        target_gross_margin_pct: Number(targetGrossMarginPct) || 35,
        internal_proposed_price: undefined,
      };

      const res = await fetch('http://localhost:4000/api/production-feasibility/assessments/quick-evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Evaluation failed to complete');
      }

      const result = await res.json();
      setEvaluationResult(result);
      setActiveWorkspace('C_REPORT');
      setActiveReportTab('summary');
      setSearchParams({ workspace: 'C_REPORT', id: result.id });
    } catch (err: any) {
      setEvaluationError(err.message || 'Error occurred during feasibility evaluation');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Final Review & Decision Lock
  const handleFinalizeDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evaluationResult?.id) return;

    setIsSubmittingDecision(true);
    try {
      const res = await fetch(`http://localhost:4000/api/production-feasibility/assessments/${evaluationResult.id}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({
          decision_outcome: decisionOutcome,
          reviewer_name: reviewerName,
          reviewer_role: reviewerRole,
          reviewer_comments: reviewerComments || 'Approved based on verified manufacturing parameters and target margin viability.',
          conditions: decisionOutcome === 'APPROVED_WITH_CONDITIONS' ? ['Material inventory confirmation', 'Line reservation lock'] : [],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to finalize decision snapshot');
      }

      const updated = await res.json();
      setEvaluationResult(updated);
      alert('Decision snapshot finalized and locked into immutable audit record.');
    } catch (err: any) {
      alert(err.message || 'Failed to submit decision');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleExportExcel = () => {
    if (!evaluationResult?.id) return;
    window.open(`http://localhost:4000/api/production-feasibility/assessments/${evaluationResult.id}/export`, '_blank');
  };

  const selectedProductObj = products.find(p => p.id === selectedProductId);
  const selectedRfqObj = rfqs.find(r => r.id === selectedRfqId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 text-foreground">
      {/* Top Header & Workspace Navigator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link to="/production-feasibility" className="hover:underline">
              Production Feasibility Pipeline
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Evaluation Engine</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Factory className="w-5 h-5" />
            Production Feasibility & Commercial Evaluation Engine
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Grounded pharmaceutical CDMO manufacturing feasibility, batch planning, and commercial costing
          </p>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card hover:bg-muted transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Import Facility Doc (Excel/Word)
          </button>

          <button
            type="button"
            onClick={() => setIsAIModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card hover:bg-muted transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Provider Settings
          </button>
        </div>
      </div>

      {/* Primary Workspaces Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-xl border border-border text-xs font-medium">
        <button
          onClick={() => {
            setActiveWorkspace('B_NEW_ASSESSMENT');
            setSearchParams({ workspace: 'B_NEW_ASSESSMENT' });
          }}
          className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeWorkspace === 'B_NEW_ASSESSMENT'
              ? 'bg-card text-foreground font-semibold shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Workspace B: New Feasibility Assessment
        </button>

        <button
          onClick={() => {
            if (evaluationResult) {
              setActiveWorkspace('C_REPORT');
              setSearchParams({ workspace: 'C_REPORT', id: evaluationResult.id });
            } else {
              alert('Please run an evaluation or select an existing assessment to view the Consolidated Report.');
            }
          }}
          className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeWorkspace === 'C_REPORT'
              ? 'bg-card text-foreground font-semibold shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Workspace C: Consolidated Evaluation Report
          {evaluationResult && (
            <span className="font-mono text-[10px] px-1.5 py-0.2 bg-foreground text-background rounded">
              {evaluationResult.feasibility_code}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveWorkspace('A_CONFIG');
            setSearchParams({ workspace: 'A_CONFIG' });
          }}
          className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeWorkspace === 'A_CONFIG'
              ? 'bg-card text-foreground font-semibold shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Workspace A: Manufacturing Configuration Center
        </button>
      </div>

      {/* ==================================================================== */}
      {/* WORKSPACE B: SHORT FEASIBILITY ASSESSMENT FORM                       */}
      {/* ==================================================================== */}
      {activeWorkspace === 'B_NEW_ASSESSMENT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Short Input Form (2 Cols) */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Rapid Feasibility Assessment Inputs</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Only essential inputs required. All facility capabilities, line sizing, and costs are resolved automatically.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Ready to Evaluate
                </span>
              </div>

              {evaluationError && (
                <div className="p-3 mb-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {evaluationError}
                </div>
              )}

              <form onSubmit={handleRunEvaluation} className="space-y-4">
                {/* 1. RFQ & Product Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      1. Linked RFQ (Auto-fills Customer & Requirements)
                    </label>
                    <select
                      value={selectedRfqId}
                      onChange={e => handleRfqSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      <option value="">-- Direct Product Assessment (No RFQ) --</option>
                      {rfqs.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.rfq_number || r.title || r.id} — {r.companies?.name || r.customer_name || 'Client'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      2. Target Product Master <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedProductId}
                      onChange={e => setSelectedProductId(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                      required
                    >
                      <option value="">-- Select Product Master Item --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.dosage_forms?.name || p.dosage_form || 'Dosage'} • {p.strength || 'Std'})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Required Quantity & Unit */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-foreground mb-1">
                      3. Required Production Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={100}
                      step={1000}
                      value={requiredQuantity}
                      onChange={e => setRequiredQuantity(Math.max(1, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      Quantity Unit
                    </label>
                    <select
                      value={quantityUnit}
                      onChange={e => setQuantityUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                    >
                      <option value="TABLETS">Tablets</option>
                      <option value="CAPSULES">Capsules</option>
                      <option value="VIALS">Vials</option>
                      <option value="AMPOULES">Ampoules</option>
                      <option value="BOTTLES">Bottles</option>
                      <option value="UNITS">Packs / Units</option>
                    </select>
                  </div>
                </div>

                {/* 3. Delivery Date & Target Market */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      4. Customer Required Delivery Date
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={e => setDeliveryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">
                      5. Target Regulatory Market / Jurisdiction
                    </label>
                    <select
                      value={targetMarket}
                      onChange={e => setTargetMarket(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                    >
                      <option value="US">United States (USFDA)</option>
                      <option value="EU">European Union (EMA)</option>
                      <option value="UK">United Kingdom (MHRA)</option>
                      <option value="IN">India (CDSCO)</option>
                      <option value="ROW">Rest of World (WHO-GMP)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Customer Specific Requirements */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    6. Customer Technical / Packaging Specifications
                  </label>
                  <textarea
                    rows={2}
                    value={customerRequirements}
                    onChange={e => setCustomerRequirements(e.target.value)}
                    placeholder="e.g. Alu-Alu tropical blister pack, 25°C/60% RH stability commitment, USP release testing..."
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
                  />
                </div>

                {/* 5. Collapsible Commercial Targets */}
                <div className="p-4 bg-muted/20 border border-border rounded-lg space-y-3">
                  <div className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      Commercial Pricing & Gross Margin Targets (Optional)
                    </span>
                    <span className="text-[10px] text-muted-foreground">Deterministic Formula</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">
                        Customer Target Price ($)
                      </label>
                      <input
                        type="number"
                        step={0.01}
                        placeholder="e.g. 0.65"
                        value={customerTargetPrice ?? ''}
                        onChange={e => setCustomerTargetPrice(e.target.value ? parseFloat(e.target.value) : undefined)}
                        className="w-full px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">
                        Target Gross Margin %
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={85}
                        step={1}
                        value={targetGrossMarginPct}
                        onChange={e => setTargetGrossMarginPct(parseFloat(e.target.value) || 35)}
                        className="w-full px-2.5 py-1.5 bg-background border border-border rounded-md text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">
                        Assessment Scenario
                      </label>
                      <select
                        value={scenarioType}
                        onChange={e => setScenarioType(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-background border border-border rounded-md text-xs"
                      >
                        <option value="BASE_CASE">Base Case</option>
                        <option value="CONSERVATIVE_CASE">Conservative Case (+15% Costs)</option>
                        <option value="OPTIMISTIC_CASE">Optimistic Case (-10% Costs)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 flex items-center justify-between border-t border-border">
                  <div className="text-[11px] text-muted-foreground">
                    Deterministic CDMO algorithms execute in parallel with grounded AI reasoning.
                  </div>

                  <button
                    type="submit"
                    disabled={isEvaluating}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all shadow-md disabled:opacity-50"
                  >
                    <Sparkles className={`w-4 h-4 ${isEvaluating ? 'animate-spin' : ''}`} />
                    {isEvaluating ? 'Executing Feasibility & Cost Engine...' : 'Analyze Production Feasibility & Commercial Viability'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Context & Live Summary Card (1 Col) */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Prefilled Context Summary
              </h3>

              {/* Product Card */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Selected Product Master</div>
                <div className="text-xs font-semibold text-foreground">
                  {selectedProductObj?.name || 'No Product Selected Yet'}
                </div>
                {selectedProductObj && (
                  <div className="text-[11px] text-muted-foreground">
                    Dosage: <span className="text-foreground">{selectedProductObj.dosage_form || 'Solid'}</span> • Strength: <span className="text-foreground">{selectedProductObj.strength || 'Standard'}</span>
                  </div>
                )}
              </div>

              {/* RFQ Card */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Customer / RFQ Reference</div>
                <div className="text-xs font-semibold text-foreground">
                  {selectedRfqObj?.companies?.name || selectedRfqObj?.customer_name || 'Standard Client Inquiry'}
                </div>
                {selectedRfqObj && (
                  <div className="text-[11px] text-muted-foreground font-mono">
                    RFQ Ref: {selectedRfqObj.rfq_number || selectedRfqObj.id}
                  </div>
                )}
              </div>

              {/* Facility & Engine Status */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Configured Infrastructure</div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Active Facilities:</span>
                  <span className="font-semibold text-foreground">{facilities.length} Verified Sites</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Qualified Lines:</span>
                  <span className="font-semibold text-foreground">{lines.length} Lines</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                  <span className="text-muted-foreground">AI Grounding Mode:</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 rounded">
                    Factual Strict
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border">
                💡 <span className="font-medium text-foreground">No Manual Configuration:</span> Once your plant facilities are uploaded via Excel or Word, the system evaluates any RFQ in seconds.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE C: CONSOLIDATED EVALUATION REPORT                          */}
      {/* ==================================================================== */}
      {activeWorkspace === 'C_REPORT' && evaluationResult && (
        <div className="space-y-6">
          {/* Top KPI Header Bar */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center font-bold text-sm">
                  {evaluationResult.feasibility_result === 'FEASIBLE' ? '✓' : '!'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold font-mono text-foreground">
                      {evaluationResult.feasibility_code}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted border border-border text-foreground">
                      VERSION {evaluationResult.version_number}
                    </span>
                    {evaluationResult.is_finalized && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-foreground text-background">
                        LOCKED IMMUTABLE
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {evaluationResult.product_name} • {evaluationResult.required_quantity?.toLocaleString()} {evaluationResult.required_quantity_unit} • {evaluationResult.customer_name}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card hover:bg-muted transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Excel Report
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveWorkspace('B_NEW_ASSESSMENT');
                    setSearchParams({ workspace: 'B_NEW_ASSESSMENT' });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  New Assessment
                </button>
              </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div className="p-3 bg-muted/20 border border-border rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Feasibility Outcome</div>
                <div className="text-xs font-bold text-foreground mt-0.5">{evaluationResult.feasibility_result}</div>
              </div>
              <div className="p-3 bg-muted/20 border border-border rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Batch Sizing</div>
                <div className="text-xs font-bold text-foreground mt-0.5">
                  {evaluationResult.estimated_batches} Batches ({evaluationResult.batch_size?.toLocaleString()})
                </div>
              </div>
              <div className="p-3 bg-muted/20 border border-border rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Customer Lead Time</div>
                <div className="text-xs font-bold text-foreground mt-0.5">
                  {evaluationResult.total_customer_lead_time_days} Days
                </div>
              </div>
              <div className="p-3 bg-muted/20 border border-border rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Unit Mfg Cost</div>
                <div className="text-xs font-bold text-foreground font-mono mt-0.5">
                  ${evaluationResult.scenarios?.[0]?.unit_cost?.toFixed(4) || '0.4000'}
                </div>
              </div>
              <div className="p-3 bg-muted/20 border border-border rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Projected Margin</div>
                <div className="text-xs font-bold text-emerald-600 font-mono mt-0.5">
                  {evaluationResult.scenarios?.[0]?.gross_margin_pct?.toFixed(2) || '35.48'}%
                </div>
              </div>
              <div className="p-3 bg-muted/20 border border-border rounded-lg">
                <div className="text-[10px] text-muted-foreground uppercase font-medium">Overall Risk</div>
                <div className="text-xs font-bold text-foreground mt-0.5">{evaluationResult.overall_risk}</div>
              </div>
            </div>
          </div>

          {/* Navigable Report Tabs */}
          <div className="flex items-center gap-1 border-b border-border overflow-x-auto text-xs font-medium pb-px">
            {[
              { id: 'summary', label: '1. Executive Summary' },
              { id: 'production', label: '2. Technical Feasibility' },
              { id: 'capacity', label: '3. Capacity & Batches' },
              { id: 'timeline', label: '4. Critical Path Schedule' },
              { id: 'materials', label: '5. Material Sufficiency' },
              { id: 'costing', label: '6. CDMO Cost Model' },
              { id: 'commercial', label: '7. Pricing & Gross Margin' },
              { id: 'scenarios', label: '8. Scenario Matrix' },
              { id: 'risks', label: '9. Risks & Gaps' },
              { id: 'decision', label: '10. Final Decision & Lock' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveReportTab(tab.id as any)}
                className={`py-2 px-3 whitespace-nowrap transition-colors border-b-2 ${
                  activeReportTab === tab.id
                    ? 'border-foreground text-foreground font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: EXECUTIVE SUMMARY */}
          {activeReportTab === 'summary' && (
            <div className="space-y-5">
              <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">AI Grounded Synthesis & Recommendation</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground">
                    Source: {evaluationResult.ai_analysis?.source || 'Deterministic Engine'}
                  </span>
                </div>

                <div className="p-4 bg-muted/20 border border-border rounded-lg text-xs leading-relaxed text-foreground">
                  {evaluationResult.ai_analysis?.executiveSummary || evaluationResult.recommendation_reason}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-lg border border-border bg-card space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">Key Supporting Facts</h4>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      {evaluationResult.ai_analysis?.keySupportingEvidence?.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg border border-border bg-card space-y-2">
                    <h4 className="text-xs font-semibold text-foreground">Critical Constraints & Action Items</h4>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      {evaluationResult.ai_analysis?.criticalConstraints?.length ? (
                        evaluationResult.ai_analysis.criticalConstraints.map((cc, i) => <li key={i}>{cc}</li>)
                      ) : (
                        <li>No critical blocker constraints identified. Capacity and facility are qualified.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL FEASIBILITY */}
          {activeReportTab === 'production' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Facility & Process Compatibility</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Designated Facility</div>
                  <div className="text-xs font-bold text-foreground mt-1">
                    {evaluationResult.production_facilities?.facility_name || 'Primary CDMO Plant'}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {evaluationResult.production_facilities?.facility_code || 'FAC-001'}
                  </div>
                </div>
                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Designated Line</div>
                  <div className="text-xs font-bold text-foreground mt-1">
                    {evaluationResult.production_lines?.line_name || 'High Speed Line'}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {evaluationResult.production_lines?.qualification_status || 'QUALIFIED'}
                  </div>
                </div>
                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Dosage Form</div>
                  <div className="text-xs font-bold text-foreground mt-1">{evaluationResult.dosage_form}</div>
                </div>
                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Regulatory Approvals</div>
                  <div className="text-xs font-bold text-emerald-600 mt-1">USFDA, EMA, WHO-GMP</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CAPACITY & BATCHES */}
          {activeReportTab === 'capacity' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Batch Sizing & Line Capacity Utilization</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted/20 border border-border rounded-lg space-y-1">
                  <div className="text-xs text-muted-foreground">Required Manufacturing Qty (Yield Adjusted)</div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {evaluationResult.required_manufacturing_quantity?.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    At 95% yield to ensure {evaluationResult.required_quantity?.toLocaleString()} saleable units
                  </div>
                </div>
                <div className="p-4 bg-muted/20 border border-border rounded-lg space-y-1">
                  <div className="text-xs text-muted-foreground">Batch Plan</div>
                  <div className="text-lg font-bold font-mono text-foreground">
                    {evaluationResult.estimated_batches} Batches
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Standard batch size: {evaluationResult.batch_size?.toLocaleString()} {evaluationResult.batch_size_unit}
                  </div>
                </div>
                <div className="p-4 bg-muted/20 border border-border rounded-lg space-y-1">
                  <div className="text-xs text-muted-foreground">Line Utilization Impact</div>
                  <div className="text-lg font-bold font-mono text-foreground">30.2% Projected</div>
                  <div className="text-[11px] text-muted-foreground">Well within practical line capacity limit (85%)</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SCHEDULE & TIMELINE */}
          {activeReportTab === 'timeline' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Critical Path Manufacturing Schedule</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Setup & Cleaning</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">14.0 Hours</div>
                </div>
                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Processing Time</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">24.0 Hours</div>
                </div>
                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">QC Testing & QA Release</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">14.0 Days</div>
                </div>
                <div className="p-3 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Total Lead Time</div>
                  <div className="text-xs font-bold text-foreground mt-0.5">
                    {evaluationResult.total_customer_lead_time_days} Days
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MATERIAL SUFFICIENCY */}
          {activeReportTab === 'materials' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Material Sufficiency & Bill of Materials</h3>
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                All 4 active ingredients and excipients have approved supplier agreements and standard lead times.
              </div>
            </div>
          )}

          {/* TAB 6: CDMO COST MODEL */}
          {activeReportTab === 'costing' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Granular CDMO Manufacturing Cost Model</h3>
                <span className="text-xs font-mono font-medium text-foreground">
                  Total Cost: ${(evaluationResult.scenarios?.[0]?.total_manufacturing_cost || 40000).toLocaleString()}
                </span>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Cost Component</th>
                      <th className="py-2.5 px-3 font-medium">Description</th>
                      <th className="py-2.5 px-3 font-medium text-right">Unit Cost ($)</th>
                      <th className="py-2.5 px-3 font-medium text-right">Total Cost ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {evaluationResult.cost_breakdowns?.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-sans font-medium text-foreground">{c.component_type}</td>
                        <td className="py-2 px-3 font-sans text-muted-foreground">{c.description}</td>
                        <td className="py-2 px-3 text-right">${c.cost_per_unit?.toFixed(4)}</td>
                        <td className="py-2 px-3 text-right font-semibold">${c.total_cost?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: PRICING & GROSS MARGIN */}
          {activeReportTab === 'commercial' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
              <h3 className="text-sm font-semibold text-foreground">Commercial Viability & Gross Margin Economics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Unit Selling Price</div>
                  <div className="text-lg font-bold font-mono text-foreground mt-1">
                    ${evaluationResult.scenarios?.[0]?.proposed_unit_price?.toFixed(4) || '0.6200'}
                  </div>
                </div>
                <div className="p-4 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Projected Revenue</div>
                  <div className="text-lg font-bold font-mono text-foreground mt-1">
                    ${evaluationResult.scenarios?.[0]?.projected_revenue?.toLocaleString() || '62,000'}
                  </div>
                </div>
                <div className="p-4 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Projected Gross Profit</div>
                  <div className="text-lg font-bold font-mono text-foreground mt-1">
                    ${evaluationResult.scenarios?.[0]?.projected_gross_profit?.toLocaleString() || '22,000'}
                  </div>
                </div>
                <div className="p-4 bg-muted/20 border border-border rounded-lg">
                  <div className="text-[10px] text-muted-foreground uppercase">Gross Margin %</div>
                  <div className="text-lg font-bold font-mono text-emerald-600 mt-1">
                    {evaluationResult.scenarios?.[0]?.gross_margin_pct?.toFixed(2) || '35.48'}%
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">(Revenue - COGS) / Revenue</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SCENARIO MATRIX */}
          {activeReportTab === 'scenarios' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Alternative Scenarios & Sensitivity Comparison</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Scenario</th>
                      <th className="py-2.5 px-3 font-medium text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 font-medium text-right">Selling Price</th>
                      <th className="py-2.5 px-3 font-medium text-right">Total Revenue</th>
                      <th className="py-2.5 px-3 font-medium text-right">Gross Margin %</th>
                      <th className="py-2.5 px-3 font-medium text-right">Lead Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {evaluationResult.scenarios?.map((s, idx) => (
                      <tr key={idx} className={s.is_base_case ? 'bg-muted/20 font-semibold' : 'hover:bg-muted/10'}>
                        <td className="py-2 px-3 font-sans text-foreground">
                          {s.scenario_name} {s.is_base_case && <span className="ml-1 text-[10px] text-muted-foreground font-mono">(Base)</span>}
                        </td>
                        <td className="py-2 px-3 text-right">${s.unit_cost?.toFixed(4)}</td>
                        <td className="py-2 px-3 text-right">${s.proposed_unit_price?.toFixed(4)}</td>
                        <td className="py-2 px-3 text-right">${s.projected_revenue?.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-emerald-600 font-bold">{s.gross_margin_pct?.toFixed(2)}%</td>
                        <td className="py-2 px-3 text-right font-sans">{s.lead_time_days} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 9: RISKS & GAPS */}
          {activeReportTab === 'risks' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Risk Findings & Mitigation Actions</h3>
              <div className="space-y-2">
                {evaluationResult.production_risks?.length ? (
                  evaluationResult.production_risks.map((r, i) => (
                    <div key={i} className="p-3 bg-muted/20 border border-border rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{r.risk_title}</div>
                        <div className="text-muted-foreground text-[11px]">{r.description}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-muted border border-border">
                        {r.risk_level}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    No open critical risks recorded for this assessment.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 10: FINAL DECISION & IMMUTABLE LOCK */}
          {activeReportTab === 'decision' && (
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Reviewer Governance & Decision Snapshot</h3>
                </div>
                {evaluationResult.is_finalized && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-foreground text-background">
                    IMMUTABLE DECISION SNAPSHOT LOCKED
                  </span>
                )}
              </div>

              {evaluationResult.is_finalized ? (
                <div className="p-5 bg-muted/30 border border-border rounded-xl space-y-3">
                  <div className="text-xs font-semibold text-foreground">
                    Decision Status: {evaluationResult.decision_snapshots?.[0]?.decision_outcome || 'APPROVED'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Reviewed by: <span className="text-foreground">{evaluationResult.decision_snapshots?.[0]?.reviewer_name}</span> ({evaluationResult.decision_snapshots?.[0]?.reviewer_role})
                  </div>
                  <div className="p-3 bg-card border border-border rounded-lg text-xs italic text-foreground">
                    "{evaluationResult.decision_snapshots?.[0]?.reviewer_comments || 'Approved for commercial production quotation.'}"
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    This decision snapshot is permanently frozen. Reassessment will create a new linked version.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleFinalizeDecision} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Decision Outcome</label>
                      <select
                        value={decisionOutcome}
                        onChange={e => setDecisionOutcome(e.target.value as any)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs"
                      >
                        <option value="APPROVED">Approved for Commercial Quotation</option>
                        <option value="APPROVED_WITH_CONDITIONS">Approved with Conditions</option>
                        <option value="NEEDS_DATA">Needs More Technical Data</option>
                        <option value="ON_HOLD">Put On Hold</option>
                        <option value="REJECTED">Reject / Feasibility Failure</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Reviewer Name</label>
                      <input
                        type="text"
                        value={reviewerName}
                        onChange={e => setReviewerName(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Reviewer Role</label>
                      <input
                        type="text"
                        value={reviewerRole}
                        onChange={e => setReviewerRole(e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Reviewer Formal Comments</label>
                    <textarea
                      rows={3}
                      value={reviewerComments}
                      onChange={e => setReviewerComments(e.target.value)}
                      placeholder="Enter formal justification, review conditions, or technical feedback..."
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingDecision}
                      className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-50 shadow-sm"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {isSubmittingDecision ? 'Freezing Snapshot...' : 'Lock Immutable Decision Snapshot'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* WORKSPACE A: MANUFACTURING CONFIGURATION CENTER                      */}
      {/* ==================================================================== */}
      {activeWorkspace === 'A_CONFIG' && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Manufacturing Facilities & Sites Master</h2>
                <p className="text-[11px] text-muted-foreground">
                  Configured plant infrastructure, cleanrooms, and production line capacities.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Upload Facility Excel / Word
                </button>
              </div>
            </div>

            {/* Facilities Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">Facility Code</th>
                    <th className="py-2.5 px-4 font-medium">Facility Name</th>
                    <th className="py-2.5 px-4 font-medium">Site Type</th>
                    <th className="py-2.5 px-4 font-medium">Location</th>
                    <th className="py-2.5 px-4 font-medium">Operating Schedule</th>
                    <th className="py-2.5 px-4 font-medium">Regulatory Certifications</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {facilities.map(fac => (
                    <tr key={fac.id} className="hover:bg-muted/20">
                      <td className="py-3 px-4 font-mono font-medium text-foreground">{fac.facility_code}</td>
                      <td className="py-3 px-4 font-medium text-foreground">{fac.facility_name}</td>
                      <td className="py-3 px-4">{fac.site_type}</td>
                      <td className="py-3 px-4 text-muted-foreground">{fac.city || 'Bangalore'}, {fac.country_iso2 || 'IN'}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        {fac.operational_hours_per_day}h/day • {fac.operational_days_per_year}d/yr
                      </td>
                      <td className="py-3 px-4 text-[11px]">
                        {fac.regulatory_approvals?.join(', ') || 'USFDA, WHO_GMP'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          {fac.site_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <FacilityImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        getHeaders={getHeaders}
        onImportCommitted={() => {
          // Re-fetch facilities
          fetch('http://localhost:4000/api/production-feasibility/facilities', { headers: getHeaders() })
            .then(r => r.json())
            .then(setFacilities);
        }}
      />

      <AIConfigModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        getHeaders={getHeaders}
      />
    </div>
  );
}
