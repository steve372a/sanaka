#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/i18n.sh"
sanaka_load_i18n

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_PROXY_HOST="${SANAKA_PROXY_HOST:-127.0.0.1}"
DEFAULT_PROXY_PORT="${SANAKA_PROXY_PORT:-7890}"
TARGET_ARCH="${1:-}"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "用法:"
  echo "  bash ./scripts/package-sanaka-linux.sh"
  echo "  bash ./scripts/package-sanaka-linux.sh x64"
  echo "  bash ./scripts/package-sanaka-linux.sh arm64"
  echo
  echo "可选环境变量:"
  echo "  SANAKA_PROXY_HOST=127.0.0.1"
  echo "  SANAKA_PROXY_PORT=7890"
  echo "  SANAKA_SKIP_LOCAL_PROXY=1"
  exit 0
fi

cd "$REPO_ROOT"
RELEASE_DIR="$REPO_ROOT/release"
mkdir -p "$RELEASE_DIR"
BUILD_MARKER="$(mktemp "$RELEASE_DIR/.sanaka-linux-build.XXXXXX")"
cleanup() {
  rm -f "$BUILD_MARKER"
}
trap cleanup EXIT

enable_local_proxy_if_available() {
  if [[ "${SANAKA_SKIP_LOCAL_PROXY:-0}" == "1" ]]; then
    return 0
  fi

  if [[ -n "${ALL_PROXY:-}" || -n "${HTTPS_PROXY:-}" || -n "${HTTP_PROXY:-}" || -n "${all_proxy:-}" || -n "${https_proxy:-}" || -n "${http_proxy:-}" ]]; then
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1; then
    return 0
  fi

  if curl --silent --output /dev/null --connect-timeout 2 --max-time 3 "http://${DEFAULT_PROXY_HOST}:${DEFAULT_PROXY_PORT}/version"; then
    export ALL_PROXY="socks5h://${DEFAULT_PROXY_HOST}:${DEFAULT_PROXY_PORT}"
    export all_proxy="$ALL_PROXY"
    export HTTP_PROXY="http://${DEFAULT_PROXY_HOST}:${DEFAULT_PROXY_PORT}"
    export HTTPS_PROXY="$HTTP_PROXY"
    export http_proxy="$HTTP_PROXY"
    export https_proxy="$HTTPS_PROXY"
    echo "检测到本地代理，已启用: ${HTTP_PROXY}"
  fi
}

resolve_target_args() {
  case "$TARGET_ARCH" in
    "" )
      return 0
      ;;
    x64|amd64)
      printf '%s\n' "--x64"
      return 0
      ;;
    arm64|aarch64)
      printf '%s\n' "--arm64"
      return 0
      ;;
    *)
      echo "不支持的架构参数: $TARGET_ARCH" >&2
      exit 1
      ;;
  esac
}

enable_local_proxy_if_available

ARCH_FLAG="$(resolve_target_args || true)"

if [[ -n "$ARCH_FLAG" ]]; then
  npx electron-builder --linux deb "$ARCH_FLAG" --publish never
else
  npm run pack:linux
fi

ACTUAL_DEB_PATH="$(
  find "$RELEASE_DIR" -maxdepth 1 -type f -name '*.deb' -newer "$BUILD_MARKER" -print \
    | sort \
    | tail -n 1
)"

ARTIFACT_ARCH="${TARGET_ARCH:-$(uname -m)}"
case "$ARTIFACT_ARCH" in
  x86_64) ARTIFACT_ARCH="x64" ;;
  amd64) ARTIFACT_ARCH="x64" ;;
  aarch64) ARTIFACT_ARCH="arm64" ;;
esac

DEB_NAME="$(node "$REPO_ROOT/build/artifact-names.js" file linux "$ARTIFACT_ARCH" deb)"

echo
sanaka_log "package_linux.deb_name"
if [[ -n "$ACTUAL_DEB_PATH" ]]; then
  echo "$ACTUAL_DEB_PATH"
else
  echo "$DEB_NAME"
fi
