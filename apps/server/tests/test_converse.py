"""POST /api/converse — the freeform speaking corner (routers/converse.py).

The Anthropic call is monkeypatched at the httpx layer so the full request →
parse → shape pipeline runs without a key or network.
"""
from __future__ import annotations

import json

import httpx
import pytest

from app.config import get_settings
from app.routers import converse as converse_module

from .conftest import auth_headers, make_user


def test_scenes_lists_cast_and_configured_flag(client):
    user = make_user()
    res = client.get("/api/converse/scenes", headers=auth_headers(user))
    assert res.status_code == 200
    body = res.json()
    assert body["configured"] is False  # no key in the test env
    assert {s["id"] for s in body["scenes"]} == {"konbini", "restaurant", "station"}


def test_opening_turn_is_free_and_fixed(client):
    user = make_user()
    res = client.post(
        "/api/converse",
        headers=auth_headers(user),
        json={"scene": "restaurant", "turns": []},
    )
    assert res.status_code == 200
    assert res.json()["jp"] == "いらっしゃいませ。何名様ですか。"


def test_unknown_scene_404s(client):
    user = make_user()
    res = client.post(
        "/api/converse",
        headers=auth_headers(user),
        json={"scene": "space-station", "turns": []},
    )
    assert res.status_code == 404


def test_without_key_real_turn_503s(client):
    user = make_user()
    res = client.post(
        "/api/converse",
        headers=auth_headers(user),
        json={
            "scene": "konbini",
            "turns": [
                {"role": "npc", "jp": "いらっしゃいませ。"},
                {"role": "you", "jp": "おにぎりをください。"},
            ],
        },
    )
    assert res.status_code == 503


@pytest.fixture
def fake_key():
    settings = get_settings()
    old = settings.anthropic_api_key
    settings.anthropic_api_key = "test-key"
    yield
    settings.anthropic_api_key = old


def _patch_anthropic(monkeypatch, payload_text: str):
    """Route converse.py's AsyncClient at a canned Anthropic response."""

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["x-api-key"] == "test-key"
        sent = json.loads(request.content)
        assert sent["messages"][-1]["role"] == "user"
        return httpx.Response(
            200, json={"content": [{"type": "text", "text": payload_text}]}
        )

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def patched_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr(converse_module.httpx, "AsyncClient", patched_client)


def test_real_turn_parses_json_reply(client, monkeypatch, fake_key):
    _patch_anthropic(
        monkeypatch,
        '{"jp": "はい、こちらです。", "romaji": "hai, kochira desu", "en": "Here you are."}',
    )
    user = make_user()
    res = client.post(
        "/api/converse",
        headers=auth_headers(user),
        json={
            "scene": "konbini",
            "turns": [
                {"role": "npc", "jp": "いらっしゃいませ。"},
                {"role": "you", "jp": "おにぎりをください。"},
            ],
        },
    )
    assert res.status_code == 200
    assert res.json() == {
        "jp": "はい、こちらです。",
        "romaji": "hai, kochira desu",
        "en": "Here you are.",
    }


def test_non_json_reply_degrades_to_raw_text(client, monkeypatch, fake_key):
    _patch_anthropic(monkeypatch, "はい、どうぞ。")
    user = make_user()
    res = client.post(
        "/api/converse",
        headers=auth_headers(user),
        json={
            "scene": "konbini",
            "turns": [
                {"role": "npc", "jp": "いらっしゃいませ。"},
                {"role": "you", "jp": "ふくろをください。"},
            ],
        },
    )
    assert res.status_code == 200
    assert res.json()["jp"] == "はい、どうぞ。"


def test_turn_ending_with_npc_422s(client, fake_key):
    user = make_user()
    res = client.post(
        "/api/converse",
        headers=auth_headers(user),
        json={
            "scene": "konbini",
            "turns": [{"role": "npc", "jp": "いらっしゃいませ。"}],
        },
    )
    assert res.status_code == 422
