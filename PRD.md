# PRD — SubLedger: SaaS Subscription & Billing System

| | |
|---|---|
| **Version** | 1.0 |
| **Status** | Draft for review |
| **Author** | Nikhil |
| **Last updated** | 18 Jul 2026 |
| **Audience** | Design team, Backend team, Frontend team, QA |
| **Source** | Airtribe Backend-Python Module 16 project brief |

---

## 1. Overview

### 1.1 Problem
Every SaaS company needs a reliable way to manage plans, customers, subscriptions, invoices, payments, and an auditable financial trail. Existing tools (Stripe, Razorpay) are heavyweight and abstract away the core billing logic teams need to understand and control.

### 1.2 Product
SubLedger is a simplified subscription billing system. It is **not** a payment gateway clone — it is a clean billing foundation that manages the subscription lifecycle, generates invoices, records payment attempts, and maintains an append-only financial ledger. It ships with a web app: an **Admin Dashboard** for operators and a **Customer Portal** for end customers.

### 1.3 Goals
1. Manage the full subscription lifecycle: plan → customer → subscription → invoice → payment → ledger.
2. Enforce billing correctness through explicit business rules (no overpayment, no duplicate active subscriptions, append-only ledger).
3. Provide a clean, layered backend (routes → services → repositories → models) that is easy to understand, test, and extend.
4. Provide a usable UI for both operators (admin) and customers (portal).

### 1.4 Non-goals (out of scope)
- Real payment gateway integration (payments are recorded, not processed).
- Complex taxation, proration, or metered billing.
- Authentication / RBAC (may be attempted as a bonus).
- Multi-currency conversion (currency is stored, not converted).

### 1.5 Success criteria
- All required APIs implemented and passing tests (≥ 5 tests covering business rules).
- All business rules in §5 enforced at the correct layer.
- LLD documents (ERD, service/repository tables, flow diagrams) delivered before/with implementation.
- Admin can complete every core flow (create plan → invoice paid) through the UI without touching the API directly.

---

## 2. Users & Personas

| Persona | Description | Primary needs |
|---|---|---|
| **Billing Admin** (primary) | Operations/finance person at the SaaS company | Create plans, manage customers & subscriptions, generate invoices, record payments, audit the ledger |
| **Customer** (secondary) | End customer of the SaaS company | View their subscriptions, invoices, payment history, and ledger |
| **Developer / Integrator** | Engineer consuming the API | Clear REST API, predictable errors, API docs |

---

## 3. Domain Model

This is the minimum required design. Fields may be added with justification.

| Entity | Core fields | Notes |
|---|---|---|
| **Plan** | id, name, description, billing_cycle, price, currency, status, created_at, updated_at | billing_cycle: `monthly`, `quarterly`, `yearly`, or custom (justify if custom) |
| **Customer** | id, name, email, company_name, status, created_at | **Email must be unique** |
| **Subscription** | id, customer_id, plan_id, status, start_date, current_period_start, current_period_end, cancelled_at | Base rule: **one active subscription per (customer, plan)** |
| **Invoice** | id, subscription_id, customer_id, amount_due, amount_paid, currency, status, period_start, period_end, due_date, created_at | status: `draft`, `issued`, `partially_paid`, `paid`, `overdue`, `void` |
| **PaymentAttempt** | id, invoice_id, amount, currency, status, provider_reference, failure_reason, created_at | status: `success` or `failed` |
| **LedgerEntry** | id, customer_id, invoice_id, entry_type, amount, currency, reference_id, description, created_at | **Append-only.** entry_type: `invoice_created`, `payment_success`, `payment_failure` |

**Relationships**
- Customer 1—N Subscriptions, Customer 1—N LedgerEntries
- Plan 1—N Subscriptions
- Subscription 1—N Invoices
- Invoice 1—N PaymentAttempts, Invoice 1—N LedgerEntries

---

## 4. Functional Requirements

### FR-1 Plan Management
- Create, update, list, and deactivate plans with price, billing cycle, currency, and status.
- Deactivated plans remain visible for history but cannot receive new subscriptions.

### FR-2 Customer Management
- Create and list customers with unique email and basic company/contact details.

