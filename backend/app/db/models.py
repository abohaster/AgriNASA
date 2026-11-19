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
    robot_devices: Mapped[list["RobotDevice"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    sensor_readings: Mapped[list["SensorReading"]] = relationship(
        back_populates="field", cascade="all, delete-orphan"
    )
    robot_images: Mapped[list["RobotImage"]] = relationship(
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


class PairingCode(Base):
    """One-time code shown as a QR; claiming it mints a new device key."""

    __tablename__ = "pairing_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RobotDevice(Base):
    """A physical sensor node paired to one field.

    Only a SHA-256 hash of the bearer token is stored; the plaintext token is
    shown once when the device is created.
    """

    __tablename__ = "robot_devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    token_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    field: Mapped[Field] = relationship(back_populates="robot_devices")
    readings: Mapped[list["SensorReading"]] = relationship(
        back_populates="device", cascade="all, delete-orphan"
    )


class SensorReading(Base):
    """One upload from a field robot.

    `measured_at` is when the device sampled (device clock when supplied),
    `received_at` is when the server accepted it. Values are nullable because a
    node may not have every sensor populated; at least one is required at the
    API boundary.
    """

    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[int] = mapped_column(
        ForeignKey("robot_devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), nullable=False, index=True
    )
    soil_moisture_pct: Mapped[float | None] = mapped_column(Float)
    air_temp_c: Mapped[float | None] = mapped_column(Float)
    humidity_pct: Mapped[float | None] = mapped_column(Float)
    distance_cm: Mapped[float | None] = mapped_column(Float)
    # Optional provenance supplied by the node itself. They identify which
    # probe took this reading and where; absent values are stored as NULL and
    # never inferred by the server.
    sensor_id: Mapped[str | None] = mapped_column(String(64))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(24), default="ok", nullable=False)
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    device: Mapped[RobotDevice] = relationship(back_populates="readings")
    field: Mapped[Field] = relationship(back_populates="sensor_readings")

    __table_args__ = (Index("ix_sensor_readings_field_measured", "field_id", "measured_at"),)


class RobotImage(Base):
    """A plant photo captured by a field robot's camera.

    The file itself lives on the server's media volume; this row stores the
    metadata the UI and the AI review need. `sha256` identifies the exact bytes
    so a file cannot silently change underneath an analysis.
    """

    __tablename__ = "robot_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    field_id: Mapped[int] = mapped_column(
        ForeignKey("fields.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[int | None] = mapped_column(
        ForeignKey("robot_devices.id", ondelete="SET NULL")
    )
    crop_id: Mapped[str] = mapped_column(String(40), nullable=False)
    growth_stage: Mapped[str | None] = mapped_column(String(40))
    filename: Mapped[str] = mapped_column(String(160), nullable=False)
    content_type: Mapped[str] = mapped_column(String(40), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    camera_id: Mapped[str | None] = mapped_column(String(64))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    note: Mapped[str | None] = mapped_column(String(255))
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    field: Mapped[Field] = relationship(back_populates="robot_images")
    analyses: Mapped[list["PlantImageAnalysis"]] = relationship(
        back_populates="image", cascade="all, delete-orphan", order_by="PlantImageAnalysis.id"
    )

    __table_args__ = (Index("ix_robot_images_field_captured", "field_id", "captured_at"),)


class HealthyPlantReference(Base):
    """A healthy reference photo uploaded for one crop.

    References are opt-in: the comparison is reported as unavailable until the
    operator supplies a real image. No synthetic reference is ever generated.
    """

    __tablename__ = "healthy_plant_references"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    crop_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    filename: Mapped[str] = mapped_column(String(160), nullable=False)
    content_type: Mapped[str] = mapped_column(String(40), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    source_note: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PlantImageAnalysis(Base):
    """One AI vision review of one robot image.

    The label vocabulary is deliberately cautious; `confidence` is the model's
    self-reported certainty and is shown as a percentage, never as a diagnosis.
    """

    __tablename__ = "plant_image_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    image_id: Mapped[int] = mapped_column(
        ForeignKey("robot_images.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(24), nullable=False)  # ok | unavailable
    label: Mapped[str | None] = mapped_column(String(48))
    confidence: Mapped[float | None] = mapped_column(Float)
    summary: Mapped[str | None] = mapped_column(Text)
    observations_json: Mapped[str | None] = mapped_column(Text)
    comparison_json: Mapped[str | None] = mapped_column(Text)
    limitations_json: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(String(24))
    model: Mapped[str | None] = mapped_column(String(120))
    reference_image_id: Mapped[int | None] = mapped_column(Integer)
    previous_image_id: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    image: Mapped[RobotImage] = relationship(back_populates="analyses")


class PublicApiKey(Base):
    """API key issued to an external app so it can call Fale7.

    One row per workspace user. The key is looked up by its SHA-256 hash and
    stored encrypted (Fernet) so a single-use QR link can deliver it once
    without keeping any plaintext at rest.
    """

    __tablename__ = "public_api_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    key_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    request_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    window_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    window_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_status: Mapped[str | None] = mapped_column(String(24))
    last_error_code: Mapped[str | None] = mapped_column(String(48))

    __table_args__ = (Index("ix_public_api_keys_hash", "key_hash"),)


class PublicApiAccessToken(Base):
    """Single-use link (rendered as a QR) that reveals the API key once."""

    __tablename__ = "public_api_access_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    api_key_id: Mapped[int] = mapped_column(
        ForeignKey("public_api_keys.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


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
