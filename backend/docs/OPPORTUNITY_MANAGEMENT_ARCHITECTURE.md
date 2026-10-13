# BDIQ Platform — Opportunity Management Architecture (Step 9)

## Executive Summary
The **Opportunity Management Module** establishes the central Business Development (BD) decision record for the BDIQ platform. It bridges the canonical **Product Master** (Step 8), operational **Task Management** (Step 7), corporate **RBAC & Configuration**, and upcoming intelligence engines (Market Intelligence, IMS, Regulatory, Production Feasibility, and Management Decisioning).

Rather than acting as a simple sales lead or contact CRM, an Opportunity represents a multidimensional commercial pharmaceutical project involving:
1. One or more canonical pharmaceutical products (`opportunity_products`).
2. Geographic target markets and country launch priorities (`opportunity_markets`).
3. Structured multi-criteria qualification scoring with versioned audit history (`opportunity_qualification_runs` & `opportunity_qualification_scores`).
4. Operational tracking with linked tasks and proactive delay detection (`tasks.opportunity_id` integrating `TaskMetricsService`).
5. Systematic risk evaluation (`opportunity_risks`) and technical/regulatory requirements (`opportunity_requirements`).
6. A 14-stage gated workflow engine with server-side validation (`OpportunityWorkflowService`).
7. Authoritative financial pipeline modeling (Estimated Value, Probability %, Weighted Pipeline Value).

---

## 1. Architectural Relationship Diagram

```
[ PRODUCT MASTER ] (Canonical Asset Identity)
       │
       ▼ (1:N or M:N via opportunity_products)
[ OPPORTUNITY RECORD ] ─── OPP-YYYY-000001 (Central BD Decision Record)
   ├── [Opportunity Markets] (Target Countries: DE, FR, US, JP...)
   ├── [Opportunity Qualification] (Multi-Criteria Scoring Engine & History)
   ├── [Opportunity Risks] (Technical, Regulatory, Commercial, Supply)
   ├── [Opportunity Requirements] (Formulation, Regulatory, Packaging, Dossier)
   ├── [Opportunity Decisions] (QUALIFIED, REJECTED, ON_HOLD, WON, LOST)
   ├── [Opportunity Timeline & Comments] (Immutable chronological audit log)
   │
   ▼
[ TASKS & FOLLOW-UPS ] (Operational Execution from Step 7)
   └── Delay calculation integrates directly into Opportunity Next Action delay banner
   │
   ▼ (Future Integration Extension Points)
[ MARKET INTELLIGENCE & IMS / IQVIA 24-Month Sales & Volume ]
   │
   ▼
[ REGULATORY INTELLIGENCE & PATENT EXPIRIES ]
   │
   ▼
[ PRODUCTION FEASIBILITY ASSESSMENT & CMO CAPACITY ]
   │
   ▼
[ MANAGEMENT BUSINESS CASE & BOARD DECISION ]
```

---

## 2. Opportunity Core Data Model

### 2.1 Normalized Table Definitions
Defined in `supabase/migrations/007_opportunity_management.sql`:

| Table | Description | Scope / RLS |
| :--- | :--- | :--- |
| `opportunities` | Core BD opportunity decision record | Tenant Isolated (`organization_id`) |
| `opportunity_products` | Multi-product junction table with relationship types | Tenant Isolated (`organization_id`) |
| `opportunity_markets` | Target countries, roles, and target entry dates | Tenant Isolated (`organization_id`) |
| `opportunity_customers` | Customer, prospect, or distributor relationships | Tenant Isolated (`organization_id`) |
| `opportunity_risks` | Risk registry (Technical, Regulatory, Commercial, etc.) | Tenant Isolated (`organization_id`) |
| `opportunity_requirements` | Structured product & market requirements | Tenant Isolated (`organization_id`) |
| `opportunity_qualification_runs` | Versioned qualification evaluations & summaries | Tenant Isolated (`organization_id`) |
| `opportunity_qualification_scores` | Breakdown of scores and evidence per criterion | Linked via `qualification_run_id` |
| `opportunity_decisions` | Formal decision history (Won/Lost/On-Hold/Qualified) | Tenant Isolated (`organization_id`) |
| `opportunity_comments` | Timestamped, threaded team discussions | Tenant Isolated (`organization_id`) |
| `opportunity_timeline` | Comprehensive chronological event log | Tenant Isolated (`organization_id`) |

### 2.2 Concurrency-Safe Opportunity Code Generation
Opportunity codes follow the pattern:
```
OPP-YYYY-000001
```
- Implemented via a PostgreSQL sequence (`opportunity_code_seq`) and database function `generate_next_opportunity_code()`.
- Guaranteed concurrency-safe; avoids race conditions inherent in naive `MAX(code) + 1` queries.
- Immutable after creation.

---

## 3. Product ↔ Opportunity Relationship

