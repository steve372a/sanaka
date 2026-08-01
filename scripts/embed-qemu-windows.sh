#!/usr/bin/env bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/i18n.sh"
sanaka_load_i18n

if [[ $# -lt 2 ]]; then
  sanaka_printf_ln "common.usage_embed_windows" "$0" >&2
  exit 1
fi

QEMU_INPUT_DIR="$1"
APP_DIR="$2"

if [[ ! -d "$QEMU_INPUT_DIR" ]]; then
  sanaka_printf_ln "embed_windows.qemu_dir_not_found" "$QEMU_INPUT_DIR" >&2
  exit 1
fi

QEMU_ROOT_DIR="$QEMU_INPUT_DIR"
QEMU_BIN_SOURCE_DIR="$QEMU_INPUT_DIR"

if [[ "$(basename "$QEMU_INPUT_DIR")" == [Bb][Ii][Nn] && -f "$QEMU_INPUT_DIR/qemu-system-x86_64.exe" ]]; then
  QEMU_ROOT_DIR="$(cd "$QEMU_INPUT_DIR/.." && pwd)"
elif [[ -f "$QEMU_INPUT_DIR/qemu-system-x86_64.exe" ]]; then
  QEMU_ROOT_DIR="$QEMU_INPUT_DIR"
elif [[ -f "$QEMU_INPUT_DIR/bin/qemu-system-x86_64.exe" ]]; then
  QEMU_BIN_SOURCE_DIR="$QEMU_INPUT_DIR/bin"
else
  sanaka_printf_ln "embed_windows.missing_required_binary" "$QEMU_INPUT_DIR/qemu-system-x86_64.exe or $QEMU_INPUT_DIR/bin/qemu-system-x86_64.exe" >&2
  exit 1
fi

if [[ ! -d "$APP_DIR" ]]; then
  sanaka_printf_ln "embed_windows.app_dir_not_found" "$APP_DIR" >&2
  exit 1
fi

RESOURCES_DIR="$APP_DIR/resources"
TARGET_QEMU_ROOT_DIR="$RESOURCES_DIR/qemu"
TARGET_QEMU_DIR="$TARGET_QEMU_ROOT_DIR/bin"

rm -rf "$TARGET_QEMU_ROOT_DIR"
mkdir -p "$TARGET_QEMU_DIR"

copy_if_exists() {
  local source_path="$1"
  local target_path="$2"
  if [[ -e "$source_path" ]]; then
    mkdir -p "$(dirname "$target_path")"
    cp -R "$source_path" "$target_path"
  fi
}

SYSTEM_TARGETS=(
  qemu-system-x86_64.exe
  qemu-system-i386.exe
  qemu-system-aarch64.exe
  qemu-system-arm.exe
  qemu-system-riscv64.exe
  qemu-system-ppc.exe
  qemu-system-ppc64.exe
)

TOOLS=(
  qemu-img.exe
)

OPTIONAL_SKIP=(
  qemu-ga.exe
  qemu-io.exe
  qemu-nbd.exe
  qemu-storage-daemon.exe
  qemu-edid.exe
  qemu-uninstall.exe
)

for binary in "${SYSTEM_TARGETS[@]}"; do
  if [[ ! -f "$QEMU_BIN_SOURCE_DIR/$binary" ]]; then
    sanaka_printf_ln "embed_windows.missing_required_binary" "$QEMU_BIN_SOURCE_DIR/$binary" >&2
    exit 1
  fi
  cp -f "$QEMU_BIN_SOURCE_DIR/$binary" "$TARGET_QEMU_DIR/$binary"
done

for tool in "${TOOLS[@]}"; do
  if [[ -f "$QEMU_BIN_SOURCE_DIR/$tool" ]]; then
    cp -f "$QEMU_BIN_SOURCE_DIR/$tool" "$TARGET_QEMU_DIR/$tool"
  fi
done

while IFS= read -r dll_path; do
  cp -f "$dll_path" "$TARGET_QEMU_DIR/$(basename "$dll_path")"
done < <(find "$QEMU_BIN_SOURCE_DIR" -maxdepth 1 -type f \( -iname '*.dll' -o -iname 'zlib1.dll' \) | sort)

copy_if_exists "$QEMU_ROOT_DIR/share" "$TARGET_QEMU_ROOT_DIR/share"
copy_if_exists "$QEMU_ROOT_DIR/lib" "$TARGET_QEMU_ROOT_DIR/lib"

rm -rf "$TARGET_QEMU_ROOT_DIR/share/doc" \
  "$TARGET_QEMU_ROOT_DIR/share/man" \
  "$TARGET_QEMU_ROOT_DIR/share/icons" \
  "$TARGET_QEMU_ROOT_DIR/share/applications"

echo
sanaka_log "embed_windows.embedded_into" "$APP_DIR"
sanaka_log "embed_windows.qemu_source" "$QEMU_ROOT_DIR (bin: $QEMU_BIN_SOURCE_DIR)"
sanaka_log "embed_windows.qemu_target" "$TARGET_QEMU_ROOT_DIR"
