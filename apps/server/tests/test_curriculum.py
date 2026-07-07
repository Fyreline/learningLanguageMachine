"""Curriculum read surface — manifest is covered indirectly elsewhere; this
file targets the Phase-4 additions: the full item bank (GET /items) and the
pre-placement lesson-read exemption for u01-u03 (docs/CURRICULUM.md §5)."""
from __future__ import annotations


def test_items_bank_returns_full_content_with_unit_and_strength(authed):
    client, uid, headers = authed
    res = client.get("/api/curriculum/items", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) > 100  # every unit + both kana decks

    konnichiwa = next(i for i in items if i["id"] == "u01.konnichiwa")
    assert konnichiwa["unit"] == "u01"
    assert konnichiwa["jp"] == "こんにちは"
    assert konnichiwa["strength"] == 0
    assert konnichiwa["due_at"] is None

    kana_item = next(i for i in items if i["id"] == "kana.hi.a")
    assert kana_item["unit"] == "hiragana"


def test_items_bank_merges_srs_strength(authed):
    client, uid, headers = authed
    import uuid

    client.post(
        "/api/reviews/complete",
        headers=headers,
        json={
            "submission_id": str(uuid.uuid4()),
            "duration_seconds": 30,
            "local_date": "2026-07-07",
            "results": [{"item_id": "u01.konnichiwa", "grade": 3, "mode": "fast-skip"}],
        },
    )
    res = client.get("/api/curriculum/items", headers=headers)
    konnichiwa = next(i for i in res.json()["items"] if i["id"] == "u01.konnichiwa")
    assert konnichiwa["strength"] == 3
    assert konnichiwa["due_at"] is not None


def test_lesson_content_readable_across_u01_u03_before_placement(authed):
    """A brand-new account can only ever complete u01.l1 first, but the
    placement probe needs to read further ahead in u01-u03 to build its item
    pool (docs/CURRICULUM.md §5) — those reads must not 403 pre-placement."""
    client, uid, headers = authed
    for lesson_id in ["u01.l3", "u02.l1", "u03.l5"]:
        res = client.get(f"/api/curriculum/lessons/{lesson_id}", headers=headers)
        assert res.status_code == 200, lesson_id


def test_lesson_content_still_locked_outside_placement_units(authed):
    client, uid, headers = authed
    res = client.get("/api/curriculum/lessons/u04.l2", headers=headers)
    assert res.status_code == 403
    assert res.json()["code"] == "lesson_locked"


def test_placement_read_exemption_closes_once_placement_done(authed):
    client, uid, headers = authed
    client.put("/api/auth/settings", headers=headers, json={"placement_done": True})
    res = client.get("/api/curriculum/lessons/u02.l1", headers=headers)
    assert res.status_code == 403
    assert res.json()["code"] == "lesson_locked"
