"""
In-memory sliding-window rate limiter for the AI endpoint.

WHY: AI calls cost money and can be abused. The public demo has no user accounts,
so limiting per client IP (supplied by the router from `request.client.host`) is
the simplest defensible control.

This is intentionally process-local. For a multi-worker deployment, replace it
with a shared store (Redis) — the interface is a single `allow()` call.
"""

import time
from collections import deque
from threading import Lock

WINDOW_SECONDS = 60 * 60


class SlidingWindowLimiter:
    def __init__(self, window_seconds: int = WINDOW_SECONDS) -> None:
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str, limit: int) -> bool:
        """Record a request and return False when the key exceeded `limit`."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            events = self._events.setdefault(key, deque())
            while events and events[0] < cutoff:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(now)
            return True

    def remaining(self, key: str, limit: int) -> int:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            events = self._events.get(key, deque())
            active = [event for event in events if event >= cutoff]
            return max(0, limit - len(active))


limiter = SlidingWindowLimiter()
