"""routers/auth.py — login (proxy verify)/refresh/rotate/reuse-tripwire/
settings, with the identity call stubbed via respx (docs/AUTH.md §2,
docs/phases/PHASE-1-scaffold.md).
"""
from __future__ import annotations

import httpx
import respx

MISHKA_BASE = "http://127.0.0.1:8000"


def _mock_mishka_login_success(email="amy@example.com", display_name="Amy", mishka_id=7):
    respx.post(f"{MISHKA_BASE}/api/auth/login").mock(
        return_value=httpx.Response(
            200,
            json={
                "access_token": "throwaway",
                "refresh_token": "throwaway-refresh",
                "expires_in": 900,
                "user": {"id": mishka_id, "email": email, "display_name": display_name},
            },
        )
    )
    respx.post(f"{MISHKA_BASE}/api/auth/logout").mock(return_value=httpx.Response(200, json={"logged_out": True}))


@respx.mock
def test_login_success_issues_tokens_and_upserts_user(client):
    _mock_mishka_login_success()
    res = client.post("/api/auth/login", json={"email": "Amy@Example.com", "password": "hunter2"})
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "amy@example.com"
    assert body["user"]["display_name"] == "Amy"
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["expires_in"] == 15 * 60


@respx.mock
def test_login_display_name_refreshes_on_second_login(client):
    _mock_mishka_login_success(display_name="Amy")
    client.post("/api/auth/login", json={"email": "amy@example.com", "password": "hunter2"})

    _mock_mishka_login_success(display_name="Amy Renamed")
    res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "hunter2"})
    assert res.json()["user"]["display_name"] == "Amy Renamed"


@respx.mock
def test_login_wrong_password_returns_401(client):
    respx.post(f"{MISHKA_BASE}/api/auth/login").mock(
        return_value=httpx.Response(401, json={"detail": "no", "code": "invalid_credentials"})
    )
    res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "wrong"})
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"


@respx.mock
def test_login_mishka_down_returns_503(client):
    respx.post(f"{MISHKA_BASE}/api/auth/login").mock(side_effect=httpx.ConnectError("refused"))
    res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "hunter2"})
    assert res.status_code == 503
    assert res.json()["code"] == "identity_unavailable"


@respx.mock
def test_login_mishka_rate_limited_returns_429(client):
    respx.post(f"{MISHKA_BASE}/api/auth/login").mock(return_value=httpx.Response(429, json={"detail": "slow down"}))
    res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "hunter2"})
    assert res.status_code == 429
    assert res.json()["code"] == "rate_limited"


@respx.mock
def test_repeated_failed_logins_trip_michis_own_rate_limit(client):
    respx.post(f"{MISHKA_BASE}/api/auth/login").mock(
        return_value=httpx.Response(401, json={"detail": "no", "code": "invalid_credentials"})
    )
    for _ in range(5):
        res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "wrong"})
        assert res.status_code == 401
    # 6th attempt in the window: Michi's own limiter trips before even calling Mishka.
    res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "wrong"})
    assert res.status_code == 429
    assert res.json()["code"] == "rate_limited"


@respx.mock
def test_refresh_rotates_token(client):
    _mock_mishka_login_success()
    login_res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "hunter2"})
    old_refresh = login_res.json()["refresh_token"]

    refresh_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert refresh_res.status_code == 200
    new_refresh = refresh_res.json()["refresh_token"]
    assert new_refresh != old_refresh

    # The old (now-rotated-away) token is spent.
    reuse_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse_res.status_code == 401
    assert reuse_res.json()["code"] == "refresh_reuse_detected"


@respx.mock
def test_refresh_reuse_revokes_all_sessions(client):
    _mock_mishka_login_success()
    login_res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "hunter2"})
    old_refresh = login_res.json()["refresh_token"]

    refresh_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    new_refresh = refresh_res.json()["refresh_token"]

    reuse_res = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse_res.status_code == 401
    assert reuse_res.json()["code"] == "refresh_reuse_detected"

    # The tripwire revoked EVERY session, including the one just rotated to.
    followup = client.post("/api/auth/refresh", json={"refresh_token": new_refresh})
    assert followup.status_code == 401
    assert followup.json()["code"] == "refresh_reuse_detected"


@respx.mock
def test_refresh_unknown_token_rejected(client):
    res = client.post("/api/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_refresh_token"


@respx.mock
def test_logout_revokes_token(client):
    _mock_mishka_login_success()
    login_res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "hunter2"})
    refresh_token = login_res.json()["refresh_token"]

    logout_res = client.post("/api/auth/logout", json={"refresh_token": refresh_token})
    assert logout_res.status_code == 200
    assert logout_res.json()["logged_out"] is True

    refresh_res = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 401


@respx.mock
def test_logout_unknown_token_is_still_200(client):
    res = client.post("/api/auth/logout", json={"refresh_token": "never-issued"})
    assert res.status_code == 200
    assert res.json()["logged_out"] is True


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert res.json()["code"] == "unauthorized"


def test_settings_requires_auth(client):
    res = client.put("/api/auth/settings", json={"romaji": "hide"})
    assert res.status_code == 401


@respx.mock
def test_me_and_settings_merge_patch(client):
    _mock_mishka_login_success()
    login_res = client.post("/api/auth/login", json={"email": "amy@example.com", "password": "hunter2"})
    access_token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["settings"] == {}
    assert me_res.json()["email"] == "amy@example.com"

    patch_res = client.put(
        "/api/auth/settings", json={"romaji": "fade", "daily_goal_xp": 50}, headers=headers
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["settings"] == {"romaji": "fade", "daily_goal_xp": 50}

    # A second, partial patch merges rather than clobbers.
    patch_res_2 = client.put("/api/auth/settings", json={"romaji": "hide"}, headers=headers)
    assert patch_res_2.json()["settings"] == {"romaji": "hide", "daily_goal_xp": 50}

    me_res2 = client.get("/api/auth/me", headers=headers)
    assert me_res2.json()["settings"] == {"romaji": "hide", "daily_goal_xp": 50}


def test_invalid_bearer_token_rejected(client):
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert res.status_code == 401
    assert res.json()["code"] == "unauthorized"


def test_no_argon2_anywhere():
    """docs/AUTH.md §5: grep -ri argon2 apps/server must return nothing."""
    import subprocess
    from pathlib import Path

    server_dir = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["grep", "-ril", "argon2", str(server_dir / "app")],
        capture_output=True,
        text=True,
    )
    assert result.stdout.strip() == "", f"argon2 reference found: {result.stdout}"
