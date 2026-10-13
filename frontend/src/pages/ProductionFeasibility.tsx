import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Factory,
  Search,
  Plus,
  RefreshCw,
  Layers,
  Cpu,
  BarChart3,
  Building2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  ProductionFeasibility,
  FacilityComparisonItem,
  ProductionFacility,
  ProductionLine
} from '@/types/production-feasibility';

export default function ProductionFeasibilityPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = (searchParams.get('tab') as 'pipeline' | 'facilities' | 'capacity' | 'map') || 'pipeline';

  // Data states
  const [assessments, setAssessments] = useState<ProductionFeasibility[]>([]);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [facilities, setFacilities] = useState<ProductionFacility[]>([]);
  const [comparisons, setComparisons] = useState<FacilityComparisonItem[]>([]);
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');

  const getAuthToken = () => {
    return session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
  };

  const getHeaders = () => ({
    Authorization: `Bearer ${getAuthToken()}`,
  });

  const fetchData = async () => {
    try {
      const headers = getHeaders();

      // 1. Fetch Assessments
      const q = new URLSearchParams();
      if (statusFilter !== 'ALL') q.set('status', statusFilter);
      if (resultFilter !== 'ALL') q.set('result', resultFilter);
      if (riskFilter !== 'ALL') q.set('risk', riskFilter);
      if (search) q.set('search', search);

      const res = await fetch(`http://localhost:4000/api/production-feasibility/assessments?${q.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAssessments(data.items || []);
        setTotalAssessments(data.total || 0);
      }

      // 2. Fetch Facilities & Comparison
      const facRes = await fetch('http://localhost:4000/api/production-feasibility/facilities', { headers });
      if (facRes.ok) {
        setFacilities(await facRes.json());
      }

      const compRes = await fetch('http://localhost:4000/api/production-feasibility/facilities/compare', { headers });
      if (compRes.ok) {
        setComparisons(await compRes.json());
      }

      // 3. Fetch Lines for Capacity View
      const linesRes = await fetch('http://localhost:4000/api/production-feasibility/lines', { headers });
      if (linesRes.ok) {
        setLines(await linesRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch production data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [session?.access_token, statusFilter, resultFilter, riskFilter, search]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const setTab = (tab: 'pipeline' | 'facilities' | 'capacity' | 'map') => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              Operations & Technical Assessment
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-muted text-foreground border border-border rounded">
              BDIQ Production Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Production Feasibility & Manufacturing Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evaluate whether pharmaceutical products & RFQs can realistically be manufactured within organizational constraints.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <Link
            to="/production-feasibility/wizard"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Evaluate Product / RFQ
          </Link>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setTab('pipeline')}
          className={`pb-3 px-3 transition-colors relative flex items-center gap-2 ${
            currentTab === 'pipeline'
              ? 'text-foreground font-semibold border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Factory className="w-4 h-4" />
          Production Feasibility Pipeline
          <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-mono text-muted-foreground">
            {totalAssessments}
          </span>
        </button>

        <button
          onClick={() => setTab('facilities')}
          className={`pb-3 px-3 transition-colors relative flex items-center gap-2 ${
            currentTab === 'facilities'
              ? 'text-foreground font-semibold border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Facility Comparison Matrix
        </button>

        <button
          onClick={() => setTab('capacity')}
          className={`pb-3 px-3 transition-colors relative flex items-center gap-2 ${
            currentTab === 'capacity'
              ? 'text-foreground font-semibold border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Capacity & Line Utilization
        </button>

        <button
          onClick={() => setTab('map')}
          className={`pb-3 px-3 transition-colors relative flex items-center gap-2 ${
            currentTab === 'map'
              ? 'text-foreground font-semibold border-b-2 border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          Visual Capability Map
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: PRODUCTION FEASIBILITY PIPELINE                    */}
      {/* ========================================================= */}
      {currentTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by evaluation code, product, customer..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={resultFilter}
                onChange={e => setResultFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
              >
                <option value="ALL">All Results</option>
                <option value="FEASIBLE">Feasible</option>
                <option value="CONDITIONALLY_FEASIBLE">Conditionally Feasible</option>
                <option value="FEASIBLE_WITH_DEVELOPMENT">Feasible With Development</option>
                <option value="CAPACITY_CONSTRAINED">Capacity Constrained</option>
                <option value="EQUIPMENT_GAP">Equipment Gap</option>
                <option value="MATERIAL_GAP">Material Gap</option>
                <option value="REGULATORY_CONSTRAINT">Regulatory Constraint</option>
                <option value="NOT_FEASIBLE">Not Feasible</option>
                <option value="DATA_INSUFFICIENT">Data Insufficient</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
              >
                <option value="ALL">All Lifecycle Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="UNDER_EVALUATION">Under Evaluation</option>
                <option value="READY_FOR_DECISION">Ready for Decision</option>
                <option value="FINALIZED">Finalized</option>
              </select>

              <select
                value={riskFilter}
                onChange={e => setRiskFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="LOW">Low Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="HIGH">High Risk</option>
                <option value="CRITICAL">Critical Risk</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                    <th className="py-3 px-4 font-medium">Code</th>
                    <th className="py-3 px-4 font-medium">Product & Dosage Form</th>
                    <th className="py-3 px-4 font-medium">Customer / RFQ</th>
                    <th className="py-3 px-4 font-medium">Designated Facility & Line</th>
                    <th className="py-3 px-4 font-medium">Annual Volume</th>
                    <th className="py-3 px-4 font-medium">Feasibility Result</th>
                    <th className="py-3 px-4 font-medium">Score</th>
                    <th className="py-3 px-4 font-medium">Risk</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        Loading production feasibility pipeline...
                      </td>
                    </tr>
                  ) : assessments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-muted-foreground">
                        No feasibility assessments match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    assessments.map(rec => (
                      <tr key={rec.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          <Link to={`/production-feasibility/${rec.id}`} className="hover:underline">
                            {rec.feasibility_code}
                          </Link>
                          {rec.is_finalized && (
                            <span className="ml-1.5 text-[9px] font-mono px-1 py-0.2 rounded bg-foreground text-background">
                              LOCKED V{rec.version_number}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{rec.product_name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {rec.dosage_form} • {rec.strength || 'Standard'} • {rec.presentation || 'Blister'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-foreground">{rec.customer_name || 'Standard Client'}</div>
                          {rec.rfq_id && (
                            <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">
                              RFQ: {rec.rfq_id}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-foreground">
                            {rec.production_facilities?.facility_name || 'Unassigned Facility'}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {rec.production_lines?.line_name || 'Unassigned Line'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground">
                          {rec.annual_volume ? `${rec.annual_volume.toLocaleString()} units` : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${
                            rec.feasibility_result === 'FEASIBLE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : rec.feasibility_result === 'CONDITIONALLY_FEASIBLE'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              : rec.feasibility_result === 'CAPACITY_CONSTRAINED'
                              ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}>
                            {rec.feasibility_result.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-foreground">
                          {rec.feasibility_score ? `${rec.feasibility_score}%` : 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                            rec.overall_risk === 'LOW'
                              ? 'bg-muted text-muted-foreground'
                              : rec.overall_risk === 'MEDIUM'
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                              : 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300'
                          }`}>
                            {rec.overall_risk}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            to={`/production-feasibility/${rec.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-border rounded bg-card hover:bg-muted text-foreground transition-colors"
                          >
                            Workbench
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: FACILITY COMPARISON MATRIX (Section 41 & 42)       */}
      {/* ========================================================= */}
      {currentTab === 'facilities' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <h2 className="text-sm font-semibold text-foreground">
              Side-by-Side Manufacturing Site Comparison
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transparent multi-site assessment across dosage capabilities, technology, equipment, capacity utilization, lead times & regulatory standings.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                  <th className="py-3 px-4 font-medium">Facility / Site</th>
                  <th className="py-3 px-4 font-medium">Site Type & Location</th>
                  <th className="py-3 px-4 font-medium">Regulatory Approvals</th>
                  <th className="py-3 px-4 font-medium">Manufacturing Lines</th>
                  <th className="py-3 px-4 font-medium">Annual Capacity</th>
                  <th className="py-3 px-4 font-medium">Avg. Utilization</th>
                  <th className="py-3 px-4 font-medium">Remaining Capacity</th>
                  <th className="py-3 px-4 font-medium">Risk Level</th>
                  <th className="py-3 px-4 font-medium">Site Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comparisons.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted-foreground">
                      No facilities registered in organization.
                    </td>
                  </tr>
                ) : (
                  comparisons.map(fac => (
                    <tr key={fac.facilityId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{fac.facilityName}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{fac.facilityCode}</div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {fac.siteType} • {fac.city}, {fac.countryIso2}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {fac.regulatoryApprovals.length === 0 ? (
                            <span className="text-[10px] text-muted-foreground font-mono">Pending Audit</span>
                          ) : (
                            fac.regulatoryApprovals.map(app => (
                              <span key={app} className="px-1.5 py-0.2 rounded bg-muted text-[10px] font-mono border border-border">
                                {app}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-foreground">
                        {fac.linesCount} lines ({fac.qualifiedEquipmentCount} machines)
                      </td>
                      <td className="py-3 px-4 font-mono text-foreground">
                        {fac.totalAvailableCapacity.toLocaleString()} units
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{fac.averageUtilizationPct}%</span>
                          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full ${fac.averageUtilizationPct > 80 ? 'bg-rose-500' : 'bg-foreground'}`}
                              style={{ width: `${Math.min(100, fac.averageUtilizationPct)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-foreground">
                        {fac.remainingCapacity.toLocaleString()} units
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          fac.risk === 'LOW'
                            ? 'bg-muted text-muted-foreground'
                            : fac.risk === 'MEDIUM'
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300'
                            : 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300'
                        }`}>
                          {fac.risk}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground text-[11px]">{fac.recommendation.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{fac.recommendationReason}</div>
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
      {/* TAB 3: CAPACITY & LINE UTILIZATION (Section 44)           */}
      {/* ========================================================= */}
      {currentTab === 'capacity' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-card">
            <h2 className="text-sm font-semibold text-foreground">
              Production Line Capacity Ledger & Utilization Dashboard
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Available, Committed, Reserved and Remaining production capacity across manufacturing suites.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lines.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-muted-foreground">
                No production lines configured in the system.
              </div>
            ) : (
              lines.map(line => {
                const nominal = Number(line.nominal_annual_capacity) || 50000000;
                const util = Number(line.current_utilization_pct) || 0;
                const committed = (nominal * util) / 100;
                const remaining = Math.max(0, nominal - committed);

                return (
                  <div key={line.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-foreground">{line.line_name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{line.line_code} • {line.manufacturing_type}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                        line.qualification_status === 'QUALIFIED'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      }`}>
                        {line.qualification_status}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-border/60">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Nominal Annual Capacity:</span>
                        <span className="font-mono font-medium text-foreground">{nominal.toLocaleString()} units</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Committed Capacity:</span>
                        <span className="font-mono text-foreground">{committed.toLocaleString()} units</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Remaining Headroom:</span>
                        <span className="font-mono font-bold text-foreground">{remaining.toLocaleString()} units</span>
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Current Line Utilization</span>
                        <span className="font-mono font-semibold text-foreground">{util}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full ${util > 80 ? 'bg-rose-500' : 'bg-foreground'}`}
                          style={{ width: `${Math.min(100, util)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: VISUAL CAPABILITY MAP (Section 67 & 68)             */}
      {/* ========================================================= */}
      {currentTab === 'map' && (
        <div className="p-6 rounded-xl border border-border bg-card space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              End-to-End Visual Manufacturing Capability Map
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Traceability hierarchy from Facility → Line → Technology → Equipment → Process → Final Product.
            </p>
          </div>

          <div className="space-y-6">
            {facilities.map(fac => (
              <div key={fac.id} className="p-4 rounded-lg border border-border bg-background space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-foreground text-background">
                    <Factory className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{fac.facility_name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground">{fac.facility_code} • {fac.site_type} ({fac.city}, {fac.country_iso2})</div>
                  </div>
                </div>

                {/* Lines hierarchy */}
                <div className="pl-6 border-l-2 border-border space-y-4 ml-3">
                  {(fac.production_lines || []).map(line => (
                    <div key={line.id} className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-foreground">{line.line_code}:</span>
                        <span className="text-foreground font-medium">{line.line_name}</span>
                        <span className="text-muted-foreground">({line.manufacturing_type})</span>
                        <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                          Capacity: {Number(line.nominal_annual_capacity).toLocaleString()}
                        </span>
                      </div>

                      {/* Equipment row */}
                      <div className="flex flex-wrap gap-2 pl-4">
                        {(fac.production_equipment || [])
                          .filter(e => !e.production_line_id || e.production_line_id === line.id)
                          .map(eq => (
                            <div key={eq.id} className="px-2.5 py-1 rounded border border-border bg-card text-[11px] flex items-center gap-1.5">
                              <Cpu className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium text-foreground">{eq.equipment_name}</span>
                              <span className="font-mono text-[9px] text-muted-foreground">({eq.equipment_type})</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
