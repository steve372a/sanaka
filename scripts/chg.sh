#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/chg.sh main
  bash scripts/chg.sh dev
  bash scripts/chg.sh <branch>

Behavior:
  - If the local branch exists, switch to it
  - Else if origin/<branch> exists, create and track it
  - Else create a new local branch
EOF
}

TARGET_BRANCH="${1:-main}"

if [[ "${TARGET_BRANCH}" == "--help" || "${TARGET_BRANCH}" == "-h" ]]; then
  usage
  exit 0
fi

echo "Current directory: $ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "git is not installed or not available in PATH."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Current directory is not a git repository."
  exit 1
fi

git fetch origin --prune >/dev/null 2>&1 || true

if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
  git checkout "${TARGET_BRANCH}"
elif git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
  git checkout -b "${TARGET_BRANCH}" --track "origin/${TARGET_BRANCH}"
else
  git checkout -b "${TARGET_BRANCH}"
fi

echo "Switched to branch: ${TARGET_BRANCH}"
