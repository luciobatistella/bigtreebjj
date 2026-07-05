import sys
from pathlib import Path
from typing import Any, Dict

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent))

from validation import normalize_aliases, normalize_name, normalize_text


def normalize_person(row: Dict[str, Any]) -> Dict[str, Any]:
    full_name = normalize_name(row.get("full_name") or row.get("name") or "")
    aliases = normalize_aliases(row.get("aliases") or row.get("nicknames") or [])
    return {
        "full_name": full_name,
        "aliases": aliases,
        "country": normalize_text(row.get("country") or row.get("country_name")),
        "city": normalize_text(row.get("city") or row.get("city_name")),
        "raw": row,
    }
