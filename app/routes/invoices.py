"""Invoice routes. HTTP I/O only — logic lives in InvoiceService."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.customer_repo import CustomerRepository
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.ledger_repo import LedgerRepository
from app.repositories.plan_repo import PlanRepository
from app.repositories.subscription_repo import SubscriptionRepository
from app.schemas.invoice import InvoiceGenerateRequest, InvoiceResponse
from app.services.invoice_service import InvoiceService
from app.services.ledger_service import LedgerService

router = APIRouter(prefix="/invoices", tags=["invoices"])


def get_invoice_service(db: Session = Depends(get_db)) -> InvoiceService:
    ledger_service = LedgerService(LedgerRepository(db), CustomerRepository(db), db)
    return InvoiceService(
        SubscriptionRepository(db),
        PlanRepository(db),
        InvoiceRepository(db),
        ledger_service,
        db,
    )


@router.post(
    "/generate", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED
)
def generate_invoice(
    payload: InvoiceGenerateRequest,
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceResponse:
    return service.generate_invoice(payload)


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int, service: InvoiceService = Depends(get_invoice_service)
) -> InvoiceResponse:
    return service.get_invoice(invoice_id)
