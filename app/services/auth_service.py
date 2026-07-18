"""Auth business logic (Phase 9): credential checks + token issuance.

Customer login is passwordless (email only) — demo-grade by design; the PRD
domain model has no password store. Both invalid API keys and unknown emails
return 401 (no account enumeration via 404).
"""

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.core.security import ROLE_ADMIN, ROLE_CUSTOMER, create_token
from app.repositories.customer_repo import CustomerRepository
from app.schemas.auth import LoginRequest, TokenResponse


class AuthService:
    def __init__(self, customer_repo: CustomerRepository, db: Session) -> None:
        self.customer_repo = customer_repo
        self.db = db

    def login(self, data: LoginRequest) -> TokenResponse:
        if data.api_key is not None:
            if data.api_key != get_settings().admin_api_key:
                raise UnauthorizedError("Invalid credentials")
            return TokenResponse(
                access_token=create_token(ROLE_ADMIN), role=ROLE_ADMIN
            )

        customer = self.customer_repo.get_by_email(data.email.lower())
        if customer is None:
            raise UnauthorizedError("Invalid credentials")
        return TokenResponse(
            access_token=create_token(ROLE_CUSTOMER, customer.id),
            role=ROLE_CUSTOMER,
            customer_id=customer.id,
        )
