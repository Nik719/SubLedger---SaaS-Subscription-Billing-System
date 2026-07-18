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

## Running tests

Tests run against SQLite and need no external services (Postgres/Docker not
required):

```bash
pip install -r requirements.txt
pytest -q
```

45 tests cover the business rules below plus the invoice-generation and
payment-recording flows end to end.

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
| GET | `/invoices/{invoice_id}` | Fetch an invoice |
| POST | `/payments/record` | Record a payment attempt |
| GET | `/customers/{customer_id}/ledger` | Fetch a customer's ledger history |
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

- Payments are **recorded**, not processed — there is no real payment
  gateway integration.
- Single currency per invoice; no currency conversion.
- No authentication/RBAC in this version.
- No taxation, proration, or metered billing.
- Timestamps are stored in UTC.
