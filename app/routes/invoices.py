"""Invoice routes. HTTP I/O only — each endpoint calls exactly one service
(InvoiceService, or PaymentService for the payments sub-resource)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import (
    Principal,
    authorize_customer_access,
    get_principal,
    require_admin,
)
from app.db.session import get_db
from app.models.invoice import InvoiceStatus
from app.repositories.customer_repo import CustomerRepository
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.ledger_repo import LedgerRepository
from app.repositories.payment_attempt_repo import PaymentAttemptRepository
from app.repositories.plan_repo import PlanRepository
from app.repositories.subscription_repo import SubscriptionRepository
from app.schemas.invoice import InvoiceGenerateRequest, InvoiceResponse
from app.schemas.payment import PaymentAttemptResponse
from app.services.invoice_service import InvoiceService
from app.services.ledger_service import LedgerService
from app.services.payment_service import PaymentService

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
    "/generate",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def generate_invoice(
    payload: InvoiceGenerateRequest,
    service: InvoiceService = Depends(get_invoice_service),
) -> InvoiceResponse:
    return service.generate_invoice(payload)


@router.get("", response_model=list[InvoiceResponse])
def list_invoices(
    subscription_id: int | None = Query(default=None),
    customer_id: int | None = Query(default=None),
    status_filter: InvoiceStatus | None = Query(default=None, alias="status"),
    service: InvoiceService = Depends(get_invoice_service),
    principal: Principal = Depends(get_principal),
) -> list[InvoiceResponse]:
    # Customers are always scoped to their own invoices (server-side)
    if not principal.is_admin:
        customer_id = principal.customer_id
    return service.list_invoices(
        subscription_id=subscription_id,
        customer_id=customer_id,
        status=status_filter.value if status_filter else None,
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
def get_invoice(
    invoice_id: int,
    service: InvoiceService = Depends(get_invoice_service),
    principal: Principal = Depends(get_principal),
) -> InvoiceResponse:
    invoice = service.get_invoice(invoice_id)
    authorize_customer_access(principal, invoice.customer_id)
    return invoice


def get_payment_service(db: Session = Depends(get_db)) -> PaymentService:
    ledger_service = LedgerService(LedgerRepository(db), CustomerRepository(db), db)
    return PaymentService(
        InvoiceRepository(db), PaymentAttemptRepository(db), ledger_service, db
    )


@router.get("/{invoice_id}/payments", response_model=list[PaymentAttemptResponse])
def list_invoice_payments(
    invoice_id: int,
    service: PaymentService = Depends(get_payment_service),
    invoice_service: InvoiceService = Depends(get_invoice_service),
    principal: Principal = Depends(get_principal),
) -> list[PaymentAttemptResponse]:
    invoice = invoice_service.get_invoice(invoice_id)
    authorize_customer_access(principal, invoice.customer_id)
    return service.list_attempts_for_invoice(invoice_id)
