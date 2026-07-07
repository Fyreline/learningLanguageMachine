"""routers/health.py — status + cached identity reachability probe."""
from __future__ import annotations

import httpx
import respx

MISHKA_BASE = "http://127.0.0.1:8000"


@respx.mock
def test_health_reachable(client):
    respx.get(f"{MISHKA_BASE}/api/health").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["identity"] == "reachable"
    assert "content_version" in body


@respx.mock
def test_health_unreachable_when_mishka_down(client):
    route = respx.get(f"{MISHKA_BASE}/api/health").mock(side_effect=httpx.ConnectError("refused"))
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["identity"] == "unreachable"
    assert route.called


@respx.mock
def test_health_reachability_is_cached(client):
    route = respx.get(f"{MISHKA_BASE}/api/health").mock(return_value=httpx.Response(200, json={"status": "ok"}))
    client.get("/api/health")
    client.get("/api/health")
    client.get("/api/health")
    assert route.call_count == 1, "the 60s cache should short-circuit repeat probes"


def test_health_does_not_require_auth(client):
    res = client.get("/api/health")
    assert res.status_code == 200
