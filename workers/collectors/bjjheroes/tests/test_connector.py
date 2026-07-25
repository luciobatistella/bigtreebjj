import os
import tempfile
import unittest

from workers.collectors.bjjheroes.catalog_seed import parse_catalog
from workers.collectors.bjjheroes.claim_detector import detect_candidates
from workers.collectors.bjjheroes.config import load_config
from workers.collectors.bjjheroes.profile_parser import parse_profile
from workers.collectors.bjjheroes.rate_limit import CrawlPause, RateLimiter, UrlCache


class BjjHeroesConnectorTests(unittest.TestCase):
    def test_catalog_person_discovery(self):
        html = '<a href="/bjj-fighters/kaynan-duarte">Kaynan Duarte</a>'
        records = parse_catalog(html)
        self.assertEqual(records[0]["external_name"], "Kaynan Duarte")
        self.assertEqual(records[0]["status"], "pending_review")

    def test_rate_limiter_returns_delay_without_sleep_in_dry_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            limiter = RateLimiter(8, 2, 5, f"{tmp}/paused.flag")
            delay = limiter.wait(dry_run=True)
            self.assertGreaterEqual(delay, 10)

    def test_duplicate_url_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache = UrlCache(f"{tmp}/cache.txt")
            cache.add("https://example.test/profile")
            self.assertTrue(cache.has("https://example.test/profile"))

    def test_profile_parser(self):
        html = "<title>Kaynan Duarte - BJJ Heroes</title><p>Nickname: The Big Deal</p><p>Team/Association: Atos</p>"
        profile = parse_profile(html, "https://www.bjjheroes.com/bjj-fighters/kaynan-duarte", "2026-07-05T00:00:00Z")
        self.assertEqual(profile["external_name"], "Kaynan Duarte")
        self.assertEqual(profile["nickname"], "The Big Deal")
        self.assertEqual(profile["listed_team_text"], "Atos")

    def test_no_full_biography_storage(self):
        html = "<title>A - BJJ Heroes</title><p>" + ("long text " * 80) + "</p>"
        profile = parse_profile(html, "https://www.bjjheroes.com/bjj-fighters/a", "2026-07-05T00:00:00Z")
        self.assertLessEqual(len(profile["intro_excerpt"]), 160)
        self.assertNotIn("html", profile)

    def test_no_image_download(self):
        html = '<title>A - BJJ Heroes</title><img src="/x.jpg"><p>Team: Atos</p>'
        profile = parse_profile(html, "https://www.bjjheroes.com/bjj-fighters/a", "2026-07-05T00:00:00Z")
        self.assertFalse(profile["image_downloaded"])
        self.assertEqual(profile["images_seen_count"], 1)

    def test_imported_fact_candidate_remains_pending_review(self):
        html = "<title>Kaynan Duarte - BJJ Heroes</title><p>black belt from Andre Galvao</p>"
        profile = parse_profile(html, "https://www.bjjheroes.com/bjj-fighters/kaynan-duarte", "2026-07-05T00:00:00Z")
        candidate = detect_candidates(profile, html)[0]
        self.assertEqual(candidate["status"], "pending_review")

    def test_crawler_pauses_after_repeated_429(self):
        with tempfile.TemporaryDirectory() as tmp:
            limiter = RateLimiter(0, 0, 0, f"{tmp}/paused.flag", block_threshold=2)
            limiter.record_status(429)
            with self.assertRaises(CrawlPause):
                limiter.record_status(429)

    def test_resume_clears_pause_flag(self):
        with tempfile.TemporaryDirectory() as tmp:
            limiter = RateLimiter(0, 0, 0, f"{tmp}/paused.flag")
            limiter.pause("manual pause")
            limiter.resume()
            limiter.assert_not_paused()

    def test_mode_b_requires_authorization(self):
        old = os.environ.pop("BJJHEROES_AUTHORIZED_PARTNER", None)
        try:
            with self.assertRaises(PermissionError):
                load_config("authorized_partner").validate(30)
        finally:
            if old is not None:
                os.environ["BJJHEROES_AUTHORIZED_PARTNER"] = old


if __name__ == "__main__":
    unittest.main()
