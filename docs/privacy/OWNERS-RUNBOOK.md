# OWNERS-RUNBOOK — Policy 1.9

**Owner:** Repository owner (policy approval); implementation owners are assigned per slice.
**Review gates:** Themis review and explicit owner approval before promotion.
**Scope:** Stable/Desktop direct local plaintext, unchanged Web-Beta restrictions, current-owned-data deletion, retained encrypted export.

**Candidate status:** This runbook section records the shipped/current policy 1.9 behavior.
The next V2 real-data candidate is separately governed by ADR-004, SPEC-01 V2 Candidate,
SPEC-05, and TEST-MATRIX §9. Do not apply the 1.9 artifact rules below to that candidate or
describe `v2.0.0-beta.15` as supporting real data.

## 1. Approved policy and consequences

- Stable Web/PWA and Desktop directly persist only the three PII keys declared in SPEC-01
  policy 1.9: customers, quotes, and history. Web/PWA use their logical localStorage keys;
  Desktop uses `open3dcalc_pwless_customers_v1`, `open3dcalc_pwless_quotes_v1`, and
  `open3dcalc_pwless_history_v1` in SQLite's `storage` table. Do not broaden the key or
  destination scope.
- Stable and Beta local saves have no password, vault-unlock, consent, or receipt prerequisite.
  Beta remains Web-only and restricted by app-mediated storage guards to its unchanged three
  Beta keys. Synthetic-only is an intended-use restriction: the app does not validate record
  contents. This is not a security boundary against same-origin scripts, browser extensions,
  or DevTools. Beta refuses sync, import, export, backup, deletion, migration, and legacy access
  through its own app paths.
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
| Beta schema and fixture               | No change; preserve the exact three Web-only keys designated for synthetic test data and their restrictions                              |
| SPEC-03 encrypted export              | Freeze format/version, algorithms, KDF parameters, integrity rules, and limits                                                           |
| Existing receipts                     | Preserve bytes; old policy receipts evaluate as `policy_mismatch` under 1.9                                                              |
| Historical vault/migration targets    | Retire as active manifest/write/delete targets; never mutate existing stored bytes                                                       |

Never use this policy change as authorization for a data-format migration. Avoid changing
encrypted-entry versions: policy 1.9 is not an encrypted-format migration.

## 2A. Next V2 candidate release path

The approved product direction is not a release authorization. Follow the S0 → S1 → S2 order
in the integration roadmap and keep each slice in its own branch/PR:

1. **S0 contract:** reconcile the current 1.9 record with ADR-004/SPEC-01 V2 Candidate/SPEC-05;
   inventory exact data classes, stores, envelopes, source formats, Desktop capability,
   backup, deletion, and user disclosures. No real profile may be inspected for this work.
2. **S1 encrypted persistence:** update the candidate manifest/schema and encrypt all durable
   user content on Web/PWA/Desktop, with passphrase/keyring gates and no plaintext fallback.
   Add user-triggered encrypted backup/restore and exact-scope deletion. Keep all legacy
   sources intact; do not enable migration readers in this slice.
3. **S2 explicit migration:** use only the reviewed versioned source registry; preview, copy,
   verify encrypted destination, report, then offer exact-source cleanup as a separate user
   action. No startup scan, prefix sweep, or source deletion on cancel/failure/crash.
4. **Candidate release:** run the complete §9 matrix against the exact Beta, Stable Web/PWA,
   and Desktop build configurations. Release notes and first-run disclosure must match each
   target's measured behavior. If a target or source is unsupported, name it and leave its
   bytes untouched; do not claim full migration or real-data support for that target.

S1/S2 are hard gates for a Beta that invites users to enter real workshop data. Dashboard,
navigation, calculator parity, marketplace, and printer-library slices may be developed in
parallel branches, but must not be included in the real-data candidate before their own plan
gates pass and the S1/S2 contract remains intact.

## 3. Verification checklist

For each implementation phase, run and record:

1. Stable manifest/schema and Beta fixture contract validation.
2. `npm run test:run -- <changed test files>` and then the relevant full suite.
3. `npm run typecheck` and `npm run typecheck:electron`.
4. `npm run lint`.
5. Save/reload checks for Stable Web, Desktop, and Beta; storage failure must not be reported
   as a durable save.
6. Negative reachability checks proving no historical-vault startup access and Beta refusal
   before prohibited app operations.
7. Diff inspection to confirm changes stay within the approved final-wave scope; Beta schema
   and fixture updates must match the documented intended-use and same-origin limitations.

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
