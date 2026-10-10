# SPEC-01 V2 Candidate — Data Classification and Storage Inventory

**Status:** S0 target contract; runtime manifest remains policy 1.9 until S1 is implemented.
**Authority:** ADR-004 and SPEC-05. This file does not change the behavior of `beta.15`.

## 1. Rule for the candidate manifest

The existing `SPEC-01-manifest-fixture.json` and its schema describe Stable/Desktop policy
1.9. The separate Beta fixture describes the released test-intended channel. Keep both as
historical runtime evidence. S1 must introduce and validate a policy-2.0 candidate manifest
before changing the runtime policy; it must not mutate either fixture in place and thereby
rewrite what an already-published build did.

For policy 2.0, every durable entry classified as `user_content` or containing personal,
commercial, workshop, or calculation-specific user data MUST use `encrypted_at_rest` on every
supported target. `pii: false` does not mean “safe to store in plaintext”: inventory, products,
quotes, prices, and user-authored settings are still user content. Plaintext persistence is
limited to a versioned, reviewed allowlist of non-content interface preferences and
onboarding state. There is no channel-specific exception for Beta and no capability fallback.

## 2. Candidate logical keys

This inventory is based on the checked-in v1.14.0 sources, the current `main` stores and
manifest, and the Beta15 runtime. S1 must keep the list synchronized with the final runtime
manifest and storage adapters.

| Logical key or record group                                                                                                                                                                                                     | Data class for candidate                                           | Candidate durable policy                                                               | Known source forms requiring explicit migration                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `open3dcalc_customers_v1`                                                                                                                                                                                                       | `user_content`, personal data                                      | Encrypted                                                                              | Stable Web/PWA localStorage; Desktop `open3dcalc_pwless_customers_v1`; Beta `open3dcalc_beta_test_customers_v1`                                  |
| `open3dcalc_quotes_v1`                                                                                                                                                                                                          | `user_content`, personal data                                      | Encrypted                                                                              | Stable Web/PWA localStorage; Desktop `open3dcalc_pwless_quotes_v1` and domain rows `quotes`/`quote_items`; Beta `open3dcalc_beta_test_quotes_v1` |
| `open3dcalc_history_v2`                                                                                                                                                                                                         | `user_content`, may include snapshots                              | Encrypted                                                                              | Stable Web/PWA localStorage; Desktop `open3dcalc_pwless_history_v1` and `history_entries`; Beta `open3dcalc_beta_test_history_v1`                |
| `open3dcalc_settings_v2`                                                                                                                                                                                                        | `user_content` (calculation/business defaults)                     | Encrypted                                                                              | Stable Web/PWA localStorage; v1.14 logical export; Desktop exact `storage` row if present                                                        |
| `open3dcalc_catalog_v1`                                                                                                                                                                                                         | `user_content` when customized (printer/material/channel profiles) | Encrypted as one current blob                                                          | Stable Web/PWA localStorage and v1.14 logical export; Desktop exact `storage` row if present                                                     |
| `open3dcalc_filaments`                                                                                                                                                                                                          | `user_content` (physical inventory, cost, notes)                   | Encrypted                                                                              | Stable Web/PWA localStorage and v1.14 logical export; Desktop exact `storage` row if present                                                     |
| `open3dcalc_products`                                                                                                                                                                                                           | `user_content` (product and price records)                         | Encrypted                                                                              | Stable Web/PWA localStorage and v1.14 logical export; Desktop exact `storage` row if present                                                     |
| `open3dcalc_color_palette_v1`                                                                                                                                                                                                   | `user_content` (user-authored entries)                             | Encrypted                                                                              | Stable Web/PWA localStorage; Desktop exact `storage` row if present                                                                              |
| `open3dcalc_dashboard_goal`                                                                                                                                                                                                     | `user_content` (business target)                                   | Encrypted                                                                              | Stable Web/PWA localStorage and v1.14 logical export; Desktop exact `storage` row if present                                                     |
| `open3dcalc_model_comparison`                                                                                                                                                                                                   | `user_content` (saved comparison inputs)                           | Encrypted                                                                              | Stable Web/PWA localStorage                                                                                                                      |
| `open3dcalc_dashboard_v1`, `open3dcalc_sections`, `open3dcalc_theme`, `open3dcalc_layout_v1`, `open3dcalc_nav_v1`, `open3dcalc_share_prefs_v1`, `open3dcalc_marketplace_comparison_v1`, `i18nextLng`, tutorial/onboarding flags | Reviewed UI/user preferences only                                  | Plaintext only if the final purpose/schema proves no user content; otherwise encrypted | Exact keys only; migrate preference values only when the source registry declares a supported transform                                          |

The table names known source shapes; it does not claim every profile has every row. Migration
must distinguish missing, malformed, unreadable, and empty. Desktop v1.14 also has SQLite
domain tables `customers`, `quotes`, `quote_items`, and `history_entries`; S2 must audit
their versioned schemas and relationship rules from the tagged source before enabling those
readers. Generic `storage` rows and domain tables are independent migration sources and may
contain duplicate representations of the same logical record.

## 3. Destination and source boundaries

- Web/PWA candidate user content uses the new `open3dcalc_pii_vault_v2` IndexedDB database,
  the existing authenticated Web Crypto envelope, and the stable logical key as AAD. It does
  not open the retired `open3dcalc_pii_vault` database.
- Desktop candidate user content must use the reviewed safeStorage/keyring gate or an
  explicit session passphrase. Current `open3dcalc_pwless_*` rows are plaintext migration
  sources only; they are not an allowed candidate destination.
- The three `open3dcalc_beta_test_*_v1` keys are versioned, user-owned migration sources,
  never a policy-2.0 destination. Their names do not prove that their contents are synthetic.
- No migration reads a key or table merely because its name shares a prefix. The exact
  versioned registry and per-source fixture coverage are release gates in SPEC-05.

## 4. Open source-audit items before S2 release gate

1. Reconfirm the tagged v1.14 Web key set and data envelopes against the release tag, not
   current serializers.
2. Reconfirm Desktop v1.14 schema/table columns and legacy `storage` keys using source fixtures;
   never inspect a user's local SQLite profile to do this audit.
3. Determine the exact supported transforms for current 2.x settings/catalog/product and
   Beta15 Zustand wrappers, preserving unknown fields when safe or surfacing unsupported
   records.
4. Identify active preference/consent keys that contain or reference user content before
   allowing any of them to remain plaintext.
5. Decide how the candidate manifest declares ciphertext-only storage surfaces and exact
   Desktop physical destinations; update the schema, fixture, runtime loader, and tests as
   one reviewed S1 change.

Until these items are implemented and fixture-tested, the inventory is a contract baseline,
not evidence that migration or policy 2.0 is shipped.
