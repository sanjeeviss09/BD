import type {
  Meeting,
  MeetingDashboardOverview,
  PreparationWorkspaceData,
  MeetingNote,
  MeetingPoint,
  MeetingDecision,
  MeetingTemplate,
  MeetingConfiguration,
  QuickCaptureSuggestion
} from '../types/meeting';

const API_BASE = 'http://localhost:4000/api/meetings';

function getHeaders(token?: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token || 'dev-admin-token'}`
  };
}

function extractErrorMessage(err: any, fallback: string): string {
  if (err?.error?.message) return err.error.message;
  if (err?.message) return err.message;
  if (typeof err?.error === 'string') return err.error;
  return fallback;
}

export const meetingApi = {
  // 1. Dashboard Overview
  async getDashboardOverview(token?: string, filters: Record<string, string> = {}): Promise<MeetingDashboardOverview> {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}/dashboard/overview?${params.toString()}`, {
      headers: getHeaders(token)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, 'Failed to load meeting dashboard'));
    }
    return res.json();
  },

  // 2. Meetings CRUD
  async listMeetings(token?: string, filters: Record<string, string> = {}): Promise<Meeting[]> {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_BASE}?${params.toString()}`, {
      headers: getHeaders(token)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, 'Failed to list meetings'));
    }
    return res.json();
  },

  async createMeeting(token: string | undefined, payload: any): Promise<Meeting> {
    const res = await fetch(`${API_BASE}`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(extractErrorMessage(err, 'Failed to schedule meeting'));
    }
    return res.json();
  },

  async getMeeting(id: string, token?: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE}/${id}`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Meeting not found');
    return res.json();
  },

  async updateMeeting(id: string, payload: any, token?: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update meeting');
    }
    return res.json();
  },

  async startMeeting(id: string, token?: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE}/${id}/start`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to start meeting');
    return res.json();
  },

  async endMeeting(id: string, token?: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE}/${id}/end`, {
      method: 'POST',
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to end meeting');
    return res.json();
  },

  // 3. Preparation Workspace
  async getPreparationWorkspace(id: string, token?: string): Promise<PreparationWorkspaceData> {
    const res = await fetch(`${API_BASE}/${id}/preparation`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to load meeting preparation');
    return res.json();
  },

  // 4. Live Mini Notes & Quick Capture
  async getNotes(meetingId: string, token?: string): Promise<MeetingNote[]> {
    const res = await fetch(`${API_BASE}/${meetingId}/notes`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to fetch notes');
    return res.json();
  },

  async createNote(meetingId: string, payload: any, token?: string): Promise<MeetingNote> {
    const res = await fetch(`${API_BASE}/${meetingId}/notes`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save note');
    return res.json();
  },

  async updateNote(noteId: string, payload: any, token?: string): Promise<MeetingNote> {
    const res = await fetch(`${API_BASE}/notes/${noteId}`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update note');
    return res.json();
  },

  async deleteNote(noteId: string, token?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/notes/${noteId}`, {
      method: 'DELETE',
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to delete note');
  },

  async parseQuickNote(text: string, token?: string): Promise<QuickCaptureSuggestion> {
    const res = await fetch(`${API_BASE}/quick-capture/parse`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('Failed to parse note text');
    return res.json();
  },

  // 5. Structured Meeting Points
  async getMeetingPoints(meetingId: string, token?: string): Promise<MeetingPoint[]> {
    const res = await fetch(`${API_BASE}/${meetingId}/points`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to load meeting points');
    return res.json();
  },

  async createMeetingPoint(meetingId: string, payload: any, token?: string): Promise<MeetingPoint> {
    const res = await fetch(`${API_BASE}/${meetingId}/points`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create meeting point');
    return res.json();
  },

  async updateMeetingPoint(pointId: string, payload: any, token?: string): Promise<MeetingPoint> {
    const res = await fetch(`${API_BASE}/points/${pointId}`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to update meeting point');
    return res.json();
  },

  async carryForwardPoint(pointId: string, targetMeetingId: string, reason?: string, token?: string): Promise<MeetingPoint> {
    const res = await fetch(`${API_BASE}/points/${pointId}/carry-forward`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ target_meeting_id: targetMeetingId, reason })
    });
    if (!res.ok) throw new Error('Failed to carry forward point');
    return res.json();
  },

  async convertPointToTask(pointId: string, payload: any, token?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/points/${pointId}/create-task`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create task from meeting point');
    return res.json();
  },

  // 6. Formal Decisions
  async getDecisions(meetingId: string, token?: string): Promise<MeetingDecision[]> {
    const res = await fetch(`${API_BASE}/${meetingId}/decisions`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to load decisions');
    return res.json();
  },

  async createDecision(meetingId: string, payload: any, token?: string): Promise<MeetingDecision> {
    const res = await fetch(`${API_BASE}/${meetingId}/decisions`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to record decision');
    return res.json();
  },

  async confirmDecision(decisionId: string, isConfirmed: boolean = true, token?: string): Promise<MeetingDecision> {
    const res = await fetch(`${API_BASE}/decisions/${decisionId}/confirm`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ is_confirmed: isConfirmed })
    });
    if (!res.ok) throw new Error('Failed to update decision confirmation status');
    return res.json();
  },

  // MOM Generation & Confirmation
  async generateMOMDraft(meetingId: string, options?: { transcript?: string; prompt?: string }, token?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/${meetingId}/mom/generate`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(options || {})
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to generate MOM draft');
    }
    return res.json();
  },

  async confirmMOM(meetingId: string, momDraft: any, token?: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE}/${meetingId}/mom/confirm`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(momDraft)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to confirm Minutes of Meeting');
    }
    return res.json();
  },

  // 7. Closure Wizard
  async executeMeetingClosure(meetingId: string, closureData: any, token?: string): Promise<Meeting> {
    const res = await fetch(`${API_BASE}/${meetingId}/closure`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(closureData)
    });
    if (!res.ok) throw new Error('Failed to execute meeting closure');
    return res.json();
  },

  // 8. Excel Export
  async exportMinutesWorkbook(meetingId: string, token?: string): Promise<Blob> {
    const res = await fetch(`${API_BASE}/${meetingId}/export`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to export minutes');
    return res.blob();
  },

  // 9. Configurations & Templates
  async getConfigurations(token?: string): Promise<MeetingConfiguration[]> {
    const res = await fetch(`${API_BASE}/configurations`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to load meeting configurations');
    return res.json();
  },

  async updateConfiguration(key: string, value: any, reason?: string, token?: string): Promise<MeetingConfiguration> {
    const res = await fetch(`${API_BASE}/configurations/${key}`, {
      method: 'PATCH',
      headers: getHeaders(token),
      body: JSON.stringify({ value, change_reason: reason })
    });
    if (!res.ok) throw new Error('Failed to update configuration');
    return res.json();
  },

  async listTemplates(token?: string): Promise<MeetingTemplate[]> {
    const res = await fetch(`${API_BASE}/templates`, {
      headers: getHeaders(token)
    });
    if (!res.ok) throw new Error('Failed to load meeting templates');
    return res.json();
  },

  async createTemplate(payload: any, token?: string): Promise<MeetingTemplate> {
    const res = await fetch(`${API_BASE}/templates`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to create meeting template');
    return res.json();
  },

  // 10. AI Meeting Intelligence & Live Copilot
  async generateAIMeetingIntelligence(id: string, payload: any = {}, token?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/${id}/ai-intelligence`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to generate meeting AI intelligence');
    }
    return res.json();
  },

  async applyAISuggestions(id: string, payload: any, token?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/${id}/ai-intelligence/apply`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to apply AI suggestions');
    }
    return res.json();
  },

  async queryCopilot(id: string, query: string, token?: string): Promise<{ query: string; answer: string; citations: string[]; suggestedFollowUps: string[] }> {
    const res = await fetch(`${API_BASE}/${id}/ai-intelligence/query`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ query })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to query Copilot');
    }
    return res.json();
  }
};

