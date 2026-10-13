import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Lock,
  RefreshCw,
  CheckSquare,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductionFeasibility } from '@/types/production-feasibility';

export default function ProductionFeasibilityDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();

  const [feasibility, setFeasibility] = useState<ProductionFeasibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'product'
    | 'facility'
    | 'equipment'
    | 'capacity'
    | 'materials'
    | 'process'
    | 'timeline'
    | 'gaps'
    | 'risks'
    | 'versions'
  >('overview');

  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeReason, setFinalizeReason] = useState('Production feasibility verified against operational data.');
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [reviseSummary, setReviseSummary] = useState('');

  const getAuthToken = () => {
    return session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
  };

  const getHeaders = () => ({
    Authorization: `Bearer ${getAuthToken()}`,
    'Content-Type': 'application/json'
  });

  const fetchRecord = async () => {
    if (!id) return;
    try {
      const res = await fetch(`http://localhost:4000/api/production-feasibility/assessments/${id}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        setFeasibility(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch feasibility detail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [id, session?.access_token]);

  const handleExport = () => {
    if (!id) return;
    window.open(`http://localhost:4000/api/production-feasibility/assessments/${id}/export`, '_blank');
  };

  const handleFinalize = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/production-feasibility/assessments/${id}/finalize`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ finalize_reason: finalizeReason })
      });
      if (res.ok) {
        setShowFinalizeModal(false);
        fetchRecord();
      }
    } catch (err) {
      console.error('Finalize error', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevise = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/api/production-feasibility/assessments/${id}/revise`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ change_summary: reviseSummary })
      });
      if (res.ok) {
        setShowReviseModal(false);
        fetchRecord();
      }
    } catch (err) {
      console.error('Revise error', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertGapToTask = async (gapId: string) => {
    if (!id) return;
    try {
      const res = await fetch(
        `http://localhost:4000/api/production-feasibility/assessments/${id}/gaps/${gapId}/create-task`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({})
        }
      );
      if (res.ok) {
        fetchRecord();
      }
    } catch (err) {
      console.error('Failed to convert gap to task', err);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-xs text-muted-foreground font-mono">
        Loading production feasibility workbench...
      </div>
    );
  }

  if (!feasibility) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="text-sm font-semibold text-foreground">Feasibility assessment not found.</div>
        <Link to="/production-feasibility" className="text-xs text-muted-foreground hover:underline">
          Return to pipeline
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/production-feasibility"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Production Feasibility Pipeline
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-mono font-medium text-foreground">
              {feasibility.feasibility_code}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {feasibility.feasibility_code}
            </h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
              feasibility.feasibility_result === 'FEASIBLE'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : feasibility.feasibility_result === 'CONDITIONALLY_FEASIBLE'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
            }`}>
              {feasibility.feasibility_result.replace(/_/g, ' ')}
            </span>

            {feasibility.is_finalized ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-foreground text-background">
                <Lock className="w-3 h-3" />
                IMMUTABLE V{feasibility.version_number}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-muted text-muted-foreground border border-border">
                {feasibility.status} (V{feasibility.version_number})
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export 21-Sheet Excel
          </button>

          <Link
            to={`/production-feasibility/engine?workspace=C_REPORT&id=${feasibility.id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Consolidated AI Engine Report
          </Link>

          {!feasibility.is_finalized ? (
            <button
              onClick={() => setShowFinalizeModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
            >
              <Lock className="w-3.5 h-3.5" />
              Finalize & Lock Snapshot
            </button>
          ) : (
            <button
              onClick={() => setShowReviseModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Create Revision V{feasibility.version_number + 1}
            </button>
          )}
        </div>
      </div>

      {/* KPI Header Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block">Production Score</span>
          <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
            {feasibility.feasibility_score ? `${feasibility.feasibility_score}%` : 'N/A'}
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block">Required Volume</span>
          <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
            {feasibility.annual_volume?.toLocaleString() || 'N/A'}
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block">Estimated Batches</span>
          <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
            {feasibility.estimated_batches} batches
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block">Customer Lead Time</span>
          <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
            {feasibility.total_customer_lead_time_days || 0} days
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block">Overall Risk</span>
          <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
            {feasibility.overall_risk}
          </span>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block">Data Completeness</span>
          <span className="text-xl font-bold font-mono text-foreground mt-0.5 block">
            {feasibility.data_completeness_pct || 0}%
          </span>
        </div>
      </div>

      {/* Section Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto text-xs font-medium pb-px">
        {[
          { key: 'overview', label: 'Executive Decision' },
          { key: 'product', label: 'Product & RFQ' },
          { key: 'facility', label: 'Facility & Line' },
          { key: 'equipment', label: 'Equipment Fit' },
          { key: 'capacity', label: 'Capacity Ledger' },
          { key: 'materials', label: 'Materials & BOM' },
          { key: 'process', label: 'Manufacturing Process' },
          { key: 'timeline', label: 'Timeline Check' },
          { key: 'gaps', label: `Gaps (${feasibility.production_gaps?.length || 0})` },
          { key: 'risks', label: `Risks (${feasibility.production_risks?.length || 0})` },
          { key: 'versions', label: `Versions (${feasibility.production_feasibility_versions?.length || 0})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-3 py-2.5 rounded-t-lg transition-colors border-t border-x ${
              activeTab === tab.key
                ? 'bg-card text-foreground font-semibold border-border border-b-card -mb-px'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: OVERVIEW & DECISION                            */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive Recommendation Banner */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Authoritative Recommendation
              </span>
              <span className="font-mono text-xs text-foreground font-semibold">
                Outcome: {feasibility.recommendation}
              </span>
            </div>
            <p className="text-sm text-foreground font-medium">
              {feasibility.recommendation_reason}
            </p>
          </div>

          {/* Transparent Score Breakdown Table */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Explainable Feasibility Score Breakdown
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deterministic factor weighting without AI or black-box calculations.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 font-medium">Factor</th>
                    <th className="pb-2 font-medium">Weight</th>
                    <th className="pb-2 font-medium">Raw Score</th>
                    <th className="pb-2 font-medium">Weighted Score</th>
                    <th className="pb-2 font-medium">Evidence & Operational Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {(feasibility.score_breakdown || []).map(f => (
                    <tr key={f.factor}>
                      <td className="py-2.5 font-medium text-foreground">{f.factor}</td>
                      <td className="py-2.5 font-mono text-muted-foreground">{(f.weight * 100).toFixed(0)}%</td>
                      <td className="py-2.5 font-mono text-foreground">{f.score} / 100</td>
                      <td className="py-2.5 font-mono font-bold text-foreground">{f.weightedScore}</td>
                      <td className="py-2.5 text-muted-foreground">
                        <div>{f.reason}</div>
                        <div className="text-[10px] text-muted-foreground/75 italic">{f.evidence}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: PRODUCT & RFQ                                  */}
      {/* ========================================================= */}
      {activeTab === 'product' && (
        <div className="p-5 rounded-xl border border-border bg-card grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-foreground">Canonical Product Master Data</h2>
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Product Name</span>
                <span className="font-medium text-foreground">{feasibility.product_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Dosage Form</span>
                <span className="text-foreground">{feasibility.dosage_form}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Route</span>
                <span className="text-foreground">{feasibility.route}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Strength</span>
                <span className="text-foreground">{feasibility.strength}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Presentation</span>
                <span className="text-foreground">{feasibility.presentation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Pack Size</span>
                <span className="text-foreground">{feasibility.pack_size}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-foreground">RFQ / Customer Commercial Demand</h2>
            <div className="space-y-2">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Customer Name</span>
                <span className="font-medium text-foreground">{feasibility.customer_name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Annual Volume</span>
                <span className="font-mono text-foreground">{feasibility.annual_volume?.toLocaleString()} units</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Required Delivery Date</span>
                <span className="font-mono text-foreground">{feasibility.customer_required_date || 'Unspecified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">RFQ Reference</span>
                <span className="font-mono text-foreground">{feasibility.rfq_id || 'Direct Request'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 4: EQUIPMENT FIT                                  */}
      {/* ========================================================= */}
      {activeTab === 'equipment' && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Equipment Qualification & Technical Compatibility
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Qualification status (IQ/OQ/PQ), calibration, and maintenance for designated line.
              </p>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-mono border ${
              feasibility.equipment_status === 'AVAILABLE'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300'
            }`}>
              {feasibility.equipment_status}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Equipment Code</th>
                  <th className="pb-2 font-medium">Equipment Name</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">IQ / OQ / PQ</th>
                  <th className="pb-2 font-medium">Calibration</th>
                  <th className="pb-2 font-medium">Maintenance</th>
                  <th className="pb-2 font-medium">Operational Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(feasibility.production_facilities?.production_equipment || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No equipment currently logged in facility.
                    </td>
                  </tr>
                ) : (
                  (feasibility.production_facilities?.production_equipment || []).map(eq => (
                    <tr key={eq.id}>
                      <td className="py-2.5 font-mono text-foreground">{eq.equipment_code}</td>
                      <td className="py-2.5 font-medium text-foreground">{eq.equipment_name}</td>
                      <td className="py-2.5 text-muted-foreground">{eq.equipment_type}</td>
                      <td className="py-2.5 font-mono text-[11px] text-foreground">
                        {eq.qualification_status}
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-foreground">{eq.calibration_status || 'CALIBRATED'}</td>
                      <td className="py-2.5 font-mono text-[11px] text-foreground">{eq.maintenance_status || 'OPERATIONAL'}</td>
                      <td className="py-2.5">
                        <span className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-mono">
                          {eq.availability_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 5: CAPACITY LEDGER                                */}
      {/* ========================================================= */}
      {activeTab === 'capacity' && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-6 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-border bg-background space-y-1">
              <span className="text-muted-foreground text-[11px]">Required Gross Quantity</span>
              <div className="text-xl font-bold font-mono text-foreground">
                {feasibility.required_manufacturing_quantity?.toLocaleString()} units
              </div>
              <span className="text-[10px] text-muted-foreground">
                Adjusted for {feasibility.expected_yield_pct}% expected yield ({feasibility.yield_source})
              </span>
            </div>

            <div className="p-4 rounded-lg border border-border bg-background space-y-1">
              <span className="text-muted-foreground text-[11px]">Batch Size & Count</span>
              <div className="text-xl font-bold font-mono text-foreground">
                {feasibility.estimated_batches} batches
              </div>
              <span className="text-[10px] text-muted-foreground">
                At {feasibility.batch_size?.toLocaleString()} units / batch
              </span>
            </div>

            <div className="p-4 rounded-lg border border-border bg-background space-y-1">
              <span className="text-muted-foreground text-[11px]">Line Capacity Headroom</span>
              <div className="text-xl font-bold font-mono text-foreground">
                {feasibility.capacity_status}
              </div>
              <span className="text-[10px] text-muted-foreground">
                Designated Line: {feasibility.production_lines?.line_name || 'Unassigned'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 6: MATERIALS & BOM                                */}
      {/* ========================================================= */}
      {activeTab === 'materials' && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Material Bill of Materials & Stock Availability</h2>
            <span className="px-2 py-0.5 rounded text-xs font-mono border border-border bg-muted">
              Status: {feasibility.material_status}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Material Name</th>
                  <th className="pb-2 font-medium">Required Qty</th>
                  <th className="pb-2 font-medium">Available Qty</th>
                  <th className="pb-2 font-medium">Gap</th>
                  <th className="pb-2 font-medium">Availability Status</th>
                  <th className="pb-2 font-medium">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(feasibility.production_materials || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No material requirements configured.
                    </td>
                  </tr>
                ) : (
                  (feasibility.production_materials || []).map(m => (
                    <tr key={m.id}>
                      <td className="py-2.5 font-mono text-[11px] text-muted-foreground">{m.material_category}</td>
                      <td className="py-2.5 font-medium text-foreground">{m.material_name}</td>
                      <td className="py-2.5 font-mono text-foreground">{m.required_quantity} {m.required_unit}</td>
                      <td className="py-2.5 font-mono text-foreground">{m.available_quantity || 0} {m.required_unit}</td>
                      <td className="py-2.5 font-mono text-foreground">
                        {Math.max(0, m.required_quantity - (m.available_quantity || 0))} {m.required_unit}
                      </td>
                      <td className="py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          m.availability_status === 'AVAILABLE'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                        }`}>
                          {m.availability_status}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{m.supplier_name || 'Supplier info unavailable'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 7: PROCESS & ROUTING                              */}
      {/* ========================================================= */}
      {activeTab === 'process' && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Configurable Manufacturing Process Routing</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Step</th>
                  <th className="pb-2 font-medium">Operation Name</th>
                  <th className="pb-2 font-medium">Required Equipment</th>
                  <th className="pb-2 font-medium">Setup Time</th>
                  <th className="pb-2 font-medium">Processing Time</th>
                  <th className="pb-2 font-medium">Cleaning Time</th>
                  <th className="pb-2 font-medium">Total Duration</th>
                  <th className="pb-2 font-medium">Step Yield %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(feasibility.production_process_steps || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-muted-foreground">
                      Standard process sequence applies (Dispensing → Granulation → Compression → Coating → Packaging).
                    </td>
                  </tr>
                ) : (
                  (feasibility.production_process_steps || []).map(s => (
                    <tr key={s.id}>
                      <td className="py-2.5 font-mono text-muted-foreground">{s.step_number}</td>
                      <td className="py-2.5 font-medium text-foreground">{s.operation_name}</td>
                      <td className="py-2.5 text-muted-foreground">{s.equipment_type_required || 'Manual'}</td>
                      <td className="py-2.5 font-mono text-foreground">{s.setup_time_hours}h</td>
                      <td className="py-2.5 font-mono text-foreground">{s.processing_time_hours}h</td>
                      <td className="py-2.5 font-mono text-foreground">{s.cleaning_time_hours}h</td>
                      <td className="py-2.5 font-mono font-bold text-foreground">
                        {s.setup_time_hours + s.processing_time_hours + s.cleaning_time_hours}h
                      </td>
                      <td className="py-2.5 font-mono text-foreground">{s.step_yield_pct}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 8: TIMELINE CHECK                                 */}
      {/* ========================================================= */}
      {activeTab === 'timeline' && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-6 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Calculated Lead Time Breakdown</h2>
              <div className="space-y-2 border-t border-border pt-2">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Setup & In-Process Time:</span>
                  <span className="font-mono text-foreground">
                    {(feasibility.setup_time_hours || 4) + (feasibility.processing_time_hours || 16)} hours
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Cleaning & Line Clearance:</span>
                  <span className="font-mono text-foreground">{feasibility.cleaning_time_hours || 4} hours</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Pure Manufacturing Lead Time:</span>
                  <span className="font-mono font-medium text-foreground">{feasibility.manufacturing_lead_time_days || 0} production days</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">QC Testing & QA Batch Release:</span>
                  <span className="font-mono text-foreground">{feasibility.testing_release_time_days || 14} days</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-foreground">
                  <span>Total Customer Delivery Lead Time:</span>
                  <span className="font-mono">{feasibility.total_customer_lead_time_days || 0} days</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Customer Target vs Calculated Availability</h2>
              <div className="space-y-2 border-t border-border pt-2">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Customer Required Date:</span>
                  <span className="font-mono text-foreground">{feasibility.customer_required_date || 'Unspecified'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Earliest Commercial Availability:</span>
                  <span className="font-mono text-foreground">{feasibility.estimated_available_date || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 font-medium text-foreground">
                  <span>Timeline Feasibility Result:</span>
                  <span className="font-mono">
                    {feasibility.estimated_available_date && feasibility.customer_required_date && feasibility.estimated_available_date <= feasibility.customer_required_date
                      ? 'TIMELINE FEASIBLE'
                      : 'TIMELINE CONSTRAINT'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 9: GAPS & ACTION PLAN (Section 38 & 39)           */}
      {/* ========================================================= */}
      {activeTab === 'gaps' && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Identified Manufacturing Gaps</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every gap can be directly converted into an operational task for cross-functional resolution.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {(feasibility.production_gaps || []).length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No manufacturing capability gaps identified. Facility is technically compliant.
              </div>
            ) : (
              (feasibility.production_gaps || []).map(gap => (
                <div
                  key={gap.id}
                  className="p-4 rounded-lg border border-border bg-background flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted border border-border">
                        {gap.gap_category}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                        gap.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {gap.severity}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Dept: {gap.responsible_department || 'Manufacturing'}
                      </span>
                    </div>
                    <div className="font-medium text-foreground">{gap.description}</div>
                    <div className="text-muted-foreground text-[11px]">Required Action: {gap.required_action}</div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {gap.task_id ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded bg-muted text-muted-foreground border border-border">
                        <CheckSquare className="w-3 h-3" />
                        Task Active
                      </span>
                    ) : (
                      <button
                        onClick={() => handleConvertGapToTask(gap.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Convert to Task
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 10: RISKS                                         */}
      {/* ========================================================= */}
      {activeTab === 'risks' && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Manufacturing Risk Matrix</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Category</th>
                  <th className="pb-2 font-medium">Risk Title</th>
                  <th className="pb-2 font-medium">Prob (1-5)</th>
                  <th className="pb-2 font-medium">Impact (1-5)</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Level</th>
                  <th className="pb-2 font-medium">Mitigation Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(feasibility.production_risks || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      No high operational risks registered.
                    </td>
                  </tr>
                ) : (
                  (feasibility.production_risks || []).map(r => (
                    <tr key={r.id}>
                      <td className="py-2.5 font-mono text-muted-foreground">{r.risk_category}</td>
                      <td className="py-2.5 font-medium text-foreground">{r.risk_title}</td>
                      <td className="py-2.5 font-mono text-foreground">{r.probability}</td>
                      <td className="py-2.5 font-mono text-foreground">{r.impact}</td>
                      <td className="py-2.5 font-mono font-bold text-foreground">{r.risk_score}</td>
                      <td className="py-2.5 font-mono text-[11px] text-foreground">{r.risk_level}</td>
                      <td className="py-2.5 text-muted-foreground">{r.mitigation_plan || 'Standard oversight'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 11: VERSIONS & DECISION SNAPSHOT (Section 49, 50) */}
      {/* ========================================================= */}
      {activeTab === 'versions' && (
        <div className="p-5 rounded-xl border border-border bg-card space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Immutable Version History & Decision Snapshots
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Finalized snapshots capture frozen parameters, facility capacity, equipment availability & commercial evidence.
            </p>
          </div>

          <div className="space-y-3">
            {(feasibility.production_feasibility_versions || []).length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No finalized snapshots yet. Once finalized, an immutable record will appear here.
              </div>
            ) : (
              (feasibility.production_feasibility_versions || []).map(ver => (
                <div key={ver.id} className="p-4 rounded-lg border border-border bg-background space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">Version {ver.version_number}</span>
                      <span className="px-1.5 py-0.2 rounded bg-foreground text-background text-[10px] font-mono">
                        IMMUTABLE
                      </span>
                    </div>
                    <span className="font-mono text-muted-foreground text-[11px]">
                      {ver.finalized_at ? new Date(ver.finalized_at).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="text-muted-foreground">{ver.change_summary}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Finalize Modal */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md p-6 rounded-xl border border-border bg-card space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Finalize & Lock Feasibility Snapshot
            </h3>
            <p className="text-xs text-muted-foreground">
              Finalizing will permanently lock Version {feasibility.version_number}. All equipment compatibility, capacity allocations, and lead times will become immutable.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Sign-off Reasoning</label>
              <textarea
                value={finalizeReason}
                onChange={e => setFinalizeReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                disabled={actionLoading}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {actionLoading ? 'Finalizing...' : 'Lock Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revise Modal */}
      {showReviseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md p-6 rounded-xl border border-border bg-card space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Create Revision V{feasibility.version_number + 1}
            </h3>
            <p className="text-xs text-muted-foreground">
              Previous Version {feasibility.version_number} will remain safely archived and immutable. A new working draft will be created.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Reason for Revision</label>
              <textarea
                value={reviseSummary}
                onChange={e => setReviseSummary(e.target.value)}
                placeholder="e.g. Updated customer annual volume requirement, adjusted batch size..."
                rows={3}
                className="w-full p-2.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowReviseModal(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleRevise}
                disabled={actionLoading || !reviseSummary}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
              >
                {actionLoading ? 'Creating Revision...' : 'Create Draft V' + (feasibility.version_number + 1)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
