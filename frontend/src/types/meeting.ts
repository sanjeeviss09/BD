export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MeetingClosureStatus = 'OPEN' | 'IN_CLOSURE' | 'CLOSED';
export type MeetingPreparationStatus = 'PENDING' | 'IN_PROGRESS' | 'READY';

export type MeetingPointCategory =
  | 'INFORMATION'
  | 'DISCUSSION'
  | 'DECISION'
  | 'ACTION'
  | 'RISK'
  | 'DEPENDENCY'
  | 'QUESTION'
  | 'CUSTOMER_REQUIREMENT'
  | 'FOLLOW_UP'
  | 'PARKED';

export type MeetingPointStatus =
  | 'OPEN'
  | 'IN_DISCUSSION'
  | 'DECIDED'
  | 'ACTION_REQUIRED'
  | 'CARRIED_FORWARD'
  | 'RESOLVED'
  | 'CANCELLED';

export interface Meeting {
  id: string;
  organization_id: string;
  meeting_code: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  end_time?: string | null;
  timezone: string;
  meeting_type: string;
  location_or_link?: string | null;
  organizer_id: string;
  department_id?: string | null;
  customer_id?: string | null;
  opportunity_id?: string | null;
  rfq_id?: string | null;
  product_id?: string | null;
  molecule_id?: string | null;
  meeting_series_id?: string | null;
  previous_meeting_id?: string | null;
  agenda?: string | null;
  objective?: string | null;
  expected_outcomes?: string | null;
  external_organizations?: string | null;
  notes?: string | null;
  decisions?: string | null;
  preparation_status: MeetingPreparationStatus;
  closure_status: MeetingClosureStatus;
  closure_summary?: string | null;
  closure_data?: any;
  minutes_text?: string | null;
  minutes_approved: boolean;
  minutes_approved_at?: string | null;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;

  // Joined relations
  organizer?: { id: string; first_name: string; last_name: string; email: string };
  department?: { id: string; name: string };
  customer?: { id: string; name: string; customer_code?: string };
  opportunity?: { id: string; title: string; opportunity_code?: string; status?: string };
  rfq?: { id: string; rfq_number: string; status?: string };
  product?: { id: string; name: string; product_code?: string };
  molecule?: { id: string; name: string };
  series?: { id: string; title: string; recurrence_type: string; series_code?: string };
  previous_meeting?: { id: string; meeting_code: string; title: string; meeting_date: string };
  participants?: MeetingParticipant[];
  stats?: {
    pointsCount: number;
    pendingActionCount: number;
    decisionCount: number;
  };
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_profile_id: string;
  role: string;
  attendance_status: string;
  user_profile?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    department?: { name: string };
  };
}

export interface MeetingNote {
  id: string;
  organization_id: string;
  meeting_id: string;
  user_id: string;
  content: string;
  speaker?: string | null;
  department_id?: string | null;
  agenda_item?: string | null;
  note_type: 'NOTE' | 'DECISION_DRAFT' | 'ACTION_DRAFT' | 'RISK_DRAFT';
  is_draft: boolean;
  converted_to_type?: string | null;
  converted_to_id?: string | null;
  client_mutation_id?: string | null;
  created_at: string;
  updated_at: string;
  user?: { id: string; first_name: string; last_name: string };
  department?: { id: string; name: string };
}

export interface MeetingPoint {
  id: string;
  organization_id: string;
  meeting_id: string;
  point_code: string;
  agenda_item?: string | null;
  title: string;
  description?: string | null;
  category: MeetingPointCategory;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  discussion_notes?: string | null;
  decision_text?: string | null;
  action_required: boolean;
  responsible_department_id?: string | null;
  responsible_user_id?: string | null;
  due_date?: string | null;
  status: MeetingPointStatus;
  related_customer_id?: string | null;
  related_opportunity_id?: string | null;
  related_rfq_id?: string | null;
  related_product_id?: string | null;
  linked_task_id?: string | null;
  linked_risk_id?: string | null;
  source_note_id?: string | null;
  carried_forward_from_id?: string | null;
  carry_forward_count: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  responsible_department?: { id: string; name: string };
  responsible_user?: { id: string; first_name: string; last_name: string; email?: string };
  linked_task?: { id: string; task_code: string; title: string; status: string; original_due_date?: string; current_due_date?: string };
  linked_risk?: { id: string; risk_code: string; risk_title: string; risk_level: string };
}

export interface MeetingDecision {
  id: string;
  organization_id: string;
  meeting_id: string;
  decision_code: string;
  title: string;
  description?: string | null;
  decision_date: string;
  decision_owner_id?: string | null;
  participants_summary?: string | null;
  rationale?: string | null;
  evidence?: string | null;
  affected_product_id?: string | null;
  affected_opportunity_id?: string | null;
  affected_rfq_id?: string | null;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  followup_required: boolean;
  linked_point_id?: string | null;
  linked_task_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;

  decision_owner?: { id: string; first_name: string; last_name: string; email?: string };
  affected_product?: { id: string; name: string };
  affected_opportunity?: { id: string; title: string };
  affected_rfq?: { id: string; rfq_number: string };
  linked_point?: { id: string; point_code: string; title: string };
}

export interface MeetingTemplate {
  id: string;
  organization_id: string;
  template_name: string;
  meeting_type: string;
  description?: string | null;
  default_agenda: string[];
  default_categories: string[];
  default_duration_minutes: number;
  required_fields: string[];
  is_active: boolean;
  version: number;
  created_at: string;
}

export interface MeetingConfiguration {
  id: string;
  organization_id: string;
  config_key: string;
  config_name: string;
  description?: string | null;
  config_value: any;
  allowed_values?: any;
  default_value?: any;
  scope: string;
  effective_date: string;
  is_enabled: boolean;
  version: number;
  updated_at: string;
}

export interface MeetingDashboardOverview {
  summary: {
    totalMeetings: number;
    todayCount: number;
    upcomingCount: number;
    awaitingPreparationCount: number;
    inProgressCount: number;
    awaitingClosureCount: number;
    pendingActionsCount: number;
    overdueActionsCount: number;
    followupsDueTodayCount: number;
    overdueFollowupsCount: number;
    previousActionsStillOpenCount: number;
    meetingsWithoutMinutesCount: number;
    meetingsWithoutNextStepsCount: number;
  };
  todayMeetings: Meeting[];
  upcomingMeetings: Meeting[];
  awaitingPreparation: Meeting[];
  inProgressMeetings: Meeting[];
  awaitingClosure: Meeting[];
  pendingActions: MeetingPoint[];
  overdueMeetingActions: MeetingPoint[];
  followupsDueToday: any[];
  overdueFollowups: any[];
  meetings: Meeting[];
}

export interface PreparationWorkspaceData {
  meeting: Meeting;
  previousSummary: {
    id: string;
    meeting_code: string;
    title: string;
    meeting_date: string;
    closure_summary: string;
    minutes_approved: boolean;
  } | null;
  previousPoints: MeetingPoint[];
  previousDecisions: MeetingDecision[];
  openActions: any[];
  overdueActions: any[];
  noUpdateRecords: any[];
  openRisks: any[];
  relatedContext: any;
  suggestedAgenda: string[];
}

export interface QuickCaptureSuggestion {
  originalText: string;
  suggestedAction: string;
  suggestedDepartment: string | null;
  suggestedDueDate: string | null;
  datePrecision: string;
  confidenceScore: number;
  requiresConfirmation: boolean;
}
