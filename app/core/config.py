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


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor, injectable via FastAPI Depends."""
    return Settings()
