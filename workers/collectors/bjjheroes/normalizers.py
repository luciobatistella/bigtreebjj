import hashlib
import json
import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urljoin

from .config import BASE_URL, SOURCE_NAME


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_space(value: str | None) -> str:
    return re.sub(r"\s+", " ", unescape(value or "")).strip()


def truncate_excerpt(value: str | None, max_length: int = 160) -> str:
    clean = normalize_space(value)
    return clean if len(clean) <= max_length else clean[: max_length - 1].rstrip() + "…"


def absolute_url(url: str) -> str:
    return urljoin(BASE_URL, url)


def content_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()


def stable_id(prefix: str, payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return f"{prefix}-{hashlib.sha1(encoded.encode('utf-8')).hexdigest()[:12]}"


def source_attribution(source_url: str) -> dict:
    return {
        "source": SOURCE_NAME,
        "source_url": source_url,
        "use": "Specialized discovery source",
        "editorial_status": "Requires review before lineage publication",
    }
