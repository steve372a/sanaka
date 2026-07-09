#!/bin/bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/i18n.sh"
sanaka_load_i18n

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_QEMU_BUILD_DIR="$HOME/sanaka/qemu/macos"
QEMU_BUILD_DIR="${1:-${SANAKA_QEMU_BUILD_DIR:-$DEFAULT_QEMU_BUILD_DIR}}"
OUTPUT_ROOT="$REPO_ROOT/release"
DMG_BACKGROUND="$REPO_ROOT/build/dmg.png"
CREATE_DMG_BIN="${CREATE_DMG_BIN:-/opt/homebrew/opt/create-dmg/bin/create-dmg}"

resolve_macos_arch() {
  local app_path="$1"
  case "$app_path" in
    *mac-arm64/*) printf '%s\n' "arm64" ;;
    *mac-aarch64/*) printf '%s\n' "aarch64" ;;
    *mac-x64/*) printf '%s\n' "x64" ;;
    *) uname -m ;;
  esac
}

if [[ ! -d "$QEMU_BUILD_DIR" ]]; then
  sanaka_log "quick_build.qemu_dir_not_found" >&2
  echo "  $QEMU_BUILD_DIR" >&2
  echo >&2
  sanaka_log "quick_build.usage_header" >&2
  sanaka_log "quick_build.usage_line" >&2
  exit 1
fi

sanaka_log "quick_build.using_qemu_dir"
echo "  $QEMU_BUILD_DIR"
echo

cd "$REPO_ROOT"
bash "$REPO_ROOT/scripts/package-sanaka-macos.sh" "$QEMU_BUILD_DIR"

APP_PATH="$(find "$OUTPUT_ROOT" -type d -name 'Sanaka.app' | head -n 1)"

if [[ "$APP_PATH" == "" ]]; then
  sanaka_printf_ln "quick_build.app_not_found" "$OUTPUT_ROOT" >&2
  exit 1
fi

if [[ ! -f "$DMG_BACKGROUND" ]]; then
  sanaka_printf_ln "quick_build.dmg_background_not_found" "$DMG_BACKGROUND" >&2
  exit 1
fi

MACOS_ARCH="$(resolve_macos_arch "$APP_PATH")"
FINAL_DMG_NAME="$(node "$REPO_ROOT/build/artifact-names.js" file macos "$MACOS_ARCH" dmg)"
FINAL_DMG_PATH="$OUTPUT_ROOT/$FINAL_DMG_NAME"

if [[ ! -x "$CREATE_DMG_BIN" ]]; then
  sanaka_log "quick_build.create_dmg_not_found" >&2
  echo "  $CREATE_DMG_BIN" >&2
  echo >&2
  sanaka_log "quick_build.install_with" >&2
  sanaka_log "quick_build.install_with_line" >&2
  exit 1
fi

rm -f "$FINAL_DMG_PATH"
"$CREATE_DMG_BIN" \
  --volname "Sanaka" \
  --window-pos 100 100 \
  --window-size 540 380 \
  --icon-size 100 \
  --icon "Sanaka.app" 130 190 \
  --app-drop-link 410 190 \
  --background "$DMG_BACKGROUND" \
  "$FINAL_DMG_PATH" \
  "$(dirname "$APP_PATH")"

echo
sanaka_log "quick_build.packaged_app"
echo "$APP_PATH"
echo
sanaka_log "quick_build.packaged_dmg"
echo "$FINAL_DMG_PATH"
