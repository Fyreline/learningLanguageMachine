"""POST /api/converse — the freeform speaking corner.

A mic-only, open-ended chat with a character (konbini clerk, restaurant
staff, station attendant) played by Claude. Unlike every other exercise this
has no grading and no SRS writes — it's a sandbox for stringing together
what the path has taught, calm by design (docs/CURRICULUM.md §8: tempo is
the learner's, nothing is scored, ending early is fine).

Stateless by construction: the client sends the whole (short) transcript
each turn, so nothing conversational touches the database. The opening line
per scene is hardcoded — deterministic, instant, and one fewer paid call.

Needs MICHI_ANTHROPIC_API_KEY in apps/server/.env (the household adds this
themselves; the key never lives in the repo). Without it: friendly 503 the
UI turns into an explanation card.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import current_user
from ..config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/converse", tags=["converse"])

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"

# Scene cast. Openers are fixed so the first line is instant and free; the
# `brief` seeds the system prompt that keeps Claude in character.
SCENES: dict[str, dict[str, str]] = {
    "konbini": {
        "title": "At the konbini",
        "brief": (
            "You are a friendly convenience store (konbini) clerk in Japan. "
            "The customer is buying snacks and drinks, may ask for the "
            "toilet, a bag, chopsticks, or to pay."
        ),
        "opener_jp": "いらっしゃいませ。",
        "opener_romaji": "irasshaimase",
        "opener_en": "Welcome in.",
    },
    "restaurant": {
        "title": "At a restaurant",
        "brief": (
            "You are a warm restaurant server in Japan. The guest is being "
            "seated, ordering food and drinks, asking about the menu, and "
            "paying at the end."
        ),
        "opener_jp": "いらっしゃいませ。何名様ですか。",
        "opener_romaji": "irasshaimase. nanmei-sama desu ka",
        "opener_en": "Welcome. How many people?",
    },
    "station": {
        "title": "At the station",
        "brief": (
            "You are a helpful train station attendant in Japan. The "
            "traveller is buying tickets, finding platforms, and asking "
            "about lines, transfers, and times."
        ),
        "opener_jp": "こんにちは。どちらまでですか。",
        "opener_romaji": "konnichiwa. dochira made desu ka",
        "opener_en": "Hello. Where are you headed?",
    },
}

SYSTEM_TEMPLATE = """{brief}

You are speaking with a beginner Japanese learner (JLPT N5 level) practising
for a real trip. Rules:
- Reply ONLY with strict JSON: {{"jp": "...", "romaji": "...", "en": "..."}}
- "jp": your next line, in Japanese. Keep it SHORT (under 15 words), plain
  polite form (desu/masu), N5 vocabulary wherever possible.
- "romaji": Hepburn romanisation of that line.
- "en": a brief natural British English translation.
- Stay in character; never break the scene, never explain grammar.
- Be forgiving: if their Japanese is garbled, respond to your best guess of
  the intent, the way a kind shopkeeper actually would.
- If they speak English, gently continue in simple Japanese anyway.
- After roughly eight exchanges, wind the scene down naturally (hand them
  the bag, wish them a good journey) rather than chatting forever."""


class Turn(BaseModel):
    role: Literal["npc", "you"]
    jp: str = Field(max_length=500)


class ConverseBody(BaseModel):
    scene: str
    # The whole conversation so far, oldest first. Capped: this is a short
    # scene, not a chat product — 24 turns is well past "wind it down".
    turns: list[Turn] = Field(default_factory=list, max_length=24)


@router.get("/scenes")
def list_scenes(_user_id: int = Depends(current_user)) -> dict[str, Any]:
    configured = bool(get_settings().anthropic_api_key)
    return {
        "configured": configured,
        "scenes": [{"id": key, "title": s["title"]} for key, s in SCENES.items()],
    }


@router.post("")
async def converse(
    body: ConverseBody, _user_id: int = Depends(current_user)
) -> dict[str, Any]:
    scene = SCENES.get(body.scene)
    if not scene:
        raise HTTPException(404, "Unknown scene")

    # First turn: the fixed opener, no API call.
    if not body.turns:
        return {
            "jp": scene["opener_jp"],
            "romaji": scene["opener_romaji"],
            "en": scene["opener_en"],
        }

    settings = get_settings()
    if not settings.anthropic_api_key:
        raise HTTPException(503, "Conversation practice isn't set up yet")

    messages = [
        {"role": "assistant" if t.role == "npc" else "user", "content": t.jp}
        for t in body.turns
    ]
    # The API requires alternating roles ending in "user"; the UI always
    # sends [npc opener, you, npc, you, ...], so just guard the invariant.
    if messages[-1]["role"] != "user":
        raise HTTPException(422, "The last turn must be yours")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                ANTHROPIC_URL,
                headers={
                    "x-api-key": settings.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": settings.anthropic_model,
                    "max_tokens": 300,
                    "system": SYSTEM_TEMPLATE.format(brief=scene["brief"]),
                    "messages": messages,
                },
            )
    except httpx.HTTPError as exc:
        logger.warning("converse: anthropic unreachable: %s", exc)
        raise HTTPException(503, "The conversation partner is unreachable just now")

    if res.status_code != 200:
        logger.warning("converse: anthropic %s: %s", res.status_code, res.text[:300])
        raise HTTPException(503, "The conversation partner is unavailable just now")

    text = "".join(
        block.get("text", "") for block in res.json().get("content", [])
    ).strip()
    # Strict JSON was requested; tolerate a stray code fence anyway.
    if text.startswith("```"):
        text = text.strip("`")
        text = text.removeprefix("json").strip()
    try:
        reply = json.loads(text)
        return {
            "jp": str(reply["jp"]),
            "romaji": str(reply.get("romaji", "")),
            "en": str(reply.get("en", "")),
        }
    except (json.JSONDecodeError, KeyError, TypeError):
        # Model slipped out of the JSON contract — treat its raw text as the
        # Japanese line rather than failing the learner's turn.
        logger.warning("converse: non-JSON reply: %s", text[:200])
        return {"jp": text, "romaji": "", "en": ""}
