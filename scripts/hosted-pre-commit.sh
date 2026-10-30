#!/usr/bin/env bash
set -euo pipefail

: "${GATE_BASE_SHA:?GATE_BASE_SHA is required}"
: "${CANDIDATE_SHA:?CANDIDATE_SHA is required}"
[[ "$GATE_BASE_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]]

candidate_repo=$(git rev-parse --show-toplevel)
candidate_head=$(env -u GIT_INDEX_FILE git -C "$candidate_repo" rev-parse HEAD)
candidate_tree=$(env -u GIT_INDEX_FILE git -C "$candidate_repo" rev-parse "$CANDIDATE_SHA^{tree}")
candidate_index=$(env -u GIT_INDEX_FILE git -C "$candidate_repo" write-tree)
[[ "$candidate_head" = "$CANDIDATE_SHA" ]]
[[ "$candidate_tree" = "$candidate_index" ]]

node_modules="$candidate_repo/node_modules"
[[ -d "$node_modules" && ! -L "$node_modules" ]]

hook_root=$(mktemp -d "${TMPDIR:-/tmp}/open3dcalc-hosted-hook.XXXXXX")
hook_worktree="$hook_root/worktree"
cleanup() {
  if [[ -d "$hook_worktree" ]]; then
    git -C "$candidate_repo" worktree remove --force "$hook_worktree" \
      >/dev/null 2>&1 || true
  fi
  rm -rf -- "$hook_root"
}
trap cleanup EXIT

git -C "$candidate_repo" worktree add --quiet --detach \
  "$hook_worktree" "$GATE_BASE_SHA"

# Keep this worktree's HEAD at the gate base, but replace both its index and
# tracked working tree with the exact immutable candidate tree.
env -u GIT_INDEX_FILE git -C "$hook_worktree" read-tree --reset -u \
  "$CANDIDATE_SHA"
hook_head=$(env -u GIT_INDEX_FILE git -C "$hook_worktree" rev-parse HEAD)
hook_index=$(env -u GIT_INDEX_FILE git -C "$hook_worktree" write-tree)
[[ "$hook_head" = "$GATE_BASE_SHA" ]]
[[ "$hook_index" = "$candidate_tree" ]]
env -u GIT_INDEX_FILE git -C "$hook_worktree" diff --quiet
env -u GIT_INDEX_FILE git -C "$hook_worktree" diff --cached --quiet \
  "$GATE_BASE_SHA" -- && {
  echo '❌ Candidate tree has no staged content relative to the gate base.' >&2
  exit 1
}

# lint-staged runs in the disposable candidate-content worktree. Its package
# executables resolve through node_modules installed in the protected checkout.
[[ ! -e "$hook_worktree/node_modules" && ! -L "$hook_worktree/node_modules" ]]
ln -s "$node_modules" "$hook_worktree/node_modules"
hook_excludes=$(env -u GIT_INDEX_FILE git -C "$hook_worktree" \
  rev-parse --git-path info/exclude)
printf '\n/node_modules\n' >> "$hook_excludes"

printf '%s\n' \
  'Running candidate .husky/pre-commit with HEAD at gate base and candidate tree staged.'
(
  cd "$hook_worktree"
  unset GIT_INDEX_FILE BETA_STAGING_INDEX
  sh .husky/pre-commit
)

hook_head=$(env -u GIT_INDEX_FILE git -C "$hook_worktree" rev-parse HEAD)
hook_index=$(env -u GIT_INDEX_FILE git -C "$hook_worktree" write-tree)
hook_unstaged=$(env -u GIT_INDEX_FILE git -C "$hook_worktree" diff --name-only)
hook_untracked=$(env -u GIT_INDEX_FILE git -C "$hook_worktree" \
  ls-files --others --exclude-standard)
if [[ "$hook_head" != "$GATE_BASE_SHA" || "$hook_index" != "$candidate_tree" ||
      -n "$hook_unstaged" || -n "$hook_untracked" ]]; then
  echo '❌ Candidate pre-commit changed the disposable staged tree.' >&2
  printf 'HEAD=%s\nINDEX_TREE=%s\n' "$hook_head" "$hook_index" >&2
  printf 'Unstaged paths:\n%s\nUntracked paths:\n%s\n' \
    "${hook_unstaged:-none}" "${hook_untracked:-none}" >&2
  exit 1
fi
