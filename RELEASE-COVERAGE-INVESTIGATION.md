# Release automation coverage investigation

Date: 2026-07-31

The project-wide coverage reported below is the existing application baseline;
it is not the scope of the release-notes generator. The generator has its own
focused test run and remains above 80% coverage. No global threshold is changed
to obtain that result.

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
current checkout and instrument. The global 48.15% line coverage is retained as
the project baseline and is explicitly outside this generator task. The focused
generator command is:

```bash
npx vitest run scripts/__tests__/release-notes.test.ts --coverage \
  --coverage.include=scripts/release-notes.mjs
```

That focused report is the evidence for the generator's >80% coverage claim;
the repository-wide report remains informational for this work.
