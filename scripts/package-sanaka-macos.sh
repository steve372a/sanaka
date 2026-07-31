#!/bin/bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/i18n.sh"
sanaka_load_i18n

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_ROOT="$REPO_ROOT/release"
QEMU_BUILD_DIR_INPUT="${1:-}"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  sanaka_printf_ln "common.usage_package_macos" "$0"
  echo
  echo "也可以直接运行："
  echo "  SANAKA_QEMU_BUILD_DIR=$HOME/sanaka/qemu/macos npm run pack:mac"
  exit 0
fi

resolve_qemu_build_dir() {
  local candidate
  local candidates=()

  if [[ -n "${QEMU_BUILD_DIR_INPUT:-}" ]]; then
    candidates+=("$QEMU_BUILD_DIR_INPUT")
  fi

  if [[ -n "${SANAKA_QEMU_BUILD_DIR:-}" ]]; then
    candidates+=("$SANAKA_QEMU_BUILD_DIR")
  fi

  candidates+=(
    "$HOME/sanaka/qemu/macos"
    "/Volumes/sks/src/qemu-11.0.1/build-sanaka"
    "/Volumes/sks/src/qemu-stage/build-sanaka"
    "$HOME/src/qemu-11.0.1/build-sanaka"
    "$HOME/src/qemu/build-sanaka"
    "$HOME/qemu-11.0.1/build-sanaka"
    "$HOME/qemu/build-sanaka"
    "$REPO_ROOT/../qemu-11.0.1/build-sanaka"
    "$REPO_ROOT/../qemu/build-sanaka"
  )

  for candidate in "${candidates[@]}"; do
    [[ -n "$candidate" ]] || continue
    if [[ -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

if ! QEMU_BUILD_DIR="$(resolve_qemu_build_dir)"; then
  sanaka_printf_ln "common.usage_package_macos" "$0" >&2
  echo >&2
  sanaka_log "quick_build.qemu_dir_not_found" >&2
  echo "  ${QEMU_BUILD_DIR_INPUT:-<auto-detect failed>}" >&2
  echo >&2
  echo "可通过这两种方式指定：" >&2
  echo "  1. bash ./scripts/package-sanaka-macos.sh $HOME/sanaka/qemu/macos" >&2
  echo "  2. SANAKA_QEMU_BUILD_DIR=$HOME/sanaka/qemu/macos npm run pack:mac" >&2
  exit 1
fi

QEMU_BUILD_DIR="$(cd "$QEMU_BUILD_DIR" && pwd)"

resolve_macos_arch() {
  local app_path="$1"
  case "$app_path" in
    *mac-arm64/*) printf '%s\n' "arm64" ;;
    *mac-aarch64/*) printf '%s\n' "aarch64" ;;
    *mac-x64/*) printf '%s\n' "x64" ;;
    *) uname -m ;;
  esac
}

cd "$REPO_ROOT"

npm run build
npx electron-builder --dir --mac --config.mac.target=dir --publish never

APP_PATH="$(find "$OUTPUT_ROOT" -type d -name 'Sanaka.app' | head -n 1)"

if [[ "$APP_PATH" == "" ]]; then
  sanaka_printf_ln "package_macos.app_not_found" "$OUTPUT_ROOT" >&2
  exit 1
fi

SANAKA_QEMU_AARCH64_ENTITLEMENTS="$REPO_ROOT/build/qemu-aarch64.entitlements.plist" \
  bash "$REPO_ROOT/scripts/embed-qemu-macos.sh" "$QEMU_BUILD_DIR" "$APP_PATH" --adhoc-sign

LSREGISTER_BIN="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

if [[ -x "$LSREGISTER_BIN" ]]; then
  "$LSREGISTER_BIN" -f "$APP_PATH" >/dev/null 2>&1 || true
fi

touch "$APP_PATH" || true

MACOS_ARCH="$(resolve_macos_arch "$APP_PATH")"
DMG_NAME="$(node "$REPO_ROOT/build/artifact-names.js" file macos "$MACOS_ARCH" dmg)"

echo
sanaka_log "package_macos.packaged_app"
echo "$APP_PATH"
echo
sanaka_log "package_macos.packaged_dmg_name"
echo "$DMG_NAME"
