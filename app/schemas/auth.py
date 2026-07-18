"""Auth request/response schemas (Phase 9)."""

from pydantic import BaseModel, EmailStr, model_validator


class LoginRequest(BaseModel):
    email: EmailStr | None = None  # customer login
    api_key: str | None = None  # admin login

    @model_validator(mode="after")
    def exactly_one_credential(self) -> "LoginRequest":
        if bool(self.email) == bool(self.api_key):
            raise ValueError("Provide either email (customer) or api_key (admin)")
        return self


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    customer_id: int | None = None
