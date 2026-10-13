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
  Clock,
  Send
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
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Closure state
  const [summary, setSummary] = useState(
    `Meeting ${meeting.meeting_code} concluded successfully. Key decisions and action items agreed upon.`
  );
  const [nextMeetingDate, setNextMeetingDate] = useState('');
  const [selectedCarryForwardPoints, setSelectedCarryForwardPoints] = useState<string[]>([]);
  const [nextAgendaItems, setNextAgendaItems] = useState<string>('');

  const totalSteps = 6; // Compacted into 6 clear enterprise stages covering all 12 operational checks

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < totalSteps) setCurrentStep(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary uppercase font-bold tracking-wider">
                Stage {currentStep} of {totalSteps}
              </span>
              <h2 className="text-base font-bold text-foreground">
                Meeting Closure & Follow-up Reconciler
              </h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review notes, verify decisions, confirm tasks, and carry forward unresolved items.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progression Bar */}
        <div className="w-full bg-muted/50 h-1">
          <div
            className="bg-primary h-1 transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STAGE 1: Notes & Points Review */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-primary" />
                Step 1 & 2: Review Mini Notes & Points Summary
              </h3>
              <p className="text-xs text-muted-foreground">
                Verify that all discussion notes taken during the live meeting have been converted into structured points.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Captured Live Notes</span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {notes.length} total
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
                    {notes.length === 0 ? (
                      <p className="text-muted-foreground italic">No live mini notes captured.</p>
                    ) : (
                      notes.map((n) => (
                        <div key={n.id} className="p-2 rounded bg-background border border-border/60">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{n.speaker || 'General Note'}</span>
                            <span className="font-mono">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-foreground mt-1">{n.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/20 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Structured Meeting Points</span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {points.length} total
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
                    {points.length === 0 ? (
                      <p className="text-muted-foreground italic">No structured points recorded.</p>
                    ) : (
                      points.map((p) => (
                        <div key={p.id} className="p-2 rounded bg-background border border-border/60 flex items-start justify-between">
                          <div>
                            <span className="font-mono text-[10px] text-muted-foreground">{p.point_code}</span>
                            <p className="font-medium text-foreground">{p.title}</p>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono">{p.category}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: Decisions Confirmation */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Step 3: Confirm Formal Decisions ({decisions.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Formal decisions are recorded permanently in enterprise audit logs.
              </p>

              {decisions.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border rounded-lg text-muted-foreground text-xs">
                  No formal decisions recorded during this meeting. You can proceed or add one before finalizing.
                </div>
              ) : (
                <div className="space-y-3">
                  {decisions.map((d) => (
                    <div key={d.id} className="p-3 rounded-lg bg-muted/20 border border-border space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-foreground">{d.decision_code}: {d.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-mono font-bold">
                          IMPACT: {d.impact}
                        </span>
                      </div>
                      {d.rationale && <p className="text-xs text-muted-foreground"><strong className="text-foreground">Rationale:</strong> {d.rationale}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STAGE 3: Action Items & Tasks Review */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Step 4, 5 & 6: Action Items & Responsible Assignment
              </h3>
              <p className="text-xs text-muted-foreground">
                Verify that every committed action has an assigned department, owner, and due date.
              </p>

              <div className="space-y-3">
                {points.filter(p => p.action_required).length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-border rounded-lg text-muted-foreground text-xs">
                    No points marked with "Action Required".
                  </div>
                ) : (
                  points.filter(p => p.action_required).map((p) => (
                    <div key={p.id} className="p-3 rounded-lg bg-background border border-border flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{p.point_code}</span>
                          <span className="text-xs font-bold text-foreground">{p.title}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                          <span>Dept: <strong className="text-foreground">{p.responsible_department?.name || 'Unassigned'}</strong></span>
                          <span>Owner: <strong className="text-foreground">{p.responsible_user ? `${p.responsible_user.first_name} ${p.responsible_user.last_name}` : 'Unassigned'}</strong></span>
                          <span>Due: <strong className="text-foreground">{p.due_date || 'No Date'}</strong></span>
                        </div>
                      </div>
                      <div>
                        {p.linked_task_id ? (
                          <span className="text-[10px] font-mono px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Task Created
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-1 rounded bg-amber-500/10 text-amber-600 font-semibold">
                            Pending Task Creation
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STAGE 4: Carry Forward Unresolved Points */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Step 9: Carry Forward Unresolved Points
              </h3>
              <p className="text-xs text-muted-foreground">
                Select open items to carry forward to the next meeting agenda while preserving original history and due dates.
              </p>

              <div className="space-y-2">
                {points.filter(p => p.status !== 'RESOLVED').length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">All points in this meeting are resolved!</p>
                ) : (
                  points.filter(p => p.status !== 'RESOLVED').map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-background cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedCarryForwardPoints.includes(p.id)}
                          onChange={() => toggleCarryForward(p.id)}
                          className="w-4 h-4 rounded text-primary border-border"
                        />
                        <div>
                          <div className="text-xs font-semibold text-foreground">{p.title}</div>
                          <div className="text-[11px] text-muted-foreground">Original Due: {p.due_date || 'N/A'}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {p.status}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STAGE 5: Next Meeting Schedule & Agenda */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Step 10: Next Meeting Preparation
              </h3>
              <p className="text-xs text-muted-foreground">
                Schedule the follow-up meeting date and define high-priority agenda topics.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
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
                    className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border text-foreground cursor-pointer"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
                    Suggested Next Agenda Items
                  </label>
                  <textarea
                    rows={4}
                    value={nextAgendaItems}
                    onChange={(e) => setNextAgendaItems(e.target.value)}
                    placeholder="1. Review formulation trial results&#10;2. Commercial pricing signoff&#10;3. Final RFQ response submission"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STAGE 6: Final Minutes Signoff & Closure */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Step 11 & 12: Final Minutes Signoff & Closure
              </h3>
              <p className="text-xs text-muted-foreground">
                Add an executive closure summary. Finalizing will generate official meeting minutes.
              </p>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1 uppercase tracking-wider">
                  Executive Closure Summary
                </label>
                <textarea
                  rows={4}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground"
                />
              </div>

              <div className="p-4 rounded-lg bg-muted/20 border border-border text-xs space-y-1">
                <div className="font-semibold text-foreground">Closure Checklist Summary:</div>
                <div className="text-muted-foreground">• Notes Reconciled: {notes.length}</div>
                <div className="text-muted-foreground">• Decisions Confirmed: {decisions.length}</div>
                <div className="text-muted-foreground">• Actions Identified: {points.filter(p => p.action_required).length}</div>
                <div className="text-muted-foreground">• Items Carried Forward: {selectedCarryForwardPoints.length}</div>
                <div className="text-muted-foreground">• Next Meeting Target: {nextMeetingDate || 'None Scheduled'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/40">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrev}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Previous Stage
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleFinalizeClosure(true)}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save Draft
            </button>

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
              >
                Next Stage <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleFinalizeClosure(false)}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                {loading ? 'Finalizing...' : 'Finalize & Close Meeting'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
