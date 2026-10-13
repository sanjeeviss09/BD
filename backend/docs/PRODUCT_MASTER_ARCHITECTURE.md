# BDIQ Platform — Product Master Architecture (Step 8)

## Executive Summary
The **Product Master Module** establishes the canonical pharmaceutical identity layer for the entire BDIQ platform. It decouples the core chemical/generic identity (Molecule) from physical pharmaceutical formulations (Dosage Form, Strength, Route) and specific commercial packages (Product Presentations, Brand Names, Target Countries, and Corporate Entities). 

This architecture guarantees that future commercial intelligence (e.g. IMS / IQVIA market observations, 24-month sales/volume trends, pricing, competitor market share) and regulatory intelligence (e.g. approvals, patent expirations, DMF filings) connect natively through stable identifiers without altering the underlying product identity.

---

## 1. Canonical Pharmaceutical Identity Model

The identity model strictly distinguishes between hierarchical pharmacological and commercial concepts:

```
[Molecule (API)] 
   └── [Therapeutic Area / Category]
   └── [Canonical Molecule Aliases & INN/Salt Forms]
        │
        ▼
[Product Master] 
   ├── Canonical Product Code (PROD-YYYY-000001)
   ├── Product Name (e.g. Atorvastatin 20mg Film-Coated Tablet)
   ├── Dosage Form (e.g. Film-Coated Tablet)
   ├── Strength Numerical Value (20) & Unit (mg)
   ├── Route of Administration (Oral)
   ├── Product Category (Generic, Innovator, Biosimilar, API)
   ├── Lifecycle Status (ACTIVE, UNDER_DEVELOPMENT, UNDER_EVALUATION, ARCHIVED)
   │
   ├── [Product Presentations] (e.g. 30 Tablets in Alu-Alu Blister Pack)
   ├── [Corporate Relationships] (Originator, CMO, Marketer, License Holder)
   ├── [Target Countries] (Country ISO-2, Market Status, Target Launch Date)
   ├── [Product Aliases] (Internal SKUs, Regional Brands, Customer References)
   └── [Linked Tasks] (Feasibility, Dossier Reviews, Follow-ups from Step 7)
```

---

## 2. Database Schema & Multi-Tenant Isolation

### 2.1 Database Migrations
Defined in `supabase/migrations/006_product_master.sql`:
- **Idempotent DDL**: Employs `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS`.
- **Sequence Generation**: PostgreSQL sequence `product_code_seq` combined with `generate_next_product_code()` generates human-readable business codes (`PROD-2026-000001`).
- **Optimistic Concurrency**: Stored `version` column protects concurrent edits from silent overwrites.

### 2.2 Table Definitions
| Table | Description | Scope |
| :--- | :--- | :--- |
| `products` | Core pharmaceutical product record | Tenant-Owned (`organization_id`) |
| `product_presentations` | Finished pack sizes, packaging types, units | Tenant-Owned (`organization_id`) |
| `product_companies` | Corporate entities & relationship types | Tenant-Owned (`organization_id`) |
| `product_countries` | Country market status & launch dates | Tenant-Owned (`organization_id`) |
| `product_aliases` | Brand aliases, internal SKUs, regional names | Tenant-Owned (`organization_id`) |
| `molecules` | Active pharmaceutical substances / APIs | Global Reference + Tenant Custom |
| `molecule_aliases` | Molecule synonyms, salt forms, INN | Global Reference |
| `dosage_forms` | Normalized pharmaceutical forms & route compatibility | Master Reference (System) |
| `routes_of_administration` | Physiological delivery routes | Master Reference (System) |
| `strength_units` | Normalized mass, volume, concentration units | Master Reference (System) |
| `countries` | ISO 3166-1 alpha-2 / alpha-3 master | Master Reference (System) |
| `therapeutic_categories` | Hierarchical Anatomical / Therapeutic classification | Master Reference (System) |

### 2.3 Row-Level Security (RLS)
All tenant-owned tables enforce strict row-level security using `get_auth_user_organization_id()`:
```sql
CREATE POLICY products_tenant_isolation_policy ON products
  FOR ALL
  USING (organization_id = get_auth_user_organization_id())
  WITH CHECK (organization_id = get_auth_user_organization_id());
```
Global reference tables (`dosage_forms`, `routes_of_administration`, `strength_units`, `countries`, `therapeutic_categories`, and global `molecules`) allow read access for authenticated users while protecting system integrity.

