"""Payment business rules (PRD 7.2).

BR-6: a successful payment cannot exceed the remaining unpaid amount.
BR-7: fully paid -> 'paid'; partial payment -> 'partially_paid'.
BR-8: a failed payment never changes amount_paid or invoice status.
Attempt + invoice update + ledger entry commit atomically.
"""

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleViolation, NotFoundError
from app.models.invoice import Invoice, InvoiceStatus
from app.models.ledger_entry import LedgerEntryType
from app.models.payment_attempt import PaymentAttempt, PaymentStatus
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.payment_attempt_repo import PaymentAttemptRepository
from app.schemas.payment import PaymentRecordRequest
from app.services.ledger_service import LedgerService

# Invoices that can accept payment attempts
PAYABLE_STATUSES = {
    InvoiceStatus.ISSUED.value,
    InvoiceStatus.PARTIALLY_PAID.value,
    InvoiceStatus.OVERDUE.value,
}


class PaymentService:
    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        payment_attempt_repo: PaymentAttemptRepository,
        ledger_service: LedgerService,
        db: Session,
    ) -> None:
        self.invoice_repo = invoice_repo
        self.payment_attempt_repo = payment_attempt_repo
        self.ledger_service = ledger_service
        self.db = db

    def record_payment(self, data: PaymentRecordRequest) -> tuple[PaymentAttempt, Invoice]:
        invoice = self.invoice_repo.get(data.invoice_id)
        if invoice is None:
            raise NotFoundError(
                f"Invoice {data.invoice_id} not found", {"invoice_id": data.invoice_id}
            )

        if invoice.status not in PAYABLE_STATUSES:
            raise BusinessRuleViolation(
                f"Invoice in status '{invoice.status}' cannot accept payments",
                {"invoice_id": invoice.id, "status": invoice.status},
            )

        if data.currency != invoice.currency:
            raise BusinessRuleViolation(
                "Payment currency does not match invoice currency",
                {"invoice_currency": invoice.currency, "payment_currency": data.currency},
            )

        remaining = invoice.amount_due - invoice.amount_paid
        if data.status == PaymentStatus.SUCCESS and data.amount > remaining:
            raise BusinessRuleViolation(
                "Payment exceeds the remaining unpaid amount on the invoice",
                {"rule": "BR-6", "remaining": str(remaining), "amount": str(data.amount)},
            )

        attempt = self.payment_attempt_repo.create(
            PaymentAttempt(
                invoice_id=invoice.id,
                amount=data.amount,
                currency=data.currency,
                status=data.status.value,
                provider_reference=data.provider_reference,
                failure_reason=data.failure_reason,
            )
        )

        if data.status == PaymentStatus.SUCCESS:
            invoice.amount_paid = invoice.amount_paid + data.amount
            invoice.status = (  # BR-7
                InvoiceStatus.PAID.value
                if invoice.amount_paid == invoice.amount_due
                else InvoiceStatus.PARTIALLY_PAID.value
            )
            invoice = self.invoice_repo.save(invoice)
            entry_type = LedgerEntryType.PAYMENT_SUCCESS
            description = f"Payment received for invoice {invoice.id}"
        else:
            # BR-8: failed payment — amount_paid and status untouched
            entry_type = LedgerEntryType.PAYMENT_FAILURE
            description = f"Payment failed for invoice {invoice.id}: {data.failure_reason}"

        self.ledger_service.append(
            customer_id=invoice.customer_id,
            invoice_id=invoice.id,
            entry_type=entry_type,
            amount=data.amount,
            currency=data.currency,
            reference_id=f"payment_attempt:{attempt.id}",
            description=description,
        )

        self.db.commit()  # attempt + invoice update + ledger entry, atomically
        return attempt, invoice