An opportunity frequently encompasses a primary pharmaceutical product, lifecycle extensions, secondary dosage strengths, or comparison against reference/competitor products:

- Junction Table: `opportunity_products`
  - `opportunity_id` (FK to `opportunities`)
  - `product_id` (FK to `products` from Step 8 Product Master)
  - `relationship_type`:
    - `PRIMARY_PRODUCT` (Lead commercial asset)
    - `SECONDARY_PRODUCT` (Line extension or secondary strength)
    - `ALTERNATIVE_PRODUCT` (Contingency formulation or alternate dosage)
    - `REFERENCE_PRODUCT` (Innovator / RLD benchmark)
    - `COMPETITOR_PRODUCT` (Target generic competitor asset)
    - `RELATED_PRODUCT` (Combination therapy or bundle)
  - `is_primary`: Boolean indicator ensuring exactly one primary asset is highlighted for summary reporting.

---

## 4. Stage Workflow Engine (`OpportunityWorkflowService`)

### 4.1 Configurable Gated Stage Definitions
The system supports a 14-stage pharmaceutical BD lifecycle:
1. `IDENTIFIED` (Default probability: 10%)
2. `INITIAL_SCREENING` (Default probability: 20%)
3. `QUALIFICATION` (Default probability: 30%)
4. `MARKET_EVALUATION` (Default probability: 40%)
5. `TECHNICAL_EVALUATION` (Default probability: 50%)
6. `REGULATORY_EVALUATION` (Default probability: 60%)
7. `CUSTOMER_EVALUATION` (Default probability: 65%)
8. `COMMERCIAL_EVALUATION` (Default probability: 70%)
9. `RFQ` (Default probability: 75%)
10. `NEGOTIATION` (Default probability: 85%)
11. `MANAGEMENT_REVIEW` (Default probability: 90%)
12. `APPROVAL` (Default probability: 95%)
13. `WON` (Default probability: 100%, Terminal)
14. `LOST` (Default probability: 0%, Terminal)

### 4.2 Server-Side Transition Validation Rules
The workflow engine enforces business rules before permitting stage movements:
- Advancing past `QUALIFICATION` into downstream technical, regulatory, or commercial evaluations requires the opportunity to have completed qualification and not be marked `NOT_QUALIFIED`.
- Transitioning to `RFQ` requires at least one product linked to the opportunity.
- Transitioning to `LOST` strictly mandates a structured `closed_reason` (e.g. `PRICE`, `TECHNICAL`, `REGULATORY`, `CUSTOMER_SELECTED_COMPETITOR`, `CAPACITY`).
- Terminal stages (`WON`, `LOST`) require official closure/reopen actions and cannot be arbitrarily modified via inline stage clicks without authorization.

---

## 5. Qualification Framework & Authoritative Scoring

### 5.1 Qualification Engine (`OpportunityScoringService`)
Opportunity qualification evaluates commercial readiness using 8 weighted criteria (total weight = 100):
1. **Strategic Portfolio Fit** (Weight: 15)
2. **Market Potential & Value** (Weight: 15)
3. **Customer / Buyer Demand** (Weight: 10)
4. **Technical & Formulation Feasibility** (Weight: 15)
5. **Regulatory & IP Feasibility** (Weight: 15)
6. **Manufacturing & CMO Capability** (Weight: 10)
7. **Commercial Viability & Margin** (Weight: 10)
8. **Timeline & Investment Feasibility** (Weight: 10)

### 5.2 Authoritative Scoring Formula
```
Weighted Score = SUM(criterion_score * weight) / SUM(weights)
```
- Outcome Thresholds:
  - `QUALIFIED`: Total score >= 70%
  - `CONDITIONAL`: Total score between 50% and 69.9%
  - `NOT_QUALIFIED`: Total score < 50%
- If no qualification run has occurred, status is displayed as `NOT_EVALUATED` rather than a misleading 0%.
- Qualification runs are immutable (`opportunity_qualification_runs`); re-evaluations increment the version number, preserving complete historical evidence.

---

## 6. Financial & Operational Metrics (`OpportunityMetricsService`)

### 6.1 Authoritative Calculations
- **Weighted Pipeline Value**:
  ```
  Weighted Value = (estimated_value * probability) / 100
  ```
- **Opportunity Age (Days)**:
  Elapsed calendar days from `created_at` to the present date (or `closed_at` for closed opportunities).
- **Next Action Delay Integration**:
  Evaluates `next_action_date` against the current date. Crucially, if linked tasks from Step 7 have overdue follow-ups or delays, `calculateNextActionDelayDays` factors in the linked task delay so BD leaders are alerted to operational bottlenecks:
  ```
  Delay Days = MAX(Action Date Delay, Linked Overdue Task Delays)
  ```
