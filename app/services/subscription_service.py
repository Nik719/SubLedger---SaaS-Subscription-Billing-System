"""Subscription business rules.

BR-3: no subscription for an inactive plan (422).
BR-4: no duplicate active subscription per (customer, plan) (409).
Cancel is idempotent-safe: cancelling a cancelled subscription is a no-op.
"""

import calendar
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleViolation, ConflictError, NotFoundError
from app.models.plan import BillingCycle, PlanStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.repositories.customer_repo import CustomerRepository
from app.repositories.plan_repo import PlanRepository
from app.repositories.subscription_repo import SubscriptionRepository
from app.schemas.subscription import SubscriptionCreate

CYCLE_MONTHS: dict[str, int] = {
    BillingCycle.MONTHLY.value: 1,
    BillingCycle.QUARTERLY.value: 3,
    BillingCycle.YEARLY.value: 12,
}


def add_months(moment: datetime, months: int) -> datetime:
    """Calendar-aware month addition (clamps day, e.g. Jan 31 + 1mo = Feb 28/29)."""
    month_index = moment.month - 1 + months
    year = moment.year + month_index // 12
    month = month_index % 12 + 1
    day = min(moment.day, calendar.monthrange(year, month)[1])
    return moment.replace(year=year, month=month, day=day)


class SubscriptionService:
    def __init__(
        self,
        subscription_repo: SubscriptionRepository,
        plan_repo: PlanRepository,
        customer_repo: CustomerRepository,
        db: Session,
    ) -> None:
        self.subscription_repo = subscription_repo
        self.plan_repo = plan_repo
        self.customer_repo = customer_repo
        self.db = db

    def create_subscription(self, data: SubscriptionCreate) -> Subscription:
        customer = self.customer_repo.get(data.customer_id)
        if customer is None:
            raise NotFoundError(
                f"Customer {data.customer_id} not found",
                {"customer_id": data.customer_id},
            )

        plan = self.plan_repo.get(data.plan_id)
        if plan is None:
            raise NotFoundError(
                f"Plan {data.plan_id} not found", {"plan_id": data.plan_id}
            )

        if plan.status != PlanStatus.ACTIVE.value:
            raise BusinessRuleViolation(
                "Cannot subscribe to an inactive plan",
                {"rule": "BR-3", "plan_id": plan.id},
            )

        existing = self.subscription_repo.find_active_for_customer_and_plan(
            data.customer_id, data.plan_id
        )
        if existing is not None:
            raise ConflictError(
                "Customer already has an active subscription to this plan",
                {"rule": "BR-4", "existing_subscription_id": existing.id},
            )

        start = data.start_date or datetime.now(timezone.utc)
        period_end = add_months(start, CYCLE_MONTHS[plan.billing_cycle])

        subscription = Subscription(
            customer_id=data.customer_id,
            plan_id=data.plan_id,
            start_date=start,
            current_period_start=start,
            current_period_end=period_end,
        )
        subscription = self.subscription_repo.create(subscription)
        self.db.commit()
        return subscription

    def list_subscriptions(
        self,
        customer_id: int | None = None,
        plan_id: int | None = None,
        status: SubscriptionStatus | None = None,
    ) -> list[Subscription]:
        return self.subscription_repo.list_filtered(
            customer_id=customer_id,
            plan_id=plan_id,
            status=status.value if status else None,
        )

    def get_subscription(self, subscription_id: int) -> Subscription:
        subscription = self.subscription_repo.get(subscription_id)
        if subscription is None:
            raise NotFoundError(
                f"Subscription {subscription_id} not found",
                {"subscription_id": subscription_id},
            )
        return subscription

    def cancel_subscription(self, subscription_id: int) -> Subscription:
        subscription = self.get_subscription(subscription_id)

        if subscription.status == SubscriptionStatus.CANCELLED.value:
            return subscription  # idempotent-safe: already cancelled is a no-op

        subscription.status = SubscriptionStatus.CANCELLED.value
        subscription.cancelled_at = datetime.now(timezone.utc)
        subscription = self.subscription_repo.save(subscription)
        self.db.commit()
        return subscription
