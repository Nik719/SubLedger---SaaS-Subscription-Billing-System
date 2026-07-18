"""Subscription routes. HTTP I/O only — logic lives in SubscriptionService."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import Principal, get_principal, require_admin
from app.db.session import get_db
from app.models.subscription import SubscriptionStatus
from app.repositories.customer_repo import CustomerRepository
from app.repositories.plan_repo import PlanRepository
from app.repositories.subscription_repo import SubscriptionRepository
from app.schemas.subscription import SubscriptionCreate, SubscriptionResponse
from app.services.subscription_service import SubscriptionService

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def get_subscription_service(db: Session = Depends(get_db)) -> SubscriptionService:
    return SubscriptionService(
        SubscriptionRepository(db), PlanRepository(db), CustomerRepository(db), db
    )


@router.post(
    "",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_subscription(
    payload: SubscriptionCreate,
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    return service.create_subscription(payload)


@router.get("", response_model=list[SubscriptionResponse])
def list_subscriptions(
    customer_id: int | None = Query(default=None),
    plan_id: int | None = Query(default=None),
    status_filter: SubscriptionStatus | None = Query(default=None, alias="status"),
    service: SubscriptionService = Depends(get_subscription_service),
    principal: Principal = Depends(get_principal),
) -> list[SubscriptionResponse]:
    # Customers are always scoped to their own subscriptions (server-side)
    if not principal.is_admin:
        customer_id = principal.customer_id
    return service.list_subscriptions(
        customer_id=customer_id, plan_id=plan_id, status=status_filter
    )


@router.patch(
    "/{subscription_id}/cancel",
    response_model=SubscriptionResponse,
    dependencies=[Depends(require_admin)],
)
def cancel_subscription(
    subscription_id: int,
    service: SubscriptionService = Depends(get_subscription_service),
) -> SubscriptionResponse:
    return service.cancel_subscription(subscription_id)
