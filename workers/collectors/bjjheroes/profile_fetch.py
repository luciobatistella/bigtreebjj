from .config import load_config
from .http_client import BjjHeroesHttpClient
from .normalizers import now_iso
from .profile_parser import parse_profile
from .claim_detector import detect_candidates
from .rate_limit import RateLimiter, UrlCache


def fetch_profiles(urls: list[str], mode: str = "conservative", limit: int | None = None, dry_run: bool = False, refresh: bool = False, resume: bool = False) -> dict:
    config = load_config(mode)
    requested_limit = limit or config.default_limit
    config.validate(requested_limit)
    limiter = RateLimiter(config.request_delay_seconds, config.jitter_min_seconds, config.jitter_max_seconds, config.paused_path, config.repeated_block_threshold)
    if resume:
        limiter.resume()
    cache = UrlCache(config.cache_path)
    client = BjjHeroesHttpClient(limiter)
    results = {"profiles": [], "fact_candidates": [], "logs": [], "summary": {"queued": len(urls), "fetched": 0, "skipped": 0, "paused": False}}

    for url in urls[:requested_limit]:
        if cache.has(url) and not refresh:
            results["summary"]["skipped"] += 1
            results["logs"].append({"url": url, "status": "skipped_cached"})
            continue
        response = client.fetch(url, dry_run=dry_run)
        if response.skipped_reason:
            results["summary"]["skipped"] += 1
            results["logs"].append({"url": url, "status": response.skipped_reason})
            continue
        captured_at = now_iso()
        profile = parse_profile(response.body, url, captured_at)
        results["profiles"].append(profile)
        results["fact_candidates"].extend(detect_candidates(profile, response.body))
        results["summary"]["fetched"] += 1
        cache.add(url)
    return results
