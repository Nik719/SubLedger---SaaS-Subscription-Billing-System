"""Ledger routes (read-only). The ledger has no write/update/delete API."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.customer_repo import CustomerRepository
from app.repositories.ledger_repo import LedgerRepository
from app.schemas.ledger import LedgerEntryResponse
from app.services.ledger_service import LedgerService

router = APIRouter(prefix="/customers", tags=["ledger"])


def get_ledger_service(db: Session = Depends(get_db)) -> LedgerService:
    return LedgerService(LedgerRepository(db), CustomerRepository(db), db)


@router.get("/{customer_id}/ledger", response_model=list[LedgerEntryResponse])
def get_customer_ledger(
    customer_id: int, service: LedgerService = Depends(get_ledger_service)
) -> list[LedgerEntryResponse]:
    return service.get_customer_ledger(customer_id)
