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


REQUIRED_FIELDS_BY_ENTITY = {
    "people": ("full_name", "name"),
    "persons": ("full_name", "name"),
    "organizations": ("name", "organization_name"),
    "sources": ("source_name", "url", "name"),
    "official_observations": ("observation_id", "person_id"),
    "person_affiliations": ("affiliation_id", "person_id", "organization_id"),
    "research_queue": ("task_id", "person_id", "person_name"),
    "research_tasks": ("task_id", "task_type"),
    "lineage_claims": ("claim_id", "student_person_id", "student_name"),
    "claim_evidence": ("claim_id", "url"),
    "external_source_profiles": ("source_profile_url", "external_name"),
    "external_fact_candidates": ("candidate_type", "subject_name", "source_url"),
    "evidence": ("url", "source_url"),
}


def validate_row(row: Dict[str, Any], entity_type: str = "people") -> Dict[str, Any]:
    errors: List[str] = []
    required_fields = REQUIRED_FIELDS_BY_ENTITY.get(entity_type)
    if required_fields and not any(str(row.get(field) or "").strip() for field in required_fields):
        errors.append(f"Missing category identifier: {' or '.join(required_fields)}")
    return {"valid": not errors, "errors": errors}
