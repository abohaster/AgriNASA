"""AI assistant request/response schemas and stored messages."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import DataMode


class ChatRequest(BaseModel):
    field_id: int = Field(gt=0)
    message: str = Field(min_length=2, max_length=1000)
    conversation_id: int | None = Field(default=None, gt=0)
    mode: DataMode = "live"

    @field_validator("message")
    @classmethod
    def _strip_message(cls, value: str) -> str:
        stripped = value.strip()
        if len(stripped) < 2:
            raise ValueError("Please write a longer question.")
        return stripped


class ChatResponse(BaseModel):
    reply: str
    provider: Literal["llm", "rule_based"]
    conversation_id: int
    context_used: dict[str, Any]
    notice: str
    is_demo: bool


class ConversationMessage(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    content: str
    provider: str | None = None
    # Stored with the answer so a reopened conversation can still show the
    # exact context the assistant was grounded on.
    context_used: dict[str, Any] | None = None
    created_at: datetime
