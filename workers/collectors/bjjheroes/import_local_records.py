import argparse
import csv
import json
import re
from pathlib import Path

from .config import SOURCE_NAME
from .normalizers import content_hash, now_iso, source_attribution, stable_id, truncate_excerpt


def clean_name(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").replace("\ufeff", "")).strip()


def split_teacher_text(value: str) -> list[str]:
    text = clean_name(value)
    text = re.split(r"\b(?:having|while|and a |who |, regarded|, being|\.| Full Name:)\b", text, flags=re.IGNORECASE)[0]
    parts = re.split(r"\s+and\s+|,|/|&", text)
    return [clean_name(part) for part in parts if clean_name(part) and len(clean_name(part)) <= 90]


def detect_lineage_clues(bio: str) -> list[tuple[str, str, str, float]]:
    text = clean_name(bio)
    clues: list[tuple[str, str, str, float]] = []
    patterns = [
        ("possible_black_belt_under", r"black belt under\s*([^.;]{2,160})", 0.62),
        ("possible_black_belt_under", r"black belt from\s*([^.;]{2,160})", 0.58),
        ("possible_main_teacher", r"under the tutelage of\s*([^.;]{2,160})", 0.48),
        ("possible_main_teacher", r"following the instructions of\s*([^.;]{2,160})", 0.44),
    ]
    for candidate_type, pattern, confidence in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            for teacher in split_teacher_text(match.group(1)):
                clues.append((candidate_type, teacher, "introductory paragraph", confidence))
    return clues


def fact_candidate(profile_id: str, source_url: str, subject: str, candidate_type: str, object_name: str, locator: str, confidence: float, structured_value: dict, imported_at: str) -> dict:
    payload = {"profile": profile_id, "type": candidate_type, "subject": subject, "object": object_name, "url": source_url, "value": structured_value}
    return {
        "id": stable_id("fact-candidate", payload),
        "external_profile_id": profile_id,
        "candidate_type": candidate_type,
        "subject_name": subject,
        "object_name": object_name,
        "structured_value": json.dumps(structured_value, ensure_ascii=False, sort_keys=True),
        "source_url": source_url,
        "source_locator": locator,
        "evidence_level": "specialized_source",
        "status": "pending_review",
        "confidence_score": f"{confidence:.2f}",
        "imported_at": imported_at,
        "source_name": SOURCE_NAME,
        "source_attribution": json.dumps(source_attribution(source_url), ensure_ascii=False, sort_keys=True),
    }


def convert(input_path: Path, output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    captured_at = now_iso()
    profiles: list[dict] = []
    candidates: list[dict] = []
    skipped = 0

    with input_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, start=2):
            source_url = clean_name(row.get("profile_url", ""))
            external_name = clean_name(row.get("full_name_title")) or clean_name(f"{row.get('first_name', '')} {row.get('last_name', '')}")
            if not source_url or not external_name:
                skipped += 1
                continue
            nickname = clean_name(row.get("nickname", ""))
            team = clean_name(row.get("team", ""))
            bio = row.get("bio", "") or ""
            record_count = clean_name(row.get("record_row_count", "0")) or "0"
            profile_id = stable_id("external-profile", {"url": source_url})
            attribution = source_attribution(source_url)
            raw_hash = content_hash(json.dumps({
                "source_url": source_url,
                "external_name": external_name,
                "nickname": nickname,
                "team": team,
                "bio": bio,
                "record_row_count": record_count,
            }, ensure_ascii=False, sort_keys=True))
            profiles.append({
                "id": profile_id,
                "source_name": SOURCE_NAME,
                "source_profile_url": source_url,
                "external_name": external_name,
                "nickname": nickname,
                "listed_team_text": team,
                "captured_at": captured_at,
                "source_status": "local_export_pending_review",
                "raw_hash": raw_hash,
                "created_at": captured_at,
                "status": "pending_review",
                "evidence_level": "specialized_source",
                "source_locator": "local fighters_details.csv",
                "original_file": str(input_path),
                "original_row": row_number,
                "bio_locator": "introductory paragraph",
                "bio_excerpt": truncate_excerpt(bio, 160),
                "record_row_count": record_count,
                "record_rows_stored": "false",
                "source_attribution": json.dumps(attribution, ensure_ascii=False, sort_keys=True),
            })
            candidates.append(fact_candidate(profile_id, source_url, external_name, "person_discovery", "", "profile metadata", 0.86, {"external_name": external_name, "original_row": row_number}, captured_at))
            if nickname:
                candidates.append(fact_candidate(profile_id, source_url, external_name, "nickname_discovery", nickname, "profile metadata", 0.78, {"nickname": nickname, "original_row": row_number}, captured_at))
            if team:
                candidates.append(fact_candidate(profile_id, source_url, external_name, "team_affiliation_observation", team, "listed team field", 0.72, {"team_text": team, "original_row": row_number}, captured_at))
                candidates.append(fact_candidate(profile_id, source_url, external_name, "possible_team_affiliation", team, "listed team field", 0.52, {"team_text": team, "original_row": row_number}, captured_at))
            for candidate_type, teacher, locator, confidence in detect_lineage_clues(bio):
                candidates.append(fact_candidate(profile_id, source_url, external_name, candidate_type, teacher, locator, confidence, {"teacher_text": teacher, "original_row": row_number}, captured_at))

    profile_path = output_dir / "bjjheroes_external_source_profiles.csv"
    candidate_path = output_dir / "bjjheroes_external_fact_candidates.csv"
    write_csv(profile_path, profiles)
    write_csv(candidate_path, candidates)
    return {
        "profiles": len(profiles),
        "fact_candidates": len(candidates),
        "skipped": skipped,
        "profile_csv": str(profile_path),
        "candidate_csv": str(candidate_path),
    }


def write_csv(path: Path, rows: list[dict]) -> None:
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    headers = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert local BJJ Heroes fighters_details.csv into review-first import CSVs")
    parser.add_argument("--input", default="records/fighters_details.csv")
    parser.add_argument("--output-dir", default="data/imports/bjjheroes_local")
    args = parser.parse_args()
    print(json.dumps(convert(Path(args.input), Path(args.output_dir)), ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
