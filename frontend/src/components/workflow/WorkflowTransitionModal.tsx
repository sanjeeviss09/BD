import { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Send,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import type { ValidTransitionOption } from '@/components/visualization/WorkflowProgress';

interface WorkflowTransitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  currentStage: string;
  targetStageInit?: string;
  validTransitions: ValidTransitionOption[];
  onTransitionSuccess: () => void;
  token?: string;
}

export const WorkflowTransitionModal: React.FC<WorkflowTransitionModalProps> = ({
  isOpen,
  onClose,
  opportunityId,
  opportunityTitle,
  currentStage,
  targetStageInit,
  validTransitions,
  onTransitionSuccess,
  token,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>(targetStageInit || '');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (targetStageInit) {
      setSelectedTarget(targetStageInit);
    } else if (validTransitions.length > 0) {
      // Pick first valid transition by default if available
      const firstValid = validTransitions.find(t => t.is_valid);
      if (firstValid) {
        setSelectedTarget(firstValid.to_stage_code);
      } else {
        setSelectedTarget(validTransitions[0].to_stage_code);
      }
    }
  }, [targetStageInit, validTransitions]);

  if (!isOpen) return null;

  const currentOption = validTransitions.find(t => t.to_stage_code === selectedTarget);
  const isTargetBlocked = currentOption ? !currentOption.is_valid : false;
  const isTerminalLost = selectedTarget.toUpperCase() === 'LOST';
  const isCommentMandatory = isTerminalLost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarget) return;

    if (isTargetBlocked) {
      setErrorMsg('This transition is currently blocked by workflow validation rules.');
      return;
    }

    if (isCommentMandatory && !comment.trim()) {
      setErrorMsg('A detailed justification reason is mandatory when transitioning to LOST.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // First attempt dedicated workflow transition endpoint
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`http://localhost:4000/api/workflows/opportunities/${opportunityId}/transition`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          target_stage_code: selectedTarget,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Fallback to legacy stage route if workflow route not active
        if (res.status === 404) {
          const fallbackRes = await fetch(`http://localhost:4000/api/opportunities/${opportunityId}/stage`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              stage: selectedTarget,
              closed_reason: comment.trim() || undefined,
            }),
          });
          const fallbackData = await fallbackRes.json();
          if (!fallbackRes.ok) {
            setErrorMsg(fallbackData.error || 'Stage progression failed.');
            return;
          }
        } else {
          setErrorMsg(data.error || 'Stage transition rejected by workflow engine.');
          return;
        }
      }

      // Success
      setComment('');
      onClose();
      onTransitionSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error executing transition.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              Advance Operational Workflow Stage
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-md">
              Target: <span className="text-slate-200 font-semibold">{opportunityTitle}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Stage Progression Flow Preview */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-500">Current Stage</span>
              <div className="text-xs font-bold text-cyan-300 font-mono">
                {currentStage.replace(/_/g, ' ')}
              </div>
            </div>

            <ArrowRight className="w-5 h-5 text-slate-600" />

            <div className="space-y-1 text-right">
              <span className="text-[10px] font-mono uppercase text-slate-500">Destination Stage</span>
              <div className="text-xs font-bold text-emerald-400 font-mono">
                {currentOption?.to_stage_name || selectedTarget.replace(/_/g, ' ')}
              </div>
            </div>
          </div>

          {/* Select Target Transition */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 font-mono">
              Select Valid Progression Transition
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {validTransitions.map(t => {
                const isSelected = t.to_stage_code === selectedTarget;
                const isBlocked = !t.is_valid;

                return (
                  <div
                    key={t.to_stage_code}
                    onClick={() => {
                      setSelectedTarget(t.to_stage_code);
                      setErrorMsg(null);
                    }}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400/30'
                        : isBlocked
                        ? 'border-slate-800/80 bg-slate-950/40 text-slate-500'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200">{t.to_stage_name}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Transition: {t.transition_name}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isBlocked ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Valid
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocking Reasons / Gate Requirements */}
          {isTargetBlocked && currentOption?.blocking_reasons && currentOption.blocking_reasons.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Stage Gate Requirements Unmet:
              </div>
              <ul className="text-xs text-amber-200/90 list-disc list-inside space-y-1 pl-1">
                {currentOption.blocking_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Justification / Audit Comment */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Operational Justification / Transition Note</span>
              {isCommentMandatory && (
                <span className="text-[11px] font-mono text-rose-400 font-bold">* Required for Lost</span>
              )}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                isCommentMandatory
                  ? 'Mandatory: detail why this opportunity was lost or declined...'
                  : 'Add operational context, key gate observations, or rationale for stage advancement...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-800 bg-slate-950/80 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isTargetBlocked || !selectedTarget || (isCommentMandatory && !comment.trim())}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 hover:from-cyan-400 hover:to-sky-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 transition flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Transitioning...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  Confirm Stage Transition
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
