"""Invoice request/response schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.models.invoice import InvoiceStatus


class InvoiceGenerateRequest(BaseModel):
    subscription_id: int
    period_start: datetime | None = None  # defaults to subscription's current period
    period_end: datetime | None = None


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    subscription_id: int
    customer_id: int
    amount_due: Decimal
    amount_paid: Decimal
    currency: str
    status: InvoiceStatus
    period_start: datetime
    period_end: datetime
    due_date: datetime
    created_at: datetime
