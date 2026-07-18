"""Ledger persistence. APPEND-ONLY (BR-9): create + reads. No update or
delete methods may EVER be added here (Rules.md 2)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ledger_entry import LedgerEntry


class LedgerRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, entry: LedgerEntry) -> LedgerEntry:
        self.db.add(entry)
        self.db.flush()
        self.db.refresh(entry)
        return entry

    def list_for_customer(self, customer_id: int) -> list[LedgerEntry]:
        stmt = (
            select(LedgerEntry)
            .where(LedgerEntry.customer_id == customer_id)
            .order_by(LedgerEntry.id)
        )
        return list(self.db.execute(stmt).scalars())

    def list_recent(self, limit: int) -> list[LedgerEntry]:
        stmt = select(LedgerEntry).order_by(LedgerEntry.id.desc()).limit(limit)
        return list(self.db.execute(stmt).scalars())
