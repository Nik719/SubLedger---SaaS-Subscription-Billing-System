"""Ledger routes (read-only). The ledger has no write/update/delete API."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import (
    Principal,
    authorize_customer_access,
    get_principal,
    require_admin,
)
from app.db.session import get_db
from app.repositories.customer_repo import CustomerRepository
from app.repositories.ledger_repo import LedgerRepository
from app.schemas.ledger import LedgerEntryResponse
from app.services.ledger_service import LedgerService

router = APIRouter(tags=["ledger"])


def get_ledger_service(db: Session = Depends(get_db)) -> LedgerService:
    return LedgerService(LedgerRepository(db), CustomerRepository(db), db)


@router.get("/customers/{customer_id}/ledger", response_model=list[LedgerEntryResponse])
def get_customer_ledger(
    customer_id: int,
    service: LedgerService = Depends(get_ledger_service),
    principal: Principal = Depends(get_principal),
) -> list[LedgerEntryResponse]:
    authorize_customer_access(principal, customer_id)
    return service.get_customer_ledger(customer_id)


@router.get(
    "/ledger",
    response_model=list[LedgerEntryResponse],
    dependencies=[Depends(require_admin)],
)
def get_recent_ledger(
    limit: int = Query(default=20, ge=1, le=100),
    service: LedgerService = Depends(get_ledger_service),
) -> list[LedgerEntryResponse]:
    """Most-recent-first activity feed for the admin overview."""
    return service.get_recent(limit)
