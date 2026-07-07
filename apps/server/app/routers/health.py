"""GET /api/health — docs/API.md "Misc": {status, identity, content_version}.

The Mishka Hub reachability probe uses a 1s timeout (identity.py's ``ping``)
and is cached for 60s at module scope so health checks don't hammer or block
on Mishka Hub.
"""
from __future__ import annotations

import time

from fastapi import APIRouter, Request

from app import content

router = APIRouter(tags=["health"])

_CACHE_TTL_SECONDS = 60
_cache: dict[str, float | bool] = {"checked_at": 0.0, "reachable": False}


async def _identity_reachable(request: Request) -> bool:
    now = time.monotonic()
    if now - _cache["checked_at"] < _CACHE_TTL_SECONDS:
        return bool(_cache["reachable"])
    identity = request.app.state.identity
    reachable = await identity.ping()
    _cache["checked_at"] = now
    _cache["reachable"] = reachable
    return reachable


@router.get("/health")
async def health(request: Request) -> dict:
    reachable = await _identity_reachable(request)
    return {
        "status": "ok",
        "identity": "reachable" if reachable else "unreachable",
        # Curriculum content ships in Phase 2 (docs/phases/PHASE-2-content.md);
        # a fixed placeholder until content/manifest.json exists to version off.
        "content_version": content.manifest()["course"] if content.manifest() else "no-content",
    }
