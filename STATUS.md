# Deepwork D0 — G-code weight reliability

- **Branch/worktree:** `fix/gcode-weight-reliability` / `../open3dcalc-d0-gcode-reliability`
- **Status:** implementation revised — awaiting Themis review; D1 not started.
- **Scope:** Investigate and minimally correct issue #102 only, with regression tests and verification.
- **Last update:** 2026-09-10 — isolated worktree created from current `main`.

## Discovery evidence

- UI path: `StlPreview.tsx` dynamically imports `parseGcode()` and uses
  `filamentUsedGrams` directly as the displayed/anchored weight.
- `parseGcode()` handles `;Filament used:` and otherwise tracks the largest
  absolute positive `E` value; it does not account for `M83`, `M82` deltas,
  retractions, or `G92` resets. `parseGcodeTotals()` already contains the
  safer stateful algorithm, but is not used by this UI path.
- The reported `0.026842945729516288 g` equals the existing formula for
  exactly 9 mm of 1.75 mm filament at PLA density 1.24 g/cm³. An equivalent
  sanitized file with an absolute `E9` move followed by a reset/restart and
  later extrusion reproduces the undercount mechanism.
- PR #72 fixes 3MF path/transform/volume handling; PR #73 fixes mesh weight and
  print-time estimation; PR #84 is the issue behind time-header work; PR #86
  adds the shared time/fallback cascade. None fixes the legacy G-code weight
  path used by this UI. Issue #102 has no attached fixture.

## Correction and verification

- Minimal fix: retain a valid `;Filament used:` header as authoritative; when
  absent, make the UI parser consume `parseGcodeTotals()` for stateful E
  accumulation and then apply the existing diameter/density formula.
- TDD: regression tests were red before the revision and green after the fix;
  the original equivalent fixture remains `34,200 mm` /
  `102.00319377216188 g`.
- Focused tests: 100 passed across 3 files (45 in `gcodeParser.test.ts`).
  Full suite: 1,180 passed across 86 files.
- Typecheck (app + Electron), lint, desktop/web build, coverage and
  `git diff --check` passed. Overall coverage is 64.55% statements /
  66.56% lines versus the reported
  baseline of ~46.69%; altered critical paths are `gcodeParser.ts` 100% lines,
  `gcodeTotals.ts` 98.42% lines, and `StlPreview.tsx` 86.86% lines.
- Build emitted pre-existing Vite warnings about native config loading,
  ineffective dynamic imports and large chunks; no build failure.

## Themis findings revision

- Finding 1: a valid `;Filament used:` header is now latched as authoritative;
  later `G0/G1` moves and the stateful second pass cannot replace it. Multiple
  valid headers retain the documented last-valid-header precedence, while
  supported plain-mm, `mm`, and metre forms remain accepted.
- Finding 2: malformed, non-finite, negative, or absurd filament headers are
  ignored rather than treated as present, so `parseGcodeTotals()` handles
  `M82`, `M83`, `G92`, positive deltas, retractions, and restarts.
- Regression coverage added for header position, multiple headers/units,
  malformed and unsafe values, plus the stateful M82/M83/G92 path. The fixture
  remains generated/sanitized and contains no PII or secrets.

**D0 remains pending Themis review. D1 is not started.**
