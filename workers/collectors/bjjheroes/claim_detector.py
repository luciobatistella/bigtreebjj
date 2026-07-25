import re

from .config import ALLOWED_CANDIDATE_TYPES
from .normalizers import normalize_space, source_attribution, stable_id, truncate_excerpt


def _candidate(candidate_type: str, profile: dict, subject: str, object_name: str, locator: str, confidence: float, structured_value: dict) -> dict:
    if candidate_type not in ALLOWED_CANDIDATE_TYPES:
        raise ValueError("unsupported candidate type")
    source_url = profile["source_profile_url"]
    return {
        "id": stable_id("fact-candidate", {"type": candidate_type, "subject": subject, "object": object_name, "url": source_url}),
        "external_profile_id": profile["id"],
        "candidate_type": candidate_type,
        "subject_name": subject,
        "object_name": object_name,
        "structured_value": structured_value,
        "source_url": source_url,
        "source_locator": locator,
        "evidence_level": "specialized_source",
        "status": "pending_review",
        "confidence_score": confidence,
        "imported_at": profile["captured_at"],
        "source_attribution": source_attribution(source_url),
    }


def detect_candidates(profile: dict, html: str) -> list[dict]:
    subject = profile.get("external_name", "")
    candidates = []
    if subject:
        candidates.append(_candidate("person_discovery", profile, subject, "", "profile metadata", 0.8, {"name": subject}))
    if profile.get("nickname"):
        candidates.append(_candidate("nickname_discovery", profile, subject, profile["nickname"], "profile metadata", 0.75, {"nickname": profile["nickname"]}))
    if profile.get("listed_team_text"):
        candidates.append(_candidate("team_affiliation_observation", profile, subject, profile["listed_team_text"], "listed team field", 0.7, {"team_text": profile["listed_team_text"]}))

    clean = normalize_space(html)
    under_match = re.search(r"black belt (?:under|from|by)\s+([A-Z][A-Za-zÀ-ÿ' .-]{2,80})", clean, re.IGNORECASE)
    if under_match:
        teacher = truncate_excerpt(under_match.group(1), 80)
        candidates.append(_candidate("possible_black_belt_under", profile, subject, teacher, "introductory paragraph", 0.55, {"phrase": "black belt under/from/by", "teacher_text": teacher}))

    main_teacher = re.search(r"(?:main teacher|coach|instructor)\s*:?\s*([A-Z][A-Za-zÀ-ÿ' .-]{2,80})", clean, re.IGNORECASE)
    if main_teacher:
        teacher = truncate_excerpt(main_teacher.group(1), 80)
        candidates.append(_candidate("possible_main_teacher", profile, subject, teacher, "introductory paragraph", 0.5, {"teacher_text": teacher}))
    return candidates
