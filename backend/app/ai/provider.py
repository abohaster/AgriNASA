"""
LLM provider adapter (OpenAI-compatible chat completions).

DESIGN RULES
------------
* The API key is read from the backend environment only. It is never sent to the
  browser and never logged.
* The provider receives the structured context produced by `ai/context.py`.
  It cannot call NASA, the database, or the science modules.
* Any failure (no key, timeout, HTTP error, malformed response) raises
  `LlmUnavailable`; the assistant service then falls back to the deterministic
  explainer instead of failing the request.
* Temperature is low and the system prompt is strict, because this is an
  explanation task — not a creative task.
"""

import logging

import httpx

from app.ai.prompts import SYSTEM_PROMPT, build_user_message
from app.config import Settings

logger = logging.getLogger(__name__)

# How many previous turns are included for follow-up questions. The field
# context is recomputed for every request, so history is only conversational
# glue — never a source of measurements.
MAX_HISTORY_MESSAGES = 6


class LlmUnavailable(Exception):
    """Raised when the optional language model cannot produce a reply."""


async def generate_reply(
    *,
    question: str,
    context: dict,
    history: list[dict[str, str]],
    settings: Settings,
) -> str:
    """Call an OpenAI-compatible endpoint and return grounded prose."""
    if not settings.ai_configured:
        raise LlmUnavailable("No AI API key is configured.")

    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for message in history[-MAX_HISTORY_MESSAGES:]:
        role = message.get("role")
        content = message.get("content")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": build_user_message(question, context)})

    payload = {
        "model": settings.ai_model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 600,
    }
    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }
    url = f"{settings.ai_base_url.rstrip('/')}/chat/completions"

    try:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            response = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("AI provider request failed: %s", exc.__class__.__name__)
        raise LlmUnavailable("The AI provider could not be reached.") from exc

    if response.status_code >= 400:
        # Status only — never log headers, which contain the bearer token.
        logger.warning("AI provider returned HTTP %s", response.status_code)
        raise LlmUnavailable(f"The AI provider returned HTTP {response.status_code}.")

    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        logger.warning("AI provider returned an unexpected payload.")
        raise LlmUnavailable("The AI provider returned an unexpected response.") from exc

    if not isinstance(content, str) or not content.strip():
        raise LlmUnavailable("The AI provider returned an empty reply.")

    return content.strip()
