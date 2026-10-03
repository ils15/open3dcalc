# 🌿 Open3DCalc — Branch & PR Policy

> **Date:** July 2026
> **Goal:** Ensure full traceability of new features through branches + Pull Requests.

## 📋 Rules

### 1. Every new feature → branch + PR

No significant change goes directly to `main`. Every new feature, improvement, or structural fix must:

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/<feature-name>
   ```
2. Develop with commits following [Conventional Commits](https://www.conventionalcommits.org/)
3. Open a Pull Request to `main`
4. Go through review (minimum 1 approval)
5. CI/CD must pass (lint, typecheck, tests, build)

### 2. Branch naming

| Type       | Prefix     | Example                       |
| ---------- | ---------- | ----------------------------- |
| Feature    | `feat/`    | `feat/dark-mode-pdf-export`   |
| Fix        | `fix/`     | `fix/currency-conversion-bug` |
| Infra/Docs | `chore/`   | `chore/update-docker-compose` |
| Release    | `release/` | `release/v1.9.0`              |

### 3. Post-merge cleanup

Merged branches are deleted automatically by GitHub ("Delete branch" option in the PR) and locally:

```bash
git branch -d <branch>
git push origin --delete <branch>
```

### 4. Exceptional deepwork

For complex tasks (multi-turn, multi-agent), the flow continues via `/deepwork`, but the **final result always generates a PR** for merge into `main`.

### 5. Current branches

Last sweep: **2026-09-11** — 25 local and 23 `origin` stale branches, 4 stale fork
remotes, 3 stale worktrees, and 1 stale lint-staged stash were removed after verifying
their content was fully contained in `main` (via merged PRs or content checks).
Branches with **open PRs are never deleted** (D1.1 S1 + dependabot bumps).

| Branch                                     | Status                    | Action                                             |
| ------------------------------------------ | ------------------------- | -------------------------------------------------- |
| `main`                                     | ✅ Active                 | Development default branch                         |
| `feat/d1-s1-manifest-loader`               | 🔄 Open PR #107           | D1.1 S1 — SPEC-01 manifest loader                  |
| `dependabot/*` (12)                        | 🔄 Open PRs #53, #90–#101 | Dependency bumps pending review                    |
| `feature/fase2-complete`                   | ✅ Deleted                | Already implemented in main (v1.8 Bifrost)         |
| `feature/fase2-historico-unificado`        | ✅ Deleted                | Contained in fase2-complete (also already in main) |
| `feat/*`, `fix/*`, `chore/*` (pre-2026-09) | ✅ Deleted                | All squash-merged via PRs #29, #51–#106            |

### 6. Local pre-push gate is "did not get worse", CI is the authority

`.husky/pre-push` runs `typecheck`, `lint` and `build:all` at **zero tolerance**,
and `test:run` in **baseline mode**: it compares against
`scripts/push-gate-baseline.json` and blocks only **new** regressions —

| Situation                                     | Pre-push | CI      |
| --------------------------------------------- | -------- | ------- |
| Typecheck / lint / build fails                | ❌ block | ❌      |
| A test file fails that is **not** in baseline | ❌ block | ❌      |
| Failing test count **above** baseline         | ❌ block | ❌      |
| Failing test count **below** baseline         | ✅ pass  | depends |
| A baseline file starts passing (stale)        | ⚠️ warn  | ✅      |

This exists because `main` carries inherited red: on `main@09d8947` **12 test
files / 52 tests fail** across the W6 studio refactor and two deferred pin
registries. A gate demanding zero failures there blocked this repository three
times in one day — one push needed `--no-verify`, two merges needed an
administrator bypass of required checks. It protected nothing and taught
`--no-verify`.

**The CI remains the authority.** `BRANCH-POLICY` protection rules are unchanged:
lint, typecheck, test and build must pass on the PR. The local gate is a cheap
"you did not make it worse" filter, not a substitute for green CI. If CI is red,
your branch is not ready, whatever the local gate says.

**Escape hatch:** `SKIP_PUSH_GATE=1` skips the whole pre-push hook and prints a
loud warning. It is an exception, not a workflow — CI still blocks you.

#### Regenerating the baseline

Never hand-edit `scripts/push-gate-baseline.json`. Regenerate it from a measured
run so the numbers cannot drift from reality:

```bash
npm run test:run -- --reporter=default --reporter=json \
  --outputFile.json=node_modules/.cache/push-gate/vitest.json
node scripts/push-gate.mjs node_modules/.cache/push-gate/vitest.json \
  scripts/push-gate-baseline.json --write
```

Then **update `notes.slices` in the same commit** — the per-file note naming the
slice that closes that red is what stops the baseline from becoming accumulated
junk. A baseline file that only lists failing paths, with no reason attached,
will never be cleaned up and will quietly stop blocking anything.

Commit the regenerated baseline **together with** the test change that justifies
it, never on its own.

---

_This policy replaces the previous flow where multiple obsolete branches polluted the repository._
