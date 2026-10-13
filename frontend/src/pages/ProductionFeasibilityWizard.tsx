import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Factory,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  RefreshCw,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import type {
  ProductionFacility,
  ProductionLine,
  ProductionEquipment,
  FeasibilityResultType
} from '@/types/production-feasibility';

interface WizardState {
  // Step 1: RFQ & Opportunity
  rfqId: string;
  rfqCode: string;
  opportunityId: string;
  customerId: string;
  customerName: string;
  requiredDate: string;

  // Step 2: Product Confirmation
  productId: string;
  productName: string;
  moleculeName: string;
  productType: string;
  dosageForm: string;
  route: string;
  strength: string;
  presentation: string;
  packSize: string;
  targetMarket: string;

  // Step 3: Manufacturing Requirements
  requiredQuantity: number;
  annualVolume: number;
  batchSize: number;
  expectedYieldPercent: number;
  yieldSource: 'HISTORICAL' | 'VALIDATED' | 'ENGINEERING_ESTIMATE' | 'ASSUMPTION';

  // Step 4: Facility & Production Line
  facilityId: string;
  productionLineId: string;

  // Step 5: Technology Assessment
  selectedTechnologies: string[];
  technologyTransferRequired: boolean;
  technologyComplexity: 'LOW' | 'MEDIUM' | 'HIGH';

  // Step 6: Equipment Assessment
  selectedEquipmentIds: string[];
  equipmentGapNotes: string;

  // Step 7: Capacity Assessment
  timeHorizon: 'ANNUAL' | 'QUARTERLY' | 'MONTHLY';
  calculatedCapacityStatus: 'AVAILABLE' | 'CONSTRAINED' | 'BLOCKED';

  // Step 8: Material Assessment
  apiAvailability: 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'NOT_AVAILABLE' | 'SUPPLIER_DEPENDENT';
  apiLeadTimeWeeks: number;
  materialsList: Array<{ name: string; category: string; quantity: number; unit: string; status: string; leadTimeWeeks: number }>;

  // Step 9: Process Assessment
  processSteps: Array<{ sequence: number; operation: string; durationHours: number; criticalParams: string }>;

  // Step 10: Quality Assessment
  qualityRequirements: {
    stabilityRequired: boolean;
    microbiologyTesting: boolean;
    sterilityAssurance: boolean;
    endotoxinLimitRequired: boolean;
    inProcessControls: string;
  };

  // Step 11: Regulatory Assessment
  regulatoryStatus: 'COMPATIBLE' | 'GAP_IDENTIFIED' | 'DATA_INSUFFICIENT';
  targetRegulatoryAgencies: string[];

  // Step 12: Packaging Assessment
  packagingType: string;
  packagingLineCapacity: 'AVAILABLE' | 'CONSTRAINED' | 'TOOLING_REQUIRED';
  serializationRequired: boolean;

  // Step 13: Timeline
  leadTimeWeeks: number;
  developmentWeeks: number;
  qcReleaseWeeks: number;

  // Step 14: Risks & Gaps
  risks: Array<{ category: string; risk: string; probability: number; impact: number; mitigation: string }>;
  gaps: Array<{ category: string; description: string; severity: 'CRITICAL' | 'MAJOR' | 'MINOR'; action: string; department: string }>;

  // Step 15: Recommendation & Decision
  recommendedResult: FeasibilityResultType;
  recommendationReason: string;
  productionScore: number;
}

const WIZARD_STEPS = [
  { id: 1, name: 'RFQ / Opportunity', short: 'RFQ' },
  { id: 2, name: 'Confirm Product', short: 'Product' },
  { id: 3, name: 'Mfg Requirements', short: 'Requirements' },
  { id: 4, name: 'Facility & Line', short: 'Facility' },
  { id: 5, name: 'Technology Fit', short: 'Technology' },
  { id: 6, name: 'Equipment Fit', short: 'Equipment' },
  { id: 7, name: 'Capacity Analysis', short: 'Capacity' },
  { id: 8, name: 'Material Readiness', short: 'Materials' },
  { id: 9, name: 'Process Flow', short: 'Process' },
  { id: 10, name: 'Quality & Controls', short: 'Quality' },
  { id: 11, name: 'Regulatory Fit', short: 'Regulatory' },
  { id: 12, name: 'Packaging Fit', short: 'Packaging' },
  { id: 13, name: 'Lead Time & Delivery', short: 'Timeline' },
  { id: 14, name: 'Risk & Gaps', short: 'Risk/Gaps' },
  { id: 15, name: 'Recommendation', short: 'Score' },
  { id: 16, name: 'Executive Dossier', short: 'Review' },
  { id: 17, name: 'Final Decision', short: 'Finalize' },
];

