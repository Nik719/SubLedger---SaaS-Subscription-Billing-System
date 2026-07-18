"""Authentication & authorization (Phase 9 bonus).

Two principals:
- admin    — authenticates with the X-API-Key header (or an admin JWT).
- customer — authenticates with `Authorization: Bearer <JWT>` from /auth/login.

Routes attach `require_admin` for admin-only endpoints, and call
`authorize_customer_access` for owner-scoped reads (admin passes, a customer
may only access their own data → 403 otherwise).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header

from app.core.config import get_settings
from app.core.exceptions import ForbiddenError, UnauthorizedError

ROLE_ADMIN = "admin"
ROLE_CUSTOMER = "customer"


@dataclass(frozen=True)
class Principal:
    role: str
    customer_id: int | None = None

    @property
    def is_admin(self) -> bool:
        return self.role == ROLE_ADMIN


def create_token(role: str, customer_id: int | None = None) -> str:
    settings = get_settings()
    payload = {
        "role": role,
        "customer_id": customer_id,
        "exp": datetime.now(timezone.utc)
        + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> Principal:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Token has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Invalid token") from exc
    return Principal(role=payload.get("role"), customer_id=payload.get("customer_id"))


def get_principal(
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> Principal:
    """Resolve the caller. API key (admin) or Bearer JWT; 401 otherwise."""
    settings = get_settings()

    if x_api_key is not None:
        if x_api_key == settings.admin_api_key:
            return Principal(role=ROLE_ADMIN)
        raise UnauthorizedError("Invalid API key")

    if authorization and authorization.startswith("Bearer "):
        return decode_token(authorization.removeprefix("Bearer "))

    raise UnauthorizedError("Missing credentials")


def require_admin(principal: Principal = Depends(get_principal)) -> Principal:
    if not principal.is_admin:
        raise ForbiddenError("Admin access required")
    return principal


def authorize_customer_access(principal: Principal, customer_id: int) -> None:
    """Admins pass; customers may only access their own records (403)."""
    if principal.is_admin:
        return
    if principal.role == ROLE_CUSTOMER and principal.customer_id == customer_id:
        return
    raise ForbiddenError(
        "You do not have access to this customer's data",
        {"customer_id": customer_id},
    )
