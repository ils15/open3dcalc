# Release automation coverage investigation

Date: 2026-07-31

The comparison between `main` and `fix/release-automation` contains no new
TypeScript, JavaScript, or shell files. The PR changes GitHub Actions YAML,
release documentation, and dependency metadata only. Therefore, it introduces
no new application functions or validators that can be covered by unit tests.

The coverage command was run three times on each ref:

```text
npm run test:run -- --coverage
```

Every run completed with the same result:

| Ref                      |         Statements |           Branches |         Functions |              Lines | Tests |
| ------------------------ | -----------------: | -----------------: | ----------------: | -----------------: | ----: |
| `main`                   | 46.69% (1753/3754) | 45.03% (1220/2709) | 42.39% (482/1137) | 48.15% (1537/3192) |   701 |
| `fix/release-automation` | 46.69% (1753/3754) | 45.03% (1220/2709) | 42.39% (482/1137) | 48.15% (1537/3192) |   701 |

There was no run-to-run variation and no reproducible coverage regression.
The reported `42.50%` to `42.48%` difference could not be reproduced with the
current checkout and instrument. No thresholds were changed and no source
code was excluded.
