import re
import unicodedata
from difflib import SequenceMatcher
from typing import Any, Dict, List


PERSON_STOPWORDS = {"da", "de", "do", "das", "dos", "del", "van", "von", "jr", "junior", "filho", "neto"}
ORG_SUFFIXES = {
    "academy",
    "academia",
    "bjj",
    "jiujitsu",
    "jiu",
    "jitsu",
    "team",
    "association",
    "associacao",
    "hq",
    "brasil",
    "brazil",
    "international",
    "club",
}
ORG_ABBREVIATIONS = {"gb": "gracie barra"}


def strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(char for char in normalized if not unicodedata.combining(char))


def normalize_text(value: str) -> str:
    if not value:
        return ""
    value = strip_accents(str(value).lower())
    value = value.replace("&", " and ")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", normalize_text(value))


def person_tokens(name: str) -> List[str]:
    return [token for token in normalize_text(name).split() if token and token not in PERSON_STOPWORDS]


def org_tokens(name: str) -> List[str]:
    normalized = ORG_ABBREVIATIONS.get(normalize_text(name), normalize_text(name))
    return [token for token in normalized.split() if token and token not in ORG_SUFFIXES]


def organization_type(row: Dict[str, Any]) -> str:
    value = normalize_text(row.get("organization_type") or row.get("type") or "")
    if "feder" in value:
        return "federation"
    if "event" in value or "organizer" in value:
        return "event organizer"
    if "associ" in value:
        return "association"
    if "academ" in value:
        return "academy"
    if "team" in value or "equipe" in value:
        return "team"
    return value or "organization"


def as_record(existing: Any) -> Dict[str, Any]:
    if isinstance(existing, dict):
        return existing
    return {"name": str(existing), "raw": {}}


def first_last(tokens: List[str]) -> tuple[str, str]:
    if not tokens:
        return "", ""
    return tokens[0], tokens[-1]


def score_person(target_name: str, existing_name: str, row: Dict[str, Any], existing_row: Dict[str, Any]) -> tuple[float, str]:
    target_compact = compact(target_name)
    existing_compact = compact(existing_name)
    if not target_compact or not existing_compact:
        return 0.0, "Missing comparable name"
    if target_compact == existing_compact:
        return 0.99, "Exact normalized full-name match"

    target_tokens = person_tokens(target_name)
    existing_tokens = person_tokens(existing_name)
    target_first, target_last = first_last(target_tokens)
    existing_first, existing_last = first_last(existing_tokens)
    if not target_first or not existing_first:
        return 0.0, "Missing first name"

    if target_first != existing_first:
        alias_value = row.get("aliases") or row.get("nicknames") or row.get("nickname") or ""
        existing_alias_value = existing_row.get("aliases") or existing_row.get("nicknames") or existing_row.get("nickname") or ""
        aliases = {compact(alias) for alias in str(alias_value).replace(",", "|").split("|") if alias}
        existing_aliases = {compact(alias) for alias in str(existing_alias_value).replace(",", "|").split("|") if alias}
        if target_compact not in existing_aliases and existing_compact not in aliases and target_first not in existing_aliases and existing_first not in aliases:
            return 0.0, "Different first names"
        return 0.88, "Alias-supported name match"

    if target_last and existing_last and target_last == existing_last and target_first != existing_first:
        return 0.0, "Shared surname only"

    overlap = len(set(target_tokens).intersection(existing_tokens))
    union = max(len(set(target_tokens).union(existing_tokens)), 1)
    token_score = overlap / union
    sequence_score = SequenceMatcher(None, target_compact, existing_compact).ratio()
    score = max(token_score, sequence_score)
    reason = "Name token similarity"

    if target_first == existing_first and target_last and target_last == existing_last:
        score = max(score, 0.92)
        reason = "Same first and last name"
    elif target_first == existing_first and token_score >= 0.6:
        score = max(score, 0.84)
        reason = "Same first name with strong token overlap"

    country = normalize_text(row.get("country") or row.get("country_name") or "")
    existing_country = normalize_text(existing_row.get("country") or existing_row.get("country_name") or "")
    team = normalize_text(row.get("team") or row.get("organization_name_as_reported") or "")
    existing_team = normalize_text(existing_row.get("team") or existing_row.get("organization_name_as_reported") or "")
    if country and existing_country and country == existing_country:
        score += 0.03
    elif country and existing_country and country != existing_country:
        score -= 0.08
    if team and existing_team and team == existing_team:
        score += 0.04
    elif team and existing_team and team != existing_team:
        score -= 0.05

    return max(0.0, min(score, 0.99)), reason


def score_organization(target_name: str, existing_name: str, row: Dict[str, Any], existing_row: Dict[str, Any]) -> tuple[float, str]:
    target_text = normalize_text(target_name)
    existing_text = normalize_text(existing_name)
    target_compact = compact(target_name)
    existing_compact = compact(existing_name)
    if not target_compact or not existing_compact:
        return 0.0, "Missing comparable organization name"
    if target_compact == existing_compact:
        return 0.96, "Exact normalized organization name"

    target_brand = org_tokens(target_name)
    existing_brand = org_tokens(existing_name)
    if not target_brand or not existing_brand:
        return 0.0, "Missing organization brand"

    shared = set(target_brand).intersection(existing_brand)
    if not shared:
        return 0.0, "Different organization brand"

    target_type = organization_type(row)
    existing_type = organization_type(existing_row)
    if target_type and existing_type and target_type != existing_type:
        return 0.0, "Different organization type"

    token_score = len(shared) / max(len(set(target_brand).union(existing_brand)), 1)
    sequence_score = SequenceMatcher(None, target_text, existing_text).ratio()
    score = max(token_score, sequence_score)
    reason = "Organization brand similarity"

    branch_words = {"hq", "brasil", "brazil", "usa", "france", "berlin", "charlotte", "midland", "alabama", "greenville"}
    has_branch_difference = bool((set(target_text.split()) ^ set(existing_text.split())).intersection(branch_words))
    if has_branch_difference:
        score = min(score, 0.84)
        reason = "Related brand with branch difference"

    return max(0.0, min(score, 0.96)), reason


def detect_duplicate_candidates(name: str, existing_names: List[Any], row: Dict[str, Any] | None = None, entity_type: str = "people") -> List[Dict[str, object]]:
    row = row or {}
    threshold = 0.80 if entity_type in {"organizations", "organization"} else 0.70
    candidates: List[Dict[str, object]] = []
    for existing in existing_names:
        existing_record = as_record(existing)
        existing_name = str(existing_record.get("name") or existing_record.get("full_name") or "")
        if entity_type in {"organizations", "organization"}:
            confidence, reason = score_organization(name, existing_name, row, existing_record.get("raw") or existing_record)
        else:
            confidence, reason = score_person(name, existing_name, row, existing_record.get("raw") or existing_record)
        if confidence >= threshold:
            candidates.append({
                "name": existing_name,
                "confidence": round(confidence, 2),
                "reason": reason,
                "matching_fields": ["name"],
                "entity_type": entity_type,
            })
    candidates.sort(key=lambda candidate: float(candidate["confidence"]), reverse=True)
    return candidates[:3]
