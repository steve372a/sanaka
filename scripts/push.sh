#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/i18n.sh"
sanaka_load_i18n

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/push.sh main
  bash scripts/push.sh dev
  bash scripts/push.sh <branch> ["Commit message"]

Behavior:
  - Ensure you are inside a Git repository
  - Switch to the target branch, or create it if missing
  - Commit current changes if needed
  - Push to origin/<branch>
EOF
}

TARGET_BRANCH="${1:-main}"
MESSAGE="${2:-Update}"

if [[ "${TARGET_BRANCH}" == "--help" || "${TARGET_BRANCH}" == "-h" ]]; then
  usage
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  sanaka_log "push.missing_git"
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  sanaka_log "push.not_git_repo"
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"

if [[ -z "${CURRENT_BRANCH}" ]]; then
  sanaka_log "push.not_on_branch"
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
  if [[ "${CURRENT_BRANCH}" != "${TARGET_BRANCH}" ]]; then
    git checkout "${TARGET_BRANCH}"
  fi
else
  git checkout -b "${TARGET_BRANCH}"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  if git diff --cached --quiet; then
    sanaka_log "push.no_local_changes"
  else
    git commit -m "$MESSAGE"
  fi
else
  sanaka_log "push.no_local_changes"
fi

sanaka_log "push.pushing" "$TARGET_BRANCH"
git push -u origin "${TARGET_BRANCH}"
sanaka_log "common.done"
