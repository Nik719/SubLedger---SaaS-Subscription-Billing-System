# Rules — AI Boundaries for SubLedger

These rules constrain every AI coding session on this project. Read `PRD.md` and `Architecture.md` first; when in conflict, PRD > Architecture > Rules > your judgment. Update `Memory.md` at the end of every session.

---

## 1. Libraries

**Allowed (do not add alternatives):**
- fastapi, uvicorn, sqlalchemy (2.x), alembic, pydantic (v2), pydantic-settings, psycopg2-binary, pytest, httpx, python-dotenv
- Frontend (later phases): react, vite, tailwindcss, react-router-dom, axios (or fetch)

**Forbidden:**
- Django, Flask, Tortoise, peewee, raw `sqlite3`/`psycopg2` queries outside repositories
- ORMs/query builders other than SQLAlchemy
- Any payment gateway SDK (stripe, razorpay) — payments are recorded, not processed
- Auth libraries unless the bonus auth phase is explicitly started
- Frontend state libs (Redux, Zustand) — use React state/context
- Any new dependency without asking first and recording it in Memory.md

## 2. Architecture rules
- Never put business logic in routes or repositories. Business rules (BR-1…BR-9) live in services only; DB constraints may back them up.
- Never write SQLAlchemy queries in services or routes. All DB access goes through repositories.
- One entity = one model file = one schema file = one repo = one service = one route file. Don't merge or split without asking.
- Inject DB sessions and repositories via FastAPI `Depends`. Never create sessions inline.
- Ledger is append-only: never write an update or delete method on `LedgerRepository`, and never expose one via API.
- Follow the folder tree in `Architecture.md` exactly. If a file doesn't fit, ask before creating it.
- Schema/model changes require an Alembic migration in the same change.

## 3. Error handling
- Raise domain exceptions (`NotFoundError`, `ConflictError`, `BusinessRuleViolation`) from services; never raise `HTTPException` from a service.
- Map domain exceptions to HTTP codes only in `core/exceptions.py` handlers (404 / 409 / 422 per Architecture §5).
- Every error response uses the envelope `{ "error": { "code", "message", "details" } }` with a stable machine-readable `code`.
- No bare `except:` and no silently swallowed exceptions. Don't log-and-continue on data-integrity failures.
- Validate at the boundary with Pydantic; don't re-validate types inside services (business rules only).

## 4. Code style & quality
- Type hints on all function signatures. `Decimal` for money — never float. UTC for all timestamps. Enums (`str, Enum`) for statuses — no magic strings.
- Keep functions small; no file over ~300 lines without asking.
- No commented-out code, no TODOs left in committed code — track pending work in Memory.md instead.
- Every new business rule gets a test in the same phase it's implemented.
- Config only via `core/config.py` settings — no `os.getenv` scattered in code, no hardcoded URLs/secrets. Keep `.env.example` updated.

## 5. Process rules (what the AI should/shouldn't do)
- Work only on the current phase in `Phases.md`. Do not start the next phase without confirmation.
- Do not refactor code outside the scope of the current task unless asked.
- Do not regenerate files wholesale to make a small edit — make targeted edits.
- Do not invent requirements. If PRD/Architecture is ambiguous, ask; record the decision in Memory.md.
- Run tests after every change set; a phase is not done with failing tests.
- Never delete migrations, tests, or ledger-related code without explicit confirmation.
- Keep commits/changes scoped to one phase step; update `Memory.md` (progress, decisions, next steps) at the end of each session **and immediately after completing each phase** — a phase is not done until Memory.md reflects it.
