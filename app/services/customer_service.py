"""Customer business rules: BR-2 unique email (service check + DB backstop)."""

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.models.customer import Customer
from app.repositories.customer_repo import CustomerRepository
from app.schemas.customer import CustomerCreate


class CustomerService:
    def __init__(self, customer_repo: CustomerRepository, db: Session) -> None:
        self.customer_repo = customer_repo
        self.db = db

    def create_customer(self, data: CustomerCreate) -> Customer:
        email = data.email.lower()
        if self.customer_repo.get_by_email(email) is not None:
            raise ConflictError(
                "A customer with this email already exists",
                {"rule": "BR-2", "email": email},
            )
        customer = Customer(
            name=data.name, email=email, company_name=data.company_name
        )
        try:
            customer = self.customer_repo.create(customer)
            self.db.commit()
        except IntegrityError as exc:  # race-condition backstop for BR-2
            self.db.rollback()
            raise ConflictError(
                "A customer with this email already exists",
                {"rule": "BR-2", "email": email},
            ) from exc
        return customer

    def list_customers(self) -> list[Customer]:
        return self.customer_repo.list_all()

    def get_customer(self, customer_id: int) -> Customer:
        customer = self.customer_repo.get(customer_id)
        if customer is None:
            raise NotFoundError(
                f"Customer {customer_id} not found", {"customer_id": customer_id}
            )
        return customer
