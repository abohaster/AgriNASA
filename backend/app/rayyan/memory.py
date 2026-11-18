"""
Ephemeral multi-turn memory for RAYAN.

The project brief allows RAYAN to keep its own conversation metadata only if
that is authorized without changing the existing database. It is not
authorized, so nothing is persisted: turns live in process memory, are bounded
and expire. The API response says `conversation_persisted: false`.

A restart, a second worker or a cache eviction starts a new conversation. That
is intentional and is disclosed in the UI.
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class Turn:
    role: str
    content: str


class ConversationStore:
    def __init__(
        self,
        *,
        max_conversations: int = 64,
        max_turns: int = 12,
        ttl_seconds: int = 60 * 60,
    ) -> None:
        self.max_conversations = max_conversations
        self.max_turns = max_turns
        self.ttl_seconds = ttl_seconds
        self._entries: dict[str, tuple[float, list[Turn]]] = {}
        self._lock = threading.Lock()

    def new_id(self) -> str:
        return uuid.uuid4().hex

    def get(self, conversation_id: str) -> list[Turn]:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(conversation_id)
            if entry is None:
                return []
            stored_at, turns = entry
            if now - stored_at > self.ttl_seconds:
                self._entries.pop(conversation_id, None)
                return []
            return list(turns)

    def append(self, conversation_id: str, turns: list[Turn]) -> None:
        now = time.monotonic()
        with self._lock:
            current = self._entries.get(conversation_id)
            existing = list(current[1]) if current else []
            combined = (existing + list(turns))[-self.max_turns :]
            self._entries[conversation_id] = (now, combined)
            self._prune(now)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def _prune(self, now: float) -> None:
        expired = [
            key
            for key, (stored_at, _turns) in self._entries.items()
            if now - stored_at > self.ttl_seconds
        ]
        for key in expired:
            self._entries.pop(key, None)
        if len(self._entries) <= self.max_conversations:
            return
        ordered = sorted(self._entries.items(), key=lambda item: item[1][0])
        for key, _value in ordered[: len(self._entries) - self.max_conversations]:
            self._entries.pop(key, None)


store = ConversationStore()
