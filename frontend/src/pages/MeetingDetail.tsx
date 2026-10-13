import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { meetingApi } from '@/services/meeting.api';
import type {
  Meeting,
  MeetingPoint,
  MeetingDecision,
  MeetingNote,
  PreparationWorkspaceData,
  QuickCaptureSuggestion
} from '@/types/meeting';
import { MeetingClosureWizardModal } from '@/components/meetings/MeetingClosureWizardModal';
import {
  Calendar,
  Clock,
  Building2,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCheck2,
  Download,
  Plus,
  Send,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Info
} from 'lucide-react';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [prepData, setPrepData] = useState<PreparationWorkspaceData | null>(null);
  const [points, setPoints] = useState<MeetingPoint[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'live' | 'prep' | 'points' | 'followups' | 'minutes'>('live');

  // Mini Notes side-panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [noteSpeaker, setNoteSpeaker] = useState('');
  const [noteSavedStatus, setNoteSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [quickSuggestion, setQuickSuggestion] = useState<QuickCaptureSuggestion | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Modals & wizards
  const [closureModalOpen, setClosureModalOpen] = useState(false);

  // New Point
  const [newPointTitle, setNewPointTitle] = useState('');
  const [newPointCategory, setNewPointCategory] = useState<any>('DISCUSSION');
  const [newPointPriority] = useState<any>('MEDIUM');

  // Task creation loading state
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadMeetingData();
  }, [id]);

  const loadMeetingData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = session?.access_token;
      const [m, prep, pts, decs, nts] = await Promise.all([
        meetingApi.getMeeting(id, token),
        meetingApi.getPreparationWorkspace(id, token),
        meetingApi.getMeetingPoints(id, token),
        meetingApi.getDecisions(id, token),
        meetingApi.getNotes(id, token)
      ]);
      setMeeting(m);
      setPrepData(prep);
      setPoints(pts);
      setDecisions(decs);
      setNotes(nts);
    } catch (err) {
      console.error('Failed to load meeting details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Quick Capture realtime rule-based parsing
  const handleNoteChange = (text: string) => {
    setNoteContent(text);
    setNoteSavedStatus('idle');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!text.trim()) {
      setQuickSuggestion(null);
      return;
    }

    typingTimeoutRef.current = setTimeout(async () => {
      try {
        const suggestion = await meetingApi.parseQuickNote(text, session?.access_token);
        setQuickSuggestion(suggestion);
      } catch {
        // Fallback
      }
    }, 250);
  };

  const handleSaveNote = async (asDraft = false) => {
    if (!id || !noteContent.trim()) return;
    setNoteSavedStatus('saving');
    try {
      const mutationId = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const saved = await meetingApi.createNote(
        id,
        {
          content: noteContent.trim(),
          speaker: noteSpeaker.trim() || null,
          is_draft: asDraft,
          client_mutation_id: mutationId
        },
        session?.access_token
      );
      setNotes(prev => [...prev, saved]);
      setNoteContent('');
      setNoteSpeaker('');
      setQuickSuggestion(null);
      setNoteSavedStatus('saved');
      setTimeout(() => setNoteSavedStatus('idle'), 2500);
    } catch {
      setNoteSavedStatus('error');
    }
  };

  const handleApplySuggestionToPoint = async () => {
    if (!id || !quickSuggestion) return;
    try {
      const newPt = await meetingApi.createMeetingPoint(
        id,
        {
          title: quickSuggestion.suggestedAction,
          category: 'ACTION',
          action_required: true,
          due_date: quickSuggestion.suggestedDueDate,
          discussion_notes: `Source Mini Note: ${quickSuggestion.originalText}`
        },
        session?.access_token
      );
      setPoints(prev => [...prev, newPt]);
      handleSaveNote(false);
    } catch (err) {
      console.error('Failed to apply suggestion to meeting point:', err);
    }
  };

  const handleCreateTaskFromPoint = async (point: MeetingPoint) => {
    setCreatingTaskId(point.id);
    try {
      await meetingApi.convertPointToTask(
        point.id,
        {
          title: point.title,
          description: point.discussion_notes || point.description,
          due_date: point.due_date,
          priority: point.priority
        },
        session?.access_token
      );
      // Refresh points
      const updatedPts = await meetingApi.getMeetingPoints(id!, session?.access_token);
      setPoints(updatedPts);
    } catch (err) {
      console.error('Failed to convert point to task:', err);
    } finally {
      setCreatingTaskId(null);
    }
  };

  const handleCarryForward = async (pointId: string) => {
    if (!meeting?.previous_meeting_id) {
      alert('Carrying forward item within current series.');
    }
    try {
      await meetingApi.carryForwardPoint(pointId, id!, 'Carried forward from workbench', session?.access_token);
      const updatedPts = await meetingApi.getMeetingPoints(id!, session?.access_token);
      setPoints(updatedPts);
    } catch (err) {
      console.error('Failed to carry forward point:', err);
    }
  };

  const handleExportMinutes = async () => {
    if (!id) return;
    try {
      const blob = await meetingApi.exportMinutesWorkbook(id, session?.access_token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Meeting_Minutes_${meeting?.meeting_code || id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export minutes:', err);
    }
  };

  if (loading || !meeting) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground font-mono text-xs">
        Loading BDIQ Meeting Intelligence Workbench...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background text-foreground">
      {/* 1. Header Bar */}
      <header className="px-6 py-3.5 border-b border-border bg-card/60 backdrop-blur-sm shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {meeting.meeting_code}
              </span>
              <h1 className="text-lg font-bold tracking-tight text-foreground truncate max-w-xl">
                {meeting.title}
              </h1>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                  meeting.status === 'IN_PROGRESS'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                    : meeting.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {meeting.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1.5 font-mono">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                {meeting.meeting_date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                {meeting.meeting_time} {meeting.end_time ? `- ${meeting.end_time}` : ''} ({meeting.timezone})
              </span>
              {meeting.customer && (
                <span className="flex items-center gap-1.5 text-foreground font-sans">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  {meeting.customer.name}
                </span>
              )}
              {meeting.opportunity && (
                <span className="flex items-center gap-1.5 text-foreground font-sans">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  {meeting.opportunity.title}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {meeting.status === 'SCHEDULED' && (
              <button
                onClick={async () => {
                  const updated = await meetingApi.startMeeting(meeting.id, session?.access_token);
                  setMeeting(updated);
                  setActiveTab('live');
                }}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Play className="w-3.5 h-3.5" /> Start Live Meeting
              </button>
            )}

            <button
              onClick={() => setClosureModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <FileCheck2 className="w-3.5 h-3.5" /> Closure Wizard
            </button>

            <button
              onClick={handleExportMinutes}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors"
              title="Export Meeting Minutes to Excel"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-3 border-t border-border/50 pt-2 text-xs">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'live' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Live Meeting Mode
          </button>
          <button
            onClick={() => setActiveTab('prep')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'prep' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Preparation Workspace
          </button>
          <button
            onClick={() => setActiveTab('points')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'points' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" /> Points & Decisions ({points.length})
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'followups' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Send className="w-3.5 h-3.5" /> Follow-ups & Tasks
          </button>
          <button
            onClick={() => setActiveTab('minutes')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'minutes' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Minutes Summary
          </button>
        </div>
      </header>

      {/* 2. Main Tab Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: LIVE MEETING MODE */}
          {activeTab === 'live' && (
            <div className="space-y-6">
              {/* Meeting Agenda & Objectives */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 p-4 rounded-xl bg-card border border-border shadow-sm">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Active Agenda Items
                  </h3>
                  <div className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/50">
                    {meeting.agenda || '1. Customer Requirements Review\n2. Formulation Feasibility & Batch Size\n3. Action Commitments & Timeline'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" /> Target Objective
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {meeting.objective || 'Confirm technical feasibility and align on preliminary manufacturing timetable.'}
                  </p>
                </div>
              </div>

              {/* Live Meeting Points quick table */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Structured Meeting Points ({points.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab('points')}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    View All Points <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/50 border-b border-border text-[11px] font-mono uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Department</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {points.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-muted-foreground italic">
                            No meeting points recorded yet. Type a note in the Mini Notes panel to create points.
                          </td>
                        </tr>
                      ) : (
                        points.map((pt) => (
                          <tr key={pt.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">{pt.point_code}</td>
                            <td className="py-2 px-3 font-medium text-foreground">{pt.title}</td>
                            <td className="py-2 px-3">
                              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted">{pt.category}</span>
                            </td>
                            <td className="py-2 px-3 text-muted-foreground">{pt.responsible_department?.name || '—'}</td>
                            <td className="py-2 px-3 font-mono">{pt.due_date || '—'}</td>
                            <td className="py-2 px-3">
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                {pt.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {pt.action_required && !pt.linked_task_id && (
                                <button
                                  onClick={() => handleCreateTaskFromPoint(pt)}
                                  disabled={creatingTaskId === pt.id}
                                  className="px-2 py-1 text-[11px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                  {creatingTaskId === pt.id ? 'Creating...' : 'Create Task'}
                                </button>
                              )}
                              {pt.linked_task_id && (
                                <span className="text-[10px] font-mono text-emerald-500 font-bold">
                                  Task Linked
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Formal Decisions Recorded */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Confirmed Decisions ({decisions.length})
                </h3>
                {decisions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No formal decisions recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {decisions.map((d) => (
                      <div key={d.id} className="p-3 rounded-lg bg-background border border-border text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-foreground">{d.decision_code}: {d.title}</div>
                          {d.rationale && <div className="text-muted-foreground mt-0.5">Rationale: {d.rationale}</div>}
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">
                          Impact: {d.impact}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PREPARATION WORKSPACE */}
          {activeTab === 'prep' && prepData && (
            <div className="space-y-6">
              {/* Previous Meeting Review */}
              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> Previous Meeting Review
                  </h3>
                  {prepData.previousSummary && (
                    <span className="font-mono text-xs text-muted-foreground">
                      Linked: {prepData.previousSummary.meeting_code} ({prepData.previousSummary.meeting_date})
                    </span>
                  )}
                </div>

                {prepData.previousSummary ? (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-muted/20 border border-border text-xs">
                      <div className="font-bold text-foreground mb-1">Previous Closure Summary:</div>
                      <p className="text-muted-foreground">{prepData.previousSummary.closure_summary}</p>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-foreground mb-2">Previous Points & Actions:</div>
                      <div className="space-y-2">
                        {prepData.previousPoints.map((pt) => (
                          <div key={pt.id} className="p-3 rounded-lg bg-background border border-border text-xs flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-muted-foreground">{pt.point_code}</span>
                                <span className="font-semibold text-foreground">{pt.title}</span>
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                Due: {pt.due_date || 'N/A'} | Status: {pt.status}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {pt.status !== 'RESOLVED' && (
                                <button
                                  onClick={() => handleCarryForward(pt.id)}
                                  className="px-2.5 py-1 text-[11px] rounded bg-muted hover:bg-muted/80 text-foreground font-semibold border border-border"
                                >
                                  Carry Forward
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center border border-dashed border-border rounded-lg text-muted-foreground text-xs">
                    No linked previous meeting found. Precedence engine evaluated: explicit link, recurring series, customer, and opportunity.
                  </div>
                )}
              </div>

              {/* Open Commitments & Overdue Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Overdue Actions ({prepData.overdueActions.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {prepData.overdueActions.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No overdue commitments.</p>
                    ) : (
                      prepData.overdueActions.map((act) => (
                        <div key={act.id} className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs">
                          <div className="font-bold text-foreground">{act.task_code}: {act.title}</div>
                          <div className="text-destructive font-mono text-[11px] mt-0.5">
                            Delayed {act.delayDays} days against original due date ({act.original_due_date})
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    No Update Records ({prepData.noUpdateRecords.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {prepData.noUpdateRecords.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">All follow-ups have received responses.</p>
                    ) : (
                      prepData.noUpdateRecords.map((rec) => (
                        <div key={rec.id} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                          <div className="font-bold text-foreground">{rec.task_code}: {rec.title}</div>
                          <div className="text-amber-600 font-mono text-[11px] mt-0.5">
                            Status: NO_UPDATE recorded during last follow-up cycle
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Suggested Agenda Items */}
              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Suggested Agenda Based on Open Action Items
                </h3>
                <div className="space-y-2">
                  {prepData.suggestedAgenda.map((item, idx) => (
                    <div key={idx} className="p-2 rounded bg-background border border-border text-xs flex items-center justify-between">
                      <span className="font-mono text-foreground">{idx + 1}. {item}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">Auto-generated</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRUCTURED POINTS & DECISIONS */}
          {activeTab === 'points' && (
            <div className="space-y-6">
              {/* Create new point bar */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Add Structured Meeting Point
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newPointTitle}
                      onChange={(e) => setNewPointTitle(e.target.value)}
                      placeholder="Point title or statement..."
                      className="w-full px-3 py-1.5 text-xs rounded bg-background border border-border text-foreground"
                    />
                  </div>
                  <div>
                    <select
                      value={newPointCategory}
                      onChange={(e) => setNewPointCategory(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded bg-background border border-border text-foreground"
                    >
                      <option value="DISCUSSION">DISCUSSION</option>
                      <option value="ACTION">ACTION</option>
                      <option value="DECISION">DECISION</option>
                      <option value="RISK">RISK</option>
                      <option value="DEPENDENCY">DEPENDENCY</option>
                      <option value="CUSTOMER_REQUIREMENT">CUSTOMER_REQUIREMENT</option>
                      <option value="FOLLOW_UP">FOLLOW_UP</option>
                    </select>
                  </div>
                  <div>
                    <button
                      onClick={async () => {
                        if (!newPointTitle.trim() || !id) return;
                        const created = await meetingApi.createMeetingPoint(
                          id,
                          {
                            title: newPointTitle.trim(),
                            category: newPointCategory,
                            action_required: newPointCategory === 'ACTION',
                            priority: newPointPriority
                          },
                          session?.access_token
                        );
                        setPoints(prev => [...prev, created]);
                        setNewPointTitle('');
                      }}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Point
                    </button>
                  </div>
                </div>
              </div>

              {/* Points Table */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  All Meeting Points ({points.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/50 border-b border-border text-[11px] font-mono uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Department</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {points.map((pt) => (
                        <tr key={pt.id} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">{pt.point_code}</td>
                          <td className="py-2.5 px-3 font-semibold text-foreground">{pt.title}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted font-bold">{pt.category}</span>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{pt.responsible_department?.name || '—'}</td>
                          <td className="py-2.5 px-3 font-mono">{pt.due_date || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                              {pt.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {pt.action_required && !pt.linked_task_id && (
                              <button
                                onClick={() => handleCreateTaskFromPoint(pt)}
                                disabled={creatingTaskId === pt.id}
                                className="px-2.5 py-1 text-[11px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                {creatingTaskId === pt.id ? 'Creating...' : 'Create Task'}
                              </button>
                            )}
                            {pt.linked_task_id && (
                              <span className="text-[10px] font-mono text-emerald-500 font-bold">
                                Task Linked
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FOLLOW-UPS & TASKS */}
          {activeTab === 'followups' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Meeting Action Tasks & Follow-up History
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Delay is strictly calculated against immutable original due date.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {points.filter(p => p.linked_task_id).length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-border rounded-lg text-muted-foreground text-xs">
                      No tasks have been created from this meeting yet.
                    </div>
                  ) : (
                    points.filter(p => p.linked_task_id).map((p) => (
                      <div key={p.id} className="p-4 rounded-lg bg-background border border-border flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-primary">{p.linked_task?.task_code}</span>
                            <span className="text-xs font-bold text-foreground">{p.title}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1.5 font-mono">
                            <span>Original Due: <strong>{p.linked_task?.original_due_date || p.due_date}</strong></span>
                            <span>Status: <strong>{p.linked_task?.status || 'OPEN'}</strong></span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/tasks/${p.linked_task_id}`)}
                          className="px-3 py-1.5 text-xs font-semibold rounded border border-border hover:bg-muted text-foreground"
                        >
                          View Task Details
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MINUTES & SUMMARY */}
          {activeTab === 'minutes' && (
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    Formal Meeting Minutes Preview
                  </h3>
                  <button
                    onClick={handleExportMinutes}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Excel Workbook
                  </button>
                </div>

                <div className="p-4 rounded-lg bg-muted/20 border border-border/80 font-mono text-xs whitespace-pre-wrap leading-relaxed text-foreground">
                  {meeting.minutes_text || (
                    `================================================================\n` +
                    `MINUTES OF MEETING: ${meeting.title.toUpperCase()}\n` +
                    `CODE: ${meeting.meeting_code} | DATE: ${meeting.meeting_date} ${meeting.meeting_time}\n` +
                    `STATUS: ${meeting.status} | CLOSURE STATUS: ${meeting.closure_status}\n` +
                    `================================================================\n\n` +
                    `1. AGENDA & OBJECTIVE\n${meeting.objective || meeting.agenda || 'N/A'}\n\n` +
                    `2. FORMAL DECISIONS (${decisions.length})\n` +
                    (decisions.length === 0 ? 'No decisions recorded.' : decisions.map((d, i) => `  ${i + 1}. [${d.decision_code}] ${d.title} (Impact: ${d.impact})`).join('\n')) +
                    `\n\n3. ACTION ITEMS (${points.filter(p => p.action_required).length})\n` +
                    (points.filter(p => p.action_required).length === 0 ? 'No action items created.' : points.filter(p => p.action_required).map((p, i) => `  ${i + 1}. [${p.point_code}] ${p.title} (Due: ${p.due_date || 'TBD'})`).join('\n'))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* 3. Live Mini Notes Collapsible Side Panel (CRITICAL REQUIREMENT) */}
        <aside
          className={`relative border-l border-border bg-card transition-all duration-300 ease-in-out flex flex-col shrink-0 ${
            sidePanelOpen ? 'w-80 md:w-96' : 'w-12'
          }`}
        >
          {/* Toggle Header */}
          <div className="h-12 px-3 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
            {sidePanelOpen && (
              <span className="text-xs font-bold text-foreground flex items-center gap-2 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Mini Notes Capture
              </span>
            )}
            <button
              onClick={() => setSidePanelOpen(prev => !prev)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted ml-auto"
              title={sidePanelOpen ? 'Collapse Notes Panel' : 'Expand Notes Panel'}
            >
              {sidePanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {sidePanelOpen && (
            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
              {/* Quick Text Entry Box */}
              <div className="space-y-2 shrink-0">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>Fast capture (Enter to submit)</span>
                  {noteSavedStatus === 'saving' && <span className="text-amber-500 font-bold">Saving...</span>}
                  {noteSavedStatus === 'saved' && <span className="text-emerald-500 font-bold">✓ Saved</span>}
                  {noteSavedStatus === 'error' && <span className="text-destructive font-bold">Failed</span>}
                </div>

                <textarea
                  rows={3}
                  value={noteContent}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveNote(false);
                    }
                  }}
                  placeholder="e.g. R&D will confirm formulation feasibility by 15 October."
                  className="w-full p-2.5 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground resize-none leading-relaxed"
                />

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={noteSpeaker}
                    onChange={(e) => setNoteSpeaker(e.target.value)}
                    placeholder="Speaker / Dept (optional)"
                    className="flex-1 px-2 py-1 text-[11px] rounded bg-background border border-border text-foreground"
                  />
                  <button
                    onClick={() => handleSaveNote(false)}
                    className="px-3 py-1 text-[11px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Save Note
                  </button>
                </div>
              </div>

              {/* Quick Suggestion Box */}
              {quickSuggestion && quickSuggestion.suggestedAction && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 space-y-1.5 shrink-0 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-primary">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Extracted Suggestion
                    </span>
                    <span className="font-mono">{quickSuggestion.confidenceScore}% conf</span>
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    Action: {quickSuggestion.suggestedAction}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-3">
                    {quickSuggestion.suggestedDepartment && (
                      <span>Dept: <strong className="text-foreground">{quickSuggestion.suggestedDepartment}</strong></span>
                    )}
                    {quickSuggestion.suggestedDueDate && (
                      <span>Due: <strong className="text-foreground">{quickSuggestion.suggestedDueDate}</strong></span>
                    )}
                  </div>
                  <button
                    onClick={handleApplySuggestionToPoint}
                    className="w-full mt-1 px-2 py-1 text-[11px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1"
                  >
                    Convert to Action Point & Task
                  </button>
                </div>
              )}

              {/* Captured Notes Stream */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Meeting Notes Stream ({notes.length})
                </div>
                {notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-6">
                    No notes recorded yet.
                  </p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/80 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span className="font-bold text-foreground">{n.speaker || 'General'}</span>
                        <span>{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-foreground leading-relaxed">{n.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Closure Wizard Modal */}
      <MeetingClosureWizardModal
        isOpen={closureModalOpen}
        onClose={() => setClosureModalOpen(false)}
        meeting={meeting}
        notes={notes}
        points={points}
        decisions={decisions}
        onMeetingClosed={(updated) => {
          setMeeting(updated);
          loadMeetingData();
        }}
      />
    </div>
  );
}
