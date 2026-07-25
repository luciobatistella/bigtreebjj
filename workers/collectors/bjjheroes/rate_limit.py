import random
import time
from pathlib import Path


class UrlCache:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._urls = set(self.path.read_text(encoding="utf-8").splitlines()) if self.path.exists() else set()

    def has(self, url: str) -> bool:
        return url in self._urls

    def add(self, url: str) -> None:
        if url in self._urls:
            return
        self._urls.add(url)
        self.path.write_text("\n".join(sorted(self._urls)), encoding="utf-8")


class CrawlPause(Exception):
    pass


class RateLimiter:
    def __init__(self, delay_seconds: float, jitter_min: float, jitter_max: float, paused_path: str, block_threshold: int = 3):
        self.delay_seconds = delay_seconds
        self.jitter_min = jitter_min
        self.jitter_max = jitter_max
        self.paused_path = Path(paused_path)
        self.paused_path.parent.mkdir(parents=True, exist_ok=True)
        self.block_threshold = block_threshold
        self.repeated_blocks = 0

    def wait(self, dry_run: bool = False) -> float:
        delay = self.delay_seconds + random.uniform(self.jitter_min, self.jitter_max)
        if not dry_run:
            time.sleep(delay)
        return delay

    def pause(self, reason: str) -> None:
        self.paused_path.write_text(reason, encoding="utf-8")

    def resume(self) -> None:
        if self.paused_path.exists():
            self.paused_path.unlink()

    def assert_not_paused(self) -> None:
        if self.paused_path.exists():
            raise CrawlPause(self.paused_path.read_text(encoding="utf-8"))

    def record_status(self, status_code: int, body: str = "") -> None:
        captcha_like = "captcha" in body.lower() or "cloudflare" in body.lower()
        if status_code in {403, 429} or captcha_like:
            self.repeated_blocks += 1
        else:
            self.repeated_blocks = 0
        if self.repeated_blocks >= self.block_threshold:
            self.pause(f"Paused after repeated blocking responses; last_status={status_code}")
            raise CrawlPause("Repeated blocking responses")