### FR-3 Subscription Lifecycle
- Create, activate, cancel, and fetch subscriptions.
- Prevent invalid duplicate active subscriptions (same customer + same plan).
- Cancelling sets `cancelled_at` and status; cancelled subscriptions cannot generate new invoices.

### FR-4 Invoicing
- Generate invoices for active subscriptions.
- Track `amount_due`, `amount_paid`, status, and billing period.
- `amount_due` is snapshotted from the plan price **at generation time** (later plan price changes do not affect existing invoices).

### FR-5 Payments
- Record successful and failed payment attempts against an invoice.
- Successful payments update invoice `amount_paid` and status; failed payments do not.

### FR-6 Ledger
- Create append-only ledger entries for `invoice_created`, `payment_success`, and `payment_failure` events.
- Fetch a customer's full ledger history.

---

## 5. Business Rules (must be enforced — each needs a test)

| # | Rule | Enforced at |
|---|---|---|
| BR-1 | Plan price must be > 0 | Plan schema + PlanService |
| BR-2 | Customer email must be unique | CustomerService + CustomerRepository + DB unique constraint |
| BR-3 | A subscription cannot be created for an inactive plan | SubscriptionService |
| BR-4 | A customer cannot have two active subscriptions to the same plan | SubscriptionService + SubscriptionRepository |
| BR-5 | Invoice `amount_due` comes from the plan price at invoice generation time | InvoiceService |
| BR-6 | A successful payment cannot exceed the remaining unpaid amount on the invoice | PaymentService |
| BR-7 | Fully paid invoice → `paid`; partial payment → `partially_paid` | PaymentService |
| BR-8 | A failed payment must not increase `amount_paid` | PaymentService |
| BR-9 | Ledger entries are append-only and traceable via `reference_id` | LedgerService + LedgerRepository (no update/delete paths) |

---

## 6. API Specification

Base URL: `/api/v1` (JSON in/out). Errors return a consistent envelope: `{ "error": { "code", "message", "details" } }`.

| Method | Endpoint | Purpose | Key rules |
|---|---|---|---|
| POST | `/plans` | Create a subscription plan | BR-1 |
| GET | `/plans` | List plans | — |
| PATCH | `/plans/{plan_id}` | Update / deactivate a plan | BR-1 |
| POST | `/customers` | Create a customer | BR-2 |
| GET | `/customers` | List customers | — |
| GET | `/customers/{customer_id}` | Fetch customer details | 404 if missing |
| POST | `/subscriptions` | Create a subscription | BR-3, BR-4 |
| GET | `/subscriptions` | List subscriptions | filterable by customer/status |
| PATCH | `/subscriptions/{subscription_id}/cancel` | Cancel a subscription | idempotent-safe |
| POST | `/invoices/generate` | Generate invoice for a subscription | BR-5; subscription must be active |
| GET | `/invoices/{invoice_id}` | Fetch invoice details | 404 if missing |
| POST | `/payments/record` | Record a payment attempt | BR-6, BR-7, BR-8 |
| GET | `/customers/{customer_id}/ledger` | Fetch customer ledger history | BR-9 |

**Standard error cases (all endpoints)**: 400 validation error, 404 not found, 409 conflict (duplicate email, duplicate active subscription), 422 business-rule violation.

---

## 7. Core Flows

### 7.1 Invoice generation
1. Route receives `subscription_id` and optional billing period.
2. InvoiceService fetches subscription via SubscriptionRepository.
3. Verify subscription exists and is **active** (else 404/422).
4. Fetch plan details / plan price snapshot.
5. Calculate `amount_due` and billing period.
6. InvoiceRepository creates invoice with `issued` (or `draft`) status.
7. LedgerService appends `invoice_created` entry.
8. Route returns the invoice response.

### 7.2 Payment recording
1. Route receives `invoice_id`, amount, currency, status, `provider_reference`.
2. PaymentService fetches invoice via InvoiceRepository (404 if missing).
3. Validate amount > 0 and, for success, amount ≤ remaining unpaid (BR-6).
4. PaymentAttemptRepository creates the attempt record.
5. **Failed** → store `failure_reason`; do not touch `amount_paid` (BR-8).
6. **Success** → update `amount_paid` and invoice status (BR-7).
7. LedgerService appends `payment_success` / `payment_failure` entry.
8. Route returns the attempt + updated invoice status.

