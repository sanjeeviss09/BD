import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Factory,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Boxes,
  Calendar,
  BarChart3,
  ShieldAlert,
  Plus,
  RefreshCw,
  ChevronRight,
  Gauge
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { ProductionAnalytics } from '@/types/production-feasibility';

export default function ProductionDashboard() {
  const { session } = useAuth();
  const [analytics, setAnalytics] = useState<ProductionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getAuthToken = () => {
    return session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/production-feasibility/analytics', {
        headers: { Authorization: `Bearer ${getAuthToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Failed to load production analytics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [session?.access_token]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-neutral-400" />
        <span className="mt-3 text-xs font-mono text-neutral-500 uppercase">Loading Production Intelligence...</span>
      </div>
    );
  }

  const kpis = analytics?.kpis || {
    totalAssessments: 0,
    feasibleCount: 0,
    conditionallyFeasibleCount: 0,
    notFeasibleCount: 0,
    capacityConstrainedCount: 0,
    equipmentGapsCount: 0,
    materialGapsCount: 0,
    technologyGapsCount: 0,
    highRiskCount: 0,
    developmentRequiredCount: 0
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">
              Manufacturing Intelligence
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono bg-muted text-foreground border border-border rounded">
              CDMO Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
            Production Feasibility Command Center
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational capability, capacity headroom, equipment qualification & feasibility intelligence.
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
            New Feasibility Evaluation
          </Link>
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Evaluations</span>
            <Factory className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">
            {kpis.totalAssessments}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Active pipeline & completed
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Technically Feasible</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">
            {kpis.feasibleCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Zero critical gaps
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Conditionally Feasible</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">
            {kpis.conditionallyFeasibleCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Action items required
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Capacity Constrained</span>
            <Gauge className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-foreground mt-2">
            {kpis.capacityConstrainedCount}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Headroom exceeded
          </div>
        </div>
      </div>

      {/* KPI Cards Row 2 - Operational Blockers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <div className="p-3 rounded-lg border border-border bg-card/60">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Cpu className="w-3.5 h-3.5" />
            Equipment Gaps
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">
            {kpis.equipmentGapsCount}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card/60">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Boxes className="w-3.5 h-3.5" />
            Material Gaps
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">
            {kpis.materialGapsCount}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card/60">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Layers className="w-3.5 h-3.5" />
            Technology Gaps
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">
            {kpis.technologyGapsCount}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card/60">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Calendar className="w-3.5 h-3.5" />
            Development Req.
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">
            {kpis.developmentRequiredCount}
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-card/60">
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            High / Critical Risk
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">
            {kpis.highRiskCount}
          </div>
        </div>
      </div>

      {/* Grid: Facilities & Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Facility Distribution */}
        <div className="p-5 rounded-xl border border-border bg-card md:col-span-1">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Factory className="w-4 h-4 text-muted-foreground" />
              Assessments by Facility
            </h2>
            <Link
              to="/production-feasibility?tab=facilities"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              Compare
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {Object.keys(analytics?.byFacility || {}).length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No assessments mapped to facilities yet.
              </div>
            ) : (
              Object.entries(analytics?.byFacility || {}).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate max-w-[180px]">{name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">{count} evaluations</span>
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-foreground"
                        style={{
                          width: `${Math.min(100, (count / (kpis.totalAssessments || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Pipeline Evaluations */}
        <div className="p-5 rounded-xl border border-border bg-card md:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              Active Manufacturing Feasibility Pipeline
            </h2>
            <Link
              to="/production-feasibility"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              View Full Pipeline
              <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 font-medium">Evaluation Code</th>
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Dosage / Route</th>
                  <th className="pb-2 font-medium">Feasibility Result</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(!analytics?.recentAssessments || analytics.recentAssessments.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">
                      No feasibility evaluations recorded. Start by clicking "New Feasibility Evaluation".
                    </td>
                  </tr>
                ) : (
                  analytics.recentAssessments.map(rec => (
                    <tr key={rec.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 font-mono font-medium text-foreground">
                        {rec.feasibility_code}
                      </td>
                      <td className="py-2.5 text-foreground max-w-[180px] truncate">
                        {rec.product_name}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {rec.dosage_form} ({rec.route})
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${
                          rec.feasibility_result === 'FEASIBLE'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : rec.feasibility_result === 'CONDITIONALLY_FEASIBLE'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        }`}>
                          {rec.feasibility_result.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-foreground">
                        {rec.feasibility_score ? `${rec.feasibility_score}%` : 'N/A'}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          to={`/production-feasibility/${rec.id}`}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
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
    </div>
  );
}
