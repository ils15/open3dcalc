# Audited English release notes

The generator in `scripts/release-notes.mjs` is deterministic and read-only in
this phase. It produces `inventory.json`, `audit.json`, `release-notes.md`, and
`release-notes.diff`.

## Template contract

Notes are English Markdown with the sections **Highlights**, **Features**,
**Improvements**, **Fixes**, **Security**, **CI/CD**, **Documentation**,
**Dependencies**, **Breaking Changes**, **Other Changes**, **Downloads**,
**Checksums**, **Contributors**, and **Full Changelog** (empty categories are
omitted). External text is escaped and length-limited; it is data only and is
never executed.

## Evidence and attribution

The inventory is sourced from paginated releases, tags, commits, closed pull
requests, and release assets. A merged PR author wins, followed by the real
GitHub commit author. Bots and `github-actions` are not assigned as human
contributors; the fallback is `Unknown`. Missing URLs, digests, or messages are
`Not available` (missing people are `Unknown`). Squash commits represented by
one PR are emitted once.

Categories are keyword-based and stable. Items are sorted by category, title,
and stable key. `audit.json` contains SHA-256 hashes of normalized input and
rendered output for review and replay.

## Dry-run and limits

Use `node scripts/release-notes.mjs --dry-run --all` or `--release vX.Y.Z`.
`--audit-only` writes only inventory and audit JSON. `--input` enables offline
fixtures. `--write` is rejected: mutable backfill belongs to a separate,
approved workflow. Requests use GitHub pagination and bounded exponential
backoff for 429 and transient 5xx responses (500, 502, 503, and 504), with at
most four retries. HTTP 403 is not retried: it is recorded as a
partial-collection error so a permissions failure cannot loop or be mistaken
for a rate-limit response. Tokens come from `GH_TOKEN` and are never printed.

## Invariants, snapshots, and rollback

This workflow does not create, edit, delete, or upload GitHub tags, releases,
or assets. Tag names and commit SHAs are evidence, not mutation targets. Keep
the uploaded inventory, audit JSON, Markdown, and diff as a review snapshot.
A future approved writer must snapshot these artifacts first and provide a
rollback plan that restores the previous release body without changing tags,
commits, or assets.

## Human approval and future integration

Review the artifact hashes, attribution, categories, dangerous-text escaping,
asset digests, and diff manually. Only after explicit environment approval may
a future implementation add a writer. The publication workflow should then
replace `--generate-notes` with `--notes-file` and validate the reviewed file;
this PR deliberately does not change publication.
