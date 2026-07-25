import os
from dataclasses import dataclass

SOURCE_NAME = "BJJ Heroes"
BASE_URL = "https://www.bjjheroes.com"
CATALOG_URL = f"{BASE_URL}/a-z-bjj-fighters-list"
USER_AGENT = "TheBigTreeBJJResearchBot/0.1 (+review-first; contact curator)"
ALLOWED_CANDIDATE_TYPES = {
    "person_discovery",
    "nickname_discovery",
    "team_affiliation_observation",
    "possible_black_belt_under",
    "possible_main_teacher",
    "possible_academy_affiliation",
    "possible_team_affiliation",
}


@dataclass(frozen=True)
class ConnectorConfig:
    mode: str = "conservative"
    default_limit: int = 20
    request_delay_seconds: float = 8.0
    jitter_min_seconds: float = 2.0
    jitter_max_seconds: float = 5.0
    cache_path: str = "data/cache/bjjheroes_completed_urls.txt"
    paused_path: str = "data/cache/bjjheroes_paused.flag"
    repeated_block_threshold: int = 3

    @property
    def authorized_partner(self) -> bool:
        return os.getenv("BJJHEROES_AUTHORIZED_PARTNER", "").lower() == "true"

    def validate(self, requested_limit: int | None = None) -> None:
        if self.mode == "authorized_partner" and not self.authorized_partner:
            raise PermissionError("authorized_partner mode requires BJJHEROES_AUTHORIZED_PARTNER=true")
        if self.mode not in {"conservative", "authorized_partner"}:
            raise ValueError("mode must be conservative or authorized_partner")
        if self.mode == "conservative" and requested_limit and requested_limit > self.default_limit:
            raise ValueError("conservative mode limit cannot exceed 20 profiles")


def load_config(mode: str = "conservative") -> ConnectorConfig:
    default_limit = 20 if mode == "conservative" else int(os.getenv("BJJHEROES_PARTNER_LIMIT", "100"))
    return ConnectorConfig(mode=mode, default_limit=default_limit)
