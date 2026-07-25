import argparse

from .output_writer import emit_json
from .profile_fetch import fetch_profiles


def main() -> None:
    parser = argparse.ArgumentParser(description="BJJ Heroes profile discovery connector")
    parser.add_argument("--mode", default="conservative", choices=["conservative", "authorized_partner"])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--profile-url", action="append", default=[])
    args = parser.parse_args()
    payload = fetch_profiles(args.profile_url, mode=args.mode, limit=args.limit, dry_run=args.dry_run, refresh=args.refresh, resume=args.resume)
    emit_json(payload)


if __name__ == "__main__":
    main()
