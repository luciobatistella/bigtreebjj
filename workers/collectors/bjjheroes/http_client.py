from dataclasses import dataclass
from urllib import robotparser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .config import BASE_URL, USER_AGENT
from .rate_limit import RateLimiter


@dataclass
class HttpResult:
    url: str
    status_code: int
    body: str
    skipped_reason: str | None = None


class BjjHeroesHttpClient:
    def __init__(self, limiter: RateLimiter, user_agent: str = USER_AGENT):
        self.limiter = limiter
        self.user_agent = user_agent
        self._robots: robotparser.RobotFileParser | None = None

    def _robots_parser(self) -> robotparser.RobotFileParser:
        if self._robots is None:
            parser = robotparser.RobotFileParser()
            parser.set_url(f"{BASE_URL}/robots.txt")
            try:
                parser.read()
            except Exception:
                parser.parse([])
            self._robots = parser
        return self._robots

    def allowed_by_robots(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.netloc and parsed.netloc != urlparse(BASE_URL).netloc:
            return False
        return self._robots_parser().can_fetch(self.user_agent, url)

    def fetch(self, url: str, dry_run: bool = False) -> HttpResult:
        self.limiter.assert_not_paused()
        if not self.allowed_by_robots(url):
            return HttpResult(url=url, status_code=0, body="", skipped_reason="blocked_by_robots")
        self.limiter.wait(dry_run=dry_run)
        if dry_run:
            return HttpResult(url=url, status_code=0, body="", skipped_reason="dry_run")
        request = Request(url, headers={"User-Agent": self.user_agent})
        try:
            with urlopen(request, timeout=20) as response:
                body = response.read().decode("utf-8", errors="replace")
                status = int(response.status)
                self.limiter.record_status(status, body)
                return HttpResult(url=url, status_code=status, body=body)
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            self.limiter.record_status(error.code, body)
            return HttpResult(url=url, status_code=error.code, body="", skipped_reason=f"http_{error.code}")
        except URLError as error:
            return HttpResult(url=url, status_code=0, body="", skipped_reason=str(error.reason))
