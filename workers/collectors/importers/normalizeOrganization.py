import sys
from pathlib import Path
from typing import Any, Dict

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent))

from validation import normalize_name, normalize_text


def normalize_organization(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": normalize_name(row.get("name") or row.get("organization_name") or ""),
        "type": normalize_text(row.get("type") or "organization"),
        "raw": row,
    }
