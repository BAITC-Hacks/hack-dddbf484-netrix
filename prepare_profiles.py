"""Convert the hackathon CSV into typed profiles and JSON.

Usage:
    python prepare_profiles.py "hackathon dataset anonymized (3).csv" profiles.json

Import ``load_profiles`` to work with Python ``date`` objects directly.
The JSON output stores those dates as ISO 8601 strings (YYYY-MM-DD).
"""

from __future__ import annotations

import argparse
import csv
import json
from datetime import date
from pathlib import Path
from typing import TypedDict


class Profile(TypedDict):
    id: str
    anon_name: str
    categories: list[str]
    city: str
    city_imputed: bool
    synthetic: bool
    price_from_kzt: int
    price_imputed: bool
    event_formats: list[str]
    languages: list[str]
    max_hours: int | None
    busy_dates: list[date]
    description: str


FIELDS = set(Profile.__annotations__)


def split_list(value: str) -> list[str]:
    return [part.strip() for part in value.split("|") if part.strip()]


def parse_bool(value: str) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError(f"Expected True or False, got {value!r}")
    return normalized == "true"


def parse_profile(row: dict[str, str]) -> Profile:
    price = int(row["price_from_kzt"].strip())
    if price < 0:
        raise ValueError("price_from_kzt cannot be negative")

    hours_text = row["max_hours"].strip()
    hours = int(hours_text) if hours_text else None
    if hours is not None and hours < 0:
        raise ValueError("max_hours cannot be negative")

    return {
        "id": row["id"].strip(),
        "anon_name": row["anon_name"].strip(),
        "categories": split_list(row["categories"]),
        "city": row["city"].strip(),
        "city_imputed": parse_bool(row["city_imputed"]),
        "synthetic": parse_bool(row["synthetic"]),
        "price_from_kzt": price,
        "price_imputed": parse_bool(row["price_imputed"]),
        "event_formats": split_list(row["event_formats"]),
        "languages": split_list(row["languages"]),
        "max_hours": hours,
        "busy_dates": [date.fromisoformat(value) for value in split_list(row["busy_dates"])],
        "description": row["description"].strip(),
    }


def load_profiles(csv_path: str | Path) -> list[Profile]:
    profiles: list[Profile] = []
    seen_ids: set[str] = set()
    with Path(csv_path).open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        missing = FIELDS - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing CSV fields: {', '.join(sorted(missing))}")
        for line_number, row in enumerate(reader, start=2):
            try:
                profile = parse_profile(row)
                if not profile["id"] or profile["id"] in seen_ids:
                    raise ValueError(f"Empty or duplicate id: {profile['id']!r}")
            except (ValueError, TypeError, KeyError) as error:
                raise ValueError(f"CSV line {line_number}: {error}") from error
            seen_ids.add(profile["id"])
            profiles.append(profile)
    return profiles


def write_json(profiles: list[Profile], output_path: str | Path) -> None:
    def encode(value: object) -> str:
        if isinstance(value, date):
            return value.isoformat()
        raise TypeError(f"Cannot encode {type(value).__name__}")

    with Path(output_path).open("w", encoding="utf-8") as output:
        json.dump(profiles, output, ensure_ascii=False, indent=2, default=encode)
        output.write("\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("json_path", type=Path)
    args = parser.parse_args()
    loaded = load_profiles(args.csv_path)
    write_json(loaded, args.json_path)
    print(f"Saved {len(loaded)} profiles to {args.json_path}")
