import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/contexts/PermissionContext';
import {
  GitFork,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { WorkflowGraphVisualizer } from '@/components/workflow/WorkflowGraphVisualizer';
import type {
  WorkflowStageNode,
  WorkflowTransitionEdge,
} from '@/components/workflow/WorkflowGraphVisualizer';

export default function WorkflowAdmin() {
  const { session } = useAuth();
  const { hasPermission } = usePermission();

  const [definitions, setDefinitions] = useState<any[]>([]);
  const [selectedDefId, setSelectedDefId] = useState<string>('');
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [currentVersionData, setCurrentVersionData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'stages' | 'transitions' | 'validation'>('graph');

  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch Definitions
  const fetchDefinitions = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4000/api/workflows/definitions', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const defs = data.data || [];
        setDefinitions(defs);
        if (defs.length > 0 && !selectedDefId) {
          setSelectedDefId(defs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workflow definitions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefinitions();
  }, [session?.access_token]);

  // Fetch Versions for selected Definition
  useEffect(() => {
    if (!selectedDefId || !session?.access_token) return;

    const fetchVersions = async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/workflows/definitions/${selectedDefId}/versions`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const vers = data.data || [];
          setVersions(vers);
          if (vers.length > 0) {
            // Find active version or first
            const active = vers.find((v: any) => v.status === 'ACTIVE') || vers[0];
            setSelectedVersionId(active.id);
            setCurrentVersionData(active);
          }
        }
      } catch (err) {
        console.error('Failed to fetch versions:', err);
      }
    };

    fetchVersions();
  }, [selectedDefId, session?.access_token]);

  // Update currentVersionData when selectedVersionId changes
  useEffect(() => {
    const found = versions.find(v => v.id === selectedVersionId);
    if (found) setCurrentVersionData(found);
  }, [selectedVersionId, versions]);

  // Activate Version with Server-Side Validation
  const handleActivateVersion = async () => {
    if (!selectedVersionId || !session?.access_token) return;
    setActivating(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`http://localhost:4000/api/workflows/versions/${selectedVersionId}/activate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Structural validation failed. Cannot activate version.',
        });
      } else {
        setStatusMessage({
          type: 'success',
          text: `Version ${data.data?.version_number} successfully validated and activated as default workflow.`,
        });
        // Refresh versions list
        const resList = await fetch(`http://localhost:4000/api/workflows/definitions/${selectedDefId}/versions`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (resList.ok) {
          const updatedVers = (await resList.json()).data || [];
          setVersions(updatedVers);
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Activation request failed.' });
    } finally {
      setActivating(false);
    }
  };

  const selectedDef = definitions.find(d => d.id === selectedDefId);
  const stages: WorkflowStageNode[] = currentVersionData?.workflow_stages || [];
  const transitions: WorkflowTransitionEdge[] = currentVersionData?.workflow_transitions || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <GitFork className="w-5 h-5 text-cyan-400" />
              Workflow Engine Administration
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise Operational Stage Gate Architectures • Versioning • Structural DAG Validation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchDefinitions}
            className="p-2 rounded-xl border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Refresh Definitions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {currentVersionData?.status !== 'ACTIVE' && hasPermission('workflow.manage') && (
            <button
              onClick={handleActivateVersion}
              disabled={activating}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 hover:from-cyan-400 hover:to-sky-500 disabled:opacity-40 shadow-lg shadow-cyan-500/20 transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {activating ? 'Validating Graph...' : 'Validate & Activate Version'}
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Definition & Version Selector Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
            Workflow Template Definition
          </label>
          <select
            value={selectedDefId}
            onChange={e => setSelectedDefId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {definitions.map(d => (
              <option key={d.id} value={d.id}>
                {d.workflow_name} ({d.workflow_code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
            Workflow Version
          </label>
          <select
            value={selectedVersionId}
            onChange={e => setSelectedVersionId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {versions.map(v => (
              <option key={v.id} value={v.id}>
                v{v.version_number} • {v.status} {v.status === 'ACTIVE' ? '(Default)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 w-full flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono">Entity Target:</span>
            <span className="font-bold text-cyan-300 font-mono">
              {selectedDef?.entity_type || 'OPPORTUNITY'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
        <button
          onClick={() => setActiveTab('graph')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'graph'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          DAG Graph Visualizer
        </button>
        <button
          onClick={() => setActiveTab('stages')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'stages'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Configured Stages ({stages.length})
        </button>
        <button
          onClick={() => setActiveTab('transitions')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-2 ${
            activeTab === 'transitions'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowRight className="w-4 h-4" />
          Valid Transitions ({transitions.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'graph' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Interactive 2D Directed Acyclic Graph Canvas</span>
            <span className="font-mono text-cyan-400">Strict Operational BD Pipeline (No Approvals)</span>
          </div>
          <WorkflowGraphVisualizer stages={stages} transitions={transitions} />
        </div>
      )}

      {activeTab === 'stages' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
              <tr>
                <th className="p-3.5">Seq</th>
                <th className="p-3.5">Stage Name</th>
                <th className="p-3.5">Stage Code</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">SLA Days</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {stages.map(stg => (
                <tr key={stg.id} className="hover:bg-slate-800/30 transition font-mono">
                  <td className="p-3.5 text-cyan-400 font-bold">#{stg.sequence_order}</td>
                  <td className="p-3.5 font-sans font-semibold text-slate-200">{stg.stage_name}</td>
                  <td className="p-3.5 text-slate-400">{stg.stage_code}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        stg.stage_type === 'START'
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : stg.stage_type === 'TERMINAL'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : stg.stage_type === 'DECISION'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {stg.stage_type}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-300">{stg.sla_duration_days || 0}d</td>
                  <td className="p-3.5 text-slate-400">{stg.responsible_role || 'Cross-Functional'}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'transitions' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
              <tr>
                <th className="p-3.5">Transition Code</th>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">From Stage</th>
                <th className="p-3.5">To Stage</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {transitions.map(tr => {
                const fromStage = stages.find(s => s.id === tr.from_stage_id);
                const toStage = stages.find(s => s.id === tr.to_stage_id);

                return (
                  <tr key={tr.id} className="hover:bg-slate-800/30 transition font-mono">
                    <td className="p-3.5 text-cyan-400">{tr.transition_code}</td>
                    <td className="p-3.5 font-sans font-semibold text-slate-200">{tr.transition_name}</td>
                    <td className="p-3.5 text-slate-400">{fromStage?.stage_name || tr.from_stage_id}</td>
                    <td className="p-3.5 text-slate-200 font-bold">{toStage?.stage_name || tr.to_stage_id}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400">
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
