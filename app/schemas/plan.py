"""Plan request/response schemas. BR-1 (price > 0) enforced here first."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models.plan import BillingCycle, PlanStatus


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    billing_cycle: BillingCycle
    price: Decimal = Field(gt=0, description="Must be greater than 0 (BR-1)")
    currency: str = Field(min_length=3, max_length=3, pattern="^[A-Z]{3}$")


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    billing_cycle: BillingCycle | None = None
    price: Decimal | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    status: PlanStatus | None = None


class PlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    billing_cycle: BillingCycle
    price: Decimal
    currency: str
    status: PlanStatus
    created_at: datetime
    updated_at: datetime
