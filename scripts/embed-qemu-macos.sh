#!/bin/bash
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib/i18n.sh"
sanaka_load_i18n

if [[ $# -lt 2 ]]; then
  sanaka_printf_ln "common.usage_embed_macos" "$0" >&2
  exit 1
fi

BUILD_DIR="$(cd "$1" && pwd)"
APP_PATH="$2"
DO_ADHOC_SIGN="false"

if [[ "${3:-}" == "--adhoc-sign" || "${3:-}" == "--sign" ]]; then
  DO_ADHOC_SIGN="true"
fi

if [[ ! -d "$APP_PATH" ]]; then
  sanaka_printf_ln "embed_macos.app_not_found" "$APP_PATH" >&2
  exit 1
fi

QEMU_BIN_DIR="$APP_PATH/Contents/Resources/qemu/bin"
QEMU_SHARE_DIR="$APP_PATH/Contents/Resources/qemu/share/qemu"
FRAMEWORKS_DIR="$APP_PATH/Contents/Frameworks"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEFAULT_AARCH64_ENTITLEMENTS="$SCRIPT_DIR/../build/qemu-aarch64.entitlements.plist"
AARCH64_ENTITLEMENTS="${SANAKA_QEMU_AARCH64_ENTITLEMENTS:-$DEFAULT_AARCH64_ENTITLEMENTS}"
SOURCE_QEMU_BIN_DIR="$BUILD_DIR"
SOURCE_QEMU_SHARE_DIR=""
SOURCE_DEP_DIRS=()

if [[ -d "$BUILD_DIR/bin" ]]; then
  SOURCE_QEMU_BIN_DIR="$BUILD_DIR/bin"
fi

if [[ -d "$BUILD_DIR/share/qemu" ]]; then
  SOURCE_QEMU_SHARE_DIR="$BUILD_DIR/share/qemu"
fi

for candidate in \
  "$BUILD_DIR/Frameworks" \
  "$BUILD_DIR/frameworks" \
  "$BUILD_DIR/lib" \
  "$BUILD_DIR/libs" \
  "$BUILD_DIR/../Frameworks" \
  "$BUILD_DIR/../lib"; do
  if [[ -d "$candidate" ]]; then
    SOURCE_DEP_DIRS+=("$(cd "$candidate" && pwd)")
  fi
done

rm -rf "$QEMU_BIN_DIR" "$QEMU_SHARE_DIR"
mkdir -p "$QEMU_BIN_DIR" "$QEMU_SHARE_DIR" "$FRAMEWORKS_DIR"

find_qemu_share_source() {
  local candidates=(
    "/opt/homebrew/share/qemu"
    "/usr/local/share/qemu"
    "/Volumes/sks/src/qemu-stage/opt/homebrew/share/qemu"
  )

  for candidate in "${candidates[@]}"; do
    if [[ -d "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done

  return 1
}

SYSTEM_TARGETS=(
  x86_64
  i386
  aarch64
  arm
  riscv64
  ppc
  ppc64
)

copy_binary() {
  local source_path="$1"
  local target_name="$2"
  cp -f "$source_path" "$QEMU_BIN_DIR/$target_name"
  chmod u+w "$QEMU_BIN_DIR/$target_name"
}

resolve_system_binary_source() {
  local arch="$1"

  if [[ -f "$SOURCE_QEMU_BIN_DIR/qemu-system-$arch-unsigned" ]]; then
    printf '%s\n' "$SOURCE_QEMU_BIN_DIR/qemu-system-$arch-unsigned"
    return 0
  fi

  if [[ -f "$SOURCE_QEMU_BIN_DIR/qemu-system-$arch" ]]; then
    printf '%s\n' "$SOURCE_QEMU_BIN_DIR/qemu-system-$arch"
    return 0
  fi

  return 1
}

for arch in "${SYSTEM_TARGETS[@]}"; do
  if source_binary="$(resolve_system_binary_source "$arch")"; then
    copy_binary "$source_binary" "qemu-system-$arch"
  else
    sanaka_printf_ln "embed_macos.missing_system_binary" "$arch" "$BUILD_DIR" >&2
    exit 1
  fi
done

for tool in qemu-img; do
  if [[ -f "$SOURCE_QEMU_BIN_DIR/$tool" ]]; then
    copy_binary "$SOURCE_QEMU_BIN_DIR/$tool" "$tool"
  fi
done

copy_runtime_firmware_if_present() {
  local source_dir="$1"
  shift

  for firmware in "$@"; do
    if [[ -f "$source_dir/$firmware" ]]; then
      cp -f "$source_dir/$firmware" "$QEMU_SHARE_DIR/$firmware"
    fi
  done
}

if [[ -d "$BUILD_DIR/pc-bios" ]]; then
  copy_runtime_firmware_if_present "$BUILD_DIR/pc-bios" \
    edk2-x86_64-code.fd \
    edk2-x86_64-secure-code.fd
fi

QEMU_SHARE_SOURCE="${SOURCE_QEMU_SHARE_DIR:-}"

if [[ -z "$QEMU_SHARE_SOURCE" ]]; then
  QEMU_SHARE_SOURCE="$(find_qemu_share_source || true)"
fi

if [[ -n "$QEMU_SHARE_SOURCE" ]]; then
  copy_runtime_firmware_if_present "$QEMU_SHARE_SOURCE" \
    bios-256k.bin \
    bios.bin \
    vgabios.bin \
    vgabios-stdvga.bin \
    vgabios-cirrus.bin \
    vgabios-vmware.bin \
    vgabios-qxl.bin \
    vgabios-virtio.bin \
    vgabios-ramfb.bin \
    vgabios-bochs-display.bin \
    kvmvapic.bin \
    linuxboot_dma.bin \
    multiboot_dma.bin \
    pvh.bin \
    efi-e1000.rom \
    efi-e1000e.rom \
    efi-eepro100.rom \
    efi-ne2k_pci.rom \
    efi-pcnet.rom \
    efi-rtl8139.rom \
    efi-virtio.rom \
    efi-vmxnet3.rom \
    pxe-e1000.rom \
    pxe-eepro100.rom \
    pxe-ne2k_pci.rom \
    pxe-pcnet.rom \
    pxe-rtl8139.rom \
    pxe-virtio.rom \
    qboot.rom

  if [[ -d "$QEMU_SHARE_SOURCE/keymaps" ]]; then
    mkdir -p "$QEMU_SHARE_DIR/keymaps"
    cp -R "$QEMU_SHARE_SOURCE/keymaps/." "$QEMU_SHARE_DIR/keymaps/"
  fi
fi

is_system_dep() {
  local dep="$1"
  [[ "$dep" == /usr/lib/* ]] || [[ "$dep" == /System/Library/* ]]
}

is_app_relative_dep() {
  local dep="$1"
  [[ "$dep" == @executable_path/* ]] || [[ "$dep" == @loader_path/* ]] || [[ "$dep" == @rpath/* ]]
}

queue_dependencies() {
  local file_path="$1"
  otool -L "$file_path" | tail -n +2 | awk '{print $1}'
}

resolve_dependency_path() {
  local dep="$1"
  local owner_path="$2"

  if [[ "$dep" == /* ]]; then
    python3 - <<'PY' "$dep"
import os, sys
print(os.path.realpath(sys.argv[1]))
PY
    return 0
  fi

  if [[ "$dep" == @loader_path/* ]]; then
    local suffix="${dep#@loader_path/}"
    local candidate_path
    candidate_path="$(cd "$(dirname "$owner_path")" && pwd)/$suffix"
    if [[ -f "$candidate_path" ]]; then
      python3 - <<'PY' "$candidate_path"
import os, sys
print(os.path.realpath(sys.argv[1]))
PY
      return 0
    fi
  fi

  if is_app_relative_dep "$dep"; then
    local base_name
    base_name="$(basename "$dep")"
    local candidate_dir

    if [[ -f "$FRAMEWORKS_DIR/$base_name" ]]; then
      printf '%s\n' "$FRAMEWORKS_DIR/$base_name"
      return 0
    fi

    for candidate_dir in "${SOURCE_DEP_DIRS[@]}"; do
      if [[ -f "$candidate_dir/$base_name" ]]; then
        printf '%s\n' "$candidate_dir/$base_name"
        return 0
      fi
    done
  fi

  return 1
}

copy_dependency_recursive() {
  local dep="$1"
  local owner_path="$2"
  local real_dep
  if ! real_dep="$(resolve_dependency_path "$dep" "$owner_path")"; then
    sanaka_printf_ln "embed_macos.dependency_not_found" "$dep" >&2
    return 1
  fi

  local base_name
  base_name="$(basename "$real_dep")"
  local target_dep="$FRAMEWORKS_DIR/$base_name"

  if is_system_dep "$real_dep"; then
    return 0
  fi

  if [[ ! -f "$real_dep" ]]; then
    sanaka_printf_ln "embed_macos.dependency_not_found" "$real_dep" >&2
    return 1
  fi

  if [[ ! -f "$target_dep" ]]; then
    cp -fL "$real_dep" "$target_dep"
    chmod u+w "$target_dep"
    while IFS= read -r nested; do
      [[ -n "$nested" ]] || continue
      copy_dependency_recursive "$nested" "$real_dep"
    done < <(queue_dependencies "$real_dep")
  fi
}

while IFS= read -r binary; do
  while IFS= read -r dep; do
    [[ -n "$dep" ]] || continue
    if ! is_system_dep "$dep"; then
      copy_dependency_recursive "$dep" "$binary"
    fi
  done < <(queue_dependencies "$binary")
done < <(find "$QEMU_BIN_DIR" -type f -perm -111 2>/dev/null)

rewrite_binary_deps() {
  local binary="$1"
  while IFS= read -r dep; do
    [[ -n "$dep" ]] || continue
    if ! is_system_dep "$dep"; then
      install_name_tool -change "$dep" "@executable_path/../../../Frameworks/$(basename "$(python3 - <<'PY' "$dep"
import os, sys
print(os.path.realpath(sys.argv[1]))
PY
)")" "$binary"
    fi
  done < <(queue_dependencies "$binary")
}

rewrite_dylib_deps() {
  local dylib="$1"
  install_name_tool -id "@loader_path/$(basename "$dylib")" "$dylib"
  while IFS= read -r dep; do
    [[ -n "$dep" ]] || continue
    if ! is_system_dep "$dep"; then
      install_name_tool -change "$dep" "@loader_path/$(basename "$(python3 - <<'PY' "$dep"
import os, sys
print(os.path.realpath(sys.argv[1]))
PY
)")" "$dylib"
    fi
  done < <(queue_dependencies "$dylib")
}

while IFS= read -r dylib; do
  rewrite_dylib_deps "$dylib"
done < <(find "$FRAMEWORKS_DIR" -maxdepth 1 -type f -name '*.dylib' | sort)

while IFS= read -r binary; do
  rewrite_binary_deps "$binary"
done < <(find "$QEMU_BIN_DIR" -type f -perm -111 2>/dev/null)

if [[ "$DO_ADHOC_SIGN" == "true" ]]; then
  while IFS= read -r dylib; do
    codesign --force --sign - "$dylib"
  done < <(find "$FRAMEWORKS_DIR" -maxdepth 1 -type f -name '*.dylib' | sort)

  while IFS= read -r binary; do
    if [[ "$(basename "$binary")" == "qemu-system-aarch64" && -f "$AARCH64_ENTITLEMENTS" ]]; then
      codesign --force --sign - --entitlements "$AARCH64_ENTITLEMENTS" "$binary"
    else
      codesign --force --sign - "$binary"
    fi
  done < <(find "$QEMU_BIN_DIR" -type f -perm -111 2>/dev/null)

  codesign --force --deep --sign - "$APP_PATH"
fi

echo
sanaka_log "embed_macos.embedded_into" "$APP_PATH"
sanaka_log "embed_macos.qemu_binaries" "$QEMU_BIN_DIR"
sanaka_log "embed_macos.frameworks" "$FRAMEWORKS_DIR"
sanaka_log "embed_macos.shared_resources" "$QEMU_SHARE_DIR"
