"""Invoice persistence. DB access only — no business decisions."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.invoice import Invoice


class InvoiceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, invoice: Invoice) -> Invoice:
        self.db.add(invoice)
        self.db.flush()
        self.db.refresh(invoice)
        return invoice

    def get(self, invoice_id: int) -> Invoice | None:
        return self.db.get(Invoice, invoice_id)

    def find_for_subscription_period(
        self, subscription_id: int, period_start: datetime, period_end: datetime
    ) -> Invoice | None:
        stmt = select(Invoice).where(
            Invoice.subscription_id == subscription_id,
            Invoice.period_start == period_start,
            Invoice.period_end == period_end,
        )
        return self.db.execute(stmt).scalars().first()

    def list_for_subscription(self, subscription_id: int) -> list[Invoice]:
        stmt = (
            select(Invoice)
            .where(Invoice.subscription_id == subscription_id)
            .order_by(Invoice.id)
        )
        return list(self.db.execute(stmt).scalars())

    def save(self, invoice: Invoice) -> Invoice:
        self.db.flush()
        self.db.refresh(invoice)
        return invoice
