#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/i18n.sh"
sanaka_load_i18n

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/pull.sh main
  bash scripts/pull.sh dev
  bash scripts/pull.sh <branch>

Behavior:
  - Save the current HEAD to refs/sanaka-backups/pull/...
  - Stash tracked and untracked work before replacing the branch
  - Fetch origin
  - Switch to the target branch
  - If the local branch is missing, create it from origin/<branch>
  - Hard reset the local branch to origin/<branch>
  - Keep the backup stash instead of applying it automatically
EOF
}

TARGET_BRANCH="${1:-main}"
TEMP_HELPER=""

if [[ "${TARGET_BRANCH}" == "--help" || "${TARGET_BRANCH}" == "-h" ]]; then
  usage
  exit 0
fi

sanaka_log "common.current_directory" "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  sanaka_log "pull.missing_git"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  sanaka_log "pull.not_git_repo"
  exit 1
fi

cleanup() {
  if [[ -n "${TEMP_HELPER:-}" && -f "${TEMP_HELPER:-}" ]]; then
    rm -f "$TEMP_HELPER" 2>/dev/null || true
  fi
}

trap cleanup EXIT

TEMP_HELPER="$(mktemp "${TMPDIR:-/tmp}/sanaka-pull.XXXXXX.sh")"
cat >"$TEMP_HELPER" <<'EOF'
#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$1"
TARGET_BRANCH="$2"
cd "$ROOT_DIR"

retry_sync_after_fix() {
  local error_output="$1"
  local conflict_path
  conflict_path="$(printf '%s\n' "$error_output" | sed -n "s/^error: unable to create file \(.*\): File exists$/\1/p" | head -n 1)"
  if [[ -n "$conflict_path" ]]; then
    rm -rf -- "$ROOT_DIR/$conflict_path" 2>/dev/null || true
  fi
}

run_sync_once() {
  local timestamp backup_ref stash_before stash_after
  timestamp="$(date '+%Y%m%d-%H%M%S')"
  backup_ref="refs/sanaka-backups/pull/${TARGET_BRANCH}/${timestamp}"
  git update-ref "$backup_ref" HEAD
  echo "已备份当前提交: $backup_ref"

  if [[ -n "$(git status --porcelain --untracked-files=all)" ]]; then
    stash_before="$(git rev-parse -q --verify refs/stash 2>/dev/null || true)"
    git stash push --include-untracked -m "sanaka pull backup ${TARGET_BRANCH} ${timestamp}"
    stash_after="$(git rev-parse -q --verify refs/stash 2>/dev/null || true)"
    if [[ -z "$stash_after" || "$stash_after" == "$stash_before" ]]; then
      echo "错误：工作区备份失败，已停止拉取。" >&2
      return 1
    fi
    echo "已备份工作区: $stash_after"
    echo "恢复工作区命令: git stash apply $stash_after"
  else
    echo "工作区没有未提交改动。"
  fi

  git fetch origin

  if ! git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
    echo "Remote branch origin/${TARGET_BRANCH} does not exist."
    return 1
  fi

  if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
    git checkout "${TARGET_BRANCH}"
  else
    git checkout -b "${TARGET_BRANCH}" "origin/${TARGET_BRANCH}"
  fi

  git reset --hard "origin/${TARGET_BRANCH}"
}

run_sync_with_retry() {
  local error_output=""
  if run_sync_once 2> >(tee "$ROOT_DIR/.sanaka-pull.stderr" >&2); then
    rm -f "$ROOT_DIR/.sanaka-pull.stderr" 2>/dev/null || true
    return 0
  fi

  error_output="$(cat "$ROOT_DIR/.sanaka-pull.stderr" 2>/dev/null || true)"
  rm -f "$ROOT_DIR/.sanaka-pull.stderr" 2>/dev/null || true
  retry_sync_after_fix "$error_output"
  run_sync_once
}

run_sync_with_retry
EOF
chmod +x "$TEMP_HELPER"

sanaka_log "pull.fetching"
bash "$TEMP_HELPER" "$ROOT_DIR" "$TARGET_BRANCH"

sanaka_log "pull.completed"
