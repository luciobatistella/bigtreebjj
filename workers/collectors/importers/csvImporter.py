import csv
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parent))

from duplicateDetection import detect_duplicate_candidates
from normalizeClaim import normalize_claim
from normalizeOrganization import normalize_organization
from normalizePerson import normalize_person
from validation import validate_row


def import_csv(file_path: str, options: Dict[str, Any] | None = None) -> Dict[str, Any]:
    options = options or {}
    path = Path(file_path)
    delimiter = options.get("delimiter") or ","
    entity_type = str(options.get("importCategory") or options.get("entity_type") or "people")
    rows: List[Dict[str, Any]] = []
    existing_records: List[Dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=str(delimiter))
        for index, row in enumerate(reader, start=2):
            normalized = normalize_person(row)
            validation = validate_row(row, entity_type)
            normalized_organization = normalize_organization(row)
            current_name = normalized_organization.get("name") if entity_type in {"organizations", "organization"} else normalized.get("full_name") or ""
            duplicate_candidates = detect_duplicate_candidates(str(current_name or ""), existing_records, row, entity_type)
            rows.append({
                "row_number": index,
                "raw": row,
                "normalized_person": normalized,
                "validation": validation,
                "duplicate_candidates": duplicate_candidates,
                "normalized_claim": normalize_claim(row),
                "normalized_organization": normalized_organization,
            })
            if current_name:
                existing_records.append({"name": str(current_name), "raw": row})
    return {
        "format": "csv",
        "file_name": path.name,
        "rows": rows,
        "summary": {
            "total_rows": len(rows),
            "valid_rows": sum(1 for row in rows if row["validation"]["valid"]),
            "invalid_rows": sum(1 for row in rows if not row["validation"]["valid"]),
        },
        "preview": json.dumps(rows[:3], ensure_ascii=False),
        "metadata": {"delimiter": delimiter},
    }


if __name__ == "__main__":
    options = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    print(json.dumps(import_csv(sys.argv[1], options)))
