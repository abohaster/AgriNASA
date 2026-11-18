"""
Post-generation validation.

RAYAN answers both general agricultural questions and questions about one
AgriNASA field, so three families of checks run on every reply:

1. Numeric grounding — a sentence that talks about the analysed field (or makes
   a measurement claim with a field unit) may only use numbers that appear in
   the computed context, verbatim or as the percent/scaled form of a context
   value. General guidance may use ordinary small numbers (for example "keep
   20 metres away" or "wait 3 days") but a field measurement never can.
2. Diagnosis language — an assertive disease, pest or deficiency diagnosis about
   the user's crop is rejected unless it is negated or clearly uncertain.
   General explanation of a pest or disease is allowed.
3. Chemical and pollinator safety — a pesticide dose, concentration or mixing
   instruction is rejected, as is any recommendation to burn or spray a bee
   colony.
4. Hygiene — URLs, bidi control characters and unbounded length are removed.

A rejected reply is never shown. The orchestrator replaces it with a clearly
labelled deterministic summary, or with a safety notice when the rejected reply
contained an unsafe recommendation.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any

NUMBER_TOKEN = re.compile(r"(?<!\d)(\d+(?:\.\d+)?)(?!\d)")
UNIT_AFTER = re.compile(
    r"^\s*(mm|°c|ºc|°|c|%|٪|percent|per cent|m/s|km/h|km|ha|cm|meters?|metres?|m|"
    r"days?|hours?|minutes?|h|kg|g|mg|tons?|tonnes?|liters?|litres?|l|ml|cc|"
    r"يوم|أيام|ايام|ساعات|ساعة|دقيقة|مم|سم|درجة|هكتار|فدان|كجم|كيلوجرام|جرام|لتر|ملل?|طن|أطنان|بالمئة)\b",
    re.IGNORECASE,
)
URL = re.compile(r"https?://[^\s<>\"')]+", re.IGNORECASE)
MARKDOWN_LINK = re.compile(r"\[([^\]]*)\]\((?:https?://)[^)]+\)", re.IGNORECASE)
CONTROL_CHARS = re.compile(
    "[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff\u0000-\u0008\u000b\u000c\u000e-\u001f]"
)

# Concepts that tie a sentence to the supplied field analysis. A sentence that
# contains one of these must ground every number it states. Generic words such
# as "crop" or "field" are deliberately excluded; a measurement verb plus a
# field unit covers those sentences without blocking ordinary advice such as
# "space plants 20 cm apart".
FIELD_ANCHORS = (
    "field analysis",
    "field data",
    "field context",
    "irrigation status",
    "net refill",
    "gross refill",
    "refill requirement",
    "refill estimate",
    "root zone",
    "root-zone",
    "water balance",
    "deficit",
    "depletion",
    "et0",
    "etc",
    "ndvi",
    "crop health",
    "soil moisture",
    "soil water",
    "nasa power",
    "agrinasa",
    "analysis date",
    "data window",
    "computed context",
    "computed value",
    "the context",
    "the analysis",
    "forecast",
    "rainfall",
    "temperature",
    "humidity",
    "wind speed",
    "yield",
    "التحليل",
    "البيانات",
    "الاحتياج",
    "الري",
    "الرطوبة",
    "الحرارة",
    "الأمطار",
    "الامطار",
    "التوقعات",
    "الجفاف",
    "ناسا",
    "أجري ناسا",
)

FIELD_UNITS = {
    "mm",
    "°c",
    "ºc",
    "c",
    "%",
    "٪",
    "percent",
    "per cent",
    "m/s",
    "km/h",
    "km",
    "ha",
    "cm",
    "m",
    "kg",
    "g",
    "mg",
    "ton",
    "tons",
    "tonne",
    "tonnes",
    "liter",
    "liters",
    "litre",
    "litres",
    "l",
    "ml",
    "cc",
    "مم",
    "سم",
    "درجة",
    "هكتار",
    "فدان",
    "كجم",
    "كيلوجرام",
    "جرام",
    "لتر",
    "مل",
    "ملل",
    "طن",
    "أطنان",
    "بالمئة",
}

# A measurement verb plus a field unit is enough to treat a sentence as a
# measurement claim even if it does not name the field ("Apply 999 mm").
MEASUREMENT_VERBS = (
    "received",
    "recorded",
    "measured",
    "shows",
    "showed",
    "reached",
    "reaches",
    "expected",
    "forecast",
    "requires",
    "needs",
    "apply",
    "applied",
    "add",
    "irrigate",
    "refill",
    "depletion",
    "equals",
    "stands at",
    "بلغ",
    "بلغت",
    "سجل",
    "سجلت",
    "وصل",
    "وصلت",
    "يحتاج",
    "تحتاج",
    "أضف",
    "اضف",
    "أضيف",
    "اسق",
    "نسقي",
    "المستوى",
)

FIELD_UNIT_WORDS = (
    "mm",
    "°c",
    "ºc",
    "%",
    "m/s",
    "km/h",
    "km",
    "ha",
    "cm",
    "meters",
    "meter",
    "metres",
    "metre",
    "m",
    "kg",
    "g",
    "mg",
    "ton",
    "tons",
    "tonne",
    "tonnes",
    "liter",
    "liters",
    "litre",
    "litres",
    "l",
    "ml",
    "cc",
    "percent",
    "per cent",
    "مم",
    "سم",
    "درجة",
    "هكتار",
    "فدان",
    "كجم",
    "جرام",
    "لتر",
    "مل",
    "طن",
    "بالمئة",
)

ADVISORY_WORDS = (
    "keep",
    "stay",
    "move",
    "away",
    "avoid",
    "distance",
    "call",
    "contact",
    "within",
    "wait",
    "leave",
    "separate",
    "wear",
    "use gloves",
    "space",
    "spacing",
    "apart",
    "deep",
    "tall",
    "ابعد",
    "ابعاد",
    "ابق",
    "اتصل",
    "انتظر",
    "مسافة",
    "تجنب",
)

SAFE_ADVISORY_UNITS = {
    "",
    "m",
    "meter",
    "meters",
    "metre",
    "metres",
    "cm",
    "step",
    "steps",
    "minute",
    "minutes",
    "hour",
    "hours",
    "day",
    "days",
    "متر",
    "سم",
    "دقيقة",
    "ساعة",
    "يوم",
    "خطوة",
}

DIAGNOSIS_TERMS = (
    "rust",
    "blight",
    "mildew",
    "smut",
    "wilt",
    "rot",
    "fungal infection",
    "bacterial",
    "virus",
    "viral",
    "nematode",
    "aphid",
    "whitefly",
    "whiteflies",
    "locust",
    "borer",
    "thrips",
    "mite",
    "nitrogen deficiency",
    "phosphorus deficiency",
    "potassium deficiency",
    "nutrient deficiency",
    "yield will",
    "will yield",
    "expected yield",
    "صدأ",
    "بياض",
    "لفحة",
    "تعفن",
    "ذبول",
    "فيروس",
    "بكتيريا",
    "فطر",
    "حشرة",
    "حشرات",
    "آفة",
    "افات",
    "آفات",
    "سوسة",
    "منّ",
    "ذبابة بيضاء",
    "نقص النيتروجين",
    "نقص الفوسفور",
    "نقص البوتاسيوم",
    "نقص عنصر",
    "المحصول سيكون",
    "إنتاجية متوقعة",
    "انتاجية متوقعة",
)

# A diagnosis is only unsafe when it is asserted about the user's own crop.
FIELD_TARGETS = (
    "your crop",
    "your plant",
    "your field",
    "your farm",
    "your soil",
    "your leaf",
    "your leaves",
    "your wheat",
    "your tomato",
    "your maize",
    "your rice",
    "your trees",
    "your tree",
    "this crop",
    "this plant",
    "this field",
    "the crop",
    "the plant",
    "the field",
    "the leaf",
    "the leaves",
    "the sample",
    "the soil",
    "my crop",
    "my field",
    "my plant",
    "my farm",
    "المحصول",
    "محصولك",
    "الحقل",
    "حقلك",
    "النبات",
    "نباتك",
    "الأوراق",
    "الورقة",
    "التربة",
    "تربتك",
    "العينة",
    "الشجرة",
    "شجرتك",
    "المزرعة",
    "مزرعتك",
)

ASSERTIONS = (
    " has ",
    " have ",
    " had ",
    " is infected",
    " are infected",
    " is affected",
    " are affected",
    " suffers",
    " suffering",
    " shows signs",
    " show signs",
    " shows symptoms",
    " show symptoms",
    " diagnosed",
    " confirmed",
    " has a ",
    " has an ",
    " is ",
    " are ",
    "مصاب",
    "مصابة",
    "تعاني",
    "يعاني",
    "تظهر",
    "ظهر",
    "يوجد",
    "لديه",
    "لديها",
    "أكد",
    "تؤكد",
    "will yield",
    "yield will",
    "expected yield",
)

NEGATIONS = (
    "cannot",
    "can not",
    "can't",
    "not able",
    "unable",
    "no evidence",
    "not diagnose",
    "does not diagnose",
    "not a diagnosis",
    "not confirm",
    "does not confirm",
    "no diagnosis",
    "not a disease",
    "rather than",
    "instead of",
    "outside the",
    "not implemented",
    "not available",
    "لا يمكن",
    "لا يستطيع",
    "لا نستطيع",
    "لا يقوم",
    "لا يشخص",
    "لا يشخّص",
    "ليس تشخيص",
    "ليس مرضا",
    "ليس مرضاً",
    "لا يؤكد",
    "لا تؤكد",
    "دون تشخيص",
    "بدلاً من",
    "بدلا من",
    "خارج نطاق",
    "غير متاح",
    "غير متوفرة",
)

NEGATIONS_WORD = NEGATIONS + (
    "not",
    "no",
    "never",
    "without",
    "avoid",
    "free of",
    "غير",
    "ليست",
    "بدون",
    "خالي",
    "تجنب",
    "لا",
    "لم",
    "مش",
    "بلاش",
    "مات",
)

# Egyptian Arabic often attaches the negation to the verb ("مترشش").
NEGATION_PREFIXES = ("مترش", "متحرق", "متبخ")

UNCERTAINTY = (
    "may",
    "might",
    "could",
    "possibly",
    "probably",
    "likely",
    "suspect",
    "suspected",
    "not sure",
    "unclear",
    "appears",
    "seems",
    "perhaps",
    "maybe",
    "possible",
    "قد",
    "ربما",
    "يحتمل",
    "أشتبه",
    "اشتبه",
    "لعل",
    "يبدو",
    "محتمل",
)

PESTICIDE_TERMS = (
    "pesticide",
    "insecticide",
    "herbicide",
    "fungicide",
    "acaricide",
    "nematicide",
    "chemical",
    "neem",
    "insecticidal soap",
    "horticultural oil",
    "chemical spray",
    "spray",
    "مبيد",
    "مبيدات",
    "مبيد حشري",
    "مبيد فطري",
    "كيماوي",
    "رش",
    "سموم",
)

DOSE_PATTERN = re.compile(
    r"\d+(?:\.\d+)?\s*(?:ml|millilit(?:er|re)s?|l|lit(?:er|re)s?|g|grams?|kg|"
    r"kilograms?|cc|oz|tbsp|tablespoons?|مل|لتر|جرام|جم|كجم|كيلو|ملعقة)\s*"
    r"(?:/|per|each|every|في|لكل)\s*"
    r"(?:l|lit(?:er|re)|ha|hectare|acre|feddan|فدان|هكتار|لتر|جير|تنك|برميل)",
    re.IGNORECASE,
)
MIX_PATTERN = re.compile(r"\b(?:mix|combine|blend|خلط|امزج|اخلط)\b", re.IGNORECASE)
SAFE_CONTEXT = (
    "label",
    "according to the label",
    "extension",
    "specialist",
    "professional",
    "veterinarian",
    "الملصق",
    "حسب الملصق",
    "الإرشاد",
    "الارشاد",
    "متخصص",
    "طبيب بيطري",
)

BEE_TERMS = (
    "bee",
    "bees",
    "hive",
    "swarm",
    "colony",
    "apiary",
    "نحل",
    "نحلة",
    "خلية",
    "خلايا",
    "سرب",
    "منحل",
)
BEE_HARM = (
    "burn",
    "burning",
    "set fire",
    "smoke out",
    "spray",
    "spraying",
    "pesticide",
    "insecticide",
    "boiling water",
    "حرق",
    "يحرق",
    "احرق",
    "رش",
    "يرش",
    "مبيد",
    "ماء مغلي",
)


@dataclass
class ReplyValidation:
    text: str
    ok: bool
    issues: list[str] = field(default_factory=list)
    rejected_numbers: list[str] = field(default_factory=list)
    removed_urls: int = 0
    word_count: int = 0


def _normalise_digits(text: str) -> str:
    arabic = "٠١٢٣٤٥٦٧٨٩"
    persian = "۰۱۲۳۴۵۶۷۸۹"
    table = {ord(ch): str(index) for index, ch in enumerate(arabic)}
    table.update({ord(ch): str(index) for index, ch in enumerate(persian)})
    return text.translate(table)


def _number_set(payload: str) -> set[str]:
    values: set[str] = set()
    for token in NUMBER_TOKEN.findall(payload):
        values.add(token)
        try:
            number = float(token)
        except ValueError:
            continue
        for scaled in (number * 100, number / 100, round(number * 100, 2)):
            rendered = _render(scaled)
            if rendered:
                values.add(rendered)
    return values


def _render(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.4f}".rstrip("0").rstrip(".")


def collect_allowed_numbers(context: dict[str, Any], extra_text: str = "") -> set[str]:
    payload = json.dumps(context, ensure_ascii=False, default=str, sort_keys=True)
    allowed = _number_set(payload)
    if extra_text:
        allowed |= _number_set(extra_text)
    return allowed


def _contains_phrase(text: str, phrase: str) -> bool:
    phrase = phrase.strip()
    if not phrase:
        return False
    if phrase.isascii():
        pattern = rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])"
        return re.search(pattern, text) is not None
    return phrase in text


def _has_any(text: str, phrases: tuple[str, ...]) -> bool:
    return any(_contains_phrase(text, phrase) for phrase in phrases)


def _contains_word_phrase(text: str, phrase: str) -> bool:
    if phrase.isascii():
        pattern = rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])"
    else:
        pattern = rf"(?<![\u0600-\u06ff]){re.escape(phrase)}(?![\u0600-\u06ff])"
    return re.search(pattern, text) is not None


def _has_negation(text: str) -> bool:
    if any(_contains_word_phrase(text, phrase) for phrase in NEGATIONS_WORD):
        return True
    return any(prefix in text for prefix in NEGATION_PREFIXES)


def _contains_diagnosis_term(text: str, term: str) -> bool:
    """ASCII terms match singular/plural whole words, never 'rot' in 'rotation'."""
    if term.isascii():
        pattern = rf"(?<![a-z0-9]){re.escape(term)}(?:s|es)?(?![a-z0-9])"
        return re.search(pattern, text) is not None
    return term in text


def _sentence_requires_grounding(sentence: str) -> bool:
    """A field-data sentence, or a measurement claim carrying a field unit."""
    lowered = sentence.casefold()
    if _has_any(lowered, FIELD_ANCHORS):
        return True
    has_field_unit = any(_contains_phrase(lowered, unit) for unit in FIELD_UNIT_WORDS)
    if not has_field_unit:
        return False
    if any(target in lowered for target in FIELD_TARGETS):
        return True
    return _has_any(lowered, MEASUREMENT_VERBS)


def _sentence_has_unsafe_diagnosis(sentence: str) -> bool:
    lowered = sentence.casefold()
    if not any(_contains_diagnosis_term(lowered, term) for term in DIAGNOSIS_TERMS):
        return False
    if not any(target in lowered for target in FIELD_TARGETS):
        return False
    if not _has_any(lowered, ASSERTIONS):
        return False
    if _has_negation(lowered) or _has_any(lowered, UNCERTAINTY):
        return False
    return True


def _sentence_has_unsafe_pesticide(sentence: str) -> bool:
    lowered = sentence.casefold()
    if not _has_any(lowered, PESTICIDE_TERMS):
        return False
    if _has_negation(lowered) or _has_any(lowered, SAFE_CONTEXT):
        return False
    return bool(DOSE_PATTERN.search(lowered) or MIX_PATTERN.search(lowered))


def _sentence_has_unsafe_bee_action(sentence: str) -> bool:
    lowered = sentence.casefold()
    if not _has_any(lowered, BEE_TERMS):
        return False
    if not _has_any(lowered, BEE_HARM):
        return False
    if _has_negation(lowered) or _has_any(lowered, SAFE_CONTEXT):
        return False
    return True


def validate_reply(
    reply: str,
    *,
    context: dict[str, Any],
    extra_text: str = "",
    max_words: int = 320,
) -> ReplyValidation:
    issues: list[str] = []
    removed_urls = 0

    text = CONTROL_CHARS.sub("", reply or "").strip()
    text, count = MARKDOWN_LINK.subn(lambda match: match.group(1), text)
    removed_urls += count
    text, count = URL.subn("", text)
    removed_urls += count
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    text = _normalise_digits(text)

    if not text:
        return ReplyValidation(text="", ok=False, issues=["empty"], word_count=0)

    allowed = collect_allowed_numbers(context, extra_text)
    sentences = [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?؟\n])\s+", text)
        if sentence.strip()
    ]

    rejected: list[str] = []
    for sentence in sentences:
        strict = _sentence_requires_grounding(sentence)
        advisory = _has_any(sentence.casefold(), ADVISORY_WORDS)
        for match in NUMBER_TOKEN.finditer(sentence):
            token = match.group(1)
            following = sentence[match.end() : match.end() + 12]
            unit_match = UNIT_AFTER.match(following)
            unit = unit_match.group(1).casefold() if unit_match else ""
            try:
                value = float(token)
            except ValueError:
                continue

            permitted = token in allowed
            if not permitted and not unit and value.is_integer() and 0 <= value <= 12:
                permitted = True
            if not permitted and unit in {"days", "day", "يوم", "أيام", "ايام"} and value <= 8:
                permitted = True
            if (
                not permitted
                and unit in {"minutes", "minute", "hours", "hour", "h", "دقيقة", "ساعة", "ساعات"}
                and 0 <= value <= 1440
            ):
                permitted = True
            if not permitted and strict and advisory and unit in SAFE_ADVISORY_UNITS:
                permitted = True
            if not permitted and not strict:
                permitted = True
            if not permitted:
                rejected.append(token)

    if rejected:
        issues.append("unverified_numbers")

    for sentence in sentences:
        if sentence.rstrip().endswith(("?", "؟")):
            continue
        if _sentence_has_unsafe_diagnosis(sentence):
            issues.append("unsafe_diagnosis")
            break
    for sentence in sentences:
        if _sentence_has_unsafe_pesticide(sentence):
            issues.append("unsafe_pesticide")
            break
    for sentence in sentences:
        if _sentence_has_unsafe_bee_action(sentence):
            issues.append("unsafe_bee_action")
            break

    words = re.findall(r"\S+", text)
    word_count = len(words)
    if word_count > max_words:
        text = " ".join(words[:max_words]).rstrip(" ,;،") + " …"
        issues.append("length_truncated")
        word_count = max_words

    fatal = {
        "empty",
        "unverified_numbers",
        "unsafe_diagnosis",
        "unsafe_pesticide",
        "unsafe_bee_action",
    }
    ok = not any(issue in fatal for issue in issues)
    if removed_urls:
        issues.append("urls_removed")

    return ReplyValidation(
        text=text,
        ok=ok,
        issues=issues,
        rejected_numbers=sorted(set(rejected)),
        removed_urls=removed_urls,
        word_count=word_count,
    )


def _value(value: Any, suffix: str = "") -> str:
    if value is None:
        return "not available"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, float):
        rendered = f"{value:.2f}".rstrip("0").rstrip(".")
    else:
        rendered = str(value)
    return f"{rendered}{suffix}"


def deterministic_fallback(context: dict[str, Any], *, lang: str, reason: str) -> str:
    """A safe, clearly-labelled summary built only from computed values."""
    field = context.get("field") or {}
    irrigation = context.get("irrigation") or {}
    health = context.get("crop_health") or {}
    vegetation = context.get("vegetation") or {}
    environment = context.get("environment") or {}
    window = environment.get("window") or {}
    limitations = (context.get("limitations") or [])[:3]
    forecast = context.get("forecast") or {}

    irrigation_line_en = (
        f"Irrigation status {irrigation.get('status', 'unknown')}, "
        f"demand {irrigation.get('demand_label', 'UNKNOWN')}. "
        f"Net refill {_value(irrigation.get('net_refill_requirement_mm'), ' mm')}, "
        f"gross refill {_value(irrigation.get('gross_refill_requirement_mm'), ' mm')} "
        f"at {_value(irrigation.get('application_efficiency'), '')} application efficiency. "
        f"ET0 {_value(irrigation.get('et0_mm_per_day'), ' mm/day')}, "
        f"ETc {_value(irrigation.get('etc_mm_per_day'), ' mm/day')}."
    )
    ndvi_line_en = (
        f"NDVI {_value(vegetation.get('latest_ndvi'))} on {_value(vegetation.get('latest_date'))}."
        if vegetation.get("available")
        else f"NDVI not available: {vegetation.get('reason') or 'no usable pass'}."
    )
    forecast_line_en = (
        f"Forecast: {len(forecast.get('days') or [])} day(s) available."
        if forecast.get("available")
        else f"Forecast not available: {forecast.get('reason') or 'not requested'}."
    )

    if lang == "ar":
        def ar(value: Any, suffix: str = "") -> str:
            if value is None:
                return "غير متاح"
            if isinstance(value, float):
                rendered = f"{value:.2f}".rstrip("0").rstrip(".")
            else:
                rendered = str(value)
            return f"{rendered}{suffix}"

        if vegetation.get("available"):
            ndvi_ar = f"NDVI {ar(vegetation.get('latest_ndvi'))} بتاريخ {ar(vegetation.get('latest_date'))}."
        else:
            ndvi_ar = f"NDVI غير متاح: {vegetation.get('reason') or 'لا توجد صورة صالحة'}."
        if forecast.get("available"):
            forecast_ar = f"التوقعات: متاحة لعدد {len(forecast.get('days') or [])} يوم/أيام."
        else:
            forecast_ar = f"التوقعات غير متاحة: {forecast.get('reason') or 'لم تُطلب'}."

        return (
            f"تعذّر استخدام Google Gemini لهذا الرد ({reason}). هذا ملخص حتمي أنشأه "
            "AgriNASA من القيم المحسوبة، وليس إجابة ذكاء اصطناعي.\n\n"
            f"الحقل: {field.get('name', 'غير محدد')} ({field.get('crop', 'غير محدد')}). "
            f"تاريخ التحليل: {field.get('analysis_date', 'غير متاح')}. "
            f"وضع البيانات: {context.get('data_mode', 'غير متاح')}. "
            f"نافذة البيانات: {window.get('start', 'غير متاح')} إلى {window.get('end', 'غير متاح')}.\n"
            f"الري: الحالة {irrigation.get('status', 'غير متاحة')}، "
            f"الطلب {irrigation.get('demand_label', 'غير معروف')}. "
            f"صافي الاحتياج {ar(irrigation.get('net_refill_requirement_mm'), ' مم')}، "
            f"الإجمالي {ar(irrigation.get('gross_refill_requirement_mm'), ' مم')}. "
            f"ET0 {ar(irrigation.get('et0_mm_per_day'), ' مم/يوم')}، "
            f"ETc {ar(irrigation.get('etc_mm_per_day'), ' مم/يوم')}.\n"
            f"مؤشرات صحة المحصول: {health.get('status', 'غير متاحة')}. "
            f"{health.get('summary', '')}\n"
            f"{ndvi_ar}\n{forecast_ar}\n\n"
            "قيود: " + " ".join(limitations) +
            " لا يقدّم AgriNASA تشخيصاً للأمراض أو الآفات أو نقص العناصر، ولا تنبؤاً بالمحصول."
        )

    return (
        f"RAYAN could not use Google Gemini for this reply ({reason}). This is a "
        "deterministic summary computed by AgriNASA, not an AI answer.\n\n"
        f"Field: {field.get('name', 'unnamed')} ({field.get('crop', 'crop unknown')}). "
        f"Analysis date: {field.get('analysis_date', 'not available')}. "
        f"Data mode: {context.get('data_mode', 'not available')}. "
        f"Window: {window.get('start', 'not available')} to {window.get('end', 'not available')}.\n"
        f"{irrigation_line_en}\n"
        f"Crop-health indicators: {health.get('status', 'not available')}. "
        f"{health.get('summary', '')}\n"
        f"{ndvi_line_en}\n"
        f"{forecast_line_en}\n\n"
        "Limitations: " + " ".join(limitations) +
        " AgriNASA does not diagnose disease, pests or nutrient deficiency and does "
        "not predict yield."
    )


def safety_fallback(*, lang: str) -> str:
    """Used when a reply is withheld for an unsafe recommendation."""
    if lang == "ar":
        return (
            "تم حجب هذا الرد لأنه احتوى على توصية غير آمنة، ولم يتم عرض إجابة ذكاء اصطناعي. "
            "للتقييم الآمن في الموقع، تواصل مع مرشد زراعي محلي متخصص. "
            "إذا كان الأمر يتعلق بخلية نحل، تواصل مع نحّال محلي ذي خبرة؛ "
            "أبعد الناس والحيوانات، ولا تحرق الخلية ولا ترشها. "
            "النحل ملقّح مفيد، وليس حشرة يُفترض القضاء عليها."
        )
    return (
        "RAYAN withheld this reply because it contained an unsafe recommendation. "
        "No AI answer was shown. For a safe on-site assessment, contact your local "
        "agricultural extension specialist. If the problem is a bee colony, contact "
        "an experienced local beekeeper; keep people and animals away, and do not "
        "burn or spray the colony. Bees are beneficial pollinators, not a pest to "
        "eliminate by default."
    )
