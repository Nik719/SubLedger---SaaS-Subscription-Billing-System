"""Shared test fixtures.

Tests run against SQLite (Architecture.md 1) so no external services are
needed. DATABASE_URL is forced before app imports so the engine binds SQLite.
Each test gets a fresh schema for isolation.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_subledger.db")

import pytest
from fastapi.testclient import TestClient

import app.models  # noqa: F401  # register all models on Base.metadata
from app.db.base import Base
from app.db.session import engine
from app.main import app


@pytest.fixture()
def client() -> TestClient:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as test_client:
        yield test_client
