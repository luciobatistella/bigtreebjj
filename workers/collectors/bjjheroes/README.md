# BJJ Heroes Discovery Connector

This connector uses BJJ Heroes only as a specialized discovery source for review-first research metadata: names, nicknames, listed team text, profile URLs, and possible lineage clues.

It does not clone or mirror BJJ Heroes. It does not store full biographies, profile images, articles, statistics, championship tables, or long text excerpts. Profile HTML is parsed in memory and discarded; the output stores only a content hash, source URL, capture date, structured fields, and short locators.

## Modes

- `conservative`: default mode. Catalogue import is allowed. Profile collection is limited to curator-selected URLs or small batches, default 20 profiles.
- `authorized_partner`: disabled by default. Requires `BJJHEROES_AUTHORIZED_PARTNER=true`.

## Example

```bash
python -m workers.collectors.bjjheroes.run_profiles --dry-run --limit 10 --profile-url https://www.bjjheroes.com/bjj-fighters/example
```

All output is normalized JSON. The Node API remains responsible for creating ImportJob, ImportRow, DuplicateCandidate, ReviewQueue, and ChangeHistory records.
