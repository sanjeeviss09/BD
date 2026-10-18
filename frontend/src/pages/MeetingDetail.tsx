import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Square,
  FileCheck2,
  Download,
  Plus,
  Sparkles,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Info,
  ExternalLink,
  Video,
  Edit3,
  Check,
  X,
  FileText,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  CheckSquare
} from 'lucide-react';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const navigate = useNavigate();

  // Core Data
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [prepData, setPrepData] = useState<PreparationWorkspaceData | null>(null);
  const [points, setPoints] = useState<MeetingPoint[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'prep' | 'points' | 'decisions' | 'minutes' | 'transcript'>('live');

  // Mini Notes side-panel
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [noteContent, setNoteContent] = useState('');
  const [noteSpeaker, setNoteSpeaker] = useState('');
  const [noteType, setNoteType] = useState<string>('DISCUSSION');
  const [noteAgendaItem] = useState<string>('');
  const [noteSavedStatus, setNoteSavedStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [quickSuggestion, setQuickSuggestion] = useState<QuickCaptureSuggestion | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Modals & Popovers
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [editLinkModalOpen, setEditLinkModalOpen] = useState(false);
  const [newLinkValue, setNewLinkValue] = useState('');
  const [endSessionModalOpen, setEndSessionModalOpen] = useState(false);
  const [taskModalPoint, setTaskModalPoint] = useState<MeetingPoint | null>(null);

  // New Structured Point Form
  const [newPointTitle, setNewPointTitle] = useState('');
  const [newPointCategory, setNewPointCategory] = useState<any>('DISCUSSION');
  const [newPointPriority] = useState<any>('MEDIUM');
  const [newPointDueDate, setNewPointDueDate] = useState('');

  // New Decision Form
  const [newDecisionTitle, setNewDecisionTitle] = useState('');
  const [newDecisionDesc, setNewDecisionDesc] = useState('');
  const [newDecisionImpact, setNewDecisionImpact] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');

  // Task Creation Modal Form
  const [taskFormTitle, setTaskFormTitle] = useState('');
  const [taskFormDesc, setTaskFormDesc] = useState('');
  const [taskFormPriority, setTaskFormPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [taskFormDueDate, setTaskFormDueDate] = useState('');
  const [taskFormDepartment, setTaskFormDepartment] = useState('');
  const [taskFormAssignee, setTaskFormAssignee] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // MOM Editor State
  const [momDraft, setMomDraft] = useState<any>(null);
  const [isGeneratingMOM, setIsGeneratingMOM] = useState(false);
  const [isConfirmingMOM, setIsConfirmingMOM] = useState(false);
  const [momSaveSuccess, setMomSaveSuccess] = useState(false);

  // Transcript Input
  const [transcriptInput, setTranscriptInput] = useState('');
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);

  // Browser popup fallback
  const [popupBlockedUrl, setPopupBlockedUrl] = useState<string | null>(null);

  // Live session timer
  const [sessionSeconds, setSessionSeconds] = useState(0);

  useEffect(() => {
    if (!id) return;
    loadMeetingData();
  }, [id]);

  // Sync tab and modal from URL search params (e.g., ?tab=minutes or ?tab=closure or ?closure=true)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      if (['live', 'prep', 'points', 'decisions', 'minutes', 'transcript'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
      if (tabParam === 'closure' || tabParam === 'reconcile') {
        setClosureModalOpen(true);
      }
    }
    if (searchParams.get('closure') === 'true' || searchParams.get('reconcile') === 'true') {
      setClosureModalOpen(true);
    }
  }, [searchParams]);

  // Cross-tab broadcast listener for instant synchronization
  useEffect(() => {
    if (!id) return;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('bdiq_meeting_events');
      bc.onmessage = (event) => {
        if (event.data?.meetingId === id) {
          if (event.data?.action === 'SWITCH_TAB' && event.data?.tab) {
            setActiveTab(event.data.tab);
          }
          if (event.data?.action === 'OPEN_CLOSURE') {
            setClosureModalOpen(true);
          }
          if (event.data?.action === 'REFRESH' || event.data?.status) {
            loadMeetingData();
          }
        }
      };
    } catch {}

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bdiq_meeting_updated' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.meetingId === id) {
            if (parsed.action === 'SWITCH_TAB' && parsed.tab) {
              setActiveTab(parsed.tab);
            }
            if (parsed.action === 'OPEN_CLOSURE') {
              setClosureModalOpen(true);
            }
            loadMeetingData();
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
    };
  }, [id]);

  // Session duration timer for IN_PROGRESS meetings
  useEffect(() => {
    if (meeting?.status !== 'IN_PROGRESS' || !meeting.actual_start_time) return;
    const startMs = new Date(meeting.actual_start_time).getTime();
    const updateDuration = () => {
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setSessionSeconds(diffSec);
    };
    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [meeting?.status, meeting?.actual_start_time]);

  const loadMeetingData = async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const token = session?.access_token;
      const m = await meetingApi.getMeeting(id, token);
      setMeeting(m);
      setNewLinkValue(m.location_or_link || '');
      setTranscriptInput(m.transcript_text || '');
      if (m.mom_draft) setMomDraft(m.mom_draft);

      const [prepRes, ptsRes, decsRes, ntsRes, deptsRes, usersRes] = await Promise.allSettled([
        meetingApi.getPreparationWorkspace(id, token),
        meetingApi.getMeetingPoints(id, token),
        meetingApi.getDecisions(id, token),
        meetingApi.getNotes(id, token),
        fetch('http://localhost:4000/api/departments', { headers: { Authorization: `Bearer ${token || 'dev-admin-token'}` } }).then(r => r.json()),
        fetch('http://localhost:4000/api/users', { headers: { Authorization: `Bearer ${token || 'dev-admin-token'}` } }).then(r => r.json())
      ]);

      if (prepRes.status === 'fulfilled') setPrepData(prepRes.value);
      if (ptsRes.status === 'fulfilled') setPoints(ptsRes.value || []);
      if (decsRes.status === 'fulfilled') setDecisions(decsRes.value || []);
      if (ntsRes.status === 'fulfilled') setNotes(ntsRes.value || []);
      if (deptsRes.status === 'fulfilled') {
        const dList = Array.isArray(deptsRes.value) ? deptsRes.value : (deptsRes.value?.data || []);
        setDepartments(dList);
      }
      if (usersRes.status === 'fulfilled') {
        const uList = Array.isArray(usersRes.value) ? usersRes.value : (usersRes.value?.data || []);
        setUsers(uList);
      }
    } catch (err: any) {
      console.error('Failed to load meeting details:', err);
      setLoadError(err?.message || 'Meeting could not be loaded');
    } finally {
      setLoading(false);
    }
  };

  // Format seconds to HH:MM:SS
  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? `${hrs}:` : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format Date to "Sun, Oct 18, 2026"
  const formatDisplayDate = (dStr?: string | null) => {
    if (!dStr) return 'Not scheduled';
    try {
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dStr;
    }
  };

  // Format Time to "04:20 PM" or "10:35:17 AM"
  const formatDisplayTime = (tStr?: string | null) => {
    if (!tStr) return 'Not recorded';
    try {
      if (tStr.includes('T') || tStr.includes('Z')) {
        const d = new Date(tStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
      }
      const parts = tStr.split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1];
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
      }
      return tStr;
    } catch {
      return tStr;
    }
  };

  // Calculate Duration between two ISO timestamps (e.g. "9m 16s")
  const formatDurationBetween = (startStr?: string | null, endStr?: string | null) => {
    if (!startStr || !endStr) return null;
    try {
      const s = new Date(startStr).getTime();
      const e = new Date(endStr).getTime();
      if (isNaN(s) || isNaN(e) || e <= s) return null;
      const diffSec = Math.floor((e - s) / 1000);
      const mins = Math.floor(diffSec / 60);
      const secs = diffSec % 60;
      if (mins === 0) return `${secs}s`;
      return `${mins}m ${secs}s`;
    } catch {
      return null;
    }
  };

  // Determine Conferencing Provider Badge
  const getConferencingBadge = (link?: string | null) => {
    if (!link) return { label: 'Link Not Configured', color: 'bg-muted text-muted-foreground' };
    const lower = link.toLowerCase();
    if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) {
      return { label: 'Microsoft Teams', color: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' };
    }
    if (lower.includes('zoom.us')) {
      return { label: 'Zoom Meeting', color: 'bg-blue-500/10 text-blue-400 border border-blue-500/30' };
    }
    if (lower.includes('meet.google.com')) {
      return { label: 'Google Meet', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' };
    }
    return { label: 'Conferencing Link', color: 'bg-purple-500/10 text-purple-400 border border-purple-500/30' };
  };

  // START MEETING ACTION
  const handleStartMeeting = async () => {
    if (!meeting) return;
    setPopupBlockedUrl(null);

    // If conferencing link is not set, prompt user
    if (!meeting.location_or_link) {
      const proceed = window.confirm(
        'No conferencing link has been configured for this meeting.\n\nClick OK to start the BDIQ Live Assistant session anyway, or click Cancel to add a conferencing URL.'
      );
      if (!proceed) {
        setNewLinkValue('');
        setEditLinkModalOpen(true);
        return;
      }
    }

    // 1. Direct window launch from click event if link exists
    if (meeting.location_or_link) {
      let targetUrl = meeting.location_or_link.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://${targetUrl}`;
      }
      try {
        const openedWin = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        if (!openedWin || openedWin.closed || typeof openedWin.closed === 'undefined') {
          setPopupBlockedUrl(targetUrl);
        }
      } catch (err) {
        console.warn('Popup launch restricted by browser:', err);
        setPopupBlockedUrl(targetUrl);
      }
      // Also pop out the Live Notes Companion sidecar docked beside call
      handleOpenCompanionWindow();
    }

    // 2. Call backend transition endpoint
    try {
      const updated = await meetingApi.startMeeting(meeting.id, session?.access_token);
      setMeeting(updated);
      setActiveTab('live');
      notifyMeetingChange(meeting.id, 'IN_PROGRESS');
    } catch (err: any) {
      console.error('Failed to update meeting status to IN_PROGRESS:', err);
    }
  };

  // Cross-tab Synchronization Notifier
  const notifyMeetingChange = (meetingId: string, status?: string) => {
    try {
      const bc = new BroadcastChannel('bdiq_meeting_events');
      bc.postMessage({ meetingId, status, timestamp: Date.now() });
      bc.close();
    } catch {}
    localStorage.setItem('bdiq_meeting_updated', JSON.stringify({ meetingId, status, timestamp: Date.now() }));
  };

  // POP-OUT COMPANION SIDECAR
  const handleOpenCompanionWindow = () => {
    if (!id) return;
    const width = 480;
    const height = 880;
    const left = 20;
    const top = 20;
    window.open(
      `/meetings/${id}/companion`,
      `BDIQ_Meeting_Companion_${id}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  // DIRECT JOIN BUTTON
  const handleOpenConferencingLink = () => {
    if (!meeting?.location_or_link) return;
    let targetUrl = meeting.location_or_link.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    setPopupBlockedUrl(null);
  };

  // SAVE EDITED CONFERENCING LINK
  const handleSaveConferencingLink = async () => {
    if (!id) return;
    try {
      let cleaned = newLinkValue.trim();
      if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
        cleaned = `https://${cleaned}`;
      }
      const updated = await meetingApi.updateMeeting(id, { location_or_link: cleaned || null }, session?.access_token);
      setMeeting(prev => prev ? { ...prev, location_or_link: cleaned || null } : updated);
      setEditLinkModalOpen(false);
      notifyMeetingChange(id);
    } catch (err) {
      console.error('Failed to update conferencing link:', err);
    }
  };

  // END MEETING SESSION
  const handleConfirmEndSession = async () => {
    if (!id) return;
    try {
      const ended = await meetingApi.endMeeting(id, session?.access_token);
      setMeeting(prev => prev ? { ...prev, status: 'AWAITING_MOM_REVIEW', actual_end_time: ended.actual_end_time } : ended);
      setEndSessionModalOpen(false);
      setActiveTab('minutes');
      notifyMeetingChange(id, 'AWAITING_MOM_REVIEW');
      // Automatically trigger draft MOM generation
      handleGenerateMOM();
    } catch (err) {
      console.error('Failed to end meeting session:', err);
    }
  };

  // MINI NOTES AUTOSAVE & CAPTURE
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
      } catch {}
    }, 300);
  };

  const handleSaveNote = async () => {
    if (!id || !noteContent.trim()) return;
    setNoteSavedStatus('saving');
    try {
      const mutationId = `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const saved = await meetingApi.createNote(
        id,
        {
          content: noteContent.trim(),
          speaker: noteSpeaker.trim() || null,
          note_type: noteType,
          agenda_item: noteAgendaItem.trim() || null,
          client_mutation_id: mutationId
        },
        session?.access_token
      );
      setNotes(prev => [...prev, saved]);

      // If user selected TASK as note type, auto-create point & convert to canonical task
      if (noteType === 'TASK') {
        try {
          const pt = await meetingApi.createMeetingPoint(
            id,
            {
              title: noteContent.trim(),
              category: 'ACTION',
              action_required: true,
              priority: 'MEDIUM',
              due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
            },
            session?.access_token
          );
          await meetingApi.convertPointToTask(
            pt.id,
            {
              title: noteContent.trim(),
              priority: 'MEDIUM',
              due_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
            },
            session?.access_token
          );
          const updatedPts = await meetingApi.getMeetingPoints(id, session?.access_token);
          setPoints(updatedPts);
          notifyMeetingChange(id);
        } catch (taskErr) {
          console.warn('Auto task creation from mini note fallback:', taskErr);
        }
      }

      setNoteContent('');
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
      handleSaveNote();
      notifyMeetingChange(id);
    } catch (err) {
      console.error('Failed to apply suggestion to meeting point:', err);
    }
  };

  // OPEN TASK CREATION DIALOG
  const handleOpenCreateTaskModal = (point: MeetingPoint) => {
    setTaskModalPoint(point);
    setTaskFormTitle(point.title);
    setTaskFormDesc(point.discussion_notes || point.description || `Action item from ${meeting?.meeting_code || 'Meeting'} - ${meeting?.title || ''}`);
    setTaskFormPriority(point.priority || 'MEDIUM');
    setTaskFormDueDate(point.due_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setTaskFormDepartment(point.responsible_department_id || (departments[0]?.id || ''));
    setTaskFormAssignee(point.responsible_user_id || '');
  };

  // OPEN DIRECT QUICK TASK MODAL
  const handleOpenQuickTaskDirect = () => {
    setTaskFormTitle('');
    setTaskFormDesc('');
    setTaskFormPriority('MEDIUM');
    setTaskFormDueDate(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
    setTaskFormDepartment(departments[0]?.id || '');
    setTaskFormAssignee('');
    setTaskModalPoint({
      id: 'DIRECT_QUICK_TASK',
      point_code: 'NEW-TASK',
      title: 'New Action Task',
      meeting_id: id!
    } as any);
  };

  // SUBMIT TASK FROM MEETING POINT
  const handleSubmitTaskFromPoint = async () => {
    if (!taskModalPoint) return;
    setIsCreatingTask(true);
    try {
      let targetPointId = taskModalPoint.id;
      if (taskModalPoint.id === 'DIRECT_QUICK_TASK') {
        const pt = await meetingApi.createMeetingPoint(
          id!,
          {
            title: taskFormTitle.trim(),
            description: taskFormDesc.trim() || undefined,
            category: 'ACTION',
            action_required: true,
            priority: taskFormPriority,
            due_date: taskFormDueDate || null,
            department_id: taskFormDepartment || null,
            assigned_user_id: taskFormAssignee || null
          },
          session?.access_token
        );
        targetPointId = pt.id;
      }

      await meetingApi.convertPointToTask(
        targetPointId,
        {
          title: taskFormTitle.trim(),
          description: taskFormDesc.trim(),
          priority: taskFormPriority,
          due_date: taskFormDueDate,
          department_id: taskFormDepartment || undefined,
          assigned_user_id: taskFormAssignee || undefined
        },
        session?.access_token
      );
      // Refresh points
      const updatedPts = await meetingApi.getMeetingPoints(id!, session?.access_token);
      setPoints(updatedPts);
      setTaskModalPoint(null);
      notifyMeetingChange(id!);
    } catch (err: any) {
      alert(`Failed to create task: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCreatingTask(false);
    }
  };

  // CREATE STRUCTURED POINT
  const handleCreatePoint = async () => {
    if (!newPointTitle.trim() || !id) return;
    try {
      const created = await meetingApi.createMeetingPoint(
        id,
        {
          title: newPointTitle.trim(),
          category: newPointCategory,
          priority: newPointPriority,
          due_date: newPointDueDate || null,
          action_required: newPointCategory === 'ACTION'
        },
        session?.access_token
      );
      setPoints(prev => [...prev, created]);
      setNewPointTitle('');
      setNewPointDueDate('');
    } catch (err) {
      console.error('Failed to create meeting point:', err);
    }
  };

  // CREATE DECISION
  const handleCreateDecision = async () => {
    if (!newDecisionTitle.trim() || !id) return;
    try {
      const created = await meetingApi.createDecision(
        id,
        {
          title: newDecisionTitle.trim(),
          description: newDecisionDesc.trim() || null,
          impact: newDecisionImpact,
          decision_date: new Date().toISOString().split('T')[0]
        },
        session?.access_token
      );
      setDecisions(prev => [...prev, created]);
      setNewDecisionTitle('');
      setNewDecisionDesc('');
    } catch (err) {
      console.error('Failed to record decision:', err);
    }
  };

  // CONFIRM DECISION GATE
  const handleToggleConfirmDecision = async (decision: MeetingDecision) => {
    const nextState = !decision.is_confirmed;
    try {
      const updated = await meetingApi.confirmDecision(decision.id, nextState, session?.access_token);
      setDecisions(prev => prev.map(d => d.id === decision.id ? { ...d, is_confirmed: nextState, confirmed_at: updated.confirmed_at } : d));
    } catch (err) {
      console.error('Failed to confirm decision:', err);
    }
  };

  // GENERATE MOM DRAFT
  const handleGenerateMOM = async () => {
    if (!id) return;
    setIsGeneratingMOM(true);
    try {
      const result = await meetingApi.generateMOMDraft(id, { transcript: transcriptInput }, session?.access_token);
      setMomDraft(result.mom_draft || result);
      setMomSaveSuccess(true);
      setTimeout(() => setMomSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`MOM generation failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingMOM(false);
    }
  };

  // CONFIRM MOM
  const handleConfirmMOM = async () => {
    if (!id || !momDraft) return;
    setIsConfirmingMOM(true);
    try {
      const updated = await meetingApi.confirmMOM(id, momDraft, session?.access_token);
      setMeeting(prev => prev ? {
        ...prev,
        mom_status: 'CONFIRMED',
        status: 'COMPLETED',
        closure_status: 'CLOSED',
        mom_draft: momDraft
      } : updated);
      alert('Minutes of Meeting successfully confirmed and approved!');
    } catch (err: any) {
      alert(`Failed to confirm MOM: ${err.message}`);
    } finally {
      setIsConfirmingMOM(false);
    }
  };

  // SAVE TRANSCRIPT
  const handleSaveTranscript = async () => {
    if (!id) return;
    setIsSavingTranscript(true);
    try {
      await meetingApi.updateMeeting(id, { transcript_text: transcriptInput }, session?.access_token);
      setMeeting(prev => prev ? { ...prev, transcript_text: transcriptInput } : prev);
      alert('Transcript saved successfully!');
    } catch (err: any) {
      alert(`Failed to save transcript: ${err.message}`);
    } finally {
      setIsSavingTranscript(false);
    }
  };

  // EXPORT EXCEL
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
      alert('Failed to generate Excel workbook.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-muted-foreground font-mono text-xs gap-3">
        <Clock className="w-6 h-6 animate-spin text-primary" />
        <span>Loading BDIQ Meeting Intelligence Live Workspace...</span>
      </div>
    );
  }

  if (loadError || !meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">Meeting Not Found or Inaccessible</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            {loadError || 'The meeting record could not be loaded.'}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => navigate('/meetings')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
          >
            Back to Meetings
          </button>
          <button
            onClick={() => loadMeetingData()}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const confBadge = getConferencingBadge(meeting.location_or_link);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background text-foreground">
      {/* 1. Header Bar */}
      <header className="px-6 py-3 border-b border-border bg-card/75 backdrop-blur-sm shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Left Title & Status */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {meeting.meeting_code}
              </span>
              <h1 className="text-lg font-bold tracking-tight text-foreground truncate max-w-xl">
                {meeting.title}
              </h1>

              {/* Lifecycle Status Badge */}
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                  meeting.status === 'IN_PROGRESS'
                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 animate-pulse'
                    : meeting.status === 'COMPLETED'
                    ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
                    : meeting.status === 'AWAITING_MOM_REVIEW'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {meeting.status}
              </span>

              {/* Conferencing Platform Badge */}
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold flex items-center gap-1 ${confBadge.color}`}>
                <Video className="w-3 h-3" />
                {confBadge.label}
              </span>

              {/* Session Duration if IN_PROGRESS */}
              {meeting.status === 'IN_PROGRESS' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Live Duration: {formatDuration(sessionSeconds)}
                </span>
              )}
            </div>

            {/* Sub-meta */}
            <div className="flex flex-wrap items-center gap-3.5 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5 text-foreground/90 font-medium">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                {formatDisplayDate(meeting.meeting_date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {formatDisplayTime(meeting.meeting_time)} {meeting.end_time ? `– ${formatDisplayTime(meeting.end_time)}` : ''} <span className="text-muted-foreground/70">({meeting.timezone})</span>
              </span>
              {meeting.actual_start_time && meeting.actual_end_time && (
                <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/60 text-[11px] text-muted-foreground flex items-center gap-1">
                  Actual: {formatDisplayTime(meeting.actual_start_time)} – {formatDisplayTime(meeting.actual_end_time)}
                  {formatDurationBetween(meeting.actual_start_time, meeting.actual_end_time) && (
                    <strong className="text-emerald-400 ml-1">({formatDurationBetween(meeting.actual_start_time, meeting.actual_end_time)})</strong>
                  )}
                </span>
              )}
              {meeting.customer && (
                <span className="flex items-center gap-1.5 text-foreground font-sans font-semibold">
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  {meeting.customer.name}
                </span>
              )}
              {meeting.opportunity && (
                <span className="flex items-center gap-1.5 text-foreground font-sans">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                  {meeting.opportunity.title}
                </span>
              )}
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* START MEETING (When SCHEDULED) */}
            {meeting.status === 'SCHEDULED' && (
              <button
                onClick={handleStartMeeting}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                title="Open conferencing link in new tab and activate BDIQ Live Meeting workspace"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start Live Meeting
              </button>
            )}

            {/* END MEETING (When IN_PROGRESS) */}
            {meeting.status === 'IN_PROGRESS' && (
              <button
                onClick={() => setEndSessionModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                title="Finish BDIQ live session and initiate Minutes of Meeting (MOM) review"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> Finish Live Session
              </button>
            )}

            {/* OPEN CONFERENCING LINK DIRECTLY */}
            {meeting.location_or_link && (
              <button
                onClick={handleOpenConferencingLink}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Open saved conferencing URL in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5 text-primary" /> Join Meeting
              </button>
            )}

            {/* POP-OUT COMPANION SIDECAR */}
            <button
              onClick={handleOpenCompanionWindow}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Pop out Live Notes Companion Sidecar window docked beside Google Meet / Teams"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Notes Companion</span>
            </button>

            {/* QUICK TASK BUTTON */}
            <button
              onClick={handleOpenQuickTaskDirect}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              title="Create an immediate task linked to this meeting"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Quick Task</span>
            </button>

            {/* EDIT LINK BUTTON */}
            <button
              onClick={() => {
                setNewLinkValue(meeting.location_or_link || '');
                setEditLinkModalOpen(true);
              }}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
              title="Edit Conferencing Link"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            {/* CLOSURE WIZARD */}
            <button
              onClick={() => setClosureModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <FileCheck2 className="w-3.5 h-3.5" /> Closure Wizard
            </button>

            {/* EXCEL EXPORT */}
            <button
              onClick={handleExportMinutes}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download Excel Workbook (7 Worksheets)"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
        </div>

        {/* Browser Popup Blocked Notice Fallback */}
        {popupBlockedUrl && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-500 animate-in fade-in">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Browser blocked the new window. Click the button to open your conferencing call:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenConferencingLink}
                className="px-3 py-1 text-xs font-bold rounded bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-1 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open Conferencing Window
              </button>
              <button
                onClick={() => setPopupBlockedUrl(null)}
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-2.5 border-t border-border/50 pt-2 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'live' ? 'bg-muted text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Live Meeting Mode
          </button>
          <button
            onClick={() => setActiveTab('prep')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'prep' ? 'bg-muted text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Preparation Workspace
          </button>
          <button
            onClick={() => setActiveTab('points')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'points' ? 'bg-muted text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" /> Structured Points ({points.length})
          </button>
          <button
            onClick={() => setActiveTab('decisions')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'decisions' ? 'bg-muted text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Confirmed Decisions ({decisions.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('minutes');
              if (!momDraft) handleGenerateMOM();
            }}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'minutes' ? 'bg-muted text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary" /> Minutes Summary (MOM)
            {meeting.mom_status === 'CONFIRMED' && (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                CONFIRMED
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'transcript' ? 'bg-muted text-foreground border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Conferencing & Transcript
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: LIVE MEETING MODE */}
          {activeTab === 'live' && (
            <div className="space-y-6">
              {/* Meeting Status & Conferencing Info Banner */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary" />
                    Live Conferencing Status
                  </div>
                  <div className="text-sm font-bold text-foreground">
                    {meeting.location_or_link ? (
                      <span className="font-mono text-primary truncate max-w-md inline-block">
                        {meeting.location_or_link}
                      </span>
                    ) : (
                      <span className="text-amber-500">Conferencing URL missing. Add link to enable direct launch.</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Conferencing runs externally. Central Audio/Video Recording: <strong className="text-foreground">NOT_CONFIGURED (Manual transcript import supported)</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {meeting.location_or_link ? (
                    <button
                      onClick={handleOpenConferencingLink}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Join Meeting Window
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditLinkModalOpen(true)}
                      className="px-3.5 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Meeting URL
                    </button>
                  )}
                </div>
              </div>

              {/* Agenda & Target Objective */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Live Agenda Items
                  </h3>
                  <div className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/50">
                    {meeting.agenda || '1. Customer Requirements Review\n2. Formulation Feasibility & Batch Size\n3. Action Commitments & Timetable'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" /> Target Objective
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {meeting.objective || 'Confirm technical feasibility and align on preliminary manufacturing timetable.'}
                  </p>
                  {meeting.expected_outcomes && (
                    <div className="pt-2 border-t border-border/50">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground font-bold mb-1">Expected Outcomes</div>
                      <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                        {meeting.expected_outcomes}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Practical Questions To Ask */}
              {prepData && prepData.suggestedQuestions && prepData.suggestedQuestions.length > 0 && (
                <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary" />
                    Practical Questions To Ask During Meeting ({prepData.suggestedQuestions.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {prepData.suggestedQuestions.map((q: any) => (
                      <div key={q.id} className="p-2.5 rounded-lg bg-background border border-border text-xs flex items-start gap-2.5">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold mt-0.5">
                          {q.category}
                        </span>
                        <div className="flex-1 font-sans text-foreground">
                          {q.question}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Structured Meeting Points quick summary */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Meeting Points Recorded ({points.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab('points')}
                    className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    Manage Points & Create Tasks <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/50 border-b border-border text-[11px] font-mono uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Priority</th>
                        <th className="py-2 px-3">Due Date</th>
                        <th className="py-2 px-3 text-right">Task Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {points.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-muted-foreground italic">
                            No meeting points recorded yet. Use the Mini Notes panel on the right to capture notes and generate action points.
                          </td>
                        </tr>
                      ) : (
                        points.slice(0, 5).map(pt => (
                          <tr key={pt.id} className="hover:bg-muted/20">
                            <td className="py-2 px-3 font-mono font-bold text-primary">{pt.point_code}</td>
                            <td className="py-2 px-3 font-semibold text-foreground">{pt.title}</td>
                            <td className="py-2 px-3">
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted font-bold">{pt.category}</span>
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px]">{pt.priority}</td>
                            <td className="py-2 px-3 font-mono">{pt.due_date || '—'}</td>
                            <td className="py-2 px-3 text-right">
                              {pt.linked_task_id ? (
                                <button
                                  onClick={() => navigate(`/tasks/${pt.linked_task_id}`)}
                                  className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer"
                                  title="Open in Canonical Task Management"
                                >
                                  {pt.linked_task?.task_code || 'Task'} →
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenCreateTaskModal(pt)}
                                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                                >
                                  Create Task
                                </button>
                              )}
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

          {/* TAB 2: PREPARATION WORKSPACE */}
          {activeTab === 'prep' && prepData && (
            <div className="space-y-6">
              {/* Previous Meeting Context */}
              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Previous Meeting Context & Carry-Forward Engine
                  </h3>
                  {prepData.previousSummary && (
                    <span className="text-xs font-mono text-muted-foreground">
                      Ref: <strong>{prepData.previousSummary.meeting_code}</strong> ({prepData.previousSummary.meeting_date})
                    </span>
                  )}
                </div>

                {prepData.previousSummary ? (
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-lg bg-muted/20 border border-border/80 text-xs">
                      <div className="font-mono text-[10px] text-muted-foreground uppercase font-bold">Previous Executive Summary</div>
                      <p className="text-foreground mt-1 leading-relaxed">{prepData.previousSummary.closure_summary}</p>
                    </div>

                    {/* Unresolved Points from previous meeting */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-mono uppercase font-bold text-muted-foreground">
                        Carried Forward / Open Points ({prepData.previousPoints.length})
                      </div>
                      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                        {prepData.previousPoints.map(pt => (
                          <div key={pt.id} className="p-2.5 bg-background text-xs flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold text-foreground">{pt.point_code}: {pt.title}</div>
                              <div className="text-[11px] text-muted-foreground font-mono">
                                Category: {pt.category} | Priority: {pt.priority} | Due: {pt.due_date || 'N/A'}
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                              {pt.status}
                            </span>
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

              {/* Overdue Commitments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    Overdue Commitments ({prepData.overdueActions.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {prepData.overdueActions.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No overdue commitments.</p>
                    ) : (
                      prepData.overdueActions.map((act: any) => (
                        <div key={act.id} className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs">
                          <div className="font-bold text-foreground">{act.task_code || act.point_code}: {act.title}</div>
                          <div className="text-rose-400 font-mono text-[11px] mt-0.5">
                            Due date: {act.original_due_date || act.due_date} (Overdue)
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Suggested Agenda from Action Items
                  </h3>
                  <div className="space-y-2">
                    {prepData.suggestedAgenda && prepData.suggestedAgenda.map((item: string, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-background border border-border text-xs flex items-center justify-between">
                        <span className="font-mono text-foreground">{idx + 1}. {item}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">Auto-generated</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: STRUCTURED POINTS & TASK CREATION */}
          {activeTab === 'points' && (
            <div className="space-y-6">
              {/* Add Point Form */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Add Structured Meeting Point
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newPointTitle}
                      onChange={(e) => setNewPointTitle(e.target.value)}
                      placeholder="Point title or statement..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
                    />
                  </div>
                  <div>
                    <select
                      value={newPointCategory}
                      onChange={(e) => setNewPointCategory(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
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
                    <input
                      type="date"
                      value={newPointDueDate}
                      onChange={(e) => setNewPointDueDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground font-mono"
                    />
                  </div>
                  <div>
                    <button
                      onClick={handleCreatePoint}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Point
                    </button>
                  </div>
                </div>
              </div>

              {/* All Points Table */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    All Meeting Points ({points.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/50 border-b border-border text-[11px] font-mono uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Priority</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Canonical Task</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {points.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-6 text-muted-foreground italic">
                            No points recorded yet.
                          </td>
                        </tr>
                      ) : (
                        points.map(pt => (
                          <tr key={pt.id} className="hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-mono font-bold text-primary">{pt.point_code}</td>
                            <td className="py-2.5 px-3 font-semibold text-foreground">{pt.title}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted font-bold">{pt.category}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{pt.priority}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{pt.responsible_department?.name || '—'}</td>
                            <td className="py-2.5 px-3 font-mono">{pt.due_date || '—'}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">{pt.status}</td>
                            <td className="py-2.5 px-3 text-right">
                              {pt.linked_task_id ? (
                                <button
                                  onClick={() => navigate(`/tasks/${pt.linked_task_id}`)}
                                  className="px-2.5 py-1 text-[11px] font-mono font-bold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 cursor-pointer"
                                >
                                  {pt.linked_task?.task_code || 'Task'} →
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenCreateTaskModal(pt)}
                                  className="px-2.5 py-1 text-[11px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                                >
                                  Create Task
                                </button>
                              )}
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

          {/* TAB 4: CONFIRMED DECISIONS */}
          {activeTab === 'decisions' && (
            <div className="space-y-6">
              {/* Add Decision Form */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Record Formal Decision
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newDecisionTitle}
                      onChange={(e) => setNewDecisionTitle(e.target.value)}
                      placeholder="Decision title or agreed policy..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
                    />
                  </div>
                  <div>
                    <select
                      value={newDecisionImpact}
                      onChange={(e) => setNewDecisionImpact(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
                    >
                      <option value="LOW">LOW Impact</option>
                      <option value="MEDIUM">MEDIUM Impact</option>
                      <option value="HIGH">HIGH Impact</option>
                      <option value="CRITICAL">CRITICAL Impact</option>
                    </select>
                  </div>
                  <div>
                    <button
                      onClick={handleCreateDecision}
                      className="w-full px-3 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Record Decision
                    </button>
                  </div>
                </div>
              </div>

              {/* Decisions List with Explicit Confirmation Gate */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Formal Decisions & Governance Confirmation ({decisions.length})
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-border rounded-lg overflow-hidden">
                    <thead className="bg-muted/50 border-b border-border text-[11px] font-mono uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3">Code</th>
                        <th className="py-2.5 px-3">Decision Statement</th>
                        <th className="py-2.5 px-3">Impact</th>
                        <th className="py-2.5 px-3">Decision Date</th>
                        <th className="py-2.5 px-3">Confirmation Status</th>
                        <th className="py-2.5 px-3 text-right">Gate Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {decisions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-6 text-muted-foreground italic">
                            No formal decisions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        decisions.map(d => (
                          <tr key={d.id} className="hover:bg-muted/20">
                            <td className="py-2.5 px-3 font-mono font-bold text-primary">{d.decision_code}</td>
                            <td className="py-2.5 px-3 font-semibold text-foreground">{d.title}</td>
                            <td className="py-2.5 px-3 font-mono text-[10px]">
                              <span className="px-2 py-0.5 rounded bg-muted font-bold">{d.impact}</span>
                            </td>
                            <td className="py-2.5 px-3 font-mono">{d.decision_date}</td>
                            <td className="py-2.5 px-3">
                              {d.is_confirmed ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" /> CONFIRMED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                  PENDING CONFIRMATION
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleToggleConfirmDecision(d)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                                  d.is_confirmed
                                    ? 'bg-muted hover:bg-muted/80 text-muted-foreground'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                                }`}
                              >
                                {d.is_confirmed ? 'Revoke Confirmation' : 'Confirm Decision'}
                              </button>
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

          {/* TAB 5: MINUTES OF MEETING (MOM) REVIEW & CONFIRMATION */}
          {activeTab === 'minutes' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* 1. MOM Action Control Bar */}
              <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
                {/* Header Info */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                  </div>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                        Minutes of Meeting (MOM)
                      </h3>
                      <span
                        className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                          meeting.mom_status === 'CONFIRMED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {meeting.mom_status === 'CONFIRMED' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>MOM CONFIRMED & APPROVED</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                            <span>DRAFT IN REVIEW</span>
                          </>
                        )}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground whitespace-nowrap shrink-0 border border-border/60">
                        18 Enterprise Sections
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Deterministic executive record compiled from saved notes, structured points, confirmed decisions, and assigned tasks.
                    </p>
                  </div>
                </div>

                {/* Dedicated Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60 bg-muted/20 -mx-5 -mb-5 p-4 rounded-b-2xl">
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Compliance: <strong className="text-foreground">{meeting.mom_status === 'CONFIRMED' ? 'Formally Approved' : 'Draft Review Active'}</strong></span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleGenerateMOM}
                      disabled={isGeneratingMOM}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-all hover:border-border/80 shadow-xs"
                      title="Re-run deterministic synthesis of MOM"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-primary ${isGeneratingMOM ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingMOM ? 'Synthesizing...' : 'Re-Generate Draft'}</span>
                    </button>

                    <button
                      onClick={handleExportMinutes}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-all hover:border-border/80 shadow-xs"
                      title="Export 7-sheet Microsoft Excel Workbook"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
                      <span>Download Excel (.xlsx)</span>
                    </button>

                    {meeting.mom_status !== 'CONFIRMED' ? (
                      <button
                        onClick={handleConfirmMOM}
                        disabled={isConfirmingMOM || !momDraft}
                        className="px-4 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-600 text-white flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-[0.98]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isConfirmingMOM ? 'Confirming...' : 'Confirm & Sign MOM'}</span>
                      </button>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Signed Off & Approved</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {momSaveSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 font-semibold flex items-center gap-2 animate-in fade-in">
                  <Check className="w-4 h-4" /> MOM Draft regenerated and loaded successfully!
                </div>
              )}

              {/* 18-Section MOM Viewer & Editor */}
              {momDraft ? (
                <div className="space-y-6">

                  {/* 2. Executive Document Letterhead & Session Specs */}
                  <div className="rounded-2xl bg-card border border-border/80 shadow-sm overflow-hidden">
                    <div className="h-1.5 w-full bg-gradient-to-r from-primary via-purple-500 to-emerald-500" />
                    
                    <div className="p-5 sm:p-6 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/60 pb-5">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25">
                              {momDraft.section_01_meeting_title_and_reference?.meeting_reference || meeting.meeting_code}
                            </span>
                            <span className="text-xs px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                              {momDraft.section_01_meeting_title_and_reference?.meeting_type || meeting.meeting_type}
                            </span>
                            {meeting.location_or_link && (
                              <span className="text-xs px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                                {getConferencingBadge(meeting.location_or_link).label}
                              </span>
                            )}
                          </div>
                          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight pt-1">
                            {momDraft.section_01_meeting_title_and_reference?.title || meeting.title}
                          </h2>
                        </div>

                        {formatDurationBetween(meeting.actual_start_time, meeting.actual_end_time) && (
                          <div className="sm:text-right shrink-0 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">Session Duration</div>
                            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5 flex items-center sm:justify-end gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{formatDurationBetween(meeting.actual_start_time, meeting.actual_end_time)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4-Column Structured Metadata Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-primary" /> Date & Schedule
                          </div>
                          <div className="text-xs font-bold text-foreground">
                            {formatDisplayDate(momDraft.section_02_datetime_and_timezone?.date || meeting.meeting_date)}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            {formatDisplayTime(meeting.meeting_time)} – {formatDisplayTime(meeting.end_time || '')}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-400" /> Actual Runtime
                          </div>
                          <div className="text-xs font-mono font-semibold text-foreground">
                            Start: {formatDisplayTime(meeting.actual_start_time)}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground">
                            End: {formatDisplayTime(meeting.actual_end_time)}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-purple-400" /> Presiding Organizer
                          </div>
                          <div className="text-xs font-bold text-foreground truncate">
                            {momDraft.section_03_attendance_and_participants?.organizer || (meeting.organizer ? `${meeting.organizer.first_name} ${meeting.organizer.last_name}` : 'Platform Organizer')}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {meeting.department?.name || 'Business Development'}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> Account & Opportunity
                          </div>
                          <div className="text-xs font-bold text-foreground truncate">
                            {momDraft.section_03_attendance_and_participants?.customer || meeting.customer?.name || 'Internal Team'}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {meeting.opportunity?.title || meeting.rfq?.rfq_number || 'General Business'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Executive Metrics Overview Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Formal Decisions</div>
                        <div className="text-xl font-black font-mono text-emerald-400 mt-1">
                          {momDraft.section_09_confirmed_decisions?.length || decisions.length}
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Committed Tasks</div>
                        <div className="text-xl font-black font-mono text-amber-400 mt-1">
                          {momDraft.section_10_action_items?.length || points.filter(p => p.action_required).length}
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Discussion Notes</div>
                        <div className="text-xl font-black font-mono text-primary mt-1">
                          {notes.length}
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex items-center justify-between">
                      <div className="min-w-0 pr-1">
                        <div className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Next Target Date</div>
                        <div className="text-xs font-bold font-mono text-foreground mt-1 truncate">
                          {momDraft.section_17_next_meeting_date ? formatDisplayDate(momDraft.section_17_next_meeting_date) : 'Pending Schedule'}
                        </div>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-blue-400" />
                      </div>
                    </div>
                  </div>

                  {/* 4. Section 6: Executive Summary */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
                          Section 06
                        </span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Executive Summary
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {momDraft.section_06_executive_summary?.length || 0} characters
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={momDraft.section_06_executive_summary || ''}
                      onChange={(e) => setMomDraft({ ...momDraft, section_06_executive_summary: e.target.value })}
                      className="w-full p-3.5 text-xs rounded-xl bg-background border border-border text-foreground leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-sans"
                      placeholder="Executive summary of key takeaways and conclusions..."
                    />
                  </div>

                  {/* 5. Section 7: Discussion by Agenda Item */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25">
                          Section 07
                        </span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Discussion Summary by Agenda Item
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">Structured Notes Stream</span>
                    </div>
                    <textarea
                      rows={5}
                      value={momDraft.section_07_discussion_by_agenda || ''}
                      onChange={(e) => setMomDraft({ ...momDraft, section_07_discussion_by_agenda: e.target.value })}
                      className="w-full p-3.5 text-xs rounded-xl bg-background border border-border text-foreground font-mono leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                      placeholder="Detailed agenda discussion points..."
                    />
                  </div>

                  {/* 6. Section 8: Technical and Commercial Findings */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
                          Section 08
                        </span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Technical & Commercial Findings
                        </h3>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">Evaluations & Scope</span>
                    </div>
                    <textarea
                      rows={3}
                      value={momDraft.section_08_technical_and_commercial_findings || ''}
                      onChange={(e) => setMomDraft({ ...momDraft, section_08_technical_and_commercial_findings: e.target.value })}
                      className="w-full p-3.5 text-xs rounded-xl bg-background border border-border text-foreground leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-sans"
                      placeholder="Technical assessment and commercial findings..."
                    />
                  </div>

                  {/* 7. Section 9: Confirmed Formal Decisions */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          Section 09
                        </span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Confirmed Decisions
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                        {momDraft.section_09_confirmed_decisions?.length || 0} Formalized
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {(!momDraft.section_09_confirmed_decisions || momDraft.section_09_confirmed_decisions.length === 0) ? (
                        <div className="p-6 text-center border border-dashed border-border rounded-xl text-muted-foreground italic text-xs">
                          No confirmed decisions recorded for this session.
                        </div>
                      ) : (
                        momDraft.section_09_confirmed_decisions.map((d: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-background border border-border/80 hover:border-border space-y-2 transition-colors">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                                  {d.code}
                                </span>
                                <span className="font-bold text-xs text-foreground">{d.title}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                  d.impact === 'CRITICAL'
                                    ? 'bg-rose-500/15 text-rose-400'
                                    : d.impact === 'HIGH'
                                    ? 'bg-amber-500/15 text-amber-400'
                                    : 'bg-blue-500/15 text-blue-400'
                                }`}>
                                  IMPACT: {d.impact || 'MEDIUM'}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>{d.status || 'CONFIRMED'}</span>
                                </span>
                              </div>
                            </div>
                            {d.rationale && (
                              <p className="text-[11px] text-muted-foreground leading-normal pl-1">
                                <strong className="text-foreground">Rationale:</strong> {d.rationale}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 8. Section 10: Action Items & Accountable Tasks */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          Section 10
                        </span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Action Items & Linked Canonical Tasks
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
                        {momDraft.section_10_action_items?.length || 0} Accountable
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {(!momDraft.section_10_action_items || momDraft.section_10_action_items.length === 0) ? (
                        <div className="p-6 text-center border border-dashed border-border rounded-xl text-muted-foreground italic text-xs">
                          No action items recorded for this session.
                        </div>
                      ) : (
                        momDraft.section_10_action_items.map((act: any, idx: number) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-background border border-border/80 hover:border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10">
                                  {act.code}
                                </span>
                                <span className="font-bold text-xs text-foreground">{act.title}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                <span>Owner: <strong className="text-foreground">{act.owner || 'Unassigned'}</strong></span>
                                <span>Due: <strong className="text-foreground">{formatDisplayDate(act.due_date)}</strong></span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-semibold flex items-center gap-1 border border-border">
                                <CheckSquare className="w-3 h-3 text-primary" />
                                <span>{act.task_reference || 'CANONICAL_TASK'}</span>
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 9. Section 16 & 17: Next Steps & Next Meeting Preparation */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
                            Section 16
                          </span>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Immediate Next Steps
                          </h3>
                        </div>
                        <textarea
                          rows={3}
                          value={momDraft.section_16_next_steps || ''}
                          onChange={(e) => setMomDraft({ ...momDraft, section_16_next_steps: e.target.value })}
                          className="w-full p-3.5 text-xs rounded-xl bg-background border border-border text-foreground leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-sans"
                          placeholder="Key next steps and milestone deadlines..."
                        />
                      </div>

                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
                            Section 17
                          </span>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                            Next Target Meeting Date
                          </h3>
                        </div>
                        <input
                          type="date"
                          value={momDraft.section_17_next_meeting_date || ''}
                          onChange={(e) => setMomDraft({ ...momDraft, section_17_next_meeting_date: e.target.value })}
                          className="w-full p-3 text-xs rounded-xl bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                          style={{ colorScheme: 'dark' }}
                        />
                        {/* Quick Presets */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-muted-foreground font-semibold">Quick Set:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 7);
                              setMomDraft({ ...momDraft, section_17_next_meeting_date: d.toISOString().split('T')[0] });
                            }}
                            className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors cursor-pointer"
                          >
                            +1 Wk
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 14);
                              setMomDraft({ ...momDraft, section_17_next_meeting_date: d.toISOString().split('T')[0] });
                            }}
                            className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors cursor-pointer"
                          >
                            +2 Wks
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date();
                              d.setDate(d.getDate() + 30);
                              setMomDraft({ ...momDraft, section_17_next_meeting_date: d.toISOString().split('T')[0] });
                            }}
                            className="px-2 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors cursor-pointer"
                          >
                            +1 Mo
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 10. Section 18: Official Audit Trail & Digital Certificate */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-muted/15 border border-border/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Generated Deterministically by: <strong className="text-foreground">{momDraft.section_18_source_and_generation_metadata?.generated_by || 'BDIQ Enterprise Platform'}</strong>
                      </span>
                    </div>
                    <div className="font-mono text-[11px] sm:text-right">
                      Audit Timestamp: <strong className="text-foreground">{formatDisplayDate(momDraft.section_18_source_and_generation_metadata?.generated_at)} {formatDisplayTime(momDraft.section_18_source_and_generation_metadata?.generated_at)}</strong>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-12 text-center border border-dashed border-border/80 rounded-2xl text-muted-foreground text-xs space-y-4 bg-muted/5">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary shadow-sm">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Official Minutes of Meeting Not Yet Compiled</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                      Click below to deterministically compile the official 18 enterprise sections from this session's saved notes, confirmed decisions, and assigned tasks.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateMOM}
                    disabled={isGeneratingMOM}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-md transition-all active:scale-[0.98] inline-flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingMOM ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingMOM ? 'Synthesizing...' : 'Generate 18-Section MOM Now'}</span>
                  </button>
                </div>
              )}

            </div>
          )}

          {/* TAB 6: CONFERENCING & TRANSCRIPT IMPORT */}
          {activeTab === 'transcript' && (
            <div className="space-y-6">
              {/* Conferencing Policy Notice */}
              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Conferencing Integration & Audio Recording Policy
                  </h3>
                </div>
                <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                  <p>
                    BDIQ launches conferencing directly into your external application (Microsoft Teams, Zoom, Google Meet) via secure HTTPS URL.
                  </p>
                  <p>
                    Audio and video recording is performed natively within the conferencing provider client under your organisation's enterprise licenses and consent policies. BDIQ does not intercept raw audio/video streams without dedicated Microsoft Graph / Zoom App tenant credentials.
                  </p>
                  <p className="font-semibold text-foreground">
                    Current Central Audio Recording Status: <span className="font-mono text-amber-500">NOT_CONFIGURED</span>
                  </p>
                </div>
              </div>

              {/* Paste / Import Transcript */}
              <div className="p-5 rounded-xl bg-card border border-border shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Authorised Meeting Transcript Import
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Paste or upload the official transcript from your Teams/Zoom/Meet meeting. The transcript will be parsed during Minutes of Meeting (MOM) draft generation.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveTranscript}
                    disabled={isSavingTranscript}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {isSavingTranscript ? 'Saving...' : 'Save Transcript'}
                  </button>
                </div>

                <textarea
                  rows={10}
                  value={transcriptInput}
                  onChange={(e) => setTranscriptInput(e.target.value)}
                  placeholder="Paste meeting transcript here... (e.g. [00:02:15] Speaker 1: We have confirmed the formulation feasibility...)"
                  className="w-full p-3 text-xs rounded-lg bg-background border border-border text-foreground font-mono leading-relaxed resize-y"
                />
              </div>
            </div>
          )}
        </main>

        {/* 3. Live Mini Notes Collapsible Side Panel */}
        <aside
          className={`relative border-l border-border bg-card transition-all duration-300 ease-in-out flex flex-col shrink-0 ${
            sidePanelOpen ? 'w-80 md:w-96' : 'w-12'
          }`}
        >
          {/* Header */}
          <div className="h-12 px-3 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
            {sidePanelOpen && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Mini Notes
                </span>
                <button
                  onClick={handleOpenQuickTaskDirect}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Quick create a task linked to this meeting"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>+ Task</span>
                </button>
                <button
                  onClick={handleOpenCompanionWindow}
                  className="p-1 rounded text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  title="Pop out Live Notes Companion Sidecar window beside Google Meet / Teams"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={() => setSidePanelOpen(prev => !prev)}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted ml-auto cursor-pointer"
              title={sidePanelOpen ? 'Collapse Notes Panel' : 'Expand Notes Panel'}
            >
              {sidePanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {sidePanelOpen && (
            <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4">
              {/* Note Entry Area */}
              <div className="space-y-2 shrink-0">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                  <span>Fast capture (Enter to submit)</span>
                  {noteSavedStatus === 'saving' && <span className="text-amber-500 font-bold">Saving...</span>}
                  {noteSavedStatus === 'saved' && <span className="text-emerald-500 font-bold">✓ Saved</span>}
                  {noteSavedStatus === 'error' && <span className="text-rose-500 font-bold">Failed</span>}
                </div>

                <textarea
                  rows={3}
                  value={noteContent}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveNote();
                    }
                  }}
                  placeholder="e.g. R&D will confirm formulation feasibility by 15 October."
                  className="w-full p-2.5 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground resize-none leading-relaxed"
                />

                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value)}
                    className="px-2 py-1 text-[11px] rounded bg-background border border-border text-foreground"
                  >
                    <option value="DISCUSSION">Discussion</option>
                    <option value="TASK">⚡ Task (BDIQ Task)</option>
                    <option value="ACTION">Action Item</option>
                    <option value="DECISION">Decision</option>
                    <option value="RISK">Risk</option>
                    <option value="QUESTION">Question</option>
                    <option value="COMMITMENT">Commitment</option>
                    <option value="FOLLOW_UP">Follow-up</option>
                    <option value="GENERAL">General Info</option>
                  </select>

                  <input
                    type="text"
                    value={noteSpeaker}
                    onChange={(e) => setNoteSpeaker(e.target.value)}
                    placeholder="Speaker / Dept (optional)"
                    className="px-2 py-1 text-[11px] rounded bg-background border border-border text-foreground"
                  />
                </div>

                <button
                  onClick={handleSaveNote}
                  className="w-full py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
                >
                  Save Note
                </button>
              </div>

              {/* Quick AI/Rule Suggestion Box */}
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
                    className="w-full mt-1 px-2 py-1 text-[11px] font-bold rounded bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Convert to Action Point & Task
                  </button>
                </div>
              )}

              {/* Notes Stream */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Session Notes Stream ({notes.length})
                </div>
                {notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-6">
                    No notes recorded yet.
                  </p>
                ) : (
                  notes.map(n => (
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

      {/* 4. MODALS */}

      {/* Edit Conferencing Link Modal */}
      {editLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                Conferencing Meeting Link
              </h3>
              <button onClick={() => setEditLinkModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Provide a valid HTTPS link for Microsoft Teams, Zoom, or Google Meet. BDIQ validates and opens this link on Start Meeting.
            </p>
            <input
              type="text"
              value={newLinkValue}
              onChange={(e) => setNewLinkValue(e.target.value)}
              placeholder="https://teams.microsoft.com/l/meetup-join/..."
              className="w-full px-3 py-2 text-xs rounded-lg bg-background border border-border text-foreground font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditLinkModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConferencingLink}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer shadow-xs"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Live Session Confirmation Modal */}
      {endSessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <Square className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Finish BDIQ Live Session?</h3>
                <p className="text-xs text-muted-foreground">
                  This will record the session end time, preserve all captured notes, and transition to Minutes of Meeting (MOM) review.
                </p>
              </div>
            </div>

            {/* Session Recap Summary */}
            <div className="p-3.5 rounded-lg bg-muted/30 border border-border text-xs space-y-2">
              <div className="font-mono text-[10px] uppercase font-bold text-muted-foreground">Session Recap</div>
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div>Notes Captured: <strong className="text-foreground">{notes.length}</strong></div>
                <div>Structured Points: <strong className="text-foreground">{points.length}</strong></div>
                <div>Decisions Recorded: <strong className="text-foreground">{decisions.length}</strong></div>
                <div>Action Items: <strong className="text-foreground">{points.filter(p => p.action_required).length}</strong></div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEndSessionModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground cursor-pointer"
              >
                Continue Live Session
              </button>
              <button
                onClick={handleConfirmEndSession}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shadow-xs"
              >
                Confirm & End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert Point to Canonical Task Modal */}
      {taskModalPoint && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                Create Task in Canonical Task Management
              </h3>
              <button onClick={() => setTaskModalPoint(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-muted-foreground uppercase font-bold">Task Title</label>
                <input
                  type="text"
                  value={taskFormTitle}
                  onChange={(e) => setTaskFormTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground font-semibold"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-muted-foreground uppercase font-bold">Description</label>
                <textarea
                  rows={3}
                  value={taskFormDesc}
                  onChange={(e) => setTaskFormDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-muted-foreground uppercase font-bold">Priority</label>
                  <select
                    value={taskFormPriority}
                    onChange={(e) => setTaskFormPriority(e.target.value as any)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground font-mono"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-muted-foreground uppercase font-bold">Due Date</label>
                  <input
                    type="date"
                    value={taskFormDueDate}
                    onChange={(e) => setTaskFormDueDate(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-muted-foreground uppercase font-bold">Department</label>
                  <select
                    value={taskFormDepartment}
                    onChange={(e) => setTaskFormDepartment(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
                  >
                    <option value="">Select Responsible Department...</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-muted-foreground uppercase font-bold">Assignee / Owner</label>
                  <select
                    value={taskFormAssignee}
                    onChange={(e) => setTaskFormAssignee(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground"
                  >
                    <option value="">Auto-Assign / Select Member...</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name || u.name ? `${u.first_name || u.name} ${u.last_name || ''}` : u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/20 border border-border/80 text-[11px] text-muted-foreground font-mono space-y-1">
                <div>Source Point: <strong className="text-foreground">{taskModalPoint.point_code}</strong> | Meeting: <strong className="text-foreground">{meeting.meeting_code}</strong></div>
                {taskModalPoint.agenda_item && <div>Agenda Item: <strong className="text-foreground">{taskModalPoint.agenda_item}</strong></div>}
                {(meeting.customer || meeting.opportunity || meeting.rfq || meeting.external_organizations) && (
                  <div>
                    Scope: <strong className="text-foreground">{meeting.customer?.name || meeting.external_organizations || 'Client'}</strong>
                    {meeting.opportunity && <span> — <strong className="text-foreground">{meeting.opportunity.title}</strong></span>}
                    {meeting.rfq && <span> (RFQ: {meeting.rfq.rfq_number})</span>}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setTaskModalPoint(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitTaskFromPoint}
                disabled={isCreatingTask || !taskFormTitle.trim()}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                {isCreatingTask ? 'Creating Task...' : 'Create & Link Task'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          notifyMeetingChange(id!, updated?.status || 'COMPLETED');
          loadMeetingData();
        }}
      />
    </div>
  );
}
