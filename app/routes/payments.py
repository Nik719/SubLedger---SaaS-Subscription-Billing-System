"""Payment routes. HTTP I/O only — logic lives in PaymentService."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.repositories.customer_repo import CustomerRepository
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.ledger_repo import LedgerRepository
from app.repositories.payment_attempt_repo import PaymentAttemptRepository
from app.schemas.payment import PaymentRecordRequest, PaymentRecordResponse
from app.services.ledger_service import LedgerService
from app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["payments"])


def get_payment_service(db: Session = Depends(get_db)) -> PaymentService:
    ledger_service = LedgerService(LedgerRepository(db), CustomerRepository(db), db)
    return PaymentService(
        InvoiceRepository(db), PaymentAttemptRepository(db), ledger_service, db
    )


@router.post(
    "/record",
    response_model=PaymentRecordResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def record_payment(
    payload: PaymentRecordRequest,
    service: PaymentService = Depends(get_payment_service),
) -> PaymentRecordResponse:
    attempt, invoice = service.record_payment(payload)
    return PaymentRecordResponse.model_validate(
        {"attempt": attempt, "invoice": invoice}, from_attributes=True
    )
