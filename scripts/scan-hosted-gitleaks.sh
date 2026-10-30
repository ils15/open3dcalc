#!/usr/bin/env bash
set -euo pipefail

: "${GATE_BASE_SHA:?GATE_BASE_SHA is required}"
: "${CANDIDATE_SHA:?CANDIDATE_SHA is required}"
[[ "$GATE_BASE_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]]

for name in GITLEAKS_CONFIG GITLEAKS_CONFIG_TOML; do
  if [[ "${!name+x}" = x ]]; then
    echo "❌ $name environment overrides are not allowed for the hosted scan." >&2
    exit 1
  fi
done

candidate_repo=$(env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE git rev-parse --show-toplevel)
candidate_head=$(env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE git -C "$candidate_repo" rev-parse HEAD)
candidate_tree=$(env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
  git -C "$candidate_repo" rev-parse "$CANDIDATE_SHA^{tree}")
candidate_index=$(env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
  git -C "$candidate_repo" write-tree)
if [[ "$candidate_head" != "$CANDIDATE_SHA" || "$candidate_index" != "$candidate_tree" ]]; then
  echo '❌ Hosted Gitleaks scan requires the exact candidate HEAD and index.' >&2
  exit 1
fi

umask 077
if ! scan_root=$(mktemp -d "${TMPDIR:-/tmp}/open3dcalc-hosted-gitleaks.XXXXXX"); then
  echo '❌ Unable to create a private hosted Gitleaks snapshot directory.' >&2
  exit 1
fi
scan_worktree="$scan_root/worktree"
trusted_config_source="$scan_root/base-gitleaks-source.toml"
trusted_config="$scan_root/base-gitleaks.toml"
trusted_ignore="$scan_root/empty-gitleaksignore"
worktree_attempted=no
worktree_added=no

cleanup_scan() {
  local cleanup_status=$?
  local cleanup_failed=no
  local registered_worktrees
  trap - EXIT HUP INT TERM

  if [[ "$worktree_added" = yes ]]; then
    if ! env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
      git -C "$candidate_repo" worktree remove --force "$scan_worktree"; then
      echo "❌ Unable to remove generated hosted Gitleaks worktree: $scan_worktree" >&2
      cleanup_failed=yes
    fi
  elif [[ "$worktree_attempted" = yes ]]; then
    if ! registered_worktrees=$(env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
      git -C "$candidate_repo" worktree list --porcelain); then
      echo '❌ Unable to verify cleanup of the attempted hosted Gitleaks worktree.' >&2
      cleanup_failed=yes
    elif grep -Fqx "worktree $scan_worktree" <<< "$registered_worktrees"; then
      if ! env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
        git -C "$candidate_repo" worktree remove --force "$scan_worktree"; then
        echo "❌ Unable to remove partially-created hosted Gitleaks worktree: $scan_worktree" >&2
        cleanup_failed=yes
      fi
    fi
  fi

  if [[ -e "$scan_worktree" || -L "$scan_worktree" ]]; then
    echo "❌ Generated hosted Gitleaks worktree remains at $scan_worktree." >&2
    cleanup_failed=yes
  fi
  if [[ "$cleanup_failed" = no ]]; then
    if ! rm -rf -- "$scan_root" || [[ -e "$scan_root" || -L "$scan_root" ]]; then
      echo "❌ Unable to remove hosted Gitleaks temporary files at $scan_root." >&2
      cleanup_failed=yes
    fi
  else
    echo "❌ Hosted Gitleaks temporary files preserved for diagnosis at $scan_root." >&2
  fi

  [[ "$cleanup_failed" = no ]] || cleanup_status=1
  exit "$cleanup_status"
}
trap cleanup_scan EXIT
trap 'exit 1' HUP INT TERM

if ! env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
  git -C "$candidate_repo" show "$GATE_BASE_SHA:.gitleaks.toml" > "$trusted_config_source" ||
  [[ ! -s "$trusted_config_source" ]]; then
  echo '❌ Trusted gate-base Gitleaks config is unavailable or empty.' >&2
  exit 1
fi
# Keep the staged test-path scan active while legacy base configs are still in use.
if ! sed '/scripts\/__tests__\//d' "$trusted_config_source" > "$trusted_config" ||
  [[ ! -s "$trusted_config" ]]; then
  echo '❌ Unable to prepare the trusted Gitleaks config without test exclusions.' >&2
  exit 1
fi
if ! : > "$trusted_ignore" || ! chmod 600 "$trusted_ignore"; then
  echo '❌ Unable to prepare an explicit empty Gitleaks ignore file.' >&2
  exit 1
fi

worktree_attempted=yes
if ! env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
  git -C "$candidate_repo" worktree add --quiet --detach "$scan_worktree" "$GATE_BASE_SHA"; then
  echo '❌ Unable to create the hosted Gitleaks snapshot worktree.' >&2
  exit 1
fi
worktree_added=yes
if ! env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
  git -C "$scan_worktree" read-tree --reset -u "$candidate_tree"; then
  echo '❌ Unable to load the exact candidate tree into the hosted Gitleaks snapshot.' >&2
  exit 1
fi

snapshot_head=$(env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
  git -C "$scan_worktree" rev-parse HEAD)
snapshot_index=$(env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
  git -C "$scan_worktree" write-tree)
if [[ "$snapshot_head" != "$GATE_BASE_SHA" || "$snapshot_index" != "$candidate_tree" ]] ||
  ! env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
    git -C "$scan_worktree" diff --quiet; then
  echo '❌ Hosted Gitleaks snapshot does not match the trusted base and candidate tree.' >&2
  exit 1
fi

# Gitleaks 8.30.1 auto-loads .gitleaksignore from its source. Only the disposable
# candidate snapshot is changed; tracked and untracked ignores in the checkout stay untouched.
if ! rm -rf -- "$scan_worktree/.gitleaksignore" ||
  [[ -e "$scan_worktree/.gitleaksignore" || -L "$scan_worktree/.gitleaksignore" ]]; then
  echo '❌ Unable to exclude candidate .gitleaksignore from the hosted snapshot.' >&2
  exit 1
fi

scan_status=0
if (
  cd "$scan_worktree"
  env -u GIT_INDEX_FILE -u GIT_DIR -u GIT_WORK_TREE \
    gitleaks git \
      --config "$trusted_config" \
      --gitleaks-ignore-path "$trusted_ignore" \
      --ignore-gitleaks-allow \
      --redact=100 \
      --no-banner \
      --report-format json \
      --report-path - \
      --log-opts="$GATE_BASE_SHA..$CANDIDATE_SHA" .
); then
  :
else
  scan_status=$?
fi
exit "$scan_status"