### 7.3 End-to-end happy path
Create plan → create customer → create subscription → generate invoice → record payment(s) → invoice `paid` → ledger shows `invoice_created` + `payment_success`.

---

## 8. Design Requirements (for the Design team)

Two surfaces: **Admin Dashboard** (primary, desktop-first) and **Customer Portal** (secondary, responsive). Clean B2B SaaS aesthetic; data-dense tables; status communicated by color-coded badges.

### 8.1 Admin Dashboard — screens

| # | Screen | Contents & key interactions |
|---|---|---|
| A1 | **Overview** | KPI cards (MRR proxy = sum of active subscription plan prices, active subscriptions, overdue invoices, payments today), recent ledger activity feed |
| A2 | **Plans list** | Table: name, price + currency, billing cycle, status badge, active subscription count. Actions: create, edit, deactivate (confirm dialog — explain existing subscriptions are unaffected) |
| A3 | **Plan create/edit** | Form: name, description, price (must be > 0 — inline validation), currency, billing cycle (monthly/quarterly/yearly), status |
| A4 | **Customers list** | Table: name, email, company, status, subscription count. Search by name/email. Action: create customer (email uniqueness error surfaced inline on 409) |
| A5 | **Customer detail** | Profile header + tabs: Subscriptions, Invoices, **Ledger** (read-only append-only timeline: entry type icon, amount, reference, timestamp) |
| A6 | **Subscriptions list** | Table: customer, plan, status badge, current period, start date. Filters: status, customer, plan. Actions: create, cancel (confirm dialog) |
| A7 | **Subscription create** | Picker: customer → plan (inactive plans hidden/disabled). Duplicate-active-subscription error (409) shown clearly with link to the existing subscription |
| A8 | **Subscription detail** | Status, period dates, plan snapshot, invoice list, "Generate invoice" action (disabled with tooltip if not active) |
| A9 | **Invoice detail** | Amount due vs amount paid (progress indicator), status badge, billing period, due date, payment attempts table (success/failed with failure reason), "Record payment" action |
| A10 | **Record payment (modal)** | Fields: amount, currency, status (success/failed), provider reference, failure reason (shown only when failed). Validation: success amount cannot exceed remaining unpaid — show remaining amount in the modal |

### 8.2 Customer Portal — screens

| # | Screen | Contents |
|---|---|---|
| C1 | **My subscriptions** | Cards: plan name, price, billing cycle, status, current period |
| C2 | **My invoices** | List with status badges; detail view shows amounts, period, payment history |
| C3 | **My ledger** | Read-only chronological activity feed |

### 8.3 Status badge system (shared design tokens)

| Domain | States → suggested color |
|---|---|
| Plan | active (green), inactive (gray) |
| Subscription | active (green), cancelled (gray) |
| Invoice | draft (gray), issued (blue), partially_paid (amber), paid (green), overdue (red), void (gray strikethrough) |
| Payment | success (green), failed (red) |

### 8.4 UX rules
- Every destructive/irreversible action (deactivate plan, cancel subscription) gets a confirmation dialog stating consequences.
- Business-rule violations (409/422) surface as human-readable inline errors, not toasts alone — e.g. "This customer already has an active subscription to Pro Monthly."
- Ledger UI must have **no** edit or delete affordances anywhere.
- Empty states for every list (no plans yet, no invoices yet) with a primary CTA.
- Amounts always shown with currency; never render a bare number.
- Loading, error, and empty states required for every data view.

### 8.5 Design deliverables
- Wireframes → hi-fi mockups for A1–A10, C1–C3 (desktop; responsive for portal).
- Component library: table, status badge, form fields, modal, confirmation dialog, timeline/feed item, KPI card.
- Error/empty/loading state specs per screen.

---

## 9. Engineering Requirements (for the Dev team)

### 9.1 Stack
Python 3.11+, FastAPI, SQLAlchemy, Pydantic schemas, PostgreSQL (SQLite acceptable for tests), Docker + docker-compose, pytest. Config via environment variables / `.env.example`. No hardcoded secrets or DB URLs.

