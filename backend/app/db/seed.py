"""Seed the data-source catalogue and the single local operator account."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.data_catalog import SOURCE_CATALOGUE
from app.db.models import DataSourceRecord, User

DEFAULT_USER_EMAIL = "local@agrinasa.app"


def seed_reference_data(session: Session) -> None:
    for entry in SOURCE_CATALOGUE:
        existing = session.get(DataSourceRecord, entry["id"])
        if existing is None:
            session.add(
                DataSourceRecord(
                    id=entry["id"],
                    name=entry["name"],
                    nature=entry["nature"],
                    resolution=entry.get("resolution"),
                    attribution=entry["attribution"],
                    url=entry.get("url"),
                    description=entry.get("description"),
                )
            )
        else:
            existing.name = entry["name"]
            existing.nature = entry["nature"]
            existing.resolution = entry.get("resolution")
            existing.attribution = entry["attribution"]
            existing.url = entry.get("url")
            existing.description = entry.get("description")

    user = session.scalar(select(User).where(User.email == DEFAULT_USER_EMAIL))
    if user is None:
        session.add(User(email=DEFAULT_USER_EMAIL, display_name="Local operator"))
