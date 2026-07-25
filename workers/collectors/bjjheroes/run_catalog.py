import argparse

from .catalog_seed import CATALOG_URL, parse_catalog
from .config import load_config
from .http_client import BjjHeroesHttpClient
from .output_writer import emit_json
from .rate_limit import RateLimiter


def main() -> None:
    parser = argparse.ArgumentParser(description="BJJ Heroes catalogue discovery connector")
    parser.add_argument("--mode", default="conservative", choices=["conservative", "authorized_partner"])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    config = load_config(args.mode)
    config.validate(args.limit)
    limiter = RateLimiter(config.request_delay_seconds, config.jitter_min_seconds, config.jitter_max_seconds, config.paused_path, config.repeated_block_threshold)
    if args.resume:
        limiter.resume()
    client = BjjHeroesHttpClient(limiter)
    response = client.fetch(CATALOG_URL, dry_run=args.dry_run)
    records = [] if response.skipped_reason else parse_catalog(response.body)
    if args.limit:
        records = records[: args.limit]
    emit_json({"catalog_url": CATALOG_URL, "records": records, "summary": {"catalog_size_discovered": len(records), "status": response.skipped_reason or response.status_code}})


if __name__ == "__main__":
    main()
