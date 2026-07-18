"""Invoice business rules.

BR-5: amount_due snapshots the plan price at generation time.
Invoice + invoice_created ledger entry commit atomically (PRD 7.1).
One invoice per (subscription, billing period) — duplicate returns 409.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleViolation, ConflictError, NotFoundError
from app.models.invoice import Invoice
from app.models.ledger_entry import LedgerEntryType
from app.models.subscription import SubscriptionStatus
from app.repositories.invoice_repo import InvoiceRepository
from app.repositories.plan_repo import PlanRepository
from app.repositories.subscription_repo import SubscriptionRepository
from app.schemas.invoice import InvoiceGenerateRequest
from app.services.ledger_service import LedgerService

DUE_DAYS = 14  # payment terms: due 14 days after generation


class InvoiceService:
    def __init__(
        self,
        subscription_repo: SubscriptionRepository,
        plan_repo: PlanRepository,
        invoice_repo: InvoiceRepository,
        ledger_service: LedgerService,
        db: Session,
    ) -> None:
        self.subscription_repo = subscription_repo
        self.plan_repo = plan_repo
        self.invoice_repo = invoice_repo
        self.ledger_service = ledger_service
        self.db = db

    def generate_invoice(self, data: InvoiceGenerateRequest) -> Invoice:
        subscription = self.subscription_repo.get(data.subscription_id)
        if subscription is None:
            raise NotFoundError(
                f"Subscription {data.subscription_id} not found",
                {"subscription_id": data.subscription_id},
            )

        if subscription.status != SubscriptionStatus.ACTIVE.value:
            raise BusinessRuleViolation(
                "Cannot generate an invoice for a non-active subscription",
                {"subscription_id": subscription.id, "status": subscription.status},
            )

        plan = self.plan_repo.get(subscription.plan_id)

        period_start = data.period_start or subscription.current_period_start
        period_end = data.period_end or subscription.current_period_end
        if period_end <= period_start:
            raise BusinessRuleViolation(
                "period_end must be after period_start",
                {"period_start": str(period_start), "period_end": str(period_end)},
            )

        duplicate = self.invoice_repo.find_for_subscription_period(
            subscription.id, period_start, period_end
        )
        if duplicate is not None:
            raise ConflictError(
                "An invoice already exists for this subscription and billing period",
                {"existing_invoice_id": duplicate.id},
            )

        now = datetime.now(timezone.utc)
        invoice = Invoice(
            subscription_id=subscription.id,
            customer_id=subscription.customer_id,
            amount_due=plan.price,  # BR-5: price snapshot at generation time
            currency=plan.currency,
            period_start=period_start,
            period_end=period_end,
            due_date=now + timedelta(days=DUE_DAYS),
        )
        invoice = self.invoice_repo.create(invoice)

        self.ledger_service.append(
            customer_id=invoice.customer_id,
            invoice_id=invoice.id,
            entry_type=LedgerEntryType.INVOICE_CREATED,
            amount=invoice.amount_due,
            currency=invoice.currency,
            reference_id=f"invoice:{invoice.id}",
            description=f"Invoice generated for subscription {subscription.id}",
        )

        self.db.commit()  # invoice + ledger entry committed atomically
        return invoice

    def get_invoice(self, invoice_id: int) -> Invoice:
        invoice = self.invoice_repo.get(invoice_id)
        if invoice is None:
            raise NotFoundError(
                f"Invoice {invoice_id} not found", {"invoice_id": invoice_id}
            )
        return invoice
