import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { meetingApi } from '@/services/meeting.api';
import type { Meeting, MeetingPoint, MeetingDecision, MeetingNote } from '@/types/meeting';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileCheck2,
  Save,
  Calendar,
  Send,
  ListTodo,
  Layers
} from 'lucide-react';

interface MeetingClosureWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: Meeting;
  notes: MeetingNote[];
  points: MeetingPoint[];
  decisions: MeetingDecision[];
  onMeetingClosed: (updatedMeeting: Meeting) => void;
}

export const MeetingClosureWizardModal: React.FC<MeetingClosureWizardModalProps> = ({
  isOpen,
  onClose,
  meeting,
  notes,
  points,
  decisions,
  onMeetingClosed
}) => {
  const { session } = useAuth();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Closure state
  const [summary, setSummary] = useState(
    `Meeting ${meeting.meeting_code} concluded successfully. Key decisions and action items agreed upon.`
  );
  const [nextMeetingDate, setNextMeetingDate] = useState('');
  const [selectedCarryForwardPoints, setSelectedCarryForwardPoints] = useState<string[]>([]);
  const [nextAgendaItems, setNextAgendaItems] = useState<string>('');

  const totalSteps = 2; // Streamlined into 2 comprehensive enterprise stages

  if (!isOpen) return null;

  const openPoints = points.filter(p => p.status !== 'RESOLVED');
  const actionPoints = points.filter(p => p.action_required);

  const handleNext = () => {
    if (currentStep < totalSteps) setCurrentStep(2);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(1);
  };

  const handleFinalizeClosure = async (isDraft: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const closureData = {
        is_draft: isDraft,
        summary: summary.trim(),
        next_meeting_date: nextMeetingDate || null,
        carry_forward_points: selectedCarryForwardPoints,
        next_agenda: nextAgendaItems.trim() || null,
        closed_by_user: session?.user?.id,
        closed_at: new Date().toISOString()
      };

      const updated = await meetingApi.executeMeetingClosure(meeting.id, closureData, session?.access_token);
      onMeetingClosed(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete meeting closure.');
    } finally {
      setLoading(false);
    }
  };

  const toggleCarryForward = (ptId: string) => {
    setSelectedCarryForwardPoints(prev =>
      prev.includes(ptId) ? prev.filter(id => id !== ptId) : [...prev, ptId]
    );
  };

  const selectAllOpen = () => {
    setSelectedCarryForwardPoints(openPoints.map(p => p.id));
  };

  const deselectAllOpen = () => {
    setSelectedCarryForwardPoints([]);
  };

  const setDateOffset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setNextMeetingDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden text-card-foreground">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-primary/20 text-primary uppercase font-bold tracking-wider">
                Step {currentStep} of {totalSteps}
              </span>
              <h2 className="text-base font-bold text-foreground">
                {currentStep === 1
                  ? 'Session Review & Commitments Reconciliation'
                  : 'Follow-up Planning & Official Minutes Sign-off'}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentStep === 1
                ? 'Review live captured notes, structured discussion points, confirmed formal decisions, and assigned action tasks.'
                : 'Carry forward unresolved items, schedule the next follow-up session, define agenda items, and finalize official minutes.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Close Wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2-Step Navigation Tabs */}
        <div className="grid grid-cols-2 border-b border-border bg-muted/20 text-xs">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer font-medium ${
              currentStep === 1
                ? 'border-primary text-primary font-bold bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              1
            </span>
            <span className="truncate">Step 1: Session Review & Commitments</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground hidden sm:inline">
              {notes.length + points.length + decisions.length} items
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={`py-3 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer font-medium ${
              currentStep === 2
                ? 'border-primary text-primary font-bold bg-background'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
              currentStep === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              2
            </span>
            <span className="truncate">Step 2: Follow-up & Final Sign-off</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground hidden sm:inline">
              {openPoints.length} open
            </span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 1: Session Review & Commitments Reconciliation       */}
          {/* ======================================================== */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Executive Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Live Notes</div>
                    <div className="text-xl font-bold text-foreground font-mono mt-0.5">{notes.length}</div>
                  </div>
                  <FileCheck2 className="w-5 h-5 text-blue-400 opacity-80" />
                </div>
                <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Discussion Points</div>
                    <div className="text-xl font-bold text-foreground font-mono mt-0.5">{points.length}</div>
                  </div>
                  <Layers className="w-5 h-5 text-purple-400 opacity-80" />
                </div>
                <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Decisions Made</div>
                    <div className="text-xl font-bold text-emerald-400 font-mono mt-0.5">{decisions.length}</div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 opacity-80" />
                </div>
                <div className="p-3 rounded-lg bg-muted/20 border border-border flex items-center justify-between">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Action Tasks</div>
                    <div className="text-xl font-bold text-amber-400 font-mono mt-0.5">{actionPoints.length}</div>
                  </div>
                  <Send className="w-5 h-5 text-amber-400 opacity-80" />
                </div>
              </div>

              {/* 2-Column Responsive Detailed View */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                {/* COLUMN 1: Session Discussion Log */}
                <div className="space-y-4">
                  {/* Notes Stream */}
                  <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck2 className="w-4 h-4 text-primary" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Live Captured Notes
                        </span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {notes.length} total
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 text-xs">
                      {notes.length === 0 ? (
                        <div className="p-4 text-center border border-dashed border-border/80 rounded-lg text-muted-foreground italic text-xs">
                          No live mini notes captured during this meeting.
                        </div>
                      ) : (
                        notes.map((n) => (
                          <div key={n.id} className="p-2.5 rounded-lg bg-background/90 border border-border/70 hover:border-border transition-colors">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                              <span className="font-semibold text-foreground/80">{n.speaker || 'General Note'}</span>
                              <span className="font-mono">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-foreground leading-relaxed text-xs">{n.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Discussion Points */}
                  <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Structured Points
                        </span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {points.length} total
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 text-xs">
                      {points.length === 0 ? (
                        <div className="p-4 text-center border border-dashed border-border/80 rounded-lg text-muted-foreground italic text-xs">
                          No structured points logged.
                        </div>
                      ) : (
                        points.map((p) => (
                          <div key={p.id} className="p-2.5 rounded-lg bg-background/90 border border-border/70 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-muted-foreground font-semibold">{p.point_code}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">{p.category}</span>
                              </div>
                              <p className="font-medium text-foreground mt-0.5 text-xs truncate">{p.title}</p>
                            </div>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold shrink-0 ${
                              p.status === 'RESOLVED'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : p.status === 'ACTION_REQUIRED'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {p.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: Outcomes & Accountability */}
                <div className="space-y-4">
                  {/* Confirmed Decisions */}
                  <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Confirmed Formal Decisions
                        </span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold">
                        {decisions.length} recorded
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 text-xs">
                      {decisions.length === 0 ? (
                        <div className="p-4 text-center border border-dashed border-border/80 rounded-lg text-muted-foreground italic text-xs">
                          No formal decisions recorded for this meeting.
                        </div>
                      ) : (
                        decisions.map((d) => (
                          <div key={d.id} className="p-2.5 rounded-lg bg-background/90 border border-border/70 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {d.decision_code}: {d.title}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold shrink-0 ${
                                d.impact === 'CRITICAL'
                                  ? 'bg-rose-500/15 text-rose-500'
                                  : d.impact === 'HIGH'
                                  ? 'bg-amber-500/15 text-amber-500'
                                  : 'bg-emerald-500/10 text-emerald-600'
                              }`}>
                                IMPACT: {d.impact}
                              </span>
                            </div>
                            {d.rationale && (
                              <p className="text-[11px] text-muted-foreground leading-normal mt-1">
                                <strong className="text-foreground/90">Rationale:</strong> {d.rationale}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Committed Action Items */}
                  <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Committed Action Items
                        </span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold">
                        {actionPoints.length} actions
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 text-xs">
                      {actionPoints.length === 0 ? (
                        <div className="p-4 text-center border border-dashed border-border/80 rounded-lg text-muted-foreground italic text-xs">
                          No points flagged as Action Required.
                        </div>
                      ) : (
                        actionPoints.map((p) => (
                          <div key={p.id} className="p-2.5 rounded-lg bg-background/90 border border-border/70 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-muted-foreground font-semibold">{p.point_code}</span>
                                <span className="font-bold text-foreground text-xs">{p.title}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
                                <span>Dept: <strong className="text-foreground">{p.responsible_department?.name || 'Unassigned'}</strong></span>
                                <span>Owner: <strong className="text-foreground">{p.responsible_user ? `${p.responsible_user.first_name} ${p.responsible_user.last_name}` : 'Unassigned'}</strong></span>
                                <span>Due: <strong className="text-foreground">{p.due_date || 'No Date'}</strong></span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              {p.linked_task_id ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Task Created
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-semibold">
                                  Pending Task
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 2: Follow-up Planning & Official Minutes Sign-off     */}
          {/* ======================================================== */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              
              {/* Carry Forward Open Points Card */}
              <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-primary" />
                      Carry Forward Unresolved Points to Next Session
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Select open discussion items to roll over into the follow-up meeting agenda while retaining full historical context.
                    </p>
                  </div>
                  {openPoints.length > 0 && (
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectAllOpen}
                        className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-foreground text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Select All ({openPoints.length})
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllOpen}
                        className="px-2.5 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs">
                  {openPoints.length === 0 ? (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>All discussion points in this meeting are resolved! No items need to be carried forward.</span>
                    </div>
                  ) : (
                    openPoints.map((p) => {
                      const isSelected = selectedCarryForwardPoints.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border/70 bg-background/90 hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCarryForward(p.id)}
                              className="w-4 h-4 rounded text-primary border-border cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-muted-foreground font-semibold">{p.point_code}</span>
                                <span className="text-xs font-semibold text-foreground truncate">{p.title}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Original Due: <strong className="text-foreground/80">{p.due_date || 'N/A'}</strong> • Category: {p.category}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground shrink-0 ml-2">
                            {p.status}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Next Meeting Schedule & Suggested Agenda */}
              <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Next Follow-up Preparation
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                      Next Follow-up Meeting Date
                    </label>
                    <input
                      type="date"
                      value={nextMeetingDate}
                      onChange={(e) => setNextMeetingDate(e.target.value)}
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch {}
                      }}
                      className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                      style={{ colorScheme: 'dark' }}
                    />
                    {/* Quick date shortcuts */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-muted-foreground font-semibold">Quick Set:</span>
                      <button
                        type="button"
                        onClick={() => setDateOffset(7)}
                        className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors cursor-pointer"
                      >
                        +1 Week
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateOffset(14)}
                        className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors cursor-pointer"
                      >
                        +2 Weeks
                      </button>
                      <button
                        type="button"
                        onClick={() => setDateOffset(30)}
                        className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors cursor-pointer"
                      >
                        +1 Month
                      </button>
                      {nextMeetingDate && (
                        <button
                          type="button"
                          onClick={() => setNextMeetingDate('')}
                          className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-mono transition-colors cursor-pointer ml-auto"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                      Suggested Next Agenda Items
                    </label>
                    <textarea
                      rows={3}
                      value={nextAgendaItems}
                      onChange={(e) => setNextAgendaItems(e.target.value)}
                      placeholder="1. Review formulation trial results&#10;2. Commercial pricing signoff&#10;3. Final RFQ response submission"
                      className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* Executive Closure Summary */}
              <div className="p-4 rounded-xl bg-muted/15 border border-border space-y-2.5">
                <label className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Executive Minutes Closure Summary
                </label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Summarize the core takeaways and next steps for the official minutes..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>

              {/* Audit Checklist Summary Badge Bar */}
              <div className="p-3.5 rounded-xl bg-muted/20 border border-border text-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-foreground font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Closure Audit Checklist:</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span>Notes: <strong className="text-foreground">{notes.length}</strong></span>
                  <span>•</span>
                  <span>Decisions: <strong className="text-foreground">{decisions.length}</strong></span>
                  <span>•</span>
                  <span>Actions: <strong className="text-foreground">{actionPoints.length}</strong></span>
                  <span>•</span>
                  <span>Carried Forward: <strong className="text-primary font-bold">{selectedCarryForwardPoints.length}</strong></span>
                  <span>•</span>
                  <span>Next Date: <strong className="text-foreground">{nextMeetingDate || 'None Scheduled'}</strong></span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/40">
          <div>
            {currentStep === 2 && (
              <button
                type="button"
                onClick={handlePrev}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Previous: Session Review
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleFinalizeClosure(true)}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" /> Save Draft
            </button>

            {currentStep === 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                Next: Follow-up & Sign-off <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleFinalizeClosure(false)}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {loading ? 'Finalizing & Closing...' : 'Finalize & Close Meeting'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