### 9.2 Architecture — layered, strict separation

```
routes (HTTP only) → services (business rules) → repositories (DB read/write) → models (SQLAlchemy)
schemas (Pydantic request/response) | config | db (session, Base)
```

- **Routes**: parse/validate I/O, call one service, map exceptions → HTTP codes. No business logic.
- **Services**: own all business rules (§5). No SQLAlchemy queries.
- **Repositories**: all DB access. One repository per entity. No business decisions.
- **Dependency injection**: DB sessions and dependencies injected (FastAPI `Depends`), never created inline.
- **Design pattern**: Repository Pattern (or Service Layer) — document the choice and why.

### 9.3 Service responsibilities

| Service | Owns |
|---|---|
| PlanService | Validate price, billing cycle, plan status changes |
| CustomerService | Create customers, email uniqueness check, fetch profile |
| SubscriptionService | Create/cancel subscriptions, check plan active, prevent duplicate active subscriptions |
| InvoiceService | Generate invoices for active subscriptions, calculate amount_due, update invoice status after payment |
| PaymentService | Record payment attempts, validate amount, trigger invoice status update and ledger entry |
| LedgerService | Create append-only ledger entries, fetch customer ledger history |

### 9.4 LLD deliverables (in `DESIGN.md` / `README.md`, before or with implementation)

| Deliverable | Status |
|---|---|
| Entity Relationship Diagram (image, Mermaid, or schema table) | **Mandatory** |
| Service responsibility table | **Mandatory** |
| Repository responsibility table (entities each repo reads/writes) | **Mandatory** |
| Business-rule ownership map (rule → schema/service/repo/DB constraint) | **Mandatory** |
| One design pattern used and why | **Mandatory** |
| Invoice generation flow (bullets/pseudocode/diagram) | Guided/simple |
| Payment recording flow (bullets/pseudocode/diagram) | Guided/simple |
| Class diagram | Optional |

### 9.5 Testing
- Minimum **5 tests** covering business rules; recommended coverage: BR-1, BR-2, BR-4, BR-6, BR-7 + BR-8 (failed payment), and the two core flows end-to-end.
- Tests must run without external services (SQLite/testcontainers).

### 9.6 Submission checklist
- [ ] GitHub repo with completed implementation
- [ ] `README.md`: setup steps, API list, assumptions, limitations
- [ ] `DESIGN.md` (or README section): ERD, repository table, business-rule ownership, design pattern rationale, invoice flow, payment flow
- [ ] ≥ 5 business-rule tests passing
- [ ] Dockerfile + docker-compose (or clear local setup commands)
- [ ] Swagger/OpenAPI docs (FastAPI default) or Postman collection — optional but valued
- [ ] Submit by **Jul 26, 11:30 PM IST**

---

## 10. Milestones

| Phase | Deliverable | Owner |
|---|---|---|
| M1 | LLD docs approved (ERD, service/repo tables, rule ownership) | Backend |
| M2 | Backend: models, migrations, plans + customers APIs | Backend |
| M3 | Backend: subscriptions, invoices, payments, ledger + tests | Backend |
| M4 | Wireframes for A1–A10, C1–C3 | Design |
| M5 | Hi-fi mockups + component library | Design |
| M6 | Frontend build against API | Frontend |
| M7 | Docker, docs, submission | Backend |

---

## 11. Open Questions
1. Should invoice generation ever auto-run on a schedule, or is it always manually triggered? (Brief implies manual — assume manual for v1.)
2. `overdue` status: set manually, or derived when `due_date` passes? (Recommend derived at read time for v1.)
3. Is auth attempted as the bonus (simple API key or JWT), which would gate the customer portal? (Portal requires at least a customer identifier; decide before M6.)
4. Custom billing cycles beyond monthly/quarterly/yearly — supported in v1? (Default: no.)

## 12. Assumptions
- Payments are **recorded**, not processed — no gateway webhooks.
- Single currency per invoice; no conversion.
- One invoice per billing period per subscription (duplicates for same period should be prevented or documented as a limitation).
- Timestamps stored in UTC.
