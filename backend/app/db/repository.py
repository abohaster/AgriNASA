"""
Repository helpers — all SQL lives here so services stay readable.

Each function takes an explicit Session; the API layer owns the transaction
boundary (commit at the end of a successful request).
"""

import json
from datetime import date, datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    AIConversation,
    AIMessage,
    CropHealthAnalysis,
    DataSourceRecord,
    EnvironmentalData,
    Field,
    FieldLocation,
    IrrigationAnalysis,
    User,
    VegetationData,
)
from app.db.seed import DEFAULT_USER_EMAIL


def get_default_user(session: Session) -> User:
    user = session.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if user is None:
        user = User(email=DEFAULT_USER_EMAIL, display_name="Local operator")
        session.add(user)
        session.flush()
    return user


def list_fields(session: Session) -> list[Field]:
    user = get_default_user(session)
    return list(
        session.scalars(
            select(Field).where(Field.user_id == user.id).order_by(Field.created_at.desc(), Field.id.desc())
        )
    )


def get_field(session: Session, field_id: int) -> Field | None:
    user = get_default_user(session)
    return session.scalar(select(Field).where(Field.id == field_id, Field.user_id == user.id))


def create_field(session: Session, *, values: dict, location_source: str = "manual") -> Field:
    user = get_default_user(session)
    field = Field(user_id=user.id, **values)
    session.add(field)
    session.flush()

    session.add(
        FieldLocation(
            field_id=field.id,
            label=field.location_label,
            latitude=field.latitude,
            longitude=field.longitude,
            source=location_source,
        )
    )
    session.flush()
    return field


def delete_field(session: Session, field: Field) -> None:
    session.delete(field)


def list_data_sources(session: Session) -> list[DataSourceRecord]:
    return list(session.scalars(select(DataSourceRecord).order_by(DataSourceRecord.name)))


def replace_environment_window(
    session: Session,
    *,
    field_id: int,
    start: date,
    end: date,
    source: str,
    is_demo: bool,
    rows: list[dict],
) -> None:
    """Replace the normalised cache for a date window, then insert new rows.

    Analysis responses are reproducible because the exact rows used are stored;
    replacing (rather than appending) keeps the table free of duplicate windows.

    The explicit pre-flush matters: one request may recompute the same window
    more than once (e.g. the health analysis also runs the irrigation model).
    Flushing first ensures the DELETE removes those pending rows before the new
    batch is inserted, instead of violating the unique constraint at commit.
    """
    session.flush()
    session.execute(
        delete(EnvironmentalData).where(
            EnvironmentalData.field_id == field_id,
            EnvironmentalData.source == source,
            EnvironmentalData.is_demo == is_demo,
            EnvironmentalData.date >= start,
            EnvironmentalData.date <= end,
        )
    )
    session.flush()
    session.add_all(
        [
            EnvironmentalData(
                field_id=field_id,
                date=row["date"],
                variable=row["variable"],
                value=row["value"],
                unit=row["unit"],
                source=source,
                is_demo=is_demo,
            )
            for row in rows
        ]
    )


def replace_vegetation_window(
    session: Session,
    *,
    field_id: int,
    source: str,
    is_demo: bool,
    rows: list[dict],
) -> None:
    session.flush()
    session.execute(
        delete(VegetationData).where(
            VegetationData.field_id == field_id,
            VegetationData.source == source,
            VegetationData.is_demo == is_demo,
        )
    )
    session.flush()
    session.add_all(
        [
            VegetationData(
                field_id=field_id,
                date=row["date"],
                index_name="ndvi",
                value=row["value"],
                source=source,
                is_demo=is_demo,
            )
            for row in rows
        ]
    )


def save_irrigation_snapshot(session: Session, *, field: Field, payload: dict, is_demo: bool) -> None:
    computed_for = date.fromisoformat(payload["computed_for"])
    existing = session.scalar(
        select(IrrigationAnalysis).where(
            IrrigationAnalysis.field_id == field.id,
            IrrigationAnalysis.computed_for == computed_for,
            IrrigationAnalysis.is_demo == is_demo,
        )
    )
    payload_json = json.dumps(payload, default=str)
    if existing is None:
        session.add(
            IrrigationAnalysis(
                field_id=field.id,
                computed_for=computed_for,
                demand=payload["demand"],
                confidence=payload["confidence"]["level"],
                payload_json=payload_json,
                is_demo=is_demo,
            )
        )
    else:
        existing.demand = payload["demand"]
        existing.confidence = payload["confidence"]["level"]
        existing.payload_json = payload_json


def save_health_snapshot(session: Session, *, field: Field, payload: dict, is_demo: bool) -> None:
    computed_for = date.fromisoformat(payload["computed_for"])
    existing = session.scalar(
        select(CropHealthAnalysis).where(
            CropHealthAnalysis.field_id == field.id,
            CropHealthAnalysis.computed_for == computed_for,
            CropHealthAnalysis.is_demo == is_demo,
        )
    )
    payload_json = json.dumps(payload, default=str)
    if existing is None:
        session.add(
            CropHealthAnalysis(
                field_id=field.id,
                computed_for=computed_for,
                status=payload["status"],
                payload_json=payload_json,
                is_demo=is_demo,
            )
        )
    else:
        existing.status = payload["status"]
        existing.payload_json = payload_json


def get_or_create_conversation(
    session: Session, *, field: Field, conversation_id: int | None, first_message: str
) -> AIConversation:
    if conversation_id is not None:
        conversation = session.scalar(
            select(AIConversation).where(
                AIConversation.id == conversation_id, AIConversation.field_id == field.id
            )
        )
        if conversation is not None:
            return conversation
    conversation = AIConversation(field_id=field.id, title=first_message[:120])
    session.add(conversation)
    session.flush()
    return conversation


def add_message(
    session: Session,
    *,
    conversation: AIConversation,
    role: str,
    content: str,
    provider: str | None = None,
    context: dict | None = None,
) -> AIMessage:
    message = AIMessage(
        conversation_id=conversation.id,
        role=role,
        content=content,
        provider=provider,
        context_json=json.dumps(context, default=str) if context is not None else None,
    )
    session.add(message)
    conversation.updated_at = datetime.now(timezone.utc)
    session.flush()
    return message


def messages_for_conversation(
    session: Session, conversation_id: int, limit: int = 8
) -> list[AIMessage]:
    """Return the most recent N messages in chronological order for LLM history."""
    rows = list(
        session.scalars(
            select(AIMessage)
            .where(AIMessage.conversation_id == conversation_id)
            .order_by(AIMessage.id.desc())
            .limit(limit)
        )
    )
    return list(reversed(rows))


def latest_messages(session: Session, field_id: int) -> list[AIMessage]:
    conversation = session.scalar(
        select(AIConversation)
        .where(AIConversation.field_id == field_id)
        .order_by(AIConversation.updated_at.desc(), AIConversation.id.desc())
    )
    if conversation is None:
        return []
    return list(
        session.scalars(
            select(AIMessage).where(AIMessage.conversation_id == conversation.id).order_by(AIMessage.id)
        )
    )
