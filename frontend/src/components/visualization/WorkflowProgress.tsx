import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, Lock, PlayCircle } from 'lucide-react';

export interface WorkflowStageItem {
  key: string;
  name: string;
  description?: string;
  defaultProbability: number;
  slaDays: number;
  blockedReason?: string;
}

export const CANONICAL_OPERATIONAL_WORKFLOW_STAGES: WorkflowStageItem[] = [
  { key: 'OPPORTUNITY_CREATED', name: 'Opportunity Created', defaultProbability: 10, slaDays: 3 },
  { key: 'QUALIFICATION', name: 'Qualification', defaultProbability: 25, slaDays: 7 },
  { key: 'MARKET_INTELLIGENCE', name: 'Market Intelligence', defaultProbability: 40, slaDays: 14 },
  { key: 'TECHNICAL_EVALUATION', name: 'Technical Eval', defaultProbability: 50, slaDays: 21 },
  { key: 'REGULATORY_EVALUATION', name: 'Regulatory Eval', defaultProbability: 60, slaDays: 14 },
  { key: 'PRODUCTION_FEASIBILITY', name: 'Production Feasibility', defaultProbability: 70, slaDays: 21 },
  { key: 'COMMERCIAL_EVALUATION', name: 'Commercial Eval', defaultProbability: 80, slaDays: 14 },
  { key: 'RFQ_CUSTOMER_ENGAGEMENT', name: 'RFQ & Engagement', defaultProbability: 85, slaDays: 14 },
  { key: 'OPPORTUNITY_DECISION', name: 'Opportunity Decision', defaultProbability: 90, slaDays: 7 },
  { key: 'WON', name: 'Won', defaultProbability: 100, slaDays: 0 },
];

// Retain alias export for backwards compatibility
export const WORKFLOW_STAGES_SEQUENCE = CANONICAL_OPERATIONAL_WORKFLOW_STAGES;

export interface WorkflowInstanceData {
  id?: string;
  current_stage_code?: string;
  stage_started_at?: string;
  stage_due_at?: string;
  sla_status?: 'ON_TRACK' | 'DUE_SOON' | 'OVERDUE' | 'COMPLETED';
  is_paused?: boolean;
}

export interface ValidTransitionOption {
  to_stage_code: string;
  to_stage_name: string;
  transition_name: string;
  is_valid: boolean;
  blocking_reasons?: string[];
  suggested_probability?: number;
}

