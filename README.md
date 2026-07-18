# SubLedger — SaaS Subscription & Billing System

A simplified subscription billing backend. It is **not** a payment gateway —
it's a billing foundation that manages the subscription lifecycle, generates
invoices, records payment attempts, and maintains an append-only financial
ledger.

Plan → Customer → Subscription → Invoice → Payment → Ledger.

## Stack

- Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic v2
- PostgreSQL 15 (Docker) for the running service; SQLite for tests
- Alembic for migrations
- pytest for tests
- Docker + docker-compose

## Architecture

Strict layering, each layer with one job:

```
routes (HTTP only) → services (business rules) → repositories (DB access) → models (SQLAlchemy)
schemas (Pydantic request/response) | core (config, exceptions) | db (session, Base)
```

- **Routes** — parse/validate I/O, call one service, no business logic.
- **Services** — own all business rules; no SQLAlchemy queries.
- **Repositories** — one per entity, all DB access, no business decisions.
- **Dependency injection** — DB sessions injected via FastAPI `Depends`.
- Domain errors (`NotFoundError`, `ConflictError`, `BusinessRuleViolation`)
  are raised in services and mapped centrally to HTTP responses with a
  consistent envelope: `{ "error": { "code", "message", "details" } }`.

## Getting started

### Run with Docker (recommended)

```bash
docker compose up -d --build
```

This starts Postgres, waits for it to be healthy, then runs
`alembic upgrade head` before starting the API. The app is available at
`http://localhost:8000` (Swagger docs at `/docs`, health check at `/health`).

To apply new migrations after pulling changes, restart the stack:

```bash
docker compose down
docker compose up -d --build
```

### Run locally (without Docker)

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
cp .env.example .env          # adjust DATABASE_URL if needed
alembic upgrade head
uvicorn app.main:app --reload
```

### Configuration

All config is read from environment variables (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `APP_NAME` | `SubLedger` | Service name |
| `DEBUG` | `false` | Debug flag |
| `DATABASE_URL` | `postgresql+psycopg2://subledger:subledger@localhost:5432/subledger` | SQLAlchemy connection string |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins |
| `ADMIN_API_KEY` | `dev-admin-key` | Admin credential (change outside dev) |
| `JWT_SECRET` | `dev-jwt-secret-change-me` | JWT signing secret (change outside dev) |
| `JWT_EXPIRES_MINUTES` | `720` | Token lifetime |

## Authentication (Phase 9 bonus)

Two roles, one login endpoint (`POST /api/v1/auth/login`):

- **Admin** — send `{"api_key": "..."}` (matches `ADMIN_API_KEY`), or pass
  the key directly as an `X-API-Key` header on any request. Admins can do
  everything.
- **Customer** — send `{"email": "..."}` to receive a JWT
  (`Authorization: Bearer <token>`). Customers are **server-side scoped to
  their own data**: list endpoints are forced to their own records, and
  direct reads of another customer's resources return `403`.
  Login is passwordless (email only) — demo-grade by design, since the
  domain model has no password store.

Public without credentials: `/health`, `GET /api/v1/plans` (catalog),
`/docs`. Everything else returns `401` without valid credentials.

### Run the admin frontend (Phase 6+)

```bash
cd frontend
npm install
npm run dev
```

Opens at `http://localhost:5173` (allowed by the API's `CORS_ORIGINS`
setting). Screens: Overview (KPIs + activity feed), Plans (list, create,
edit, deactivate), Customers (list, search, create, detail with
Subscriptions / Invoices / Ledger tabs), Subscriptions (list, filter,
create, cancel, generate invoice), Invoice detail (paid-vs-due progress,
payment attempts, record payment with remaining-amount guard). The full
happy path — plan → customer → subscription → invoice → payment → paid —
is achievable entirely in the UI. Design tokens follow `Design.md`; every
data view has loading, empty, and error states. Set `VITE_API_URL` to
point at a non-default API address.

The admin app requires signing in at `/login` with the admin API key.
The **customer portal** lives at `/portal` (read-only, responsive):
customers sign in with their account email and see only their own
subscriptions, invoices with payment history, and activity feed — enforced
server-side. Admins visiting `/portal` get a browse-as-customer picker.

## Running tests

Tests run against SQLite and need no external services (Postgres/Docker not
required):

```bash
pip install -r requirements.txt
pytest -q
```

