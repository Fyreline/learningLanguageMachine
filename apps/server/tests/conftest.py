"""Shared pytest fixtures.

Sets test-only env vars (isolated sqlite file, a throwaway JWT secret) BEFORE
anything imports the ``app`` package, since app/config.py + app/db.py read
settings at import time. No pytest-asyncio needed: FastAPI's own dependency
(starlette) pulls in anyio, which registers its own pytest plugin, so plain
``@pytest.mark.anyio`` works for testing async code directly (e.g.
identity.py) without an extra dev dependency.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

_TEST_DATA_DIR = Path(tempfile.mkdtemp(prefix="michi-test-"))
os.environ.setdefault("MICHI_JWT_SECRET", "test-secret-not-for-production-use-only")
os.environ.setdefault("MICHI_DATABASE_URL", f"sqlite:///{_TEST_DATA_DIR / 'michi-test.db'}")
os.environ.setdefault("MICHI_MISHKA_BASE_URL", "http://127.0.0.1:8000")
os.environ.setdefault("MICHI_ENVIRONMENT", "test")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402
from app.routers import auth as auth_module  # noqa: E402
from app.routers import health as health_module  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def _clean_state():
    """Fresh tables, a reset health-reachability cache, and a reset login
    rate-limit deque for every test — all three are module-level state that
    would otherwise leak between tests."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    health_module._cache["checked_at"] = 0.0
    health_module._cache["reachable"] = False
    auth_module._login_failures.clear()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
