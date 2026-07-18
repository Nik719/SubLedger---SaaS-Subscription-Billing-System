"""Plan business rules: BR-1 price > 0 (schema-validated, re-asserted here)."""

from sqlalchemy.orm import Session

from app.core.exceptions import BusinessRuleViolation, NotFoundError
from app.models.plan import Plan
from app.repositories.plan_repo import PlanRepository
from app.schemas.plan import PlanCreate, PlanUpdate


class PlanService:
    def __init__(self, plan_repo: PlanRepository, db: Session) -> None:
        self.plan_repo = plan_repo
        self.db = db

    def create_plan(self, data: PlanCreate) -> Plan:
        self._assert_price_positive(data.price)
        plan = Plan(
            name=data.name,
            description=data.description,
            billing_cycle=data.billing_cycle.value,
            price=data.price,
            currency=data.currency,
        )
        plan = self.plan_repo.create(plan)
        self.db.commit()
        return plan

    def list_plans(self) -> list[Plan]:
        return self.plan_repo.list_all()

    def update_plan(self, plan_id: int, data: PlanUpdate) -> Plan:
        plan = self.plan_repo.get(plan_id)
        if plan is None:
            raise NotFoundError(f"Plan {plan_id} not found", {"plan_id": plan_id})

        changes = data.model_dump(exclude_unset=True)
        if "price" in changes:
            self._assert_price_positive(changes["price"])

        for field, value in changes.items():
            setattr(plan, field, value.value if hasattr(value, "value") else value)

        plan = self.plan_repo.save(plan)
        self.db.commit()
        return plan

    @staticmethod
    def _assert_price_positive(price) -> None:
        if price is None or price <= 0:
            raise BusinessRuleViolation(
                "Plan price must be greater than 0", {"rule": "BR-1"}
            )