57 tests cover the business rules below, the invoice-generation and
payment-recording flows end to end, and auth (401/403, role enforcement,
customer data scoping).

## API

Base URL: `/api/v1`. All errors use the envelope above; standard cases are
`400` validation, `404` not found, `409` conflict, `422` business-rule
violation.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/plans` | Create a plan |
| GET | `/plans` | List plans |
| PATCH | `/plans/{plan_id}` | Update / deactivate a plan |
| POST | `/customers` | Create a customer |
| GET | `/customers` | List customers |
| GET | `/customers/{customer_id}` | Fetch a customer |
| POST | `/subscriptions` | Create a subscription |
| GET | `/subscriptions` | List subscriptions (filter by customer/plan/status) |
| PATCH | `/subscriptions/{subscription_id}/cancel` | Cancel a subscription |
| POST | `/invoices/generate` | Generate an invoice for an active subscription |
| GET | `/invoices` | List invoices (filter by subscription/customer/status) |
| GET | `/invoices/{invoice_id}` | Fetch an invoice |
| GET | `/invoices/{invoice_id}/payments` | List payment attempts for an invoice |
| POST | `/payments/record` | Record a payment attempt |
| GET | `/customers/{customer_id}/ledger` | Fetch a customer's ledger history |
| GET | `/ledger` | Recent ledger activity (feed, `?limit=`) |
| GET | `/health` | Liveness probe |

Full interactive docs at `/docs` (Swagger) once the app is running.

## Domain model

| Entity | Notes |
|---|---|
| **Plan** | name, price, currency, billing cycle, status |
| **Customer** | unique email |
| **Subscription** | one active subscription per (customer, plan) |
| **Invoice** | `amount_due` snapshotted from plan price at generation time |
| **PaymentAttempt** | `success` or `failed`, tied to an invoice |
| **LedgerEntry** | append-only; `invoice_created`, `payment_success`, `payment_failure` |

## Business rules

| # | Rule | Enforced at |
|---|---|---|
| BR-1 | Plan price must be > 0 | Plan schema + PlanService |
| BR-2 | Customer email must be unique | CustomerService + repo + DB constraint |
| BR-3 | A subscription cannot be created for an inactive plan | SubscriptionService |
| BR-4 | A customer cannot have two active subscriptions to the same plan | SubscriptionService + repo |
| BR-5 | Invoice `amount_due` comes from the plan price at generation time | InvoiceService |
| BR-6 | A successful payment cannot exceed the remaining unpaid amount | PaymentService |
| BR-7 | Fully paid invoice → `paid`; partial payment → `partially_paid` | PaymentService |
| BR-8 | A failed payment must not increase `amount_paid` | PaymentService |
| BR-9 | Ledger entries are append-only, traceable via `reference_id` | LedgerService + repo (no update/delete paths) |

## Core flows

**Invoice generation**: fetch subscription → verify it's active → snapshot
plan price → create invoice → append `invoice_created` ledger entry.

**Payment recording**: fetch invoice → validate amount (and, for success,
that it doesn't exceed the remaining unpaid balance) → create the payment
attempt → on success, update `amount_paid`/status; on failure, store the
failure reason only → append the matching ledger entry.

## Assumptions & limitations

**Assumptions**

- Payments are **recorded**, not processed — there is no real payment
  gateway integration.
- Invoices are created as `issued`; `due_date` = generation time + 14 days.
- One invoice per (subscription, billing period); duplicates return `409`.
- Billing periods are calendar-aware: Jan 31 + 1 month → Feb 28/29
  (cycles: monthly, quarterly, yearly).
- Customer emails are normalized to lowercase, so uniqueness (BR-2) is
  case-insensitive.
- BR-6 caps **successful** payments only; failed attempts of any amount are
  recordable as evidence and never touch the invoice (BR-8).
- Single currency per invoice; payment currency must match the invoice;
  no currency conversion.
- Timestamps are stored in UTC.

**Limitations**

- Customer login is passwordless (email only) — sufficient for the bonus
  demo, not for production; add a password/OTP store to harden it.
- `overdue` status exists but is not auto-derived (no scheduler); `draft`
  and `void` transitions are not exposed via the API.
- No pagination on list endpoints.
- Invoice generation is manual — there is no recurring billing job.
- No taxation, proration, or metered billing.
