# BDIQ Task Module — Configuration Guide

This guide documents the configuration engine integration for the BDIQ Task Tracking & Follow-up Management Module, explaining configurable options versus system-controlled machine keys.

---

## 1. Configurable Domains Overview

All dynamic parameters are anchored in the `configuration_groups`, `configuration_definitions`, and `configuration_options` architecture.

| Domain | Group Key | Definition Key | Configurable Scope | System Key Protected |
| :--- | :--- | :--- | :--- | :--- |
| **Task Types** | `TASK_CONFIG` | `TASK_TYPES` | Organization / Custom | Yes (Machine Keys) |
| **Task Statuses** | `TASK_CONFIG` | `TASK_STATUSES` | Organization Labels | Yes (Workflow Enforced) |
| **Priorities** | `TASK_CONFIG` | `TASK_PRIORITIES` | Organization Labels | Yes (SLA Influencing) |
| **Response Statuses** | `TASK_CONFIG` | `RESPONSE_STATUSES` | Organization / Custom | Yes (History Enforced) |
| **SLA & Escalation** | `TASK_CONFIG` | `SLA_RULES` | Organization Thresholds | Configurable |

---

## 2. Task Types

Task types represent the operational purpose of each business requirement.

### Seeded System Types
1. **`INFORMATION_REQUEST`**: Requests for technical, clinical, or commercial data from partners or internal teams.
2. **`TECHNICAL_FEASIBILITY`**: R&D / Tech Transfer assessment on formulation, API availability, or batch compatibility.
3. **`REGULATORY_ASSESSMENT`**: Dossier queries, GMP audits, CTD Module requests, or variation filings.
4. **`MARKET_RESEARCH`**: Secondary data inquiries, therapy-area volume evaluations, or IQVIA cross-references.
5. **`COMMERCIAL_REQUEST`**: Pricing approvals, margin analysis, and target COGs queries.
6. **`CUSTOMER_FOLLOWUP`**: Outbound communication follow-ups with pharmaceutical clients and distributors.
7. **`RFQ_FOLLOWUP`**: Quotation and RFP timeline tracking.
8. **`DOCUMENT_REQUEST`**: Quality agreements, CoA, MSDS, and DMF access requests.
9. **`MANAGEMENT_ACTION`**: Directives and action items from BD review meetings.
10. **`INTERNAL_REVIEW`**: Cross-functional alignment between BD, Legal, and Supply Chain.
11. **`APPROVAL`**: Stage-gate sign-offs and executive endorsements.
12. **`GENERAL`**: General operational tasks.

*Organizations can add custom task types via the Configuration Engine (`POST /api/configuration/options/:definitionId`).*

---

## 3. Task Statuses vs. Calculated Conditions

To prevent contradictory states, BDIQ distinguishes between **Stored Machine Statuses** and **Calculated Conditions**:

### Stored Statuses
- **`OPEN`**: Task is created and awaiting initial work.
- **`IN_PROGRESS`**: Active assignment undergoing processing.
- **`WAITING_FOR_UPDATE`**: A "No Update" response was recorded; awaiting next follow-up.
- **`PARTIAL_UPDATE_RECEIVED`**: Partial deliverable received; remaining deliverables pending.
- **`ON_HOLD`**: Temporarily frozen with documented justification. Holds are deducted from active delay analytics.
- **`COMPLETED`**: Final resolution achieved and verified.
- **`CANCELLED`**: Revoked with mandatory audit reason.

### Calculated Conditions (Authoritative in `TaskMetricsService`)
- **`isOverdue`**: Evaluated dynamically: $\text{today} > \text{current\_due\_date}$.
- **`originalDelayDays`**: $\max(0, \text{today} - \text{original\_due\_date})$.
- **`slaStatus`**: Evaluated dynamically as `OK`, `WARNING`, or `BREACHED`.

---

## 4. Priorities & Escalation Rules

| Priority Key | Default Label | SLA Target | Escalation Tier 2 (Functional Head) | Escalation Tier 3 (Executive Leadership) |
| :--- | :--- | :--- | :--- | :--- |
| **`CRITICAL`** | Critical | 1 Day | Delay $\ge$ 1 Day | Delay $\ge$ 2 Days |
| **`HIGH`** | High | 3 Days | Delay $\ge$ 2 Days | Delay $\ge$ 4 Days |
| **`MEDIUM`** | Medium | 5 Days | Delay $\ge$ 5 Days | Delay $\ge$ 7 Days |
| **`LOW`** | Low | 10 Days | Delay $\ge$ 10 Days | Delay $\ge$ 14 Days |

---

## 5. Follow-up Response Statuses

When recording interactions, the user selects a categorized response status:
- **`NO_UPDATE`**: No response received; system advances `current_due_date` to `next_followup_date`, preserves `original_due_date`, and recalculates active delay.
- **`PARTIAL_UPDATE`**: Partial response received; captures received and pending scopes.
- **`UPDATE_RECEIVED`**: Response received; optional complete resolution.
- **`RESCHEDULED`**: Date changed with justification; records history into `task_reschedules`.
- **`NOT_REACHABLE`**: Counterparty or internal team unavailable.
- **`CUSTOMER_DELAY`**: External client or partner delay.
- **`INTERNAL_DELAY`**: Laboratory or regulatory bandwidth constraint.
- **`OTHER`**: Miscellaneous with mandatory notes.
