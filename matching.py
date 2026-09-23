"""Deterministic eligibility, ordering and explanations for contractor matches."""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, field_validator

from prepare_profiles import Profile


FIRST_DATE = date(2026, 9, 23)
LAST_DATE = date(2026, 12, 31)
CATALOG_PATH = Path(__file__).with_name("profiles.json")

# These stems affect ordering only. Eligibility comes from structured profile fields.
FORMAT_TERMS: dict[str, tuple[str, ...]] = {
    "свадьба": ("свадеб", "свадьб", "жених", "невест", "церемони"),
    "той": ("той", "қазақ", "национальн", "традиц"),
    "корпоратив": ("корпоратив", "компан", "бизнес", "команд"),
    "конференция": ("конференц", "форум", "доклад", "делов"),
    "юбилей": ("юбиле", "годовщин"),
    "день рождения": ("день рождения", "именин"),
}
WORK_TERMS = (
    "сценар", "импровиз", "интерактив", "ведущ", "фотограф", "снима",
    "цвет", "флорист", "оформлен", "декор", "букет", "меню", "зал",
    "свет", "звук", "музык", "танц", "репертуар", "гост", "программ",
    "церемони", "съём", "съем", "композиц", "площад", "театр",
)
CONTACT_TERMS = ("телефон", "связь со мной", "свяжитесь", "меня зовут", "приветствую")


def normalize(value: str) -> str:
    return " ".join(value.split()).casefold()


class MatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    city: str = Field(min_length=1)
    event_date: date = Field(ge=FIRST_DATE, le=LAST_DATE)
    event_format: str = Field(min_length=1)
    category: str = Field(min_length=1)
    budget_kzt: int = Field(ge=0)
    duration_hours: int | None = Field(default=None, gt=0)
    language: str | None = None

    @field_validator("city", "event_format", "category", "language")
    @classmethod
    def clean_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = " ".join(value.split())
        if not value:
            raise ValueError("Field cannot be blank")
        return value


class Recommendation(BaseModel):
    id: str
    anon_name: str
    category: str
    city: str
    price_from_kzt: int
    synthetic: bool
    city_imputed: bool
    price_imputed: bool
    explanation: str


class MatchResponse(BaseModel):
    status: str  # matched | no_category_in_city | no_matches
    message: str
    total_matches: int
    exclusions: dict[str, int]
    recommendations: list[Recommendation]


def load_catalog(path: Path = CATALOG_PATH) -> list[Profile]:
    """Read the committed JSON once; all comparison dates stay typed."""
    with path.open(encoding="utf-8") as source:
        raw = json.load(source)
    if not isinstance(raw, list):
        raise ValueError("profiles.json must contain a list")
    profiles: list[Profile] = []
    seen_ids: set[str] = set()
    for row in raw:
        if row["id"] in seen_ids:
            raise ValueError(f"Duplicate profile id: {row['id']}")
        seen_ids.add(row["id"])
        profiles.append({**row, "busy_dates": [date.fromisoformat(d) for d in row["busy_dates"]]})
    return profiles


def format_terms(event_format: str) -> tuple[str, ...]:
    return FORMAT_TERMS.get(normalize(event_format), (normalize(event_format),))


def event_mentions(description: str, event_format: str) -> int:
    text = normalize(description)
    return sum(term in text for term in format_terms(event_format))


def description_evidence(description: str, event_format: str) -> str:
    """Select one original profile fragment; never invent experience or credentials."""
    chunks = [c.strip(" •\t\r\n") for c in re.split(r"(?<=[.!?;])\s+|\s+•\s*", description)]
    chunks = [c for c in chunks if len(c) >= 18] or [description.strip()]
    terms = format_terms(event_format)

    def quality(chunk: str) -> tuple[int, int, int, int]:
        words = normalize(chunk)
        return (
            sum(t in words for t in terms),
            sum(t in words for t in WORK_TERMS) - 3 * sum(t in words for t in CONTACT_TERMS),
            int(any(ch.isdigit() for ch in chunk)),
            min(len(chunk), 180),
        )

    best = max(enumerate(chunks), key=lambda pair: (quality(pair[1]), -pair[0]))[1]
    best = best.strip(" .;:•")
    if len(best) > 175:
        best = best[:175].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
    return best


def count_word(n: int, one: str, few: str, many: str) -> str:
    if n % 100 in (11, 12, 13, 14):
        return many
    return one if n % 10 == 1 else few if n % 10 in (2, 3, 4) else many


