"""Real Egyptian farm locations offered as one-tap examples.

The coordinates are genuine agricultural areas; the polygons are small squares
drawn around the centre so the satellite reduction covers a field-sized area
rather than a single pixel. No NDVI, moisture or health value is predefined:
the live Sentinel-1/2 analysis supplies whatever the fields actually show.

The four trials cover the three crops with a full FAO-56 profile — wheat
(Delta reference and prepared seedbed), potato (sandy reclamation edge) and
tomato (Upper Egypt transplants). The descriptions state the *intended*
contrast; if the live image disagrees with the description, the image wins and
the page reports it unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DemoField:
    id: str
    name: str
    name_ar: str
    description: str
    description_ar: str
    latitude: float
    longitude: float
    geometry: dict
    crop_id: str
    intent: str
    days_since_planting: int | None = None
    # Field-level trials (dashboard, satellite, health, irrigation) need a saved
    # profile. These defaults only describe the demo field; every reported value
    # still comes from the live analysis of that location.
    soil_texture: str = "loam"
    irrigation_system: str = "sprinkler"
    area_ha: float = 2.0
    planting_offset_days: int = 7


def _square(latitude: float, longitude: float, half_side_deg: float) -> dict:
    """A closed GeoJSON square of roughly 400 m near the Egyptian latitudes."""
    west = longitude - half_side_deg
    east = longitude + half_side_deg
    south = latitude - half_side_deg
    north = latitude + half_side_deg
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
            ]
        ],
    }


DEMO_FIELDS: tuple[DemoField, ...] = (
    DemoField(
        id="delta_irrigated",
        name="Nile Delta irrigated field",
        name_ar="حقل مروي في دلتا النيل",
        description=(
            "Well-irrigated winter cereals in the central Delta near Tanta, used "
            "as the moist reference field."
        ),
        description_ar=(
            "محاصيل شتوية مروية جيدًا في وسط الدلتا قرب طنطا، وتُستخدم كالحقل "
            "المرجعي للتربة الرطبة."
        ),
        latitude=30.7951,
        longitude=30.9402,
        geometry=_square(30.7951, 30.9402, 0.0018),
        crop_id="wheat",
        intent="already_planted",
        days_since_planting=7,
        soil_texture="loam",
        irrigation_system="sprinkler",
        area_ha=4.2,
        planting_offset_days=7,
    ),
    DemoField(
        id="nubaria_reclamation",
        name="Nubaria potato reclamation farm",
        name_ar="مزرعة بطاطس في النوبارية",
        description=(
            "Reclaimed sandy land at the western desert edge planted with winter "
            "potato on drip irrigation; the canopy starts sparse and the shallow "
            "root zone dries quickly, so every irrigation has to count."
        ),
        description_ar=(
            "أرض رملية مستصلحة على الحافة الصحراوية الغربية مزروعة بالبطاطس الشتوي "
            "على الري بالتنقيط؛ الغطاء النباتي متفرق في البداية ومنطقة الجذور "
            "الضحلة تجف بسرعة، لذلك يجب أن يُحسب كل ري."
        ),
        latitude=30.36,
        longitude=29.90,
        geometry=_square(30.36, 29.90, 0.0020),
        crop_id="potato",
        intent="already_planted",
        days_since_planting=14,
        soil_texture="sandy_loam",
        irrigation_system="drip",
        area_ha=2.6,
        planting_offset_days=14,
    ),
    DemoField(
        id="sharqia_prepared",
        name="Newly prepared field — Sharqia",
        name_ar="حقل مجهّز حديثًا — الشرقية",
        description=(
            "A prepared field east of the Delta before sowing, used to show the "
            "pre-planting advice mode; it is expected to read close to bare soil."
        ),
        description_ar=(
            "حقل مجهّز شرق الدلتا قبل الزراعة، لعرض وضع «بداية الزراعة». "
            "يُتوقع أن تكون قراءته قريبة من الأرض العارية."
        ),
        latitude=30.6438,
        longitude=31.5962,
        geometry=_square(30.6438, 31.5962, 0.0020),
        crop_id="wheat",
        intent="plant_now",
        days_since_planting=None,
        soil_texture="clay_loam",
        irrigation_system="surface",
        area_ha=3.0,
        # The farmer page keeps this trial pre-planting; the field tools need a
        # sowing date, so they show a seedbed sown two days ago. The satellite
        # signal is still expected to read close to bare soil.
        planting_offset_days=2,
    ),
    DemoField(
        id="luxor_tomato",
        name="Luxor winter tomato field",
        name_ar="حقل طماطم شتوي في الأقصر",
        description=(
            "Early winter tomato in Upper Egypt near Luxor, transplanted about ten "
            "days ago on drip irrigation. The trial shows transplant-stage advice "
            "instead of sowing advice."
        ),
        description_ar=(
            "طماطم شتوية مبكرة في صعيد مصر قرب الأقصر، نُقلت الشتلات إلى الحقل منذ "
            "نحو عشرة أيام على الري بالتنقيط. تعرض التجربة إرشادات مرحلة الشتلات "
            "بدلًا من إرشادات البذر."
        ),
        latitude=25.6872,
        longitude=32.6396,
        geometry=_square(25.6872, 32.6396, 0.0018),
        crop_id="tomato",
        intent="already_planted",
        days_since_planting=10,
        soil_texture="silt_loam",
        irrigation_system="drip",
        area_ha=2.2,
        planting_offset_days=10,
    ),
)


def list_demo_fields() -> tuple[DemoField, ...]:
    return DEMO_FIELDS


def get_demo_field(field_id: str) -> DemoField | None:
    return next((item for item in DEMO_FIELDS if item.id == field_id), None)
