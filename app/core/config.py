"""Application settings.

All configuration is read from environment variables (or a local .env file).
No other module may call os.getenv directly (Rules.md 4).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SubLedger"
    debug: bool = False
    database_url: str = (
        "postgresql+psycopg2://subledger:subledger@localhost:5432/subledger"
    )
    cors_origins: str = "http://localhost:5173"  # comma-separated

    # Auth (Phase 9 bonus)
    admin_api_key: str = "dev-admin-key"  # override in .env for anything real
    jwt_secret: str = "dev-jwt-secret-change-me"
    jwt_expires_minutes: int = 60 * 12

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor, injectable via FastAPI Depends."""
    return Settings()
