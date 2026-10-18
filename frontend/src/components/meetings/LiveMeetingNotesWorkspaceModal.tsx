import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
  ChevronRight,
  CheckSquare,
  ArrowRight,
  History,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface LiveMeetingNotesWorkspaceModalProps {
  meetingId: string;
  onClose: () => void;
  onOpenReviewTasks: () => void;
}

export default function LiveMeetingNotesWorkspaceModal({
  meetingId,
  onClose,
  onOpenReviewTasks,
}: LiveMeetingNotesWorkspaceModalProps) {
  const { session } = useAuth();

  // Meeting & Context Data
  const [meeting, setMeeting] = useState<any>(null);
  const [previousMeeting, setPreviousMeeting] = useState<any>(null);
  const [unresolvedPoints, setUnresolvedPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes Content
  const [notesContent, setNotesContent] = useState('');

  // Autosave status: 'idle' | 'saving' | 'saved' | 'failed'
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('saved');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const saveTimeoutRef = useRef<any>(null);

  // Quick Add Item States
  const [quickItemText, setQuickItemText] = useState('');
  const [quickItemType, setQuickItemType] = useState<'POINT' | 'DECISION' | 'ACTION' | 'RISK'>('POINT');
  const [isAddingItem, setIsAddingItem] = useState(false);

  const getHeaders = useCallback(() => {
    const token = session?.access_token || localStorage.getItem('token') || 'dev-admin-token';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [session]);

  // Load meeting details, previous meeting context, and existing notes
  useEffect(() => {
    const loadMeetingWorkspace = async () => {
      setLoading(true);
      try {
        const headers = getHeaders();
        const [meetRes, notesRes] = await Promise.all([
          fetch(`http://localhost:4000/api/meetings/${meetingId}`, { headers }),
          fetch(`http://localhost:4000/api/meetings/${meetingId}/notes`, { headers }),
        ]);

        if (meetRes.ok) {
          const m = await meetRes.json();
          setMeeting(m);

          // If linked previous meeting, fetch it
          if (m.previous_meeting_id) {
            const prevRes = await fetch(`http://localhost:4000/api/meetings/${m.previous_meeting_id}`, { headers });
            if (prevRes.ok) {
              const prev = await prevRes.json();
              setPreviousMeeting(prev);
            }

            // Fetch unresolved points from previous meeting
            const prevPointsRes = await fetch(
              `http://localhost:4000/api/meetings/${m.previous_meeting_id}/points`,
              { headers }
            );
            if (prevPointsRes.ok) {
              const pData = await prevPointsRes.json();
              setUnresolvedPoints((pData || []).filter((p: any) => p.status !== 'RESOLVED' && p.status !== 'CANCELLED'));
            }
          }
        }

        if (notesRes.ok) {
          const notesData = await notesRes.json();
          if (notesData && notesData.length > 0) {
            const combinedText = notesData.map((n: any) => n.content).join('\n\n');
            setNotesContent(combinedText);
          }
        }
      } catch (err) {
        console.error('Failed to load live meeting workspace:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMeetingWorkspace();
  }, [meetingId, getHeaders]);

  // Debounced Autosave for Text Editor
  const triggerAutoSave = (newContent: string) => {
    setNotesContent(newContent);
    setHasUnsavedChanges(true);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await saveNotesToServer(newContent);
    }, 1500); // 1.5s debounce
  };

  // Persist notes to server
  const saveNotesToServer = async (contentToSave = notesContent) => {
    setSaveStatus('saving');
    try {
      const res = await fetch(`http://localhost:4000/api/meetings/${meetingId}/notes`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          content: contentToSave || 'Live Meeting Notes',
          note_type: 'NOTE',
        }),
      });

      if (!res.ok) throw new Error('Save failed');

      setSaveStatus('saved');
      setHasUnsavedChanges(false);
    } catch (err) {
      setSaveStatus('failed');
    }
  };

  // Quick-Add Structured Item (Point, Decision, Action, Risk)
  const handleAddQuickItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItemText.trim()) return;

    setIsAddingItem(true);
    try {
      if (quickItemType === 'DECISION') {
        await fetch(`http://localhost:4000/api/meetings/${meetingId}/decisions`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            title: quickItemText.trim(),
            description: quickItemText.trim(),
            impact: 'MEDIUM'
          }),
        });
      } else {
        // Create meeting point
        const categoryMap = {
          POINT: 'DISCUSSION',
          ACTION: 'ACTION',
          RISK: 'RISK',
        };
        await fetch(`http://localhost:4000/api/meetings/${meetingId}/points`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            title: quickItemText.trim(),
            category: categoryMap[quickItemType],
            action_required: quickItemType === 'ACTION',
            priority: quickItemType === 'RISK' ? 'HIGH' : 'MEDIUM',
          }),
        });
      }

      // Append note text in editor
      const prefix = `[${quickItemType}] `;
      const updatedNotes = notesContent ? `${notesContent}\n• ${prefix}${quickItemText.trim()}` : `• ${prefix}${quickItemText.trim()}`;
      setNotesContent(updatedNotes);
      setQuickItemText('');
      await saveNotesToServer(updatedNotes);
    } catch (err) {
      console.error('Failed to add quick item:', err);
    } finally {
      setIsAddingItem(false);
    }
  };

  // Carry Forward a previous unresolved point into current notes
  const handleInsertPreviousPoint = (point: any) => {
    const textToInsert = `[Carried-Forward: ${point.point_code}] ${point.title}`;
    const updated = notesContent ? `${notesContent}\n• ${textToInsert}` : `• ${textToInsert}`;
    triggerAutoSave(updated);
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      const confirmClose = window.confirm(
        'You have unsaved changes that have not finished syncing. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }
    onClose();
  };

  const handlePopoutCompanion = () => {
    const width = 480;
    const height = 880;
    const left = 20;
    const top = 20;
    window.open(
      `/meetings/${meetingId}/companion`,
      `BDIQ_Meeting_Companion_${meetingId}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-border bg-muted/20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-foreground text-background flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                  MEETING MODE LIVE
                </span>
                <span className="text-xs text-muted-foreground">
                  {meeting?.meeting_date} • {meeting?.meeting_time || '10:00 AM'}
                </span>
              </div>
              <h2 className="text-sm font-bold text-foreground truncate max-w-md">
                {meeting?.title || 'Live Meeting Session'}
              </h2>
            </div>
          </div>

          {/* Right Header Tools */}
          <div className="flex items-center gap-3">
            {/* Save Status Badge */}
            <div className="flex items-center gap-1.5 text-xs">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-muted-foreground font-mono text-[11px]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Saving notes...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-600 font-mono text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All notes saved
                </span>
              )}
              {saveStatus === 'failed' && (
                <button
                  onClick={() => saveNotesToServer()}
                  className="flex items-center gap-1 text-red-600 font-mono text-[11px] hover:underline"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  Save failed. Retry?
                </button>
              )}
            </div>

            {/* External URL Shortcut */}
            {meeting?.location_or_link && (
              <button
                type="button"
                onClick={() => window.open(meeting.location_or_link, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm"
              >
                <ExternalLink className="w-3 h-3 text-blue-600" />
                <span>Call Link</span>
              </button>
            )}

            {/* Pop-out Companion Window */}
            <button
              type="button"
              onClick={handlePopoutCompanion}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors shadow-sm"
              title="Pop out Live Notes Companion Sidecar window beside Google Meet / Teams"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Pop-out Sidecar</span>
            </button>

            {/* Review Notes & Add Tasks */}
            <button
              type="button"
              onClick={onOpenReviewTasks}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all shadow-sm"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Review & Add Tasks</span>
            </button>

            {/* Close Button */}
            <button
              onClick={handleCloseAttempt}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Close meeting mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Body: SPLIT VIEW */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* ================================================================ */}
          {/* LEFT PANEL: PREVIOUS MEETING CONTEXT & CARRIED FORWARD POINTS    */}
          {/* ================================================================ */}
          <div className="w-full lg:w-5/12 p-5 overflow-y-auto space-y-4 bg-muted/10">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Previous Meeting Context & Points
                </h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {unresolvedPoints.length} Open Points
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Loading historical meeting records...
              </div>
            ) : previousMeeting ? (
              <div className="space-y-4">
                {/* Previous Meeting Card */}
                <div className="p-3.5 rounded-xl bg-card border border-border space-y-2 shadow-sm">
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">Previous Session</div>
                  <h4 className="text-xs font-bold text-foreground">
                    {previousMeeting.title}
                  </h4>
                  <div className="text-[11px] text-muted-foreground">
                    Conducted on {previousMeeting.meeting_date}
                  </div>
                  {previousMeeting.closure_summary && (
                    <div className="p-2.5 rounded bg-muted/30 border border-border text-[11px] text-muted-foreground italic">
                      "{previousMeeting.closure_summary}"
                    </div>
                  )}
                </div>

                {/* Unresolved Points to Address */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Unresolved Action Items & Decisions:</span>
                    <span className="text-[10px] text-muted-foreground">Click to carry forward</span>
                  </div>

                  {unresolvedPoints.length === 0 ? (
                    <div className="p-3 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                      No unresolved points carried forward from previous meeting.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unresolvedPoints.map(p => (
                        <div
                          key={p.id}
                          className="p-3 rounded-lg bg-card border border-border space-y-1.5 shadow-sm hover:border-foreground/40 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground">
                              {p.point_code}
                            </span>
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.2 rounded">
                              {p.category}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-foreground">{p.title}</p>
                          {p.due_date && (
                            <div className="text-[10px] text-muted-foreground">
                              Original Due: <span className="font-mono text-foreground">{p.due_date}</span>
                            </div>
                          )}
                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleInsertPreviousPoint(p)}
                              className="text-[11px] font-medium text-foreground hover:underline flex items-center gap-1"
                            >
                              <span>Insert into notes</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                <p>This meeting is not linked to a prior recurring series or parent meeting.</p>
                <p className="text-[11px]">All notes, decisions, and action items captured today will be recorded as canonical records.</p>
              </div>
            )}
          </div>

          {/* ================================================================ */}
          {/* RIGHT PANEL: LIVE NOTES EDITOR & QUICK ACTION CAPTURE             */}
          {/* ================================================================ */}
          <div className="w-full lg:w-7/12 p-5 flex flex-col space-y-4 bg-card">
            {/* Quick Item Capture Bar */}
            <form onSubmit={handleAddQuickItem} className="p-3 rounded-xl bg-muted/20 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Quick Capture Point
                </span>
                {/* Type Selector */}
                <div className="flex items-center gap-1 text-[11px]">
                  {(['POINT', 'DECISION', 'ACTION', 'RISK'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setQuickItemType(type)}
                      className={`px-2 py-0.5 rounded font-mono transition-colors ${
                        quickItemType === type
                          ? 'bg-foreground text-background font-bold'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Enter ${quickItemType.toLowerCase()} description (e.g. "Confirm batch scale-up schedule with QA by Oct 15")...`}
                  value={quickItemText}
                  onChange={e => setQuickItemText(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isAddingItem || !quickItemText.trim()}
                  className="px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-all disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </form>

            {/* Main Live Notes Text Editor */}
            <div className="flex-1 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Free-Text Live Meeting Notes (autosaved with change tracking):</span>
                <span className="font-mono text-[10px]">{notesContent.length} characters</span>
              </div>

              <textarea
                value={notesContent}
                onChange={e => triggerAutoSave(e.target.value)}
                placeholder="Type your notes during the meeting here...
• Plain text and bullet points supported
• Autosaves seamlessly every few keystrokes
• You can convert any note item into an assigned Task at the end of the meeting"
                className="flex-1 w-full p-4 rounded-xl border border-border bg-background text-xs font-sans text-foreground leading-relaxed focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
              />
            </div>

            {/* Bottom Bar: Manual Save & Review Trigger */}
            <div className="pt-2 flex items-center justify-between border-t border-border">
              <button
                type="button"
                onClick={() => saveNotesToServer()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Now</span>
              </button>

              <button
                type="button"
                onClick={onOpenReviewTasks}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all shadow-md"
              >
                <span>Complete Notes & Create Tasks</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
