"""Application settings, loaded from environment / .env file.

All settings are prefixed with MICHI_ (docs/ARCHITECTURE.md §4). Michi's
secret and settings are entirely independent of Mishka Hub's own — the two
apps share nothing but the identity verification call (docs/AUTH.md).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# .../learningLanguageMachine/apps/server/app/config.py
#   parents[1] = apps/server (the backend dir, where .env lives)
#   parents[3] = learningLanguageMachine (the project root, where data/ lives)
SERVER_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(SERVER_DIR / ".env"),
        env_prefix="MICHI_",
        extra="ignore",
    )

    environment: str = "development"

    # --- Auth (docs/AUTH.md). 32+ random bytes, e.g. `openssl rand -hex 32`.
    # Independent of MISHKA_JWT_SECRET — rotating one never affects the
    # other app's sessions. ---
    jwt_secret: str = ""
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    # --- The one call Michi makes to Mishka Hub: verifying a login
    # (docs/AUTH.md §2). Loopback by default; identity.py refuses a plain
    # http non-loopback URL at startup. ---
    mishka_base_url: str = "http://127.0.0.1:8000"

    # --- Freeform conversation mode (routers/converse.py). The household
    # adds MICHI_ANTHROPIC_API_KEY to .env themselves; without it the
    # endpoint answers a friendly 503 and the UI explains. Haiku by default:
    # NPC small talk is short and cheap, and latency matters more than depth
    # in a spoken back-and-forth. ---
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # --- CORS. Michi's web app owns 5174 (Mishka's owns 5173). ---
    cors_origins: list[str] = [
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "https://fyreline.github.io",
    ]

    # SQLite lives in the project-level data/ folder (CWD-independent absolute path).
    database_url: str = f"sqlite:///{DATA_DIR / 'michi.db'}"

    @property
    def auth_configured(self) -> bool:
        return bool(self.jwt_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()
