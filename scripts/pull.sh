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
  - Fetch origin
  - Switch to the target branch
  - If the local branch is missing, create it from origin/<branch>
  - Hard reset the local branch to origin/<branch>
EOF
}

TARGET_BRANCH="${1:-main}"

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

sanaka_log "pull.fetching"
git fetch origin --prune

if ! git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
  sanaka_log "pull.remote_missing" "origin/${TARGET_BRANCH}"
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
  git checkout "${TARGET_BRANCH}"
else
  git checkout -b "${TARGET_BRANCH}" "origin/${TARGET_BRANCH}"
fi

git reset --hard "origin/${TARGET_BRANCH}"
sanaka_log "pull.completed"
