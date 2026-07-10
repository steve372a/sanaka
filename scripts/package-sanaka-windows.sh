#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/i18n.sh"
sanaka_load_i18n

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  sanaka_printf_ln "common.usage_package_windows" "$0"
  echo
  echo "这个脚本现在只是兼容入口。"
  echo "推荐直接运行："
  echo "  npm run pack:win:dir"
  echo "或："
  echo "  SANAKA_QEMU_WIN_DIR=$HOME/sanaka/qemu/win npm run pack:win:dir"
  exit 0
fi

cd "$REPO_ROOT"
if [[ -n "${1:-}" ]]; then
  export SANAKA_QEMU_WIN_DIR="$1"
fi

npm run pack:win:dir