---

## 3. Product Normalization & Duplicate Detection Algorithm

The backend implements `ProductIdentityService` for text standardization and duplicate detection scoring:

### 3.1 Text Normalization Rules
1. Converts strings to lowercase.
2. Replaces non-alphanumeric characters with single whitespace.
3. Trims leading and trailing spaces.
4. Normalizes numeric strengths and symbols (e.g. `20 mg`, `0.5 mg/mL`).

### 3.2 Duplicate Scoring Matrix
When a user drafts a product, the system calculates similarity scores against the tenant catalog:

| Match Condition | Confidence Score | Action / Explanation |
| :--- | :--- | :--- |
| **Identical Formulation** | **100%** | Exact match on Molecule + Strength + Dosage Form + Route. |
| **Exact Normalized Name** | **95%** | Matches existing product name identically. |
| **Molecule + Form Sibling** | **65%** | Same molecule and dosage form with distinct strength (legitimate sibling presentation). |
| **Brand Name Match** | **75%** | Proprietary brand overlaps with existing catalog item. |
| **Alias Match** | **70%** | Candidate matches an established product alias or SKU. |

**Safeguard**: The system **never merges records automatically**. If a score $\ge 80\%$ is detected, the API warns the user with details of the conflicting entries, requiring human confirmation (`forceCreate: true`) to proceed.

---

## 4. API Endpoints & RBAC Authorization

All endpoints are mounted under `/api/products` and protected by `requireAuth` and `requirePermission`:

| Method | Endpoint | RBAC Permission | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | `products.read` | Paginated search, faceted filtering |
| `POST` | `/api/products` | `products.create` | Create canonical product with duplicate detection |
| `GET` | `/api/products/:id` | `products.read` | Complete product profile with presentations & tasks |
| `PATCH` | `/api/products/:id` | `products.update` | Update product attributes with version check |
| `POST` | `/api/products/:id/archive` | `products.archive` | Soft-archive product with mandatory reason |
| `POST` | `/api/products/:id/restore` | `products.archive` | Restore archived product |
| `POST` | `/api/products/duplicate-check` | `products.read` | Real-time duplicate checking for draft inputs |
| `GET` | `/api/products/analytics` | `products.read` | Aggregated catalog metrics |
| `GET` | `/api/products/export` | `products.export` | Export filtered catalog to CSV |
| `POST` | `/api/products/:id/presentations` | `products.manage` | Add presentation pack configuration |
| `DELETE`| `/api/products/:id/presentations/:presId` | `products.manage` | Remove presentation |
| `POST` | `/api/products/:id/companies` | `products.manage` | Add partner / CMO relationship |
| `DELETE`| `/api/products/:id/companies/:compId` | `products.manage` | Remove partner relationship |
| `POST` | `/api/products/:id/countries` | `products.manage` | Add target country applicability |
| `DELETE`| `/api/products/:id/countries/:cId` | `products.manage` | Remove country applicability |
| `POST` | `/api/products/:id/aliases` | `products.manage` | Add brand alias or regional name |
| `DELETE`| `/api/products/:id/aliases/:aliasId` | `products.manage` | Remove alias |

---

## 5. Integration with Existing & Future Modules

### 5.1 Step 7 Task Management Integration
The Product Detail view directly connects with the Task Tracking Engine built in Step 7:
- Products track linked tasks (`tasks.product_id = products.id`).
- Regulatory reviews, technical evaluations, and formulation follow-ups appear directly in the **Tasks tab** of the product workspace.

### 5.2 Extension Points for Future Modules
1. **Market Intelligence (IMS / IQVIA Observations)**:
   - Historical commercial observations (24-month volume trends, sales revenues, price per unit, market share) will reference `products.id` and `product_presentations.id` alongside `time_period` and `country_id`.
   - Sales figures are strictly decoupled from the Product Master to prevent static data pollution.
2. **Regulatory Intelligence**:
   - Marketing authorizations, DMF filings, clinical trial clearances, and patent expiries will link to `products.id` by country.
3. **Opportunity Management & RFQ**:
   - Commercial opportunities (`opportunities.product_id`) and customer quotation requests reference the canonical product.
