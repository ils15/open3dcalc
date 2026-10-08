# OWNERS-RUNBOOK — Policy 1.9

**Owner:** Repository owner (policy approval); implementation owners are assigned per slice.
**Review gates:** Themis review and explicit owner approval before promotion.
**Scope:** Stable/Desktop direct local plaintext, unchanged Web-Beta restrictions, current-owned-data deletion, retained encrypted export.

## 1. Approved policy and consequences

- Stable Web/PWA and Desktop directly persist only the three PII keys declared in SPEC-01
  policy 1.9: customers, quotes, and history. Do not broaden the key or destination scope.
- Stable and Beta local saves have no password, vault-unlock, consent, or receipt prerequisite.
  Beta remains Web-only, synthetic-only, and restricted to its unchanged three Beta keys; it
  still refuses sync, import, export, backup, deletion, migration, and legacy access.
- `contract_performance` is a provisional fixture annotation requiring qualified legal
  review. Engineering does not choose or certify a legal basis.
- Encrypted logical export (E1) retains its existing password, algorithms, integrity checks,
  compatibility, and limits. Its password never gates local saves. Beta has no export path.
- Existing `open3dcalc_pii_vault` bytes are inert, may remain in the profile, and are excluded
  from current deletion. No inspection, enumeration, conversion, recovery, migration, purge,
  or startup cleanup is authorized. Recovery of these bytes is not promised.
- Delete-all is limited to current app-owned data identified by supported current adapters.
  Do not claim complete physical erasure, encrypted rollback, cross-surface recovery, or
  deletion of external copies/historical bytes.

## 2. Version and artifact rules

| Artifact                              | Policy 1.9 rule                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Stable manifest                       | Keep `manifest_version` at `1.0`; set `policy_version` to `1.9`                                                                          |
| Stable customer/quote/history entries | Set `pii:true`, `persistence:plaintext_allowed`, and provisional `legal_basis:contract_performance`; preserve per-entry `version` values |
| Other PII entries and destinations    | Keep their prior restrictions; no blanket plaintext permission                                                                           |
| Beta schema and fixture               | No change; preserve the exact three Web-only synthetic keys and restrictions                                                             |
| SPEC-03 encrypted export              | Freeze format/version, algorithms, KDF parameters, integrity rules, and limits                                                           |
| Existing receipts                     | Preserve bytes; old policy receipts evaluate as `policy_mismatch` under 1.9                                                              |
| Historical vault/migration targets    | Retire as active manifest/write/delete targets; never mutate existing stored bytes                                                       |

Never use this policy change as authorization for a data-format migration. Avoid changing
encrypted-entry versions: policy 1.9 is not an encrypted-format migration.

## 3. Verification checklist

For each implementation phase, run and record:

1. Stable manifest/schema and Beta fixture contract validation.
2. `npm run test:run -- <changed test files>` and then the relevant full suite.
3. `npm run typecheck` and `npm run typecheck:electron`.
4. `npm run lint`.
5. Save/reload checks for Stable Web, Desktop, and Beta; storage failure must not be reported
   as a durable save.
6. Negative reachability checks proving no historical-vault access and Beta refusal before
   prohibited operations.
7. Diff inspection to confirm no runtime changes occur in a documentation/RED-only phase,
   and no Beta schema/fixture changes occur in this slice.

A RED test is acceptable only when it fails because the target policy behavior is missing.
Fixture parse failures, type errors, unrelated component exceptions, and environmental setup
failures are defects in the test, not evidence of RED behavior.

## 4. Rollback

- Rollback is a code/package rollback only. Do not run a migration, inspect or convert
  historical vault bytes, remove old bytes, or rewrite receipts.
- Leave all current plaintext and historical storage bytes unchanged during rollback. A
  previous application version may again impose old save gates and may not operate on data
  written under policy 1.9; disclose this compatibility risk rather than attempting an
  undocumented conversion.
- The SPEC-03 export envelope remains frozen, so policy rollback must not alter its crypto
  format or compatibility behavior.
- Beta's three-key namespace and all Beta restrictions remain unchanged during Stable policy
  rollback.
- Any rollback that would add vault access, data migration, or deletion of excluded bytes
  requires a new explicit owner decision and a reviewed contract change.

## 5. Phase ownership and release gate

Each implementation phase has a named owner and must pass Themis review before the next
phase. No phase may claim successful data erasure beyond the scope in SPEC-02. The repository
owner separately approves legal review status, release promotion, and any change to the
approved exact key scope. This runbook authorizes no commit, merge, release, or publication.