interface WorkflowProgressProps {
  currentStage: string;
  workflowInstance?: WorkflowInstanceData | null;
  validTransitions?: ValidTransitionOption[];
  onSelectStage?: (stageKey: string) => void;
  onOpenTransitionDrawer?: () => void;
  className?: string;
  canTransition?: boolean;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  currentStage,
  workflowInstance,
  validTransitions = [],
  onSelectStage,
  onOpenTransitionDrawer,
  className = '',
  canTransition = true,
}) => {
  // Normalize current stage string (handling aliases like IDENTIFIED -> OPPORTUNITY_CREATED)
  const normalizedCurrent = (() => {
    const s = (currentStage || '').toUpperCase();
    if (s === 'IDENTIFIED' || s === 'INITIAL_SCREENING' || s === 'START') return 'OPPORTUNITY_CREATED';
    if (s === 'MARKET_EVALUATION') return 'MARKET_INTELLIGENCE';
    if (s === 'CUSTOMER_EVALUATION' || s === 'RFQ' || s === 'NEGOTIATION') return 'RFQ_CUSTOMER_ENGAGEMENT';
    return s;
  })();

  const currentIndex = CANONICAL_OPERATIONAL_WORKFLOW_STAGES.findIndex(
    s => s.key === normalizedCurrent
  );
  const isLost = normalizedCurrent === 'LOST';
  const isOnHold = normalizedCurrent === 'ON_HOLD';

  // SLA calculations
  const slaStatus = workflowInstance?.sla_status || 'ON_TRACK';
  const slaBadgeColor =
    slaStatus === 'OVERDUE'
      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      : slaStatus === 'DUE_SOON'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/90 light:bg-white light:border-slate-200 p-5 shadow-2xl relative overflow-hidden ${className}`}>
      {/* Background ambient gradient glow */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h4 className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200 light:text-slate-800">
            Pharmaceutical BD Operational Stage Gate Engine
          </h4>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            Step 10 Operational
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* SLA Badge */}
          {workflowInstance?.stage_due_at && !isLost && (
            <div className={`px-2.5 py-1 rounded-md text-[11px] font-mono border flex items-center gap-1.5 ${slaBadgeColor}`}>
              <Clock className="w-3 h-3" />
              <span>SLA: {slaStatus.replace('_', ' ')}</span>
              <span className="opacity-70">
                (Due {new Date(workflowInstance.stage_due_at).toLocaleDateString()})
              </span>
            </div>
          )}

          {isLost && (
            <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              STATUS: CLOSED / LOST
            </span>
          )}

          {isOnHold && (
            <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              STATUS: PIPELINE ON HOLD
            </span>
          )}

          {/* Quick Action Button */}
          {canTransition && !isLost && onOpenTransitionDrawer && (
            <button
              onClick={onOpenTransitionDrawer}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 hover:from-cyan-400 hover:to-sky-500 shadow-md shadow-cyan-500/20 transition flex items-center gap-1.5"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Advance Workflow
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Flow for Desktop */}
      <div className="hidden lg:flex items-center justify-between relative py-2 overflow-x-auto gap-1">
        {CANONICAL_OPERATIONAL_WORKFLOW_STAGES.map((stage, idx) => {
          const isComplete = !isLost && currentIndex > idx;
          const isCurrent = !isLost && currentIndex === idx;

          // Check if this stage is a valid destination transition
          const matchingTransition = validTransitions.find(t => t.to_stage_code === stage.key);
          const isAvailableTarget = Boolean(matchingTransition);
          const isBlocked = matchingTransition ? !matchingTransition.is_valid : false;

          return (
            <React.Fragment key={stage.key}>
              {/* Stage Node */}
              <button
                disabled={!canTransition && !isAvailableTarget}
                onClick={() => {
                  if (onSelectStage) {
                    onSelectStage(stage.key);
                  }
                }}
                className={`relative flex flex-col items-center group text-center min-w-[84px] max-w-[96px] transition-all p-1.5 rounded-xl ${
                  isCurrent
                    ? 'bg-cyan-950/40 border border-cyan-500/40 ring-2 ring-cyan-500/20 shadow-lg shadow-cyan-500/10'
                    : isAvailableTarget
                    ? 'hover:bg-slate-800/60 cursor-pointer border border-dashed border-cyan-500/30'
                    : 'cursor-default opacity-85'
                }`}
                title={matchingTransition?.blocking_reasons?.join(', ') || stage.name}
              >
                {/* Node Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs font-mono font-bold transition shadow-lg ${
                    isCurrent
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 ring-4 ring-cyan-500/20 scale-110 z-10'
                      : isComplete
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 z-10'
                      : isBlocked
                      ? 'border-rose-500/60 bg-rose-950/30 text-rose-400 z-10'
                      : isAvailableTarget
                      ? 'border-sky-400/80 bg-sky-950/40 text-sky-300 z-10'
                      : 'border-slate-700 bg-slate-800 text-slate-500 z-10'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  ) : isBlocked ? (
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                {/* Stage Title */}
                <span
                  className={`mt-2 text-[11px] font-semibold transition leading-tight text-center line-clamp-2 ${
                    isCurrent
                      ? 'text-cyan-300 font-bold'
                      : isComplete
                      ? 'text-slate-200 light:text-slate-800'
                      : isBlocked
                      ? 'text-rose-400/80'
                      : 'text-slate-400'
                  }`}
                >
                  {stage.name}
                </span>

                {/* Probability & SLA */}
                <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-slate-400">
                  <span>{stage.defaultProbability}%</span>
                  {stage.slaDays > 0 && (
                    <span className="flex items-center gap-0.5 text-slate-500">
                      • {stage.slaDays}d
                    </span>
                  )}
                </div>

                {/* Blocked or Available indicator */}
                {isBlocked && (
                  <span className="mt-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> Blocked
                  </span>
                )}
                {isAvailableTarget && !isBlocked && !isCurrent && (
                  <span className="mt-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-0.5 animate-pulse">
                    <ArrowRight className="w-2.5 h-2.5" /> Ready
                  </span>
                )}
              </button>

              {/* Connecting Line between stages */}
              {idx < CANONICAL_OPERATIONAL_WORKFLOW_STAGES.length - 1 && (
                <div
                  className={`flex-1 h-[2px] min-w-[12px] transition ${
                    isComplete
                      ? 'bg-emerald-500/60'
                      : isCurrent
                      ? 'bg-gradient-to-r from-emerald-500/40 via-cyan-500/40 to-slate-800'
                      : 'bg-slate-800'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Vertical Stepper for Mobile / Tablet */}
      <div className="lg:hidden space-y-2 mt-2">
        {CANONICAL_OPERATIONAL_WORKFLOW_STAGES.map((stage, idx) => {
          const isComplete = !isLost && currentIndex > idx;
          const isCurrent = !isLost && currentIndex === idx;

          return (
            <div
              key={stage.key}
              onClick={() => canTransition && onSelectStage && onSelectStage(stage.key)}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                isCurrent
                  ? 'border-cyan-500 bg-cyan-950/30 text-cyan-300 shadow-md shadow-cyan-500/10'
                  : isComplete
                  ? 'border-emerald-500/40 bg-emerald-950/10 text-slate-300'
                  : 'border-slate-800 bg-slate-900/40 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs font-mono font-bold ${
                    isCurrent
                      ? 'border-cyan-400 text-cyan-300 bg-cyan-500/20'
                      : isComplete
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-500/20'
                      : 'border-slate-700 text-slate-500'
                  }`}
                >
                  {isComplete ? '✓' : idx + 1}
                </div>
                <div>
                  <div className="font-semibold text-slate-200">{stage.name}</div>
                  <div className="text-[10px] font-mono text-slate-500">
                    SLA: {stage.slaDays} days • Suggested: {stage.defaultProbability}%
                  </div>
                </div>
              </div>
              <span className="font-mono text-xs text-slate-400 font-bold">{stage.defaultProbability}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
