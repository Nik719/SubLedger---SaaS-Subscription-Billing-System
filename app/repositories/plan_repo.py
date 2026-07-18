"""Plan persistence. DB access only — no business decisions (Rules.md 2)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.plan import Plan


class PlanRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, plan: Plan) -> Plan:
        self.db.add(plan)
        self.db.flush()
        self.db.refresh(plan)
        return plan

    def get(self, plan_id: int) -> Plan | None:
        return self.db.get(Plan, plan_id)

    def list_all(self) -> list[Plan]:
        return list(self.db.execute(select(Plan).order_by(Plan.id)).scalars())

    def save(self, plan: Plan) -> Plan:
        self.db.flush()
        self.db.refresh(plan)
        return plan
