"""
AI assistant endpoints.

The browser sends only a question, a field id and an optional conversation id.
All data retrieval, science, prompting and provider calls happen server-side, so
the API key can never be exposed to the client.
"""

import json

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import repository
from app.db.database import get_session
from app.exceptions import NotFoundError
from app.schemas.assistant import ChatRequest, ChatResponse, ConversationMessage
from app.services import assistant as assistant_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    request: Request,
    session: Session = Depends(get_session),
) -> ChatResponse:
    field = repository.get_field(session, payload.field_id)
    if field is None:
        raise NotFoundError("Field not found.", details="Select or create a field first.")

    # `request.client` is absent in some test transports; use a stable fallback.
    client_key = request.client.host if request.client else "local"
    response = await assistant_service.chat(
        session, field=field, payload=payload, client_key=client_key
    )
    session.commit()
    return response


@router.get("/conversations/{field_id}", response_model=list[ConversationMessage])
def conversation(field_id: int, session: Session = Depends(get_session)) -> list[ConversationMessage]:
    field = repository.get_field(session, field_id)
    if field is None:
        raise NotFoundError("Field not found.")
    messages = repository.latest_messages(session, field_id)
    result: list[ConversationMessage] = []
    for message in messages:
        context: dict | None = None
        if message.context_json:
            try:
                parsed = json.loads(message.context_json)
                context = parsed if isinstance(parsed, dict) else None
            except (TypeError, ValueError):
                # A legacy/corrupt context must not break the conversation view.
                context = None
        result.append(
            ConversationMessage(
                id=message.id,
                role=message.role,  # type: ignore[arg-type] — only "user"/"assistant" are stored
                content=message.content,
                provider=message.provider,
                context_used=context,
                created_at=message.created_at,
            )
        )
    return result
