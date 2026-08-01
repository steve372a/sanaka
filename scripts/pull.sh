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
  - Fetch origin and try a fast-forward-only update
  - Ask before replacing local work when the safe update fails
  - Save the current HEAD and stash tracked and untracked work before a forced update
  - Create the local branch from origin/<branch> when it does not exist
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

run_force_sync() {
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

  if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
    git checkout "${TARGET_BRANCH}"
  else
    git checkout -b "${TARGET_BRANCH}" "origin/${TARGET_BRANCH}"
  fi

  git reset --hard "origin/${TARGET_BRANCH}"
}

run_safe_sync() {
  if git show-ref --verify --quiet "refs/heads/${TARGET_BRANCH}"; then
    git checkout "${TARGET_BRANCH}" || return 1
    git merge --ff-only "origin/${TARGET_BRANCH}"
  else
    git checkout -b "${TARGET_BRANCH}" "origin/${TARGET_BRANCH}"
  fi
}

if ! git fetch origin; then
  echo "无法获取远程代码，未执行强制同步。" >&2
  exit 1
fi

if ! git show-ref --verify --quiet "refs/remotes/origin/${TARGET_BRANCH}"; then
  echo "远程分支不存在: origin/${TARGET_BRANCH}" >&2
  exit 1
fi

if run_safe_sync; then
  exit 0
fi

echo "安全拉取失败：本地分支或工作区与远程存在冲突。" >&2
if [[ ! -t 0 && ! -t 1 ]]; then
  echo "当前不是交互终端，已停止。" >&2
  exit 1
fi

printf '是否使用 Git 强制同步 origin/%s？本地改动会先备份到 stash [y/N]: ' "$TARGET_BRANCH" >&2
read -r answer </dev/tty || answer=""
case "$answer" in
  y|Y|yes|YES|Yes)
    run_force_sync
    ;;
  *)
    echo "已取消强制同步。" >&2
    exit 1
    ;;
esac
EOF
chmod +x "$TEMP_HELPER"

sanaka_log "pull.fetching"
bash "$TEMP_HELPER" "$ROOT_DIR" "$TARGET_BRANCH"

sanaka_log "pull.completed"
