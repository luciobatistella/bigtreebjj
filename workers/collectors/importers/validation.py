import re
from typing import Any, Dict, List


def normalize_name(value: str) -> str:
    if not value:
        return ""
    normalized = value.strip()
    normalized = re.sub(r"\s+", " ", normalized)
    normalized = normalized.replace("“", '"').replace("”", '"')
    return normalized


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_aliases(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [normalize_name(str(item)) for item in value if normalize_name(str(item))]
    return [normalize_name(str(value))]


def validate_row(row: Dict[str, Any]) -> Dict[str, Any]:
    errors: List[str] = []
    if not row.get("full_name") and not row.get("name"):
        errors.append("Missing full_name or name")
    return {"valid": not errors, "errors": errors}
