"""Subscription request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.subscription import SubscriptionStatus


class SubscriptionCreate(BaseModel):
    customer_id: int
    plan_id: int
    start_date: datetime | None = None  # defaults to now (UTC) when omitted


class SubscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    customer_id: int
    plan_id: int
    status: SubscriptionStatus
    start_date: datetime
    current_period_start: datetime
    current_period_end: datetime
    cancelled_at: datetime | None
    created_at: datetime
