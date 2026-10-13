# BDIQ Task Tracking & Follow-up Management Architecture

## 1. Architectural Overview
The Task Management Module provides enterprise-grade commitment tracking and follow-up accountability for pharmaceutical Business Development and cross-functional teams.

```
                    ┌───────────────────────────────┐
                    │       BDIQ Client (React)     │
                    └───────────────┬───────────────┘
                                    │ JWT + Scope
                                    ▼
┌───────────────────────────────────────────────────────────────────┐
│                    BDIQ Backend (Express + RBAC)                  │
│                                                                   │
│  ┌───────────────────────┐             ┌───────────────────────┐  │
│  │   PermissionEngine    │             │   TaskMetricsService  │  │
│  │   (tasks.* checks)    │             │ (authoritative delays)│  │
│  └───────────┬───────────┘             └───────────┬───────────┘  │
│              │                                     │              │
│  ┌───────────▼───────────┐             ┌───────────▼───────────┐  │
│  │      TaskService      │             │  TaskNotificationSvc  │  │
│  │(workflows, validation)│             │ (templated in-app/msg)│  │
│  └───────────┬───────────┘             └───────────────────────┘  │
└──────────────┼────────────────────────────────────────────────────┘
               │ Row Level Security (RLS)
               ▼
┌───────────────────────────────────────────────────────────────────┐
│                 PostgreSQL / Supabase Database                    │
│                                                                   │
│  - tasks (PK, organization_id, task_code, original_due_date...)   │
│  - task_followups (sequential followup_number per task)          │
│  - task_reschedules (audit trail of date changes)                 │
│  - task_comments (collaborative notes)                           │
│  - task_watchers (observers)                                      │
│  - task_timeline (immutable business activity events)             │
│  - notifications & audit_logs                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Normalized Database Schema

### `tasks`
- **`id`** (`UUID`, PK): Global surrogate identifier.
- **`organization_id`** (`UUID`, FK): Tenant isolation anchor.
- **`task_code`** (`VARCHAR(50)`, Unique per organization): Human-readable code (`TASK-YYYY-000001`). Generated via PostgreSQL sequence `task_code_seq`.
- **`title`** (`VARCHAR(255)`): Core deliverable or inquiry title.
- **`description`** (`TEXT`): Full scope of requirement.
- **`task_type`** (`VARCHAR(50)`): Configurable machine key.
- **`priority`** (`VARCHAR(50)`): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **`status`** (`VARCHAR(50)`): Stored workflow state.
- **`original_due_date`** (`DATE`, Immutable): The baseline commitment date. Never modified during regular workflows.
- **`current_due_date`** (`DATE`): Latest promised date or next expected follow-up.
- **`total_hold_duration_days`** (`INT`): Approved pause time deducted from active delay.
- **`version`** (`INT`): Optimistic concurrency control counter.
- **`created_by`**, **`completed_by`**, **`cancelled_by`**: User profile references.

### `task_followups`
- **`id`** (`UUID`, PK).
- **`task_id`** (`UUID`, FK): Parent task.
- **`followup_number`** (`INT`): Monotonically increasing counter per task. Constraint: `UNIQUE(task_id, followup_number)`.
- **`followup_date`** (`DATE`): Date follow-up was executed.
- **`expected_response_date`** (`DATE`): Date response was promised.
- **`response_status`** (`VARCHAR(50)`): `NO_UPDATE`, `PARTIAL_UPDATE`, `UPDATE_RECEIVED`, etc.
- **`next_followup_date`** (`DATE`): Scheduled next check.
- **`contacted_person`** (`VARCHAR(255)`): Counterparty or department contact.
- **`remarks`** (`TEXT`): Context and interaction notes.

### `task_timeline` (Immutable Activity Layer)
Stores every business event: `TASK_CREATED`, `TASK_ASSIGNED`, `TASK_REASSIGNED`, `TASK_NO_UPDATE`, `TASK_PARTIAL_UPDATE`, `TASK_UPDATE_RECEIVED`, `TASK_RESCHEDULED`, `TASK_HOLD`, `TASK_RESUMED`, `TASK_COMPLETED`, `TASK_CANCELLED`, `TASK_REOPENED`, `TASK_ESCALATED`, `TASK_COMMENT_ADDED`.

---

## 3. Authoritative Delay Formulas (`TaskMetricsService`)

To eliminate discrepancies between client rendering and reports, all calculations are performed server-side using calendar-day math:

1. **Original Delay Days**:
   $$\text{OriginalDelay} = \max\left(0, \text{ResolutionDate} - \text{original\_due\_date}\right)$$
   *(Never reset when follow-up dates advance)*

2. **Current Delay Days**:
   $$\text{CurrentDelay} = \max\left(0, \text{today} - \text{current\_due\_date}\right)$$

3. **Response Delay Days**:
   $$\text{ResponseDelay} = \max\left(0, \text{actual\_response\_date} - \text{original\_due\_date}\right)$$

4. **Active Delay Days**:
   $$\text{ActiveDelay} = \max\left(0, \text{OriginalDelay} - \text{total\_hold\_duration\_days}\right)$$

5. **Waiting Days**:
   $$\text{WaitingDays} = \max\left(0, \text{today} - \text{created\_at}\right)$$

6. **Overdue Status**:
   $$\text{isOverdue} = (\text{today} > \text{current\_due\_date}) \land (\text{status} \notin \{\text{'COMPLETED'}, \text{'CANCELLED'}, \text{'ON\_HOLD'}\})$$

---

## 4. Permission Model (RBAC)

| Permission Code | Purpose |
| :--- | :--- |
| `tasks.read` | View task list and details |
| `tasks.create` | Create new tasks |
| `tasks.update` | Edit task details, watchers, hold/resume |
| `tasks.assign` | Reassign responsible user or department |
| `tasks.followup` | Record No Update, Partial Update, and interactions |
| `tasks.complete` | Formally complete tasks |
| `tasks.cancel` | Cancel tasks with required justification |
| `tasks.reschedule` | Submit and approve date rescheduling |
| `tasks.export` | Export filtered task datasets |
| `tasks.analytics` | Access management dashboard analytics |
| `tasks.admin` | Administrative overrides and monitoring job execution |

---

## 5. Security & Isolation Controls

- **Database RLS Policies**: Enforced on `tasks`, `task_followups`, `task_reschedules`, `task_comments`, `task_watchers`, and `task_timeline` using `organization_id = get_auth_user_organization_id()`.
- **Backend Organization Resolution**: `loadUserContext` middleware securely reads `organization_id` from the authenticated user's profile and guarantees isolation.
- **Hierarchy Validation**: Assignment strictly verifies that user, department, and team all belong to the current user's organization.
- **Optimistic Concurrency**: Task updates increment `version` and reject concurrent conflicting mutations.
