"""
SQLAlchemy table definitions.

Design notes
------------
* User data (fields, conversations, computed snapshots) lives here.
* Crop constants and science parameters do NOT live here: `app/crops` and
  `app/science` are the single source of truth. Duplicating them in the database
  would let code and stored rows drift apart.
* Environmental rows are the normalised values actually used by an analysis;
  raw NASA payloads are not stored to avoid unbounded duplication.
"""

from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    fields: Mapped[list["Field"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Field(Base):
    __tablename__ = "fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    crop_id: Mapped[str] = mapped_column(String(40), nullable=False)
    planting_date: Mapped[date] = mapped_column(Date, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    area_ha: Mapped[float | None] = mapped_column(Float)
    soil_texture: Mapped[str | None] = mapped_column(String(40))
    irrigation_system: Mapped[str | None] = mapped_column(String(40))
    location_label: Mapped[str | None] = mapped_column(String(255))
    elevation_m: Mapped[float | None] = mapped_column(Float)
    # GeoJSON text. Only stored when the user supplies a real boundary; the
    # frontend must never fabricate one.
    boundary_geojson: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    owner: Mapped[User] = relationship(back_populates="fields")
    locations: Mapped[list["FieldLocation"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    environmental_rows: Mapped[list["EnvironmentalData"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    vegetation_rows: Mapped[list["VegetationData"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    irrigation_snapshots: Mapped[list["IrrigationAnalysis"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    health_snapshots: Mapped[list["CropHealthAnalysis"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["AIConversation"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )

    __table_args__ = (Index("ix_fields_user_crop", "user_id", "crop_id"),)

    @property
    def crop_name(self) -> str:
        """Display name resolved from the crop registry (not stored, no duplication)."""
        from app.crops import get_crop

        crop = get_crop(self.crop_id)
        return crop.name if crop else self.crop_id.replace("_", " ").title()


class FieldLocation(Base):
    """Append-only location history; keeps the original label/coordinates."""

    __tablename__ = "field_locations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), nullable=False, index=True)
    label: Mapped[str | None] = mapped_column(String(255))
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(40), default="manual", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    field: Mapped[Field] = relationship(back_populates="locations")


class EnvironmentalData(Base):
    """Normalised daily observation used by an analysis (one row per variable)."""

    __tablename__ = "environmental_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    variable: Mapped[str] = mapped_column(String(48), nullable=False)
    value: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(24), nullable=False)
    source: Mapped[str] = mapped_column(String(80), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    field: Mapped[Field] = relationship(back_populates="environmental_rows")

    __table_args__ = (
        UniqueConstraint("field_id", "date", "variable", "source", "is_demo", name="uq_environment_row"),
        Index("ix_environment_field_date", "field_id", "date"),
    )


class VegetationData(Base):
    """Reserved for real NDVI points when a provider is configured."""

    __tablename__ = "vegetation_data"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    index_name: Mapped[str] = mapped_column(String(20), default="ndvi", nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    source: Mapped[str] = mapped_column(String(80), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    field: Mapped[Field] = relationship(back_populates="vegetation_rows")

    __table_args__ = (
        UniqueConstraint("field_id", "date", "index_name", "source", "is_demo", name="uq_vegetation_row"),
    )


class IrrigationAnalysis(Base):
    """Snapshot of a computed analysis, kept for reproducibility and history."""

    __tablename__ = "irrigation_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    computed_for: Mapped[date] = mapped_column(Date, nullable=False)
    demand: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence: Mapped[str] = mapped_column(String(16), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    field: Mapped[Field] = relationship(back_populates="irrigation_snapshots")

    __table_args__ = (
        UniqueConstraint("field_id", "computed_for", "is_demo", name="uq_irrigation_snapshot"),
    )


class CropHealthAnalysis(Base):
    __tablename__ = "crop_health_analysis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    computed_for: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    field: Mapped[Field] = relationship(back_populates="health_snapshots")

    __table_args__ = (
        UniqueConstraint("field_id", "computed_for", "is_demo", name="uq_health_snapshot"),
    )


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    field: Mapped[Field] = relationship(back_populates="conversations")
    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="AIMessage.id"
    )


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str | None] = mapped_column(String(24))
    # Exact structured context supplied to the model (or used by the rule engine).
    context_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    conversation: Mapped[AIConversation] = relationship(back_populates="messages")


class DataSourceRecord(Base):
    __tablename__ = "data_sources"

    id: Mapped[str] = mapped_column(String(48), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    nature: Mapped[str] = mapped_column(String(40), nullable=False)
    resolution: Mapped[str | None] = mapped_column(String(120))
    attribution: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
