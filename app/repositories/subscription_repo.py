"""Subscription persistence. DB access only — no business decisions."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.subscription import Subscription, SubscriptionStatus


class SubscriptionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, subscription: Subscription) -> Subscription:
        self.db.add(subscription)
        self.db.flush()
        self.db.refresh(subscription)
        return subscription

    def get(self, subscription_id: int) -> Subscription | None:
        return self.db.get(Subscription, subscription_id)

    def find_active_for_customer_and_plan(
        self, customer_id: int, plan_id: int
    ) -> Subscription | None:
        stmt = select(Subscription).where(
            Subscription.customer_id == customer_id,
            Subscription.plan_id == plan_id,
            Subscription.status == SubscriptionStatus.ACTIVE.value,
        )
        return self.db.execute(stmt).scalars().first()

    def list_filtered(
        self,
        customer_id: int | None = None,
        plan_id: int | None = None,
        status: str | None = None,
    ) -> list[Subscription]:
        stmt = select(Subscription).order_by(Subscription.id)
        if customer_id is not None:
            stmt = stmt.where(Subscription.customer_id == customer_id)
        if plan_id is not None:
            stmt = stmt.where(Subscription.plan_id == plan_id)
        if status is not None:
            stmt = stmt.where(Subscription.status == status)
        return list(self.db.execute(stmt).scalars())

    def save(self, subscription: Subscription) -> Subscription:
        self.db.flush()
        self.db.refresh(subscription)
        return subscription
