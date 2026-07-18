"""Domain exceptions and their HTTP mapping (Architecture.md 5).

Services raise these; only this module knows about HTTP. Envelope:
{ "error": { "code", "message", "details" } }
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class DomainError(Exception):
    """Base for all business/domain errors."""

    http_status = 500
    code = "INTERNAL_ERROR"

    def __init__(self, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class UnauthorizedError(DomainError):
    http_status = 401
    code = "UNAUTHORIZED"


class ForbiddenError(DomainError):
    http_status = 403
    code = "FORBIDDEN"


class NotFoundError(DomainError):
    http_status = 404
    code = "NOT_FOUND"


class ConflictError(DomainError):
    http_status = 409
    code = "CONFLICT"


class BusinessRuleViolation(DomainError):
    http_status = 422
    code = "BUSINESS_RULE_VIOLATION"


def _envelope(code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def domain_error_handler(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_envelope(
                "VALIDATION_ERROR",
                "Request validation failed",
                jsonable_encoder(exc.errors()),
            ),
        )
