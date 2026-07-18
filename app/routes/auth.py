"""Auth routes. HTTP I/O only — logic lives in AuthService."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories.customer_repo import CustomerRepository
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(CustomerRepository(db), db)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest, service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    return service.login(payload)