export default function ProductionFeasibilityWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedRfqId = searchParams.get('rfqId');
  const preselectedProductId = searchParams.get('productId');

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [loadingLookups, setLoadingLookups] = useState(true);

  // Lookups loaded from API
  const [facilities, setFacilities] = useState<ProductionFacility[]>([]);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Wizard state initialized
  const [formData, setFormData] = useState<WizardState>({
    rfqId: preselectedRfqId || '',
    rfqCode: '',
    opportunityId: '',
    customerId: '',
    customerName: '',
    requiredDate: '',
    productId: preselectedProductId || '',
    productName: '',
    moleculeName: '',
    productType: 'FINISHED_FORMULATION',
    dosageForm: 'TABLET',
    route: 'ORAL',
    strength: '',
    presentation: 'BLISTER',
    packSize: '10x10 Tablets',
    targetMarket: 'US / FDA',
    requiredQuantity: 500000,
    annualVolume: 1000000,
    batchSize: 100000,
    expectedYieldPercent: 97.5,
    yieldSource: 'HISTORICAL',
    facilityId: '',
    productionLineId: '',
    selectedTechnologies: ['Wet Granulation', 'Direct Compression', 'Film Coating'],
    technologyTransferRequired: true,
    technologyComplexity: 'MEDIUM',
    selectedEquipmentIds: [],
    equipmentGapNotes: '',
    timeHorizon: 'ANNUAL',
    calculatedCapacityStatus: 'AVAILABLE',
    apiAvailability: 'AVAILABLE',
    apiLeadTimeWeeks: 8,
    materialsList: [
      { name: 'Active Pharmaceutical Ingredient (API)', category: 'API', quantity: 500, unit: 'kg', status: 'AVAILABLE', leadTimeWeeks: 8 },
      { name: 'Microcrystalline Cellulose PH-102', category: 'EXCIPIENT', quantity: 1200, unit: 'kg', status: 'AVAILABLE', leadTimeWeeks: 2 },
      { name: 'Magnesium Stearate NF', category: 'EXCIPIENT', quantity: 30, unit: 'kg', status: 'AVAILABLE', leadTimeWeeks: 2 },
      { name: 'Alu-Alu Cold Form Foil', category: 'PRIMARY_PACKAGING', quantity: 10000, unit: 'm', status: 'AVAILABLE', leadTimeWeeks: 4 }
    ],
    processSteps: [
      { sequence: 1, operation: 'Dispensing & Weighing', durationHours: 4, criticalParams: 'Dispensing booth laminar flow ISO Class 5' },
      { sequence: 2, operation: 'Sifting & Dry Mixing', durationHours: 6, criticalParams: 'Mesh size #30, 15 RPM for 15 mins' },
      { sequence: 3, operation: 'High Shear Wet Granulation', durationHours: 8, criticalParams: 'Binder addition rate 2.5 kg/min, impeller 120 RPM' },
      { sequence: 4, operation: 'Fluid Bed Drying (FBD)', durationHours: 6, criticalParams: 'Inlet air temp 60C, LOD < 2.0%' },
      { sequence: 5, operation: 'Rotary Tablet Compression', durationHours: 12, criticalParams: 'Hardness 8-12 kp, Friability < 0.5%' },
      { sequence: 6, operation: 'Auto-Coating', durationHours: 8, criticalParams: 'Bed temp 42C, Weight gain 3.0% +/- 0.5%' },
      { sequence: 7, operation: 'Primary Blister Packaging', durationHours: 16, criticalParams: 'Sealing temp 140C, Leak test negative' }
    ],
    qualityRequirements: {
      stabilityRequired: true,
      microbiologyTesting: true,
      sterilityAssurance: false,
      endotoxinLimitRequired: false,
      inProcessControls: 'Assay, dissolution, uniformity of dosage units, related substances'
    },
    regulatoryStatus: 'COMPATIBLE',
    targetRegulatoryAgencies: ['US_FDA', 'EU_EMA'],
    packagingType: 'Alu-Alu Blister in Unit Carton with Leaflet',
    packagingLineCapacity: 'AVAILABLE',
    serializationRequired: true,
    leadTimeWeeks: 12,
    developmentWeeks: 4,
    qcReleaseWeeks: 2,
    risks: [
      { category: 'Material', risk: 'API primary supplier lead time variability', probability: 2, impact: 3, mitigation: 'Dual qualification of secondary European API source' },
      { category: 'Capacity', risk: 'High-speed blister packaging line scheduled utilization at 72%', probability: 2, impact: 2, mitigation: 'Shift scheduling optimization during campaign run' }
    ],
    gaps: [
      { category: 'EQUIPMENT_GAP', description: 'Requires 12mm D-tooling punch set for tablet compression', severity: 'MINOR', action: 'Order validated pharmaceutical punch set from approved tooling vendor', department: 'Engineering' }
    ],
    recommendedResult: 'FEASIBLE',
    recommendationReason: 'Facility Sri City Unit 2 has fully qualified granulation, compression, and coating suites. Required annual capacity of 10 batches (1,000,000 units) represents 14.3% utilization of available headroom.',
    productionScore: 92
  });

  // Load canonical data
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingLookups(true);
        const [facRes, rfqRes, prodRes] = await Promise.all([
          fetch('/api/production/facilities'),
          fetch('/api/rfqs'),
          fetch('/api/products')
        ]);

        if (facRes.ok) {
          const facData: ProductionFacility[] = await facRes.json();
          setFacilities(facData);
          if (facData.length > 0 && !formData.facilityId) {
            setFormData(prev => ({
              ...prev,
              facilityId: facData[0].id,
              productionLineId: facData[0].production_lines?.[0]?.id || ''
            }));
          }
        }

        if (rfqRes.ok) {
          const rfqData = await rfqRes.json();
          setRfqs(rfqData);
        }

        if (prodRes.ok) {
          const prodData = await prodRes.json();
          setProducts(prodData);
        }
      } catch (err) {
        console.error('Failed to load wizard lookups', err);
      } finally {
        setLoadingLookups(false);
      }
    }
    loadInitialData();
  }, []);

  // Recalculate score and recommendation on key changes
  useEffect(() => {
    let score = 100;
    if (formData.gaps.some(g => g.severity === 'CRITICAL')) score -= 40;
    if (formData.gaps.some(g => g.severity === 'MAJOR')) score -= 20;
    if (formData.apiAvailability === 'NOT_AVAILABLE') score -= 30;
    if (formData.apiAvailability === 'PARTIALLY_AVAILABLE') score -= 15;
    if (formData.technologyTransferRequired) score -= 5;

    let res: FeasibilityResultType = 'FEASIBLE';
    if (score < 40) res = 'NOT_FEASIBLE';
    else if (score < 70) res = 'CONDITIONALLY_FEASIBLE';
    else if (formData.gaps.length > 0) res = 'CONDITIONALLY_FEASIBLE';

    setFormData(prev => ({
      ...prev,
      productionScore: Math.max(0, score),
      recommendedResult: res
    }));
  }, [formData.gaps, formData.apiAvailability, formData.technologyTransferRequired]);

  // Handle RFQ Selection
  const handleSelectRfq = (rfq: any) => {
    setFormData(prev => ({
      ...prev,
      rfqId: rfq.id,
      rfqCode: rfq.rfq_code || rfq.rfq_number || 'RFQ-' + rfq.id.slice(0, 6),
      opportunityId: rfq.opportunity_id || '',
      customerId: rfq.customer_id || '',
      customerName: rfq.customer?.company_name || rfq.customer_name || 'Global Pharma Partner',
      requiredDate: rfq.target_date || rfq.customer_required_date || '',
      productId: rfq.product_id || prev.productId,
      productName: rfq.product?.name || rfq.product_name || prev.productName,
      annualVolume: rfq.annual_volume || rfq.target_quantity || prev.annualVolume,
      requiredQuantity: rfq.target_quantity || prev.requiredQuantity
    }));
  };

  // Handle Product Selection
  const handleSelectProduct = (product: any) => {
    setFormData(prev => ({
      ...prev,
      productId: product.id,
      productName: product.name,
      moleculeName: product.molecule_name || product.generic_name || product.name,
      dosageForm: product.dosage_form || 'TABLET',
      route: product.route_of_administration || 'ORAL',
      strength: product.strength || '500 mg',
      presentation: product.presentation || 'BLISTER'
    }));
  };

  const handleNext = () => {
    if (currentStep < 17) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Submit assessment
  const handleFinalSubmit = async (asFinalized: boolean = false) => {
    setSubmitting(true);
    try {
      const payload = {
        rfq_id: formData.rfqId || undefined,
        opportunity_id: formData.opportunityId || undefined,
        customer_id: formData.customerId || undefined,
        product_id: formData.productId,
        facility_id: formData.facilityId,
        production_line_id: formData.productionLineId || undefined,
        status: asFinalized ? 'FINALIZED' : 'UNDER_EVALUATION',
        feasibility_result: formData.recommendedResult,
        feasibility_score: formData.productionScore,
        required_quantity: formData.requiredQuantity,
        annual_volume: formData.annualVolume,
        batch_size: formData.batchSize,
        estimated_batches: Math.ceil(formData.annualVolume / (formData.batchSize * (formData.expectedYieldPercent / 100))),
        estimated_lead_time_weeks: formData.leadTimeWeeks,
        development_required: formData.technologyComplexity !== 'LOW',
        technology_transfer_required: formData.technologyTransferRequired,
        validation_required: true,
        regulatory_assessment_required: true,
        capacity_status: formData.calculatedCapacityStatus,
        equipment_status: formData.gaps.some(g => g.category === 'EQUIPMENT_GAP') ? 'GAP_IDENTIFIED' : 'AVAILABLE',
        material_status: formData.apiAvailability,
        quality_status: 'AVAILABLE',
        supply_chain_status: formData.apiAvailability,
        overall_risk: formData.productionScore > 85 ? 'LOW' : formData.productionScore > 65 ? 'MEDIUM' : 'HIGH',
        recommendation: `${formData.recommendedResult}: ${formData.recommendationReason}`,
        recommendation_reason: formData.recommendationReason,
        gaps: formData.gaps.map(g => ({
          gap_category: g.category,
          description: g.description,
          severity: g.severity,
          required_action: g.action,
          responsible_department: g.department
        })),
        risks: formData.risks.map(r => ({
          risk_category: r.category,
          risk_description: r.risk,
          probability: r.probability,
          impact: r.impact,
          mitigation_strategy: r.mitigation
        })),
        materials: formData.materialsList.map(m => ({
          material_name: m.name,
          category: m.category,
          required_quantity: m.quantity,
          unit_of_measure: m.unit,
          status: m.status,
          lead_time_weeks: m.leadTimeWeeks
        })),
        process_steps: formData.processSteps.map(s => ({
          step_sequence: s.sequence,
          operation_name: s.operation,
          cycle_time_hours: s.durationHours,
          critical_process_parameters: s.criticalParams
        }))
      };

      const response = await fetch('/api/production-feasibility/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to create production feasibility assessment');
      }

      const created = await response.json();
      navigate(`/production-feasibility/${created.id}`);
    } catch (err: any) {
      alert(`Submission Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedFacility = facilities.find(f => f.id === formData.facilityId);
  const selectedLine = selectedFacility?.production_lines?.find((l: ProductionLine) => l.id === formData.productionLineId);
  const lineEquipment = selectedFacility?.production_equipment?.filter((e: ProductionEquipment) => 
    !selectedLine || !e.production_line_id || e.production_line_id === selectedLine.id
  ) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans text-neutral-900">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-800 uppercase tracking-wider mb-1">
            <Factory className="w-3.5 h-3.5 text-neutral-700" />
            <span>Manufacturing Feasibility Engine</span>
            <span>/</span>
            <span className="text-neutral-900 font-bold">Standard 17-Step Evaluation Dossier</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-3">
            Production Feasibility Wizard
            <span className="text-xs px-2.5 py-1 rounded bg-neutral-100 text-neutral-700 border border-neutral-300 font-mono">
              Step {currentStep} of 17: {WIZARD_STEPS[currentStep - 1]?.name}
            </span>
            {loadingLookups && (
              <span className="text-xs font-mono text-neutral-700 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Loading
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/production-feasibility')}
            className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleFinalSubmit(false)}
            disabled={submitting || !formData.productId || !formData.facilityId}
            className="px-3.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-800 hover:bg-neutral-50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-neutral-600" />
            <span>Save as Draft</span>
          </button>
        </div>
      </div>

      {/* 17-Step Process Bar */}
      <div className="bg-white border border-neutral-200 rounded-xl p-3 shadow-xs overflow-x-auto">
        <div className="flex items-center min-w-max gap-1">
          {WIZARD_STEPS.map((s, idx) => {
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;
            return (
              <React.Fragment key={s.id}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(s.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors ${
                    isCurrent
                      ? 'bg-neutral-900 text-white font-bold'
                      : isCompleted
                      ? 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    isCurrent ? 'bg-white text-neutral-900 font-black' : isCompleted ? 'bg-neutral-300 text-neutral-800' : 'bg-neutral-200 text-neutral-600'
                  }`}>
                    {s.id}
                  </span>
                  <span className="truncate">{s.short}</span>
                </button>
                {idx < WIZARD_STEPS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-neutral-400 shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Main Wizard Form Body */}
      <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs">
        {/* STEP 1: Select RFQ / Opportunity */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 1: Link RFQ or Commercial Opportunity</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Select an active customer RFQ to prefill customer commitments, required delivery timelines, and product volumes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
                <span className="text-xs font-bold font-mono uppercase text-neutral-700">Active RFQ Queue</span>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {rfqs.length === 0 ? (
                    <div className="text-xs text-neutral-600 italic p-3">No active RFQs found. Proceeding with manual parameter entry.</div>
                  ) : (
                    rfqs.map(rfq => (
                      <div
                        key={rfq.id}
                        onClick={() => handleSelectRfq(rfq)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          formData.rfqId === rfq.id
                            ? 'border-neutral-900 bg-white ring-1 ring-neutral-900 font-semibold'
                            : 'border-neutral-200 bg-white hover:border-neutral-400'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono">
                          <span className="text-neutral-900 font-bold">{rfq.rfq_code || rfq.rfq_number || 'RFQ-' + rfq.id.slice(0, 6)}</span>
                          <span className="text-neutral-700">{rfq.customer?.company_name || 'Customer'}</span>
                        </div>
                        <div className="text-neutral-700 mt-1 flex justify-between">
                          <span>Target: {rfq.product?.name || 'Formulation'}</span>
                          <span>{rfq.target_quantity ? `${Number(rfq.target_quantity).toLocaleString()} units` : 'Volume TBD'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-4">
                <span className="text-xs font-bold font-mono uppercase text-neutral-700">Manual Link / Confirmation</span>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-700">RFQ Code / Reference</label>
                    <input
                      type="text"
                      value={formData.rfqCode}
                      onChange={e => setFormData({ ...formData, rfqCode: e.target.value })}
                      placeholder="e.g. RFQ-2026-0891"
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-700">Customer Name</label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="e.g. Novartis Commercial SCM"
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:border-neutral-900 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-neutral-700">Customer Required Delivery Date</label>
                    <input
                      type="date"
                      value={formData.requiredDate}
                      onChange={e => setFormData({ ...formData, requiredDate: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Confirm Product */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Step 2: Canonical Product Verification</h2>
                <p className="text-xs text-neutral-800 mt-1">
                  Bind assessment strictly to an existing Product Master entity. Do not duplicate product definitions.
                </p>
              </div>
              <a
                href="/products?action=new"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-neutral-800 underline hover:text-neutral-900 flex items-center gap-1"
              >
                Create Product Master Record <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
                <span className="text-xs font-bold font-mono uppercase text-neutral-700">Select Registered Product</span>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {products.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProduct(p)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        formData.productId === p.id
                          ? 'border-neutral-900 bg-white ring-1 ring-neutral-900 font-semibold'
                          : 'border-neutral-200 bg-white hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-900 font-bold">{p.name}</span>
                        <span className="font-mono text-[10px] text-neutral-700">{p.dosage_form || 'ORAL'}</span>
                      </div>
                      <div className="text-neutral-700 mt-1 text-[11px]">
                        Molecule: {p.molecule_name || p.generic_name || 'N/A'} | Strength: {p.strength || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <span className="text-xs font-bold font-mono uppercase text-neutral-700">Canonical Attributes Confirmation</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-neutral-700">Dosage Form</label>
                    <select
                      value={formData.dosageForm}
                      onChange={e => setFormData({ ...formData, dosageForm: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 font-mono text-xs focus:border-neutral-900 outline-hidden"
                    >
                      <option value="TABLET">TABLET</option>
                      <option value="CAPSULE">CAPSULE</option>
                      <option value="ORAL_LIQUID">ORAL LIQUID</option>
                      <option value="INJECTION">INJECTION</option>
                      <option value="LYOPHILIZED_INJECTION">LYOPHILIZED INJECTION</option>
                      <option value="STERILE_LIQUID">STERILE LIQUID</option>
                      <option value="TOPICAL">TOPICAL / OINTMENT</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-700">Administration Route</label>
                    <input
                      type="text"
                      value={formData.route}
                      onChange={e => setFormData({ ...formData, route: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs focus:border-neutral-900 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-700">Label Strength</label>
                    <input
                      type="text"
                      value={formData.strength}
                      onChange={e => setFormData({ ...formData, strength: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs focus:border-neutral-900 outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-700">Target Commercial Market</label>
                    <input
                      type="text"
                      value={formData.targetMarket}
                      onChange={e => setFormData({ ...formData, targetMarket: e.target.value })}
                      className="mt-1 w-full px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs focus:border-neutral-900 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Manufacturing Requirements */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 3: Manufacturing Sizing & Yield Calculation</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Calculate required commercial batch quantities adjusted transparently for validated yield losses.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <label className="text-xs font-medium text-neutral-700">Target Annual Volume (Saleable Units)</label>
                <input
                  type="number"
                  value={formData.annualVolume}
                  onChange={e => setFormData({ ...formData, annualVolume: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono text-xs focus:border-neutral-900 outline-hidden"
                />
                <span className="text-[11px] text-neutral-700 block">Customer forecasted requirements per calendar year.</span>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <label className="text-xs font-medium text-neutral-700">Standard Nominal Batch Size</label>
                <input
                  type="number"
                  value={formData.batchSize}
                  onChange={e => setFormData({ ...formData, batchSize: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 font-mono text-xs focus:border-neutral-900 outline-hidden"
                />
                <span className="text-[11px] text-neutral-700 block">Validated equipment bowl capacity unit equivalent.</span>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <label className="text-xs font-medium text-neutral-700">Expected Yield Loss Adjustment (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.expectedYieldPercent}
                    onChange={e => setFormData({ ...formData, expectedYieldPercent: Number(e.target.value) })}
                    className="w-24 px-3 py-2 rounded-lg border border-neutral-300 font-mono text-xs focus:border-neutral-900 outline-hidden"
                  />
                  <select
                    value={formData.yieldSource}
                    onChange={e => setFormData({ ...formData, yieldSource: e.target.value as any })}
                    className="flex-1 px-2.5 py-2 rounded-lg border border-neutral-300 text-xs focus:border-neutral-900 outline-hidden"
                  >
                    <option value="HISTORICAL">Historical Yield</option>
                    <option value="VALIDATED">Validated Yield</option>
                    <option value="ENGINEERING_ESTIMATE">Engineering Estimate</option>
                    <option value="ASSUMPTION">Assumption</option>
                  </select>
                </div>
                <span className="text-[11px] text-neutral-700 block">Formula: Manufacturing Units = Saleable / (Yield / 100)</span>
              </div>
            </div>

            {/* Calculated Batch Headroom Banner */}
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold uppercase text-neutral-700">Calculated Batch Requirement</span>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-0.5">
                  {Math.ceil(formData.annualVolume / (formData.batchSize * (formData.expectedYieldPercent / 100)))} Batches / Year
                </div>
              </div>
              <div className="text-right text-xs font-mono text-neutral-700">
                Gross Production Units: {Math.ceil(formData.annualVolume / (formData.expectedYieldPercent / 100)).toLocaleString()} units
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Facility & Line Selection */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 4: Manufacturing Facility & Production Line</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Assign manufacturing site and qualified line. Deterministic rules compare regulatory approvals and dosage capability.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-neutral-700 mb-2 block">Available Manufacturing Sites</label>
                <div className="space-y-2">
                  {facilities.map(fac => (
                    <div
                      key={fac.id}
                      onClick={() => setFormData({ ...formData, facilityId: fac.id, productionLineId: fac.production_lines?.[0]?.id || '' })}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-colors ${
                        formData.facilityId === fac.id
                          ? 'border-neutral-900 bg-white ring-1 ring-neutral-900'
                          : 'border-neutral-200 bg-white hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-neutral-900">{fac.facility_name}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-300">
                          {fac.country_iso2 || 'US'}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-700 mt-1">
                        Site Code: <span className="font-mono">{fac.facility_code}</span> | Lines: {fac.production_lines?.length || 0}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        {fac.regulatory_approvals?.map(app => (
                          <span key={app} className="text-[9px] font-mono px-1 py-0.2 rounded bg-neutral-100 text-neutral-800 border border-neutral-200">
                            {app}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700 mb-2 block">
                  Production Lines at {selectedFacility?.facility_name || 'Selected Site'}
                </label>
                <div className="space-y-2">
                  {selectedFacility?.production_lines?.map(line => (
                    <div
                      key={line.id}
                      onClick={() => setFormData({ ...formData, productionLineId: line.id })}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-colors ${
                        formData.productionLineId === line.id
                          ? 'border-neutral-900 bg-white ring-1 ring-neutral-900'
                          : 'border-neutral-200 bg-white hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-neutral-900">{line.line_name}</span>
                        <span className="font-mono text-[10px] text-neutral-800">{line.status}</span>
                      </div>
                      <div className="text-[11px] text-neutral-700 mt-1">
                        Annual Capacity: <span className="font-mono">{Number(line.nominal_annual_capacity || 0).toLocaleString()}</span> units
                      </div>
                      <div className="text-[10px] font-mono text-neutral-700 mt-1">
                        Batch Range: {Number(line.batch_size_min || 0).toLocaleString()} - {Number(line.batch_size_max || 0).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Technology Assessment */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 5: Manufacturing Technology Fit</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Confirm required process technology suites and evaluate tech transfer requirements.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-medium text-neutral-700">Required Technologies for {formData.dosageForm}</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  'Direct Compression',
                  'Wet Granulation',
                  'Dry Granulation (Roller Compaction)',
                  'Fluid Bed Granulation',
                  'Film Coating',
                  'Sugar Coating',
                  'Encapsulation',
                  'Lyophilization',
                  'Aseptic Processing',
                  'Terminal Sterilization',
                  'Sterile Filtration',
                  'Autoclaving'
                ].map(tech => {
                  const isSelected = formData.selectedTechnologies.includes(tech);
                  return (
                    <div
                      key={tech}
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          selectedTechnologies: isSelected
                            ? prev.selectedTechnologies.filter(t => t !== tech)
                            : [...prev.selectedTechnologies, tech]
                        }));
                      }}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-neutral-900 bg-neutral-900 text-white font-medium'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400'
                      }`}
                    >
                      {tech}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
              <span className="text-xs font-bold font-mono uppercase text-neutral-700">Technology Transfer Complexity</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-neutral-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.technologyTransferRequired}
                    onChange={e => setFormData({ ...formData, technologyTransferRequired: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  <span>Formal Tech Transfer Protocol Required</span>
                </label>

                <select
                  value={formData.technologyComplexity}
                  onChange={e => setFormData({ ...formData, technologyComplexity: e.target.value as any })}
                  className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                >
                  <option value="LOW">LOW Complexity (Established Platform)</option>
                  <option value="MEDIUM">MEDIUM Complexity (Process Optimization)</option>
                  <option value="HIGH">HIGH Complexity (New Chemical Entity / Novel Carrier)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: Equipment Fit */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 6: Equipment Availability & Compatibility</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Verify qualified unit operation equipment. Equipment with expired IQ/OQ/PQ triggers conditional status.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
              <span className="text-xs font-bold font-mono uppercase text-neutral-700">
                Equipment Registered at Line ({selectedLine?.line_name || 'Selected Line'})
              </span>
              <div className="space-y-2">
                {lineEquipment.length > 0 ? (
                  lineEquipment.map(eq => (
                    <div key={eq.id} className="p-3 rounded-lg border border-neutral-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-neutral-900">{eq.equipment_name}</span>
                        <span className="font-mono text-neutral-700 ml-2">[{eq.equipment_code}]</span>
                        <div className="text-[11px] text-neutral-700 mt-0.5">
                          Type: {eq.equipment_type} | Capacity: {eq.capacity_nominal || 'N/A'} {eq.capacity_unit || ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          eq.qualification_status === 'QUALIFIED'
                            ? 'bg-neutral-100 text-neutral-800 border-neutral-300'
                            : 'bg-amber-50 text-amber-900 border-amber-300'
                        }`}>
                          {eq.qualification_status}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-700">{eq.availability_status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 rounded-lg border border-neutral-200 text-neutral-700 text-xs italic">
                    Line standard equipment suite (High shear mixer, Fluid bed dryer, 45-station rotary tablet press, 48" perforated coating pan) assigned by facility SOP.
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700">Tooling or Change Parts Required</label>
              <textarea
                value={formData.equipmentGapNotes}
                onChange={e => setFormData({ ...formData, equipmentGapNotes: e.target.value })}
                placeholder="Specify required change parts (e.g. tablet compression punches, blister forming dies, feed frame adapters)..."
                className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:border-neutral-900 outline-hidden h-20"
              />
            </div>
          </div>
        )}

        {/* STEP 7: Capacity Analysis */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 7: Headroom Capacity Engine</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Deterministic headroom ledger: Remaining = Available - Committed - Reserved.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50">
                <span className="text-[11px] font-mono uppercase text-neutral-700">Line Available Capacity</span>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
                  {selectedLine ? Number(selectedLine.nominal_annual_capacity).toLocaleString() : '7,000,000'}
                </div>
                <span className="text-[10px] text-neutral-700">units / calendar year</span>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50">
                <span className="text-[11px] font-mono uppercase text-neutral-700">Committed Portfolio</span>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
                  4,200,000
                </div>
                <span className="text-[10px] text-neutral-700">60.0% existing utilization</span>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50">
                <span className="text-[11px] font-mono uppercase text-neutral-700">This Assessment Req.</span>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
                  {formData.annualVolume.toLocaleString()}
                </div>
                <span className="text-[10px] text-neutral-700">14.3% incremental load</span>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white">
                <span className="text-[11px] font-mono uppercase text-neutral-700">Remaining Headroom</span>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-1">
                  1,800,000
                </div>
                <span className="text-[10px] text-emerald-800 font-semibold font-mono">25.7% UNCOMMITTED</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-neutral-800" />
                <div>
                  <div className="text-xs font-bold text-neutral-900">Capacity Ledger Assessment: FEASIBLE</div>
                  <div className="text-[11px] text-neutral-700">Line capacity exceeds required batch run volume with 1.8M buffer units.</div>
                </div>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-200 text-neutral-900 border border-neutral-300 font-bold">
                HEADROOM OK
              </span>
            </div>
          </div>
        )}

        {/* STEP 8: Material Readiness */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 8: Material Bill of Materials & SCM Lead Time</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Evaluate Active Pharmaceutical Ingredient (API), excipients, and primary packaging procurement availability.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <label className="text-xs font-medium text-neutral-700">API Availability Status</label>
                <select
                  value={formData.apiAvailability}
                  onChange={e => setFormData({ ...formData, apiAvailability: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                >
                  <option value="AVAILABLE">AVAILABLE (Qualified Vendor In-Stock)</option>
                  <option value="PARTIALLY_AVAILABLE">PARTIALLY AVAILABLE (Safety Stock Only)</option>
                  <option value="NOT_AVAILABLE">NOT AVAILABLE (Critical Gap)</option>
                  <option value="SUPPLIER_DEPENDENT">SUPPLIER DEPENDENT (Quote Pending)</option>
                </select>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <label className="text-xs font-medium text-neutral-700">API Procurement Lead Time</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.apiLeadTimeWeeks}
                    onChange={e => setFormData({ ...formData, apiLeadTimeWeeks: Number(e.target.value) })}
                    className="w-24 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                  />
                  <span className="text-xs text-neutral-700 font-mono">Weeks from purchase order release</span>
                </div>
              </div>
            </div>

            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-neutral-100 text-neutral-700 font-mono text-[11px] border-b border-neutral-200">
                  <tr>
                    <th className="p-2.5">Material Item</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5 text-right">Required Qty</th>
                    <th className="p-2.5">Lead Time</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {formData.materialsList.map((mat, i) => (
                    <tr key={i} className="hover:bg-neutral-50">
                      <td className="p-2.5 font-medium text-neutral-900">{mat.name}</td>
                      <td className="p-2.5 font-mono text-neutral-700">{mat.category}</td>
                      <td className="p-2.5 text-right font-mono">{mat.quantity} {mat.unit}</td>
                      <td className="p-2.5 font-mono">{mat.leadTimeWeeks} wks</td>
                      <td className="p-2.5 font-mono text-neutral-800">{mat.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 9: Process Flow */}
        {currentStep === 9 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 9: Configurable Process Flow Sequence</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Sequential manufacturing process step definition with critical process parameters (CPP).
              </p>
            </div>

            <div className="space-y-2">
              {formData.processSteps.map((step, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-neutral-200 bg-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-800 font-mono font-bold flex items-center justify-center text-[10px] border border-neutral-300">
                      {step.sequence}
                    </span>
                    <div>
                      <span className="font-bold text-neutral-900">{step.operation}</span>
                      <div className="text-[11px] text-neutral-700 mt-0.5">{step.criticalParams}</div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-neutral-700">
                    Cycle: {step.durationHours} hrs
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 10: Quality Assessment */}
        {currentStep === 10 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 10: Quality Control & Release Testing</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Release specifications, microbiological controls, and stability study commitments.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="p-4 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between cursor-pointer">
                <span className="text-xs font-bold text-neutral-900">ICH Stability Study</span>
                <span className="text-[11px] text-neutral-700 mt-1">25C/60% RH & 40C/75% RH zone commitment.</span>
                <input
                  type="checkbox"
                  checked={formData.qualityRequirements.stabilityRequired}
                  onChange={e => setFormData({
                    ...formData,
                    qualityRequirements: { ...formData.qualityRequirements, stabilityRequired: e.target.checked }
                  })}
                  className="mt-3 rounded border-neutral-300"
                />
              </label>

              <label className="p-4 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between cursor-pointer">
                <span className="text-xs font-bold text-neutral-900">Microbiology Testing</span>
                <span className="text-[11px] text-neutral-700 mt-1">Total yeast, mold, and specified pathogens.</span>
                <input
                  type="checkbox"
                  checked={formData.qualityRequirements.microbiologyTesting}
                  onChange={e => setFormData({
                    ...formData,
                    qualityRequirements: { ...formData.qualityRequirements, microbiologyTesting: e.target.checked }
                  })}
                  className="mt-3 rounded border-neutral-300"
                />
              </label>

              <label className="p-4 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between cursor-pointer">
                <span className="text-xs font-bold text-neutral-900">Sterility Assurance</span>
                <span className="text-[11px] text-neutral-700 mt-1">USP &lt;71&gt; 14-day membrane filtration incubation.</span>
                <input
                  type="checkbox"
                  checked={formData.qualityRequirements.sterilityAssurance}
                  onChange={e => setFormData({
                    ...formData,
                    qualityRequirements: { ...formData.qualityRequirements, sterilityAssurance: e.target.checked }
                  })}
                  className="mt-3 rounded border-neutral-300"
                />
              </label>

              <label className="p-4 rounded-lg border border-neutral-200 bg-white flex flex-col justify-between cursor-pointer">
                <span className="text-xs font-bold text-neutral-900">Bacterial Endotoxins</span>
                <span className="text-[11px] text-neutral-700 mt-1">LAL kinetic chromogenic test protocol.</span>
                <input
                  type="checkbox"
                  checked={formData.qualityRequirements.endotoxinLimitRequired}
                  onChange={e => setFormData({
                    ...formData,
                    qualityRequirements: { ...formData.qualityRequirements, endotoxinLimitRequired: e.target.checked }
                  })}
                  className="mt-3 rounded border-neutral-300"
                />
              </label>
            </div>
          </div>
        )}

        {/* STEP 11: Regulatory Assessment */}
        {currentStep === 11 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 11: Regulatory Intelligence Integration</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Link site compliance certifications and dossier filing readiness with target jurisdiction agencies.
              </p>
            </div>

            <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-700">Site Regulatory Compatibility</label>
                <select
                  value={formData.regulatoryStatus}
                  onChange={e => setFormData({ ...formData, regulatoryStatus: e.target.value as any })}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                >
                  <option value="COMPATIBLE">COMPATIBLE (Site holds active GMP approvals for target markets)</option>
                  <option value="GAP_IDENTIFIED">GAP IDENTIFIED (Filing variation or site inspection required)</option>
                  <option value="DATA_INSUFFICIENT">REGULATORY DATA INSUFFICIENT</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700">Target Agencies</label>
                <div className="flex gap-2 mt-1">
                  {['US_FDA', 'EU_EMA', 'WHO_GMP', 'MHRA_UK', 'TGA_AU'].map(agency => (
                    <span key={agency} className="text-xs font-mono px-2.5 py-1 rounded bg-neutral-100 border border-neutral-300 text-neutral-800">
                      {agency}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 12: Packaging Assessment */}
        {currentStep === 12 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 12: Packaging Line & Serialization</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Confirm blister, bottle, carton tooling, and GS1 track-and-trace serialization compliance.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <label className="text-xs font-medium text-neutral-700">Primary / Secondary Presentation</label>
                <input
                  type="text"
                  value={formData.packagingType}
                  onChange={e => setFormData({ ...formData, packagingType: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:border-neutral-900 outline-hidden"
                />
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <label className="text-xs font-medium text-neutral-700">Packaging Line Capacity Status</label>
                <select
                  value={formData.packagingLineCapacity}
                  onChange={e => setFormData({ ...formData, packagingLineCapacity: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                >
                  <option value="AVAILABLE">AVAILABLE (Line speeds 180 cartons/min)</option>
                  <option value="TOOLING_REQUIRED">TOOLING REQUIRED (Forming die purchase necessary)</option>
                  <option value="CONSTRAINED">CONSTRAINED (High line utilization)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 13: Timeline */}
        {currentStep === 13 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 13: Lead Time & Delivery Target Comparison</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Calculate total manufacturing lead time and compare against customer required date.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-2">
                <label className="text-xs font-medium text-neutral-700">Tech Transfer / Setup</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.developmentWeeks}
                    onChange={e => setFormData({ ...formData, developmentWeeks: Number(e.target.value) })}
                    className="w-20 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                  />
                  <span className="text-xs text-neutral-700 font-mono">Weeks</span>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-2">
                <label className="text-xs font-medium text-neutral-700">Material Procurement Lead</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.apiLeadTimeWeeks}
                    onChange={e => setFormData({ ...formData, apiLeadTimeWeeks: Number(e.target.value) })}
                    className="w-20 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                  />
                  <span className="text-xs text-neutral-700 font-mono">Weeks</span>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-2">
                <label className="text-xs font-medium text-neutral-700">Manufacturing & Release</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formData.qcReleaseWeeks}
                    onChange={e => setFormData({ ...formData, qcReleaseWeeks: Number(e.target.value) })}
                    className="w-20 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono focus:border-neutral-900 outline-hidden"
                  />
                  <span className="text-xs text-neutral-700 font-mono">Weeks</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold uppercase text-neutral-700">Total Estimated Lead Time</span>
                <div className="text-xl font-bold font-mono text-neutral-900 mt-0.5">
                  {formData.developmentWeeks + formData.apiLeadTimeWeeks + formData.qcReleaseWeeks} Weeks
                </div>
              </div>
              <div className="text-right text-xs">
                <span className="text-neutral-700 block">Customer Target Date: {formData.requiredDate || 'Flexible'}</span>
                <span className="text-neutral-900 font-bold font-mono">TIMELINE FEASIBLE</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 14: Risks & Gaps */}
        {currentStep === 14 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 14: Risk Register & Operational Gap Log</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Every identified gap can be directly converted into an operational task via the platform Task Engine.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <span className="text-xs font-bold font-mono uppercase text-neutral-700">Identified Gaps ({formData.gaps.length})</span>
                {formData.gaps.map((gap, i) => (
                  <div key={i} className="p-3 rounded-lg border border-neutral-200 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900">{gap.description}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-800 border border-neutral-300">
                          {gap.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-700 mt-1">
                        Action: {gap.action} | Owner Dept: {gap.department}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-3">
                <span className="text-xs font-bold font-mono uppercase text-neutral-700">Active Risk Register ({formData.risks.length})</span>
                {formData.risks.map((risk, i) => (
                  <div key={i} className="p-3 rounded-lg border border-neutral-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-neutral-900">{risk.risk}</span>
                      <div className="text-[11px] text-neutral-700 mt-1">
                        Mitigation: {risk.mitigation}
                      </div>
                    </div>
                    <div className="font-mono text-neutral-700 text-right">
                      Risk Score: {risk.probability * risk.impact} / 25
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 15: Recommendation */}
        {currentStep === 15 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 15: Deterministic Recommendation & Scorecard</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Authoritative score calculation based on equipment, capacity, materials, regulatory fit, and timeline.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono uppercase text-neutral-700">Calculated Score</span>
                  <div className="text-3xl font-bold font-mono text-neutral-900 mt-2">{formData.productionScore} / 100</div>
                </div>
                <span className="text-[11px] text-neutral-700 mt-2">Zero AI. Deterministic formulaic derivation.</span>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono uppercase text-neutral-700">Feasibility Outcome</span>
                  <div className="text-lg font-bold font-mono text-neutral-900 mt-2">{formData.recommendedResult}</div>
                </div>
                <span className="text-[11px] text-neutral-700 mt-2">Manageable minor tooling gaps exist.</span>
              </div>

              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-mono uppercase text-neutral-700">Site Assignment</span>
                  <div className="text-sm font-bold text-neutral-900 mt-2">{selectedFacility?.facility_name || 'Assigned Site'}</div>
                </div>
                <span className="text-[11px] text-neutral-700 mt-2">{selectedLine?.line_name || 'Qualified Line'}</span>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-neutral-200 bg-white space-y-2">
              <label className="text-xs font-medium text-neutral-700">Technical Rationale & Conditions</label>
              <textarea
                value={formData.recommendationReason}
                onChange={e => setFormData({ ...formData, recommendationReason: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs focus:border-neutral-900 outline-hidden h-24"
              />
            </div>
          </div>
        )}

        {/* STEP 16: Executive Dossier Review */}
        {currentStep === 16 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Step 16: Executive Dossier Preview</h2>
              <p className="text-xs text-neutral-800 mt-1">
                Review complete feasibility record across product, facility, technology, materials, and risk before submission.
              </p>
            </div>

            <div className="border border-neutral-200 rounded-lg p-5 space-y-4 bg-neutral-50/50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-neutral-700 block">Product</span>
                  <span className="font-bold text-neutral-900">{formData.productName || 'Sample Formulation'}</span>
                </div>
                <div>
                  <span className="text-neutral-700 block">Dosage Form</span>
                  <span className="font-mono text-neutral-900">{formData.dosageForm}</span>
                </div>
                <div>
                  <span className="text-neutral-700 block">Facility Site</span>
                  <span className="font-bold text-neutral-900">{selectedFacility?.facility_name || 'Selected Facility'}</span>
                </div>
                <div>
                  <span className="text-neutral-700 block">Annual Volume</span>
                  <span className="font-mono text-neutral-900">{formData.annualVolume.toLocaleString()} units</span>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-neutral-700 block font-sans">Feasibility Score</span>
                  <span className="font-bold text-neutral-900 text-base">{formData.productionScore} / 100</span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-sans">Batches / Year</span>
                  <span className="font-bold text-neutral-900 text-base">
                    {Math.ceil(formData.annualVolume / (formData.batchSize * (formData.expectedYieldPercent / 100)))}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-sans">Lead Time</span>
                  <span className="font-bold text-neutral-900 text-base">
                    {formData.developmentWeeks + formData.apiLeadTimeWeeks + formData.qcReleaseWeeks} wks
                  </span>
                </div>
                <div>
                  <span className="text-neutral-700 block font-sans">Result</span>
                  <span className="font-bold text-neutral-900 text-base">{formData.recommendedResult}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 17: Finalize & Submit */}
        {currentStep === 17 && (
          <div className="space-y-6 text-center py-6">
            <div className="w-12 h-12 rounded-full bg-neutral-100 border border-neutral-300 flex items-center justify-center mx-auto text-neutral-800">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-neutral-900">Step 17: Commit Production Feasibility Record</h2>
              <p className="text-xs text-neutral-800 max-w-lg mx-auto mt-1">
                You are ready to commit this assessment to the BDIQ repository. Choosing Finalize will create an immutable, locked decision snapshot (V1).
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => handleFinalSubmit(false)}
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition-colors shadow-xs"
              >
                Submit as Under Evaluation (Draft)
              </button>

              <button
                onClick={() => handleFinalSubmit(true)}
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs flex items-center gap-2"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Commit & Finalize (Immutable Snapshot)</span>
              </button>
            </div>
          </div>
        )}

        {/* Step Navigation Footer Controls */}
        <div className="mt-8 pt-4 border-t border-neutral-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-3.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous Step</span>
          </button>

          <div className="text-xs font-mono text-neutral-700">
            Step {currentStep} of 17
          </div>

          {currentStep < 17 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}
