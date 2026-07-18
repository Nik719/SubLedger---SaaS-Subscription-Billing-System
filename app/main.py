"""FastAPI application factory and router registration."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.routes import (
    auth,
    customers,
    invoices,
    ledger,
    payments,
    plans,
    subscriptions,
)

API_PREFIX = "/api/v1"


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        description="SubLedger - SaaS Subscription & Billing System",
        version="0.1.0",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(application)

    application.include_router(auth.router, prefix=API_PREFIX)
    application.include_router(plans.router, prefix=API_PREFIX)
    application.include_router(customers.router, prefix=API_PREFIX)
    application.include_router(subscriptions.router, prefix=API_PREFIX)
    application.include_router(invoices.router, prefix=API_PREFIX)
    application.include_router(payments.router, prefix=API_PREFIX)
    application.include_router(ledger.router, prefix=API_PREFIX)

    @application.get("/health", tags=["ops"])
    def health() -> dict[str, str]:
        """Liveness probe."""
        return {"status": "ok", "service": settings.app_name}

    return application


app = create_app()
