import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Clock,
  Sparkles,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  CheckSquare,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Trash2,
  Check,
  Save,
  HelpCircle,
  Square,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { meetingApi } from '@/services/meeting.api';
import { MeetingClosureWizardModal } from '@/components/meetings/MeetingClosureWizardModal';
import type { MeetingPoint, MeetingDecision, MeetingNote } from '@/types/meeting';

interface AISuggestedAction {
  id: string;
  title: string;
  description?: string;
  suggestedOwner?: string;
  suggestedDepartment?: string;
  suggestedDueDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  status: 'PROPOSED' | 'APPROVED' | 'DISCARDED';
  is_ai_suggested: boolean;
  sourceSnippet?: string;
  isEditing?: boolean;
}

interface AISuggestedDecision {
  id: string;
  title: string;
  rationale: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  is_ai_suggested: boolean;
  status: 'PROPOSED' | 'CONFIRMED' | 'DISCARDED';
  sourceSnippet?: string;
  isEditing?: boolean;
}

export default function MeetingCompanion() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.access_token || localStorage.getItem('token') || 'dev-admin-token';

  // Core Data
  const [meeting, setMeeting] = useState<any>(null);
  const [previousMeeting, setPreviousMeeting] = useState<any>(null);
  const [unresolvedPoints, setUnresolvedPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Notes & Autosave
  const [notesContent, setNotesContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const saveTimeoutRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasInitializedNotesRef = useRef(false);

  // Live Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Copilot Live Query Bar
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotAnswer, setCopilotAnswer] = useState<{
    query: string;
    answer: string;
    citations: string[];
    suggestedFollowUps: string[];
  } | null>(null);

  // AI Intelligence Results
  const [isGeneratingIntel, setIsGeneratingIntel] = useState(false);
  const [activeIntelTab, setActiveIntelTab] = useState<'ACTIONS' | 'DECISIONS' | 'SUMMARY' | 'QUESTIONS'>('ACTIONS');
  const [executiveSummary, setExecutiveSummary] = useState<string>('');
  const [agendaDiscussions, setAgendaDiscussions] = useState<any[]>([]);
  const [suggestedActions, setSuggestedActions] = useState<AISuggestedAction[]>([]);
  const [suggestedDecisions, setSuggestedDecisions] = useState<AISuggestedDecision[]>([]);
  const [identifiedRisks, setIdentifiedRisks] = useState<any[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Panels & Drawers
  const [showHistory, setShowHistory] = useState(false);
  const [showClosureChecklist, setShowClosureChecklist] = useState(false);
  const [showClosureWizard, setShowClosureWizard] = useState(false);
  const [points, setPoints] = useState<MeetingPoint[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [rawNotes, setRawNotes] = useState<MeetingNote[]>([]);
  const [quickItemText, setQuickItemText] = useState('');
  const [quickItemType, setQuickItemType] = useState<'POINT' | 'DECISION' | 'ACTION' | 'RISK' | 'TASK'>('ACTION');

  // Quick Task Modal State
  const [showQuickTaskModal, setShowQuickTaskModal] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskDesc, setQuickTaskDesc] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [quickTaskDueDate, setQuickTaskDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [quickTaskDept, setQuickTaskDept] = useState('');
  const [quickTaskAssignee, setQuickTaskAssignee] = useState('');
  const [quickTaskLogToNotes, setQuickTaskLogToNotes] = useState(true);
  const [isSubmittingQuickTask, setIsSubmittingQuickTask] = useState(false);
  const [quickTaskSuccessBanner, setQuickTaskSuccessBanner] = useState<string | null>(null);

  // Organization Directory Data
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Auto-close countdown state for completed meeting
  const [closingCountdown, setClosingCountdown] = useState<number | null>(null);

  // Return to BDIQ platform and automatically close this companion window
  const returnToPlatformAndClose = useCallback((targetTab: string = 'minutes') => {
    if (!id) return;
    const platformUrl = `/meetings/${id}?tab=${targetTab}`;

    // 1. Broadcast to any open platform tabs to switch directly to targetTab
    try {
      const bc = new BroadcastChannel('bdiq_meeting_events');
      bc.postMessage({
        meetingId: id,
        action: 'SWITCH_TAB',
        tab: targetTab,
        status: 'COMPLETED',
        timestamp: Date.now()
      });
      bc.close();
    } catch {}
    localStorage.setItem(
      'bdiq_meeting_updated',
      JSON.stringify({ meetingId: id, action: 'SWITCH_TAB', tab: targetTab, status: 'COMPLETED', timestamp: Date.now() })
    );

    // 2. If opener exists and is alive, navigate opener and focus it
    let openerNavigated = false;
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.location.href = platformUrl;
        window.opener.focus();
        openerNavigated = true;
      } catch (e) {
        console.warn('Could not navigate opener directly:', e);
      }
    }

    // 3. If opener was not available, open the platform in a new tab
    if (!openerNavigated) {
      try {
        window.open(platformUrl, '_blank');
      } catch {}
    }

    // 4. Automatically close this companion window
    setTimeout(() => {
      try {
        window.close();
      } catch (e) {
        console.warn('window.close() prevented:', e);
      }
      // 5. Fallback: if browser blocks window.close() (e.g. opened directly), redirect this window to platform
      setTimeout(() => {
        navigate(platformUrl);
      }, 250);
    }, 150);
  }, [id, navigate]);

  // Open full BDIQ minutes tab & notify main window
  const handleOpenFullMOMTab = useCallback(() => {
    returnToPlatformAndClose('minutes');
  }, [returnToPlatformAndClose]);

  // Auto-close companion and open platform when meeting is COMPLETED
  useEffect(() => {
    if (meeting?.status === 'COMPLETED') {
      setClosingCountdown(2);
      const countdownInterval = setInterval(() => {
        setClosingCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const closeTimer = setTimeout(() => {
        returnToPlatformAndClose('minutes');
      }, 2000);

      return () => {
        clearInterval(countdownInterval);
        clearTimeout(closeTimer);
      };
    }
  }, [meeting?.status, returnToPlatformAndClose]);

  // Load Meeting Workspace
  const loadMeetingData = useCallback(async (isSilent = false) => {
    if (!id) return;
    if (!isSilent) setLoading(true);
    try {
      const meet = await meetingApi.getMeeting(id, token);
      setMeeting(meet);

      // Load points, decisions, and raw notes for closure reconciler
      const [ptsRes, decsRes, ntsRes] = await Promise.allSettled([
        meetingApi.getMeetingPoints(id, token),
        meetingApi.getDecisions(id, token),
        meetingApi.getNotes(id, token)
      ]);
      if (ptsRes.status === 'fulfilled') setPoints(ptsRes.value || []);
      if (decsRes.status === 'fulfilled') setDecisions(decsRes.value || []);
      if (ntsRes.status === 'fulfilled') {
        const nList = ntsRes.value || [];
        setRawNotes(nList);
        if (!hasInitializedNotesRef.current && nList.length > 0) {
          const combined = nList.map((n: any) => n.content).join('\n\n');
          setNotesContent(combined);
          hasInitializedNotesRef.current = true;
        }
      }

      // If linked previous meeting, load context
      if (meet.previous_meeting_id) {
        try {
          const prev = await meetingApi.getMeeting(meet.previous_meeting_id, token);
          setPreviousMeeting(prev);
          const prevPts = await meetingApi.getMeetingPoints(meet.previous_meeting_id, token);
          setUnresolvedPoints((prevPts || []).filter((p: any) => p.status !== 'RESOLVED' && p.status !== 'CANCELLED'));
        } catch {}
      }

      // Fetch directory lookups silently
      fetch('http://localhost:4000/api/departments', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setDepartments(Array.isArray(d) ? d : d.data || []))
        .catch(() => {});

      fetch('http://localhost:4000/api/users', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(u => setUsers(Array.isArray(u) ? u : u.data || []))
        .catch(() => {});
    } catch (err) {
      console.error('Failed to load companion meeting workspace:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadMeetingData();
  }, [loadMeetingData]);

  // Cross-tab Synchronization
  useEffect(() => {
    if (!id) return;

    // 1. BroadcastChannel listener
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('bdiq_meeting_events');
      bc.onmessage = (event) => {
        if (event.data?.meetingId === id) {
          loadMeetingData(true);
        }
      };
    } catch {}

    // 2. Storage event listener fallback
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'bdiq_meeting_updated' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.meetingId === id) {
            loadMeetingData(true);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Periodic Poll every 3.5s to catch status changes in real time
    const pollInterval = setInterval(() => {
      loadMeetingData(true);
    }, 3500);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollInterval);
    };
  }, [id, loadMeetingData]);

  // Stopwatch Timer (Strictly status-aware)
  useEffect(() => {
    if (!meeting) return;

    if (meeting.status === 'IN_PROGRESS') {
      const startMs = meeting.actual_start_time ? new Date(meeting.actual_start_time).getTime() : Date.now();
      const updateTimer = () => {
        const diff = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        setElapsedSeconds(diff);
      };
      updateTimer();
      const timer = setInterval(updateTimer, 1000);
      return () => clearInterval(timer);
    } else if (meeting.actual_start_time && meeting.actual_end_time) {
      // Concluded meeting - calculate static duration
      const total = Math.max(0, Math.floor((new Date(meeting.actual_end_time).getTime() - new Date(meeting.actual_start_time).getTime()) / 1000));
      setElapsedSeconds(total);
    } else {
      setElapsedSeconds(0);
    }
  }, [meeting?.status, meeting?.actual_start_time, meeting?.actual_end_time]);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Debounced Autosave for Notes
  const handleNotesChange = (newText: string) => {
    setNotesContent(newText);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      await saveNotesToServer(newText);
    }, 1500);
  };

  const saveNotesToServer = async (contentToSave = notesContent) => {
    if (!id) return;
    setSaveStatus('saving');
    try {
      await meetingApi.createNote(
        id,
        {
          content: contentToSave || 'Meeting Notes',
          note_type: 'NOTE',
        },
        token
      );
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      setSaveStatus('failed');
    }
  };

  // Insert Quick Tag at cursor
  const handleInsertTag = (tag: string) => {
    const tagPrefix = `• [${tag}] `;
    const updated = notesContent ? `${notesContent}\n${tagPrefix}` : tagPrefix;
    setNotesContent(updated);
    handleNotesChange(updated);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Direct Quick Task Creation (Point + Task + Note Bullet)
  const handleCreateQuickTask = async (customPayload?: {
    title: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    dueDate?: string;
    departmentId?: string;
    assignedUserId?: string;
    logToNotes?: boolean;
  }) => {
    const title = (customPayload ? customPayload.title : quickTaskTitle).trim();
    if (!title || !id) return;
    setIsSubmittingQuickTask(true);
    try {
      const priority = customPayload?.priority || quickTaskPriority;
      const dueDate = customPayload?.dueDate || quickTaskDueDate;
      const deptId = customPayload?.departmentId || quickTaskDept || undefined;
      const assigneeId = customPayload?.assignedUserId || quickTaskAssignee || undefined;
      const logToNotes = customPayload?.logToNotes !== undefined ? customPayload.logToNotes : quickTaskLogToNotes;

      // 1. Create meeting point with action_required: true
      const pt = await meetingApi.createMeetingPoint(
        id,
        {
          title,
          description: quickTaskDesc.trim() || `Action task originating from live meeting ${meeting?.meeting_code || ''}`,
          category: 'ACTION',
          action_required: true,
          priority,
          due_date: dueDate || null,
          department_id: deptId || null,
          assigned_user_id: assigneeId || null
        },
        token
      );

      // 2. Convert directly to canonical BDIQ task
      const createdTask = await meetingApi.convertPointToTask(
        pt.id,
        {
          title,
          description: quickTaskDesc.trim() || `Action task originating from live meeting ${meeting?.meeting_code || ''}`,
          priority,
          due_date: dueDate,
          department_id: deptId,
          assigned_user_id: assigneeId
        },
        token
      );

      // 3. Append to live notes if enabled
      if (logToNotes) {
        const codeStr = createdTask?.task_code ? ` [${createdTask.task_code}]` : '';
        const dueStr = dueDate ? ` (Due: ${dueDate}, Priority: ${priority})` : ` (${priority})`;
        const line = `• [TASK${codeStr}] ${title}${dueStr}`;
        const updatedNotes = notesContent ? `${notesContent}\n${line}` : line;
        setNotesContent(updatedNotes);
        await saveNotesToServer(updatedNotes);
      }

      // 4. Update suggested actions in intelligence tab
      setSuggestedActions(prev => [
        {
          id: pt.id,
          title,
          priority,
          suggestedDueDate: dueDate,
          confidence: 100,
          status: 'APPROVED',
          is_ai_suggested: false
        },
        ...prev
      ]);

      // 5. Notify other tabs
      try {
        const bc = new BroadcastChannel('bdiq_meeting_events');
        bc.postMessage({ meetingId: id, type: 'TASK_CREATED', timestamp: Date.now() });
        bc.close();
      } catch {}
      localStorage.setItem('bdiq_meeting_updated', JSON.stringify({ meetingId: id, timestamp: Date.now() }));

      // Reset and close modal
      setQuickTaskTitle('');
      setQuickTaskDesc('');
      setShowQuickTaskModal(false);
      const msg = `Task ${createdTask?.task_code || ''} created & linked to ${meeting?.meeting_code || 'meeting'}!`;
      setQuickTaskSuccessBanner(msg);
      setTimeout(() => setQuickTaskSuccessBanner(null), 4500);
    } catch (err: any) {
      alert(`Failed to create task: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingQuickTask(false);
    }
  };

  // Quick Capture Form Submit
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItemText.trim() || !id) return;

    try {
      if (quickItemType === 'TASK') {
        await handleCreateQuickTask({
          title: quickItemText.trim(),
          priority: 'MEDIUM',
          logToNotes: true
        });
        setQuickItemText('');
        return;
      }

      if (quickItemType === 'DECISION') {
        await meetingApi.createDecision(
          id,
          {
            title: quickItemText.trim(),
            description: quickItemText.trim(),
            impact: 'MEDIUM',
            decision_date: new Date().toISOString().split('T')[0]
          },
          token
        );
      } else {
        const categoryMap: Record<string, any> = {
          POINT: 'DISCUSSION',
          ACTION: 'ACTION',
          RISK: 'RISK'
        };
        await meetingApi.createMeetingPoint(
          id,
          {
            title: quickItemText.trim(),
            category: categoryMap[quickItemType] || 'DISCUSSION',
            action_required: quickItemType === 'ACTION',
            priority: quickItemType === 'RISK' ? 'HIGH' : 'MEDIUM'
          },
          token
        );
      }

      // Append to notes
      const line = `• [${quickItemType}] ${quickItemText.trim()}`;
      const updated = notesContent ? `${notesContent}\n${line}` : line;
      setNotesContent(updated);
      setQuickItemText('');
      await saveNotesToServer(updated);
    } catch (err) {
      console.error('Failed to quick add item:', err);
    }
  };

  // Run AI Meeting Intelligence
  const handleTriggerAI = async (action: 'FULL_INTELLIGENCE' | 'EXTRACT_ACTIONS' | 'EXTRACT_DECISIONS' | 'SUMMARIZE' | 'SUGGEST_QUESTIONS') => {
    if (!id) return;
    setIsGeneratingIntel(true);
    try {
      const result = await meetingApi.generateAIMeetingIntelligence(
        id,
        {
          action,
          liveNotesContent: notesContent
        },
        token
      );

      if (result.executiveSummary) setExecutiveSummary(result.executiveSummary);
      if (result.agendaDiscussions) setAgendaDiscussions(result.agendaDiscussions);
      if (result.suggestedActionItems) setSuggestedActions(result.suggestedActionItems);
      if (result.suggestedDecisions) setSuggestedDecisions(result.suggestedDecisions);
      if (result.identifiedRisks) setIdentifiedRisks(result.identifiedRisks);
      if (result.suggestedQuestions) setSuggestedQuestions(result.suggestedQuestions);

      if (action === 'EXTRACT_ACTIONS') setActiveIntelTab('ACTIONS');
      else if (action === 'EXTRACT_DECISIONS') setActiveIntelTab('DECISIONS');
      else if (action === 'SUMMARIZE') setActiveIntelTab('SUMMARY');
      else if (action === 'SUGGEST_QUESTIONS') setActiveIntelTab('QUESTIONS');
    } catch (err: any) {
      alert(`AI Copilot analysis error: ${err.message || 'Check AI configurations'}`);
    } finally {
      setIsGeneratingIntel(false);
    }
  };

  // Ask Copilot query
  const handleAskCopilot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotQuery.trim() || !id) return;
    setCopilotLoading(true);
    try {
      const res = await meetingApi.queryCopilot(id, copilotQuery.trim(), token);
      setCopilotAnswer(res);
      setCopilotQuery('');
    } catch (err: any) {
      alert(`Copilot query error: ${err.message || 'Unable to execute query'}`);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Approve & Convert Action to Task (Deduplicated)
  const handleApproveAction = async (action: AISuggestedAction) => {
    if (!id) return;
    try {
      await meetingApi.applyAISuggestions(
        id,
        {
          points: [
            {
              title: action.title,
              category: 'ACTION',
              priority: action.priority,
              due_date: action.suggestedDueDate,
              create_task: true,
            }
          ]
        },
        token
      );

      setSuggestedActions(prev =>
        prev.map(a => (a.id === action.id ? { ...a, status: 'APPROVED' } : a))
      );
    } catch (err: any) {
      alert(`Failed to approve action: ${err.message}`);
    }
  };

  // Discard Action
  const handleDiscardAction = (actionId: string) => {
    setSuggestedActions(prev => prev.filter(a => a.id !== actionId));
  };

  // Confirm Decision
  const handleConfirmDecision = async (decision: AISuggestedDecision) => {
    if (!id) return;
    try {
      await meetingApi.applyAISuggestions(
        id,
        {
          decisions: [
            {
              title: decision.title,
              rationale: decision.rationale,
              impact: decision.impact
            }
          ]
        },
        token
      );

      setSuggestedDecisions(prev =>
        prev.map(d => (d.id === decision.id ? { ...d, status: 'CONFIRMED' } : d))
      );
    } catch (err: any) {
      alert(`Failed to confirm decision: ${err.message}`);
    }
  };

  // Discard Decision
  const handleDiscardDecision = (decisionId: string) => {
    setSuggestedDecisions(prev => prev.filter(d => d.id !== decisionId));
  };

  // Insert Previous Point into Notes
  const handleInsertPrevPoint = (p: any) => {
    const text = `• [Carried-Forward: ${p.point_code}] ${p.title}`;
    const updated = notesContent ? `${notesContent}\n${text}` : text;
    setNotesContent(updated);
    handleNotesChange(updated);
  };

  // End Session & Proceed to MOM
  const handleFinishSession = async () => {
    if (!id) return;
    const confirmFinish = window.confirm(
      'Are you sure you want to conclude the live session?\n\nThis will record the finish time, save all notes, and transition to Minutes of Meeting (MOM) review.'
    );
    if (!confirmFinish) return;

    try {
      await saveNotesToServer();
      const ended = await meetingApi.endMeeting(id, token);
      const newStatus = ended?.status || 'AWAITING_MOM_REVIEW';
      const endTime = ended?.actual_end_time || new Date().toISOString();

      setMeeting((prev: any) => ({
        ...prev,
        status: newStatus,
        actual_end_time: endTime
      }));

      // Broadcast to other tabs immediately
      try {
        const bc = new BroadcastChannel('bdiq_meeting_events');
        bc.postMessage({ meetingId: id, status: newStatus, timestamp: Date.now() });
        bc.close();
      } catch {}
      localStorage.setItem('bdiq_meeting_updated', JSON.stringify({ meetingId: id, status: newStatus, timestamp: Date.now() }));

      // Return to platform and close companion automatically
      returnToPlatformAndClose('minutes');
    } catch (err: any) {
      alert(`Failed to finish meeting session: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground text-xs space-y-3 p-4">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        <span className="font-mono tracking-wider">Connecting to BDIQ Live Meeting Sidecar...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans text-xs select-none antialiased">
      {/* ========================================================================= */}
      {/* 1. TOP STICKY COMPANION HEADER                                            */}
      {/* ========================================================================= */}
      <header className="px-3.5 py-2.5 border-b border-border bg-card/90 backdrop-blur-md flex items-center justify-between shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-7 h-7 rounded-lg bg-foreground text-background flex items-center justify-center font-bold shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="truncate">
            <div className="flex items-center gap-1.5">
              {meeting?.status === 'IN_PROGRESS' ? (
                <span className="font-mono font-bold text-[10px] text-red-500 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
                  LIVE
                </span>
              ) : meeting?.status === 'AWAITING_MOM_REVIEW' ? (
                <span className="font-mono font-bold text-[10px] text-purple-400 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <FileCheck2 className="w-2.5 h-2.5 text-purple-400" />
                  AWAITING REVIEW
                </span>
              ) : meeting?.status === 'COMPLETED' ? (
                <span className="font-mono font-bold text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  CONCLUDED
                </span>
              ) : (
                <span className="font-mono font-bold text-[10px] text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded">
                  {meeting?.status || 'SCHEDULED'}
                </span>
              )}
              <span className="font-mono text-[10px] text-muted-foreground truncate">
                {meeting?.meeting_code}
              </span>
            </div>
            <h1 className="font-bold text-xs truncate max-w-[210px] text-foreground" title={meeting?.title}>
              {meeting?.title || 'Live Meeting'}
            </h1>
          </div>
        </div>

        {/* Right Tools & Timer */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${
              meeting?.status === 'IN_PROGRESS'
                ? 'bg-muted border-border text-foreground'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
            title={meeting?.status === 'IN_PROGRESS' ? 'Active Call Duration' : 'Final Session Duration'}
          >
            {meeting?.status === 'IN_PROGRESS' ? (
              <Clock className="w-3 h-3 text-amber-500 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            )}
            {meeting?.status === 'IN_PROGRESS'
              ? formatTimer(elapsedSeconds)
              : elapsedSeconds > 0
              ? `Total: ${formatTimer(elapsedSeconds)}`
              : 'Concluded'}
          </span>

          {meeting?.location_or_link && (
            <button
              onClick={() => window.open(meeting.location_or_link, '_blank', 'noopener,noreferrer')}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Focus / Open Call"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
            </button>
          )}

          <button
            onClick={() => {
              if (window.opener) {
                window.opener.location.href = `/meetings/${id}`;
                window.opener.focus();
              } else {
                window.open(`/meetings/${id}`, '_blank');
              }
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Open Full BDIQ Tab"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {meeting?.status === 'IN_PROGRESS' ? (
            <button
              onClick={handleFinishSession}
              className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1"
              title="Conclude Session & Generate MOM"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Finish</span>
            </button>
          ) : meeting?.status === 'COMPLETED' ? (
            <button
              onClick={() => returnToPlatformAndClose('minutes')}
              className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1 text-[11px]"
              title="Meeting Completed - Return to Platform and Close Sidecar"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Open Platform</span>
            </button>
          ) : (
            <button
              onClick={() => setShowClosureWizard(true)}
              className="px-2.5 py-1 rounded-md bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1 text-[11px]"
              title="Open 2-Step Closure & MOM Reconciler"
            >
              <FileCheck2 className="w-3 h-3" />
              <span>Review MOM</span>
            </button>
          )}
        </div>
      </header>

      {/* Notice Banner: Auto-closing if COMPLETED or Actions if Awaiting MOM */}
      {meeting?.status === 'COMPLETED' ? (
        <div className="px-3.5 py-2.5 bg-emerald-500/20 border-b border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200 shrink-0 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Meeting Completed:</strong> Closing sidecar & returning to platform in {closingCountdown !== null ? `${closingCountdown}s` : '2s'}...
            </span>
          </div>
          <button
            onClick={() => returnToPlatformAndClose('minutes')}
            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer text-[11px] shadow-sm flex items-center gap-1 shrink-0 ml-2"
          >
            <span>Open Platform Now →</span>
          </button>
        </div>
      ) : meeting?.status && meeting.status !== 'IN_PROGRESS' && (
        <div className="px-3.5 py-2.5 bg-purple-500/15 border-b border-purple-500/30 flex items-center justify-between text-xs text-purple-200 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              <strong>Meeting Concluded:</strong> Status is{' '}
              <span className="font-mono uppercase font-bold text-foreground">
                {meeting.status === 'AWAITING_MOM_REVIEW' ? 'Awaiting MOM Review' : meeting.status}
              </span>
              .
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <button
              onClick={() => setShowClosureWizard(true)}
              className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-bold cursor-pointer text-[11px] shadow-sm flex items-center gap-1"
              title="Open 2-Step Closure & MOM Reconciler"
            >
              <FileCheck2 className="w-3 h-3" />
              <span>Reconcile (2-Step)</span>
            </button>
            <button
              onClick={handleOpenFullMOMTab}
              className="underline text-purple-300 hover:text-white cursor-pointer font-bold text-[11px]"
              title="Switch main BDIQ window to Minutes Summary and close companion"
            >
              Open MOM Tab →
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QUICK TAGS & ACTION BAR                                                */}
      {/* ========================================================================= */}
      <div className="px-3 py-2 border-b border-border bg-muted/20 flex items-center justify-between gap-1 overflow-x-auto shrink-0">
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Insert:</span>
          <button
            type="button"
            onClick={() => handleInsertTag('DECISION')}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20 hover:bg-purple-500/20 cursor-pointer"
          >
            + DECISION
          </button>
          <button
            type="button"
            onClick={() => handleInsertTag('ACTION')}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 hover:bg-blue-500/20 cursor-pointer"
          >
            + ACTION
          </button>
          <button
            type="button"
            onClick={() => handleInsertTag('RISK')}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 cursor-pointer"
          >
            + RISK
          </button>
          <button
            type="button"
            onClick={() => handleInsertTag('QUESTION')}
            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 hover:bg-cyan-500/20 cursor-pointer"
          >
            + QUESTION
          </button>

          {/* DEDICATED QUICK TASK BUTTON */}
          <button
            type="button"
            onClick={() => setShowQuickTaskModal(true)}
            className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-1 cursor-pointer shadow-xs transition-colors ml-1"
            title="Create and link an immediate BDIQ task from this meeting"
          >
            <CheckSquare className="w-3 h-3 text-emerald-400" />
            + QUICK TASK
          </button>
        </div>

        {/* Previous meeting toggle */}
        {previousMeeting && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
          >
            <History className="w-3 h-3" />
            <span>Prev Context</span>
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2.1 PREVIOUS MEETING CARRIED CONTEXT ACCORDION                            */}
      {/* ========================================================================= */}
      {showHistory && previousMeeting && (
        <div className="p-3 bg-muted/40 border-b border-border space-y-2 animate-in fade-in shrink-0 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
            <span>Prior Session: {previousMeeting.title}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{previousMeeting.meeting_date}</span>
          </div>
          {previousMeeting.closure_summary && (
            <p className="text-[11px] text-muted-foreground italic bg-card p-2 rounded border border-border">
              "{previousMeeting.closure_summary}"
            </p>
          )}
          {unresolvedPoints.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">Carried Points (Click to add):</span>
              {unresolvedPoints.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleInsertPrevPoint(p)}
                  className="p-1.5 rounded bg-card border border-border hover:border-foreground/40 text-[11px] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="truncate">{p.title}</span>
                  <span className="font-mono text-[9px] px-1 rounded bg-muted text-muted-foreground shrink-0 ml-1">
                    Insert
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE SCROLL CONTAINER                                        */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-border">
        {/* ======================================================================= */}
        {/* 3.1 LIVE NOTES EDITOR SECTION                                           */}
        {/* ======================================================================= */}
        <section className="p-3 space-y-2 flex-1 flex flex-col min-h-[220px]">
          <div className="flex items-center justify-between text-muted-foreground text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Live Notes & Scratchpad</span>
            </div>
            <div className="flex items-center gap-2">
              {saveStatus === 'saving' && (
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[10px] font-mono text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Saved {lastSavedTime}
                </span>
              )}
              {saveStatus === 'failed' && (
                <span className="text-[10px] font-mono text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5" /> Save failed
                </span>
              )}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={notesContent}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder={`Type notes taken live during the meeting here...
• Use quick tags above to label items (+ DECISION, + ACTION, + RISK)
• Everything autosaves seamlessly in the background
• AI Copilot below analyzes these notes in real time`}
            className="flex-1 w-full min-h-[140px] p-3 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:ring-1 focus:ring-foreground leading-relaxed"
          />

          {/* Quick Item Capture Bar */}
          <form onSubmit={handleQuickAdd} className="flex items-center gap-1.5 pt-1">
            <select
              value={quickItemType}
              onChange={e => setQuickItemType(e.target.value as any)}
              className="px-2 py-1.5 rounded-lg border border-border bg-card text-[11px] font-semibold text-foreground focus:outline-none shrink-0"
            >
              <option value="ACTION">Action</option>
              <option value="TASK">⚡ Task (BDIQ Task)</option>
              <option value="DECISION">Decision</option>
              <option value="RISK">Risk</option>
              <option value="POINT">Point</option>
            </select>
            <input
              type="text"
              value={quickItemText}
              onChange={e => setQuickItemText(e.target.value)}
              placeholder="Quick capture commitment or task..."
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!quickItemText.trim()}
              className="p-1.5 rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 transition-all cursor-pointer shrink-0"
              title="Add Point"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowQuickTaskModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0 shadow-xs transition-colors"
              title="Open Quick Task Form with Assignee & Due Date"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Task</span>
            </button>
          </form>

          {/* Quick Task Success Notice */}
          {quickTaskSuccessBanner && (
            <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{quickTaskSuccessBanner}</span>
            </div>
          )}
        </section>

        {/* ======================================================================= */}
        {/* 3.2 LIVE "ASK COPILOT" QUERY BAR                                        */}
        {/* ======================================================================= */}
        <section className="p-3 bg-card/60 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-bold flex items-center gap-1.5 text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Ask Copilot
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">Grounded in Live Notes</span>
          </div>

          <form onSubmit={handleAskCopilot} className="relative flex items-center">
            <input
              type="text"
              value={copilotQuery}
              onChange={e => setCopilotQuery(e.target.value)}
              placeholder="e.g. What did we agree on batch scale?"
              className="w-full pl-3 pr-8 py-2 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground"
            />
            <button
              type="submit"
              disabled={copilotLoading || !copilotQuery.trim()}
              className="absolute right-1.5 p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-40 cursor-pointer"
            >
              {copilotLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>

          {/* Quick Prompts */}
          <div className="flex items-center gap-1 overflow-x-auto text-[10px] pt-0.5">
            {[
              'Summarise notes',
              'What actions were assigned?',
              'List formal decisions',
              'What risks exist?',
            ].map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setCopilotQuery(prompt);
                }}
                className="px-2 py-0.5 rounded-full border border-border hover:bg-muted text-muted-foreground hover:text-foreground whitespace-nowrap cursor-pointer transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Copilot Answer Display */}
          {copilotAnswer && (
            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5 animate-in fade-in">
              <div className="flex items-center justify-between text-[10px] font-mono text-primary font-bold">
                <span>COPILOT ANSWER</span>
                <button
                  onClick={() => setCopilotAnswer(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {copilotAnswer.answer}
              </p>
              {copilotAnswer.citations && copilotAnswer.citations.length > 0 && (
                <div className="pt-1 border-t border-primary/10 text-[10px] text-muted-foreground space-y-0.5">
                  <span className="font-semibold text-foreground">Note Citations:</span>
                  {copilotAnswer.citations.map((c, idx) => (
                    <div key={idx} className="font-mono text-[9px] bg-background/50 p-1 rounded">
                      • {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ======================================================================= */}
        {/* 3.3 AI MEETING INTELLIGENCE SUITE & SUGGESTIONS                         */}
        {/* ======================================================================= */}
        <section className="p-3 space-y-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              AI Intelligence Suite
            </span>
            <button
              type="button"
              disabled={isGeneratingIntel}
              onClick={() => handleTriggerAI('FULL_INTELLIGENCE')}
              className="px-2 py-1 rounded bg-foreground text-background font-bold text-[10px] hover:bg-foreground/90 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1"
            >
              {isGeneratingIntel ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>Analyze All</span>
            </button>
          </div>

          {/* Sub Navigation Buttons */}
          <div className="grid grid-cols-4 gap-1 text-[10px] font-semibold">
            <button
              onClick={() => setActiveIntelTab('ACTIONS')}
              className={`py-1.5 rounded text-center transition-colors cursor-pointer border ${
                activeIntelTab === 'ACTIONS'
                  ? 'bg-foreground text-background font-bold border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              Actions ({suggestedActions.length})
            </button>
            <button
              onClick={() => setActiveIntelTab('DECISIONS')}
              className={`py-1.5 rounded text-center transition-colors cursor-pointer border ${
                activeIntelTab === 'DECISIONS'
                  ? 'bg-foreground text-background font-bold border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              Decisions ({suggestedDecisions.length})
            </button>
            <button
              onClick={() => setActiveIntelTab('SUMMARY')}
              className={`py-1.5 rounded text-center transition-colors cursor-pointer border ${
                activeIntelTab === 'SUMMARY'
                  ? 'bg-foreground text-background font-bold border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveIntelTab('QUESTIONS')}
              className={`py-1.5 rounded text-center transition-colors cursor-pointer border ${
                activeIntelTab === 'QUESTIONS'
                  ? 'bg-foreground text-background font-bold border-foreground'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              Q&A ({suggestedQuestions.length})
            </button>
          </div>

          {/* TAB 1: SUGGESTION-FIRST ACTION ITEMS */}
          {activeIntelTab === 'ACTIONS' && (
            <div className="space-y-2">
              {suggestedActions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center space-y-2">
                  <p className="text-muted-foreground text-xs">No suggested actions extracted yet.</p>
                  <button
                    onClick={() => handleTriggerAI('EXTRACT_ACTIONS')}
                    disabled={isGeneratingIntel}
                    className="px-3 py-1 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-primary" /> Extract Actions from Notes
                  </button>
                </div>
              ) : (
                suggestedActions.map(action => (
                  <div
                    key={action.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      action.status === 'APPROVED'
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-card border-border shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-500/10 text-blue-600">
                            {action.priority}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Due: {action.suggestedDueDate}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-foreground leading-snug">
                          {action.title}
                        </p>
                      </div>

                      {/* Action Status / Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {action.status === 'APPROVED' ? (
                          <span className="font-mono text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Approved & Converted
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApproveAction(action)}
                              className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                              title="Confirm and convert to BDIQ Task"
                            >
                              <CheckSquare className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleDiscardAction(action.id)}
                              className="p-1 rounded text-muted-foreground hover:text-red-500 cursor-pointer"
                              title="Discard suggestion"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: SUGGESTION-FIRST DECISIONS */}
          {activeIntelTab === 'DECISIONS' && (
            <div className="space-y-2">
              {suggestedDecisions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center space-y-2">
                  <p className="text-muted-foreground text-xs">No suggested decisions extracted yet.</p>
                  <button
                    onClick={() => handleTriggerAI('EXTRACT_DECISIONS')}
                    disabled={isGeneratingIntel}
                    className="px-3 py-1 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-primary" /> Extract Decisions from Notes
                  </button>
                </div>
              ) : (
                suggestedDecisions.map(dec => (
                  <div
                    key={dec.id}
                    className={`p-2.5 rounded-xl border transition-all ${
                      dec.status === 'CONFIRMED'
                        ? 'bg-purple-500/5 border-purple-500/30'
                        : 'bg-card border-border shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] px-1.5 py-0.2 rounded font-bold bg-purple-500/10 text-purple-600">
                            {dec.impact} IMPACT
                          </span>
                        </div>
                        <p className="text-xs font-bold text-foreground">{dec.title}</p>
                        <p className="text-[11px] text-muted-foreground">{dec.rationale}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {dec.status === 'CONFIRMED' ? (
                          <span className="font-mono text-[10px] text-purple-600 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3" /> Confirmed
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleConfirmDecision(dec)}
                              className="px-2 py-1 rounded bg-purple-600 text-white font-bold text-[10px] hover:bg-purple-700 transition-colors shadow-sm cursor-pointer flex items-center gap-1"
                              title="Confirm Decision"
                            >
                              <ShieldCheck className="w-3 h-3" /> Confirm
                            </button>
                            <button
                              onClick={() => handleDiscardDecision(dec.id)}
                              className="p-1 rounded text-muted-foreground hover:text-red-500 cursor-pointer"
                              title="Discard"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: EXECUTIVE SUMMARY & AGENDA MAPPING */}
          {activeIntelTab === 'SUMMARY' && (
            <div className="space-y-3">
              {executiveSummary ? (
                <div className="p-3 rounded-xl bg-card border border-border space-y-2">
                  <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Executive Summary</span>
                  <p className="text-xs text-foreground leading-relaxed">{executiveSummary}</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-border text-center space-y-2">
                  <p className="text-muted-foreground text-xs">No summary generated yet.</p>
                  <button
                    onClick={() => handleTriggerAI('SUMMARIZE')}
                    disabled={isGeneratingIntel}
                    className="px-3 py-1 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-primary" /> Summarise Current Notes
                  </button>
                </div>
              )}

              {/* Agenda Discussions breakdown */}
              {agendaDiscussions.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono uppercase font-bold text-muted-foreground">Agenda Breakdown</span>
                  {agendaDiscussions.map((ad, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-card border border-border text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{ad.agendaTopic}</span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold ${
                          ad.wasDiscussed ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                        }`}>
                          {ad.wasDiscussed ? 'DISCUSSED' : 'NOT DISCUSSED'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{ad.discussionSummary}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Identified Risks breakdown */}
              {identifiedRisks.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Identified Operational Risks ({identifiedRisks.length})
                  </span>
                  {identifiedRisks.map((r, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{r.title}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-600">
                          {r.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{r.description}</p>
                      {r.mitigationSuggestion && (
                        <p className="text-[10px] text-amber-600 italic">Mitigation: {r.mitigationSuggestion}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SUGGESTED QUESTIONS */}
          {activeIntelTab === 'QUESTIONS' && (
            <div className="space-y-2">
              {suggestedQuestions.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center space-y-2">
                  <p className="text-muted-foreground text-xs">No questions generated yet.</p>
                  <button
                    onClick={() => handleTriggerAI('SUGGEST_QUESTIONS')}
                    disabled={isGeneratingIntel}
                    className="px-3 py-1 rounded-lg bg-card border border-border text-xs font-semibold hover:bg-muted transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3 text-primary" /> Suggest Questions for Call
                  </button>
                </div>
              ) : (
                suggestedQuestions.map((q, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-card border border-border text-xs space-y-1">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-foreground">{q}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 4. FOOTER REVIEW & ACTION STATUS                                          */}
      {/* ========================================================================= */}
      <footer className="p-2.5 border-t border-border bg-card/90 flex items-center justify-between shrink-0 text-[11px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{notesContent.length} chars</span>
          <span>•</span>
          <button
            onClick={() => setShowClosureChecklist(true)}
            className="text-primary hover:underline font-semibold cursor-pointer"
          >
            Checklist ({suggestedActions.filter(a => a.status === 'APPROVED').length} Tasks)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => saveNotesToServer()}
            className="px-2.5 py-1 rounded border border-border hover:bg-muted text-foreground font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Save className="w-3 h-3" />
            <span>Save Now</span>
          </button>

          {meeting?.status === 'IN_PROGRESS' ? (
            <button
              onClick={handleFinishSession}
              className="px-3 py-1 rounded bg-foreground text-background hover:bg-foreground/90 font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-all"
            >
              <span>Finish & Review MOM</span>
            </button>
          ) : meeting?.status === 'COMPLETED' ? (
            <button
              onClick={() => returnToPlatformAndClose('minutes')}
              className="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-all text-xs"
              title="Open Platform & Close Sidecar"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Open Platform & Close</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowClosureWizard(true)}
                className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 font-bold flex items-center gap-1 cursor-pointer shadow-sm transition-all text-xs"
                title="Open 2-Step Closure & MOM Reconciler"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Reconcile (2-Step)</span>
              </button>
              <button
                onClick={() => returnToPlatformAndClose('minutes')}
                className="px-2.5 py-1 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 cursor-pointer transition-all text-xs"
                title="Open full Minutes tab in BDIQ and close companion"
              >
                <span>Full MOM Tab →</span>
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Post-Meeting Closure Checklist Modal */}
      {showClosureChecklist && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-4 w-full max-w-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="font-bold text-xs flex items-center gap-1.5 text-foreground">
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
                Post-Meeting Closure Checklist
              </span>
              <button
                onClick={() => setShowClosureChecklist(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-bold"
              >
                ×
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                <input type="checkbox" defaultChecked={notesContent.length > 20} className="rounded" />
                <span>Live notes recorded and autosaved</span>
              </label>
              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                <input type="checkbox" defaultChecked={suggestedActions.some(a => a.status === 'APPROVED')} className="rounded" />
                <span>Action items reviewed and approved into tasks</span>
              </label>
              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                <input type="checkbox" defaultChecked={suggestedDecisions.some(d => d.status === 'CONFIRMED')} className="rounded" />
                <span>Agreed decisions formally confirmed</span>
              </label>
              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded" />
                <span>Follow-up schedule aligned with client</span>
              </label>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowClosureChecklist(false)}
                className="px-3 py-1 rounded bg-foreground text-background text-xs font-bold hover:bg-foreground/90 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fast Create Task Modal */}
      {showQuickTaskModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-4 w-full max-w-sm space-y-3.5 text-foreground">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckSquare className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-foreground">⚡ Create & Link Task</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Linked to {meeting?.meeting_code || 'Meeting'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuickTaskModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-base font-bold leading-none p-1"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {/* Task Title */}
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase font-bold block mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  placeholder="e.g. Provide API stability report to client"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && quickTaskTitle.trim()) {
                      e.preventDefault();
                      handleCreateQuickTask();
                    }
                  }}
                />
              </div>

              {/* Priority Chips */}
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase font-bold block mb-1">
                  Priority
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setQuickTaskPriority(p)}
                      className={`py-1 text-[10px] font-mono font-bold rounded border cursor-pointer transition-colors ${
                        quickTaskPriority === p
                          ? p === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/50'
                            : p === 'HIGH'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                            : p === 'LOW'
                            ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                          : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase font-bold block mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={quickTaskDueDate}
                  onChange={(e) => setQuickTaskDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-background border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Department & Assignee */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase font-bold block mb-1">
                    Department
                  </label>
                  <select
                    value={quickTaskDept}
                    onChange={(e) => setQuickTaskDept(e.target.value)}
                    className="w-full px-2 py-1.5 text-[11px] rounded-lg bg-background border border-border text-foreground focus:outline-none"
                  >
                    <option value="">(Optional)</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase font-bold block mb-1">
                    Assignee
                  </label>
                  <select
                    value={quickTaskAssignee}
                    onChange={(e) => setQuickTaskAssignee(e.target.value)}
                    className="w-full px-2 py-1.5 text-[11px] rounded-lg bg-background border border-border text-foreground focus:outline-none"
                  >
                    <option value="">(Auto/Unassigned)</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name || u.name ? `${u.first_name || u.name} ${u.last_name || ''}` : u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Log to Notes Checkbox */}
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={quickTaskLogToNotes}
                  onChange={(e) => setQuickTaskLogToNotes(e.target.checked)}
                  className="rounded"
                />
                <span>Append task bullet into Live Notes stream</span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowQuickTaskModal(false)}
                className="px-3 py-1.5 rounded-lg border border-border text-foreground text-xs font-semibold hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingQuickTask || !quickTaskTitle.trim()}
                onClick={() => handleCreateQuickTask()}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isSubmittingQuickTask ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Create & Link Task</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-Step Meeting Closure Wizard Modal */}
      {meeting && (
        <MeetingClosureWizardModal
          isOpen={showClosureWizard}
          onClose={() => setShowClosureWizard(false)}
          meeting={meeting}
          notes={
            rawNotes.length > 0
              ? rawNotes
              : notesContent.trim()
              ? [
                  {
                    id: 'live-draft-note',
                    organization_id: meeting.organization_id || '',
                    meeting_id: meeting.id,
                    user_id: session?.user?.id || '',
                    content: notesContent,
                    speaker: 'Live Session Notes',
                    note_type: 'NOTE',
                    is_draft: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }
                ]
              : []
          }
          points={points}
          decisions={decisions}
          onMeetingClosed={(updated) => {
            setMeeting(updated);
            loadMeetingData(true);
            try {
              const bc = new BroadcastChannel('bdiq_meeting_events');
              bc.postMessage({ meetingId: id, action: 'REFRESH', status: updated?.status || 'COMPLETED', timestamp: Date.now() });
              bc.close();
            } catch {}
            returnToPlatformAndClose('minutes');
          }}
        />
      )}
    </div>
  );
}
