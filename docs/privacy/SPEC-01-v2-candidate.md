# SPEC-01 V2 Candidate — Data Classification and Storage Inventory

**Status:** Candidate contract; runtime inventory and migration sources require fixture verification before release.
**Authority:** ADR-004 and SPEC-05. This file does not change the behavior of `beta.15`.

## 1. Rule for the candidate manifest

The existing `SPEC-01-manifest-fixture.json` records the current Stable/Desktop policy 1.9
scope. The separate Beta fixture records the published test-intended channel. Keep both as
historical runtime evidence; do not edit them to rewrite an already-published build.

The next candidate manifest must inventory every local user-content key, physical storage
surface, platform, export rule, deletion rule, and known migration source. User records are
stored in readable local form; no user-content key is encrypted at rest by the app, and no
password/key/vault capability gates a save. `pii: false` does not mean “not user content”:
inventory, products, quotes, prices, and user-authored settings can still be sensitive and
must be included in disclosures and data-management rules.

## 2. Candidate logical keys

This inventory is based on checked-in v1.14 sources, current stores/manifests, and the Beta15
runtime. The final candidate manifest and adapters must be checked against synthetic fixtures.

| Logical key or record group                                                                                   | Data class                                                     | Candidate local handling | Known sources for explicit migration                                                                                                             |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `open3dcalc_customers_v1`                                                                                     | User content; personal data                                    | Readable local storage   | Stable Web/PWA localStorage; Desktop `open3dcalc_pwless_customers_v1`; Beta `open3dcalc_beta_test_customers_v1`                                  |
| `open3dcalc_quotes_v1`                                                                                        | User content; personal data                                    | Readable local storage   | Stable Web/PWA localStorage; Desktop `open3dcalc_pwless_quotes_v1` and domain rows `quotes`/`quote_items`; Beta `open3dcalc_beta_test_quotes_v1` |
| `open3dcalc_history_v2`                                                                                       | User content; may include snapshots                            | Readable local storage   | Stable Web/PWA localStorage; Desktop `open3dcalc_pwless_history_v1` and `history_entries`; Beta `open3dcalc_beta_test_history_v1`                |
| `open3dcalc_settings_v2`                                                                                      | User content; calculation/business defaults                    | Readable local storage   | Stable Web/PWA localStorage; v1.14 logical export; Desktop exact `storage` row if present                                                        |
| `open3dcalc_catalog_v1`                                                                                       | User content when customized                                   | Readable local storage   | Stable Web/PWA localStorage and v1.14 logical export; Desktop exact `storage` row if present                                                     |
| `open3dcalc_filaments`                                                                                        | User content; inventory/cost/notes                             | Readable local storage   | Stable Web/PWA localStorage and v1.14 logical export; Desktop exact `storage` row if present                                                     |
| `open3dcalc_products`                                                                                         | User content; products/prices                                  | Readable local storage   | Stable Web/PWA localStorage and v1.14 logical export; Desktop exact `storage` row if present                                                     |
| `open3dcalc_color_palette_v1`                                                                                 | User-authored content                                          | Readable local storage   | Stable Web/PWA localStorage; Desktop exact `storage` row if present                                                                              |
| `open3dcalc_dashboard_goal`                                                                                   | User content; business target                                  | Readable local storage   | Stable Web/PWA localStorage and v1.14 logical export; Desktop exact `storage` row if present                                                     |
| `open3dcalc_model_comparison`                                                                                 | User content; saved comparison inputs                          | Readable local storage   | Stable Web/PWA localStorage                                                                                                                      |
| Dashboard, section, theme, layout, nav, sharing, marketplace preferences, language, tutorial/onboarding flags | UI/user preferences; classify embedded user content explicitly | Local-only and readable  | Exact keys only; migrate values only when the source registry declares a supported transform                                                     |

The table names known source shapes; it does not claim every profile has every row. Migration
must distinguish missing, malformed, inaccessible, and empty. Desktop v1.14 also has SQLite
domain tables `customers`, `quotes`, `quote_items`, and `history_entries`; migration must audit
their versioned schemas and relationship rules from tagged source fixtures before enabling
those readers. Generic `storage` rows and domain tables are independent sources and may contain
duplicate representations of the same logical record.

## 3. Destination and source boundaries

- Web/PWA candidate content stays in declared browser profile storage in readable form.
- Desktop candidate content stays in the declared local SQLite profile in readable form,
  including current `open3dcalc_pwless_*` logical destinations.
- The three `open3dcalc_beta_test_*_v1` keys are versioned, user-owned migration sources.
  Their names do not prove that their contents are synthetic. After successful migration and
  verification, exact source cleanup may be offered separately.
- No migration reads a key/table merely because its name shares a prefix. The exact versioned
  source registry and fixture coverage are release gates in SPEC-05.
- The retired `open3dcalc_pii_vault` is not opened or altered by ordinary startup or this
  migration path. Unsupported encrypted backups are not decoded.

## 4. Open source-audit items before release

1. Reconfirm the tagged v1.14 Web key set and data envelopes against the release tag.
2. Reconfirm Desktop v1.14 schema/table columns and legacy `storage` keys using synthetic
   source fixtures; never inspect a user's local SQLite profile for this audit.
3. Determine supported transforms for current 2.x settings/catalog/product and Beta15 Zustand
   wrappers, preserving unknown fields where safe or surfacing unsupported records.
4. Identify preference/consent keys that contain or reference user content and include them in
   the readable-data disclosure and export/deletion rules.
5. Synchronize the candidate manifest, schema, adapters, UI disclosure, and tests as one
   reviewed change. Do not add an encryption marker or password prerequisite.

Until these items are implemented and fixture-tested, this inventory is a contract baseline,
not evidence that full migration or release readiness is complete.
