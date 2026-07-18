"""PaymentAttempt persistence. DB access only — no business decisions."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.payment_attempt import PaymentAttempt


class PaymentAttemptRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, attempt: PaymentAttempt) -> PaymentAttempt:
        self.db.add(attempt)
        self.db.flush()
        self.db.refresh(attempt)
        return attempt

    def list_for_invoice(self, invoice_id: int) -> list[PaymentAttempt]:
        stmt = (
            select(PaymentAttempt)
            .where(PaymentAttempt.invoice_id == invoice_id)
            .order_by(PaymentAttempt.id)
        )
        return list(self.db.execute(stmt).scalars())
