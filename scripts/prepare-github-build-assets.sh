#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUTPUT_DIR="${1:-$REPO_ROOT/release-upload/build-assets-v1}"
MAC_APP="$REPO_ROOT/release/mac-arm64/Sanaka.app"
WIN_QEMU_DIR="$REPO_ROOT/qemu/win"
VIDEO_PATH="$REPO_ROOT/video/$(node -p "require('$REPO_ROOT/package.json').version").mp4"
QEMU_VERSION="${SANAKA_QEMU_VERSION:-11.0.1}"
STAGING_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sanaka-build-assets.XXXXXX")"

cleanup() {
  find "$STAGING_DIR" -depth -delete 2>/dev/null || true
}
trap cleanup EXIT

require_path() {
  local target_path="$1"
  if [[ ! -e "$target_path" ]]; then
    echo "缺少构建资源: $target_path" >&2
    exit 1
  fi
}

require_path "$MAC_APP/Contents/Resources/qemu/bin"
require_path "$MAC_APP/Contents/Resources/qemu/share/qemu"
require_path "$MAC_APP/Contents/Frameworks"
require_path "$WIN_QEMU_DIR/qemu-system-x86_64.exe"
require_path "$WIN_QEMU_DIR/share"
require_path "$VIDEO_PATH"

mkdir -p "$OUTPUT_DIR" \
  "$STAGING_DIR/macos/bin" \
  "$STAGING_DIR/macos/lib" \
  "$STAGING_DIR/macos/share/qemu"

cp -R "$MAC_APP/Contents/Resources/qemu/bin/." "$STAGING_DIR/macos/bin/"
cp -R "$MAC_APP/Contents/Resources/qemu/share/qemu/." "$STAGING_DIR/macos/share/qemu/"
find "$MAC_APP/Contents/Frameworks" -maxdepth 1 -type f -name '*.dylib' -exec cp -f {} "$STAGING_DIR/macos/lib/" \;

MAC_ASSET="sanaka-qemu-${QEMU_VERSION}-macos-aarch64.tar.gz"
WIN_ASSET="sanaka-qemu-${QEMU_VERSION}-windows-x64.zip"

tar -czf "$OUTPUT_DIR/$MAC_ASSET" -C "$STAGING_DIR" macos
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$WIN_QEMU_DIR" "$OUTPUT_DIR/$WIN_ASSET"
cp -f "$VIDEO_PATH" "$OUTPUT_DIR/$(basename "$VIDEO_PATH")"

(
  cd "$OUTPUT_DIR"
  shasum -a 256 "$MAC_ASSET" "$WIN_ASSET" > SHA256SUMS.txt
)

echo "构建资源已生成:"
find "$OUTPUT_DIR" -maxdepth 1 -type f -print | sort
echo
echo "上传到隐藏构建资源 Release:"
echo "  gh release upload build-assets-v1 '$OUTPUT_DIR/$MAC_ASSET' '$OUTPUT_DIR/$WIN_ASSET' '$OUTPUT_DIR/SHA256SUMS.txt' '$OUTPUT_DIR/$(basename "$VIDEO_PATH")' --repo steve372a/sanaka --clobber"