def explain(profile: Profile, request: MatchRequest) -> str:
    price = f"{profile['price_from_kzt']:,}".replace(",", " ")
    budget = f"{request.budget_kzt:,}".replace(",", " ")
    estimated = " (оценочная)" if profile["price_imputed"] else ""
    parts = [
        f"На {request.event_date:%d.%m.%Y} свободен по календарю",
        f"работает в формате «{request.event_format}»",
        f"заявленная цена от {price} ₸{estimated} не выше бюджета {budget} ₸",
    ]
    if request.language is not None:
        parts.append(f"язык — {request.language}")
    if request.duration_hours is not None:
        if profile["max_hours"] is None:
            parts.append("услуга не требует почасового присутствия")
        else:
            parts.append(f"лимит работы — {profile['max_hours']} ч при запросе {request.duration_hours} ч")
    first = "; ".join(parts) + "."
    return f"{first} В описании: «{description_evidence(profile['description'], request.event_format)}»."


def exclusion_summary(exclusions: dict[str, int]) -> str:
    labels = {
        "busy_date": "заняты на дату",
        "event_format": "не работают в этом формате",
        "over_budget": "цена «от» выше бюджета",
        "language": "не указали нужный язык",
        "duration": "не хватает часов работы",
    }
    return ", ".join(f"{label}: {exclusions[key]}" for key, label in labels.items() if exclusions[key])


def match_profiles(request: MatchRequest, profiles: list[Profile]) -> MatchResponse:
    # First restrict to the city and category; all counts below refer to this subset.
    candidates = [
        p for p in profiles
        if normalize(p["city"]) == normalize(request.city)
        and any(normalize(c) == normalize(request.category) for c in p["categories"])
    ]
    exclusions = dict.fromkeys(("busy_date", "event_format", "over_budget", "language", "duration"), 0)
    if not candidates:
        return MatchResponse(
            status="no_category_in_city",
            message=f"В городе «{request.city}» нет исполнителей категории «{request.category}».",
            total_matches=0,
            exclusions=exclusions,
            recommendations=[],
        )

    eligible: list[Profile] = []
    for profile in candidates:
        # An excluded profile is counted exactly once, at its first failing rule.
        if request.event_date in profile["busy_dates"]:
            exclusions["busy_date"] += 1
        elif normalize(request.event_format) not in {normalize(x) for x in profile["event_formats"]}:
            exclusions["event_format"] += 1
        elif profile["price_from_kzt"] > request.budget_kzt:
            exclusions["over_budget"] += 1
        elif request.language is not None and normalize(request.language) not in {normalize(x) for x in profile["languages"]}:
            exclusions["language"] += 1
        elif request.duration_hours is not None and profile["max_hours"] is not None and profile["max_hours"] < request.duration_hours:
            exclusions["duration"] += 1
        else:
            eligible.append(profile)

    # Explicit mention of this event in the description, then affordability,
    # then id. This key is stable regardless of JSON/dict iteration order.
    eligible.sort(key=lambda p: (-event_mentions(p["description"], request.event_format), p["price_from_kzt"], p["id"]))
    recommendations = [
        Recommendation(
            id=p["id"], anon_name=p["anon_name"],
            category=next(c for c in p["categories"] if normalize(c) == normalize(request.category)),
            city=p["city"], price_from_kzt=p["price_from_kzt"],
            synthetic=p["synthetic"], city_imputed=p["city_imputed"],
            price_imputed=p["price_imputed"], explanation=explain(p, request),
        ) for p in eligible[:3]
    ]
    reasons = exclusion_summary(exclusions)
    if not eligible:
        message = f"В городе «{request.city}» есть {len(candidates)} {count_word(len(candidates), 'исполнитель', 'исполнителя', 'исполнителей')} категории «{request.category}», но на {request.event_date:%d.%m.%Y} никто не подходит."
        if reasons:
            message += f" Причины отсева: {reasons}."
        status = "no_matches"
    else:
        message = f"На {request.event_date:%d.%m.%Y} найдено {len(eligible)} {count_word(len(eligible), 'подходящий', 'подходящих', 'подходящих')}; показано {len(recommendations)}."
        if len(eligible) < 3:
            message += f" Подходящих меньше трёх: в этом городе всего {len(candidates)} {count_word(len(candidates), 'профиль', 'профиля', 'профилей')} этой категории"
            message += f"; причины отсева: {reasons}." if reasons else "."
        elif exclusions["busy_date"]:
            message += f" Ещё {exclusions['busy_date']} профилей заняты на выбранную дату."
        status = "matched"
    return MatchResponse(status=status, message=message, total_matches=len(eligible), exclusions=exclusions, recommendations=recommendations)
