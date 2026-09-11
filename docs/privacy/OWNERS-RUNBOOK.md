# OWNERS-RUNBOOK — D1 Contracts

**Track:** D1 — Privacy & Data Contracts
**Status:** Active for D1.0 (documentation); runbook binds D1.1+ slices
**Addresses findings:** R6 (DRI/testes), R15 (aprovadores/diff-check)
**Related:** README (roles, block declaration), COMPLIANCE-MATRIX (traceability)

## 1. DRI

- **DRI:** Hermes — owns correctness, internal consistency, and cross-references of the
  document set and of every D1.1+ slice against these contracts.
- **Gate:** Themis — reviews every slice; a slice merges only after Themis approval.
- **Final approver:** the user — approves this document set (unblocks D1.1+) and accepts
  each slice's merge. Nothing derived from these contracts lands before the user approves
  the contracts themselves (README §5).

## 2. Owners per contract

| Contract | Owner | Reviewer |
|----------|-------|----------|
| ADR-001 crypto capability | Hermes | Themis |
| ADR-002 PII at-rest/quarantine | Hermes | Themis |
| ADR-003 export vs backup | Hermes | Themis |
| SPEC-01 manifest schema + fixture | Hermes (schema), Demeter (SQLite surfaces), Aphrodite (web surfaces) | Themis |
| SPEC-02 erasure saga | Hermes | Themis |
| SPEC-03 export envelope | Hermes | Themis |
| SPEC-04 consent receipt | Hermes | Themis |
| TEST-MATRIX | Hermes (author), all owners (execute their rows) | Themis |
| Surface-specific entries in SPEC-01 | Demeter (SQLite/WAL), Aphrodite (localStorage/IndexedDB/OPFS/Cache/SW) | Hermes |

Owner duties: owners MUST keep their SPEC-01 entries truthful against the code; update `version` on
policy change; implement their TEST-MATRIX rows in their slices.

## 3. Escalation

- Contract ambiguity or contradiction between documents → Hermes decides or escalates to
  the user; contradictions are D1.0 defects and block approval.
- Slice cannot satisfy a contract clause → the owner MUST NOT weaken the contract unilaterally;
  escalate to Themis + user (a contract change requires re-approval, since receipts and
  policy hashes bind to `policy_version`).
- Security-relevant discovery mid-slice → stop the slice, notify Themis immediately.

## 4. D1.1+ slice plan (indicative order; each slice is independently shippable)

| Slice | Scope | Contracts exercised |
|-------|-------|---------------------|
| S1 | Manifest loader + schema validation wired into stores (single source of truth; unknown-key deny) | SPEC-01 |
| S2 | Crypto capability layer (desktop `safeStorage` + fallback + deny path; web Web Crypto + secure context) | ADR-001 |
| S3 | PII at-rest encryption on write paths + startup scan | ADR-001, ADR-002 |
| S4 | Legacy quarantine state + privacy screen + migrate/eliminate flows | ADR-002 |
| S5 | Export envelope v1.1 (producer + consumer) replacing legacy bundle | SPEC-03 |
| S6 | `db:export` reclassification (dev gate, redaction, retention tooling) | ADR-003 |
| S7 | Erasure saga (journal, snapshot, rescan, receipts) | SPEC-02 |
| S8 | Consent receipt (issue, verify, withdraw, policy-version delta) | SPEC-04 |

Slices S2–S4 may proceed in parallel with S5–S6 after S1 lands (S1 is the dependency for
everything). S7 depends on S1+S2 (scanner + capability). S8 depends on S7 (withdrawal uses
the saga).

## 5. Diagnostic backup disposal runbook (ADR-003 §2.2.4)

For every unredacted diagnostic backup taken under the dev gate:

1. Record in the engineering log (metadata only — never PII): date, filename, operator,
   redacted yes/no, retention deadline (creation + 14 days).
2. Before the deadline: either delete (secure: overwrite + unlink, or `srm`-class tooling)
   or justify extension in the log (only for redacted backups).
3. Weekly check: a script (D1.1+ S6 deliverable) lists backups past deadline and fails CI
   if any unredacted file exceeds retention.
4. Disposal is logged (date, file, method). The log itself is `diagnostic` class,
   `plaintext_allowed` (metadata only).

## 6. Per-slice diff-check gate (R15)

Every D1.1+ slice PR MUST declare its scope and pass:

```bash
# 1. Diff matches declared scope (no stray files)
git diff --name-only main...<slice-branch>

# 2. No changes to files outside the slice's declared modules
#    (e.g., S5 must not touch electron/main.ts beyond the export handler)

# 3. No contract documents modified without a policy_version bump
git diff main...<slice-branch> -- docs/privacy/   # must be empty unless bumping policy
```

If a slice needs a contract change: stop, bump `policy_version` (SPEC-01) and
`receipt_version` (SPEC-04) as applicable, update COMPLIANCE-MATRIX, and re-approve with
the user — receipts bind to the policy hash, so silent changes invalidate consent records.

## 7. Rollback runbook (per slice)

Each slice ships with a rollback path tested before merge:

| Slice | Rollback |
|-------|----------|
| S1 manifest loader | Feature-flag off ⇒ stores fall back to direct keys; manifest file inert (read-only doc). No data migration in S1, so rollback is a flag flip. |
| S2 crypto layer | Flag off ⇒ previous write path returns. Data written encrypted under S2 remains readable only via the S2 path — keep the decrypt path enabled (flag "write-plaintext" never exists; rollback disables *new* encrypted writes, not reads). |
| S3 PII encryption | Same as S2: rollback stops new encrypted writes; existing encrypted data stays encrypted and readable via the capability layer. Never convert back to plaintext. |
| S4 quarantine | Flag off ⇒ quarantine screen hidden; legacy data returns to previous (unquarantined) state — **only acceptable pre-approval of the at-rest policy**; after ADR-002 is active in a release, rollback of S4 requires user sign-off because it re-exposes plaintext. |
| S5 envelope v1.1 | Producer flag off ⇒ exports return to `1.0` bundle. Import keeps accepting both (never remove `1.0` import). |
| S6 db:export gate | Flag off ⇒ previous behavior returns — **requires user sign-off** (re-exposes raw PII copy); preferred rollback is keeping the gate and fixing forward. |
| S7 erasure saga | Saga is user-triggered; rollback = disable the delete-all entry (feature flag), fix forward. Never leave a half-run saga: journal + resume logic must remain enabled even when the entry is hidden, so an interrupted saga still completes or rolls back. |
| S8 consent receipt | Flag off ⇒ boolean-consent behavior returns; receipts already issued stay stored (inert). Re-enabling re-validates digests. |

**General rule:** rollback never converts encrypted data back to plaintext and never
deletes receipts/journals silently. Slices whose rollback would re-expose PII (S4, S6)
require explicit user sign-off for the rollback itself.

## 8. Contacts

- DRI (contracts, backend slices): Hermes
- SQLite/WAL surfaces: Demeter
- Web/PWA surfaces, privacy screens: Aphrodite
- Quality/security gate: Themis
- Final approval, rollback sign-offs: user
