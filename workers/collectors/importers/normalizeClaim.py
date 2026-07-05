import sys
from pathlib import Path
from typing import Any, Dict

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent))

from validation import normalize_name, normalize_text


def normalize_claim(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "student_name": normalize_name(row.get("student_name") or row.get("student") or ""),
        "teacher_name": normalize_name(row.get("teacher_name") or row.get("teacher") or ""),
        "claim_type": normalize_text(row.get("claim_type") or row.get("relationship_type") or "black_belt_awarded_by"),
        "relationship_label": normalize_text(row.get("relationship_label") or row.get("label") or "Imported claim"),
        "notes": normalize_text(row.get("notes") or row.get("comment") or ""),
        "raw": row,
    }
