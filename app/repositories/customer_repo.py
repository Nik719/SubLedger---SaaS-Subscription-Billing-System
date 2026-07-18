"""Customer persistence. DB access only — no business decisions (Rules.md 2)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.customer import Customer


class CustomerRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, customer: Customer) -> Customer:
        self.db.add(customer)
        self.db.flush()
        self.db.refresh(customer)
        return customer

    def get(self, customer_id: int) -> Customer | None:
        return self.db.get(Customer, customer_id)

    def get_by_email(self, email: str) -> Customer | None:
        stmt = select(Customer).where(Customer.email == email)
        return self.db.execute(stmt).scalar_one_or_none()

    def list_all(self) -> list[Customer]:
        return list(self.db.execute(select(Customer).order_by(Customer.id)).scalars())
