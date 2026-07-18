"""Payment request/response schemas."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.payment_attempt import PaymentStatus
from app.schemas.invoice import InvoiceResponse


class PaymentRecordRequest(BaseModel):
    invoice_id: int
    amount: Decimal = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, pattern="^[A-Z]{3}$")
    status: PaymentStatus
    provider_reference: str = Field(min_length=1, max_length=100)
    failure_reason: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def check_failure_reason(self) -> "PaymentRecordRequest":
        if self.status == PaymentStatus.FAILED and not self.failure_reason:
            raise ValueError("failure_reason is required when status is 'failed'")
        if self.status == PaymentStatus.SUCCESS and self.failure_reason:
            raise ValueError("failure_reason must be empty when status is 'success'")
        return self


class PaymentAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    amount: Decimal
    currency: str
    status: PaymentStatus
    provider_reference: str
    failure_reason: str | None
    created_at: datetime


class PaymentRecordResponse(BaseModel):
    """PRD 7.2 step 8: return the attempt and the updated invoice."""

    attempt: PaymentAttemptResponse
    invoice: InvoiceResponse