- **Deterministic Health Rating**:
  Evaluates opportunities into 4 health tiers:
  - `HEALTHY`: On track, no overdue tasks, low risk.
  - `ATTENTION`: Pending qualification or approaching decision date.
  - `AT_RISK`: Next action delayed > 3 days, overdue task, or high risk.
  - `CRITICAL`: Next action delayed > 7 days, critical risk, or marked not qualified.

---

## 7. Operational Integration with Task Management (Step 7)

- `tasks.opportunity_id` establishes a clean foreign key linking operational tasks to the opportunity decision record.
- The Opportunity Detail page includes a dedicated **Linked Tasks** panel displaying Task Code, Title, Status, Priority, Due Date, and Delay.
- Users can create new tasks directly associated with an Opportunity without duplicating task metadata inside the Opportunity table.

---

## 8. RBAC Permissions & Security

### 8.1 RBAC Permission Matrix
Registered in `permissions` and enforced by Express middleware `requirePermission`:

| Permission Code | Name | Description |
| :--- | :--- | :--- |
| `opportunities.read` | View Opportunities | Browse opportunity lists, Kanban board, and details |
| `opportunities.create` | Create Opportunities | Create new commercial opportunities |
| `opportunities.update` | Update Opportunities | Edit fields, description, values, and target dates |
| `opportunities.assign` | Assign Opportunities | Reassign owner, department, or team |
| `opportunities.stage` | Transition Stages | Move opportunities through pipeline stages |
| `opportunities.qualify` | Qualify Opportunities | Submit qualification criteria and run scoring |
| `opportunities.close` | Close Opportunities | Mark as Won, Lost, or Cancelled |
| `opportunities.reopen` | Reopen Opportunities | Reopen closed or cancelled opportunities |
| `opportunities.risk` | Manage Risks | Record and mitigate project risks |
| `opportunities.export` | Export Opportunities | Download pipeline CSV datasets |
| `opportunities.analytics` | View Analytics | Access executive revenue, win/loss, and stage funnel dashboards |
| `opportunities.admin` | Administer Opportunities | Full administrative authority over workflows |

### 8.2 Row-Level Security (RLS)
PostgreSQL RLS is enabled on all 11 opportunity tables with tenant isolation policies checking `organization_id = get_auth_user_organization_id()`. Cross-tenant data leakage is prevented at both the API layer and the PostgreSQL kernel.

---

## 9. API Architecture

Mounted at `/api/opportunities`:

- `GET /api/opportunities`: Filtered, searched, paginated opportunities list.
- `POST /api/opportunities`: Create opportunity with primary product association.
- `GET /api/opportunities/analytics`: Pipeline aggregations, win/loss stats, stage distribution.
- `GET /api/opportunities/export`: Export filtered opportunities to CSV.
- `GET /api/opportunities/stages`: Get workflow stage configuration.
- `GET /api/opportunities/qualification-criteria`: Get standard qualification criteria schema.
- `GET /api/opportunities/:id`: Full opportunity decision record.
- `PATCH /api/opportunities/:id`: Update core fields.
- `POST /api/opportunities/:id/stage`: Gated stage transition.
- `POST /api/opportunities/:id/qualify`: Submit qualification evaluation.
- `POST /api/opportunities/:id/close`: Formally close (WON, LOST, CANCELLED).
- `POST /api/opportunities/:id/reopen`: Reopen opportunity.
- `POST /api/opportunities/:id/products`: Associate product with relationship type.
- `DELETE /api/opportunities/:id/products/:productId`: Remove product association.
- `POST /api/opportunities/:id/markets`: Add target country.
- `DELETE /api/opportunities/:id/markets/:marketId`: Remove target country.
- `POST /api/opportunities/:id/risks`: Add risk.
- `PATCH /api/opportunities/:id/risks/:riskId`: Update risk mitigation/status.
- `POST /api/opportunities/:id/requirements`: Add requirement.
- `PATCH /api/opportunities/:id/requirements/:reqId`: Update requirement.
- `POST /api/opportunities/:id/comments`: Add team comment.
- `GET /api/opportunities/:id/tasks`: Fetch linked operational tasks from Step 7.
- `POST /api/opportunities/:id/tasks`: Create linked operational task.

---

## 10. Future Extensions Integration Points

1. **Market Intelligence & IMS Data Request**:
   - The Opportunity contains target markets (`opportunity_markets`) and products (`opportunity_products`).
   - Prepared for future table `market_research_requests` referencing `opportunity_id`, `product_id`, `molecule_id`, `country_id`, and `data_source` without altering the Opportunity schema.
2. **Regulatory Intelligence**:
   - Regulatory requirements recorded in `opportunity_requirements` link directly to upcoming patent expiry, DMF/CEP tracking, and bioequivalence databases.
3. **Production Feasibility**:
   - Extension point ready for CMO / manufacturing site capacity evaluation referencing `opportunity_id` and dosage form requirements.
4. **Executive Business Case & Board Decisions**:
   - The `opportunity_decisions` table provides the foundation for final board review and Capex approvals.
