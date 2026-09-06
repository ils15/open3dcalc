# Conventions

Shared working agreements for this repo. Domain docs (e.g. `docs/estimators-model.md`)
may stay in PT-BR; everything below applies to code and user-facing text.

## Language standard

- **Code, comments, TSDoc and logs are written in English (EN).**
  - Identifiers, function names, and comments: EN.
  - `console.*` logs and thrown `Error` messages: EN (they are
    developer-facing; the UI maps failures to i18n strings).
  - When touching a file, convert the PT-BR comments/TSDoc on the lines you
    touch to EN. Do not retranslate unrelated files in the same commit.
- **User-facing strings only via i18n (pt-BR + en).**
  - Never hardcode UI copy in `.tsx`/`.ts`. Use `t("namespace.key")` with
    entries in both `src/shared/i18n/locales/pt-BR.json` and
    `src/shared/i18n/locales/en-US.json`.
  - Error toasts/alerts shown to users come from i18n keys, even when the
    underlying library throws an EN `Error` (catch at the boundary and map).
- **Seed data in PT-BR is fine.**
  - Seed catalogs, example quotes, and demo fixtures may keep PT-BR copy;
    they are content, not code.

## Single-source constants

- Shared caps and bounds live in the domain and are imported — never
  duplicated:
  - G-code upload caps: `DEFAULT_MAX_CHARS` / `DEFAULT_MAX_LINES` from
    `@/shared/lib/gcodeTotals`.
  - Calibration bounds: `K_MIN` / `K_MAX` (plus `K_STEP`, `K_DEFAULT`) from
    `@/shared/types/estimation`.
- Slicer time-header formats are parsed only by `parseTimeHeaderSeconds`
  (`@/shared/lib/gcodeTotals`). New formats (e.g. Klipper variants for issue
  #84) extend that function; call sites must not reimplement the parsing.

## Estimation behavior table

- `MODE_BEHAVIOR` (`@/shared/types/estimation`) maps each `EstimationMode`
  to `{ applyCalibration, applyAnchors }`. Resolvers consult the table.
- A new mode (e.g. Klipper) is one new entry — no resolver branching changes
  (Open/Closed Principle).
