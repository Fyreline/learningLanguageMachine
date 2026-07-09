"""GET /api/stats/household + POST /api/stats/nudge (docs/API.md).

Partner resolution went untested from Phase 1 — the real bug this covers:
"any other user row" resolved a second Michi login for the SAME real person
(shared mishka_user_id) as if they were the partner. See curriculum.py's
find_partner_row.
"""
from __future__ import annotations

from .conftest import auth_headers, make_user


def test_household_pairs_two_real_people(client):
    a = make_user("a@example.com", "Alex", mishka_id=1)
    b = make_user("b@example.com", "Bo", mishka_id=2)

    res = client.get("/api/stats/household", headers=auth_headers(a))
    assert res.status_code == 200
    names = {p["display_name"] for p in res.json()["partners"]}
    assert names == {"Alex", "Bo"}
    me = next(p for p in res.json()["partners"] if p["display_name"] == "Alex")
    assert me["is_me"] is True
    them = next(p for p in res.json()["partners"] if p["display_name"] == "Bo")
    assert them["is_me"] is False


def test_household_collapses_same_person_two_logins(client):
    # Alex's second device/login shares Alex's mishka_user_id — the
    # household view must show one Alex, not two.
    a = make_user("a@example.com", "Alex", mishka_id=1)
    make_user("a-phone@example.com", "Alex", mishka_id=1)
    b = make_user("b@example.com", "Bo", mishka_id=2)

    res = client.get("/api/stats/household", headers=auth_headers(a))
    names = [p["display_name"] for p in res.json()["partners"]]
    assert names == ["Alex", "Bo"]


def test_manifest_partner_excludes_same_person_second_login(client):
    a = make_user("a@example.com", "Alex", mishka_id=1)
    a2 = make_user("a-phone@example.com", "Alex", mishka_id=1)
    make_user("b@example.com", "Bo", mishka_id=2)

    res = client.get("/api/curriculum/manifest", headers=auth_headers(a2))
    assert res.json()["partner"]["display_name"] == "Bo"


def test_nudge_send_and_receive(client):
    a = make_user("a@example.com", "Alex", mishka_id=1)
    b = make_user("b@example.com", "Bo", mishka_id=2)

    res = client.post("/api/stats/nudge", headers=auth_headers(a))
    assert res.status_code == 200
    assert res.json() == {"sent": True, "to_display_name": "Bo"}

    household = client.get("/api/stats/household", headers=auth_headers(b)).json()
    assert household["pending_nudge"]["from_display_name"] == "Alex"

    # the sender doesn't see their own nudge reflected back at them
    household_a = client.get("/api/stats/household", headers=auth_headers(a)).json()
    assert household_a["pending_nudge"] is None


def test_nudge_cooldown_prevents_spam(client):
    a = make_user("a@example.com", "Alex", mishka_id=1)
    make_user("b@example.com", "Bo", mishka_id=2)

    first = client.post("/api/stats/nudge", headers=auth_headers(a)).json()
    assert first["sent"] is True
    second = client.post("/api/stats/nudge", headers=auth_headers(a)).json()
    assert second["sent"] is False


def test_nudge_dismiss_clears_pending(client):
    a = make_user("a@example.com", "Alex", mishka_id=1)
    b = make_user("b@example.com", "Bo", mishka_id=2)

    client.post("/api/stats/nudge", headers=auth_headers(a))
    assert client.get("/api/stats/household", headers=auth_headers(b)).json()["pending_nudge"]

    client.post("/api/stats/nudge/dismiss", headers=auth_headers(b))
    assert client.get("/api/stats/household", headers=auth_headers(b)).json()["pending_nudge"] is None


def test_nudge_with_no_partner_404s(client):
    a = make_user("a@example.com", "Alex", mishka_id=1)
    res = client.post("/api/stats/nudge", headers=auth_headers(a))
    assert res.status_code == 404
