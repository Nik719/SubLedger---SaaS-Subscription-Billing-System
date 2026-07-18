"""Ledger business rules (BR-9): append-only entries, traceable via
reference_id. append() only flushes — the calling service owns the commit so
ledger entries land in the same transaction as the event they record."""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.ledger_entry import LedgerEntry, LedgerEntryType
from app.repositories.customer_repo import CustomerRepository
from app.repositories.ledger_repo import LedgerRepository


class LedgerService:
    def __init__(
        self, ledger_repo: LedgerRepository, customer_repo: CustomerRepository, db: Session
    ) -> None:
        self.ledger_repo = ledger_repo
        self.customer_repo = customer_repo
        self.db = db

    def append(
        self,
        customer_id: int,
        invoice_id: int,
        entry_type: LedgerEntryType,
        amount: Decimal,
        currency: str,
        reference_id: str,
        description: str | None = None,
    ) -> LedgerEntry:
        entry = LedgerEntry(
            customer_id=customer_id,
            invoice_id=invoice_id,
            entry_type=entry_type.value,
            amount=amount,
            currency=currency,
            reference_id=reference_id,
            description=description,
        )
        return self.ledger_repo.create(entry)  # flush only; caller commits

    def get_recent(self, limit: int = 20) -> list[LedgerEntry]:
        return self.ledger_repo.list_recent(limit)

    def get_customer_ledger(self, customer_id: int) -> list[LedgerEntry]:
        if self.customer_repo.get(customer_id) is None:
            raise NotFoundError(
                f"Customer {customer_id} not found", {"customer_id": customer_id}
            )
        return self.ledger_repo.list_for_customer(customer_id)
