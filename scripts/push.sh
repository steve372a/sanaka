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
  - If workflow file push is rejected due to cached token scope, retry with explicit token

Token sources for retry:
  1. SANAKA_GITHUB_TOKEN
  2. GH_TOKEN
  3. GITHUB_TOKEN
  4. gh auth token
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

get_retry_token() {
  if [[ -n "${SANAKA_GITHUB_TOKEN:-}" ]]; then
    printf '%s\n' "${SANAKA_GITHUB_TOKEN}"
    return 0
  fi

  if [[ -n "${GH_TOKEN:-}" ]]; then
    printf '%s\n' "${GH_TOKEN}"
    return 0
  fi

  if [[ -n "${GITHUB_TOKEN:-}" ]]; then
    printf '%s\n' "${GITHUB_TOKEN}"
    return 0
  fi

  if command -v gh >/dev/null 2>&1; then
    gh auth token 2>/dev/null || true
    return 0
  fi

  return 1
}

build_explicit_push_url() {
  local remote_url="$1"
  local token="$2"

  case "$remote_url" in
    https://github.com/*)
      printf '%s\n' "${remote_url/https:\/\/github.com\//https://x-access-token:${token}@github.com/}"
      return 0
      ;;
  esac

  return 1
}

push_with_retry() {
  local branch="$1"
  local tmp_output
  tmp_output="$(mktemp)"

  if git push -u origin "$branch" 2>&1 | tee "$tmp_output"; then
    rm -f "$tmp_output"
    return 0
  fi

  if ! grep -q "without \`workflow\` scope" "$tmp_output"; then
    cat "$tmp_output" >&2
    rm -f "$tmp_output"
    return 1
  fi

  sanaka_log "push.workflow_scope_retry" 2>/dev/null || echo "检测到 workflow 权限推送被拒绝，尝试改用显式 token 重试..."

  local retry_token=""
  retry_token="$(get_retry_token)"
  if [[ -z "$retry_token" ]]; then
    echo "没有找到可用于重试的 GitHub token。" >&2
    echo "请先设置 SANAKA_GITHUB_TOKEN、GH_TOKEN 或 GITHUB_TOKEN，或先执行 gh auth login。" >&2
    rm -f "$tmp_output"
    return 1
  fi

  local origin_url=""
  origin_url="$(git remote get-url origin)"

  local push_url=""
  if ! push_url="$(build_explicit_push_url "$origin_url" "$retry_token")"; then
    echo "当前 origin 不是 https://github.com/...，无法自动改写为显式 token 推送地址。" >&2
    rm -f "$tmp_output"
    return 1
  fi

  rm -f "$tmp_output"
  git push -u "$push_url" "$branch"
}

sanaka_log "push.pushing" "$TARGET_BRANCH"
push_with_retry "${TARGET_BRANCH}"
sanaka_log "common.done"
