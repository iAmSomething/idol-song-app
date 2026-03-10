#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
AVD_NAME="${IDOL_SONG_APP_ANDROID_QA_AVD:-idol-song-app-preview-qa-api35}"
SYSTEM_IMAGE="${IDOL_SONG_APP_ANDROID_QA_SYSTEM_IMAGE:-system-images;android-35;google_apis;arm64-v8a}"
DEVICE_ID="${IDOL_SONG_APP_ANDROID_QA_DEVICE:-pixel_8}"
LAUNCH=0

usage() {
  cat <<'EOF'
Usage: prepare-android-preview-qa-emulator.sh [--launch]

Prepares the Android preview QA AVD with the cold-boot / no-snapshot settings
used during the 2026-03-11 runtime stabilization pass.

Options:
  --launch   Start the prepared emulator in the current shell.
  --help     Show this help message.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --launch)
      LAUNCH=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

AVDMANAGER="$SDK_ROOT/cmdline-tools/latest/bin/avdmanager"
EMULATOR_BIN="$SDK_ROOT/emulator/emulator"
AVD_DIR="$HOME/.android/avd/${AVD_NAME}.avd"
CONFIG_FILE="$AVD_DIR/config.ini"
LAUNCH_CMD=(
  "$EMULATOR_BIN"
  -avd "$AVD_NAME"
  -wipe-data
  -no-snapshot
  -no-window
  -netdelay none
  -netspeed full
  -no-boot-anim
  -no-audio
  -gpu swiftshader_indirect
)

require_bin() {
  if [ ! -x "$1" ]; then
    echo "Missing required binary: $1" >&2
    exit 1
  fi
}

upsert_config() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp
  tmp="$(mktemp)"
  awk -F= -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $1 == key { print key "=" value; updated = 1; next }
    { print }
    END { if (!updated) print key "=" value }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

require_bin "$AVDMANAGER"
require_bin "$EMULATOR_BIN"

if [ ! -f "$CONFIG_FILE" ]; then
  printf 'no\n' | "$AVDMANAGER" create avd -n "$AVD_NAME" -k "$SYSTEM_IMAGE" -d "$DEVICE_ID" --force
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "AVD config not found after create: $CONFIG_FILE" >&2
  exit 1
fi

upsert_config "avd.id" "$AVD_NAME" "$CONFIG_FILE"
upsert_config "avd.name" "$AVD_NAME" "$CONFIG_FILE"
upsert_config "fastboot.forceColdBoot" "yes" "$CONFIG_FILE"
upsert_config "fastboot.forceFastBoot" "no" "$CONFIG_FILE"
upsert_config "firstboot.bootFromDownloadableSnapshot" "no" "$CONFIG_FILE"
upsert_config "firstboot.bootFromLocalSnapshot" "no" "$CONFIG_FILE"
upsert_config "firstboot.saveToLocalSnapshot" "no" "$CONFIG_FILE"
upsert_config "hw.gpu.enabled" "yes" "$CONFIG_FILE"
upsert_config "hw.gpu.mode" "swiftshader_indirect" "$CONFIG_FILE"
upsert_config "hw.ramSize" "1536" "$CONFIG_FILE"
upsert_config "showDeviceFrame" "no" "$CONFIG_FILE"
upsert_config "userdata.useQcow2" "yes" "$CONFIG_FILE"
upsert_config "vm.heapSize" "384" "$CONFIG_FILE"

find "$AVD_DIR" -maxdepth 1 \( -name '*.lock' -o -name 'hardware-qemu.ini.lock' \) -exec rm -rf {} +

echo "Prepared AVD: $AVD_NAME"
echo "Config: $CONFIG_FILE"
printf 'Launch command:'
for arg in "${LAUNCH_CMD[@]}"; do
  printf ' %q' "$arg"
done
printf '\n'

if [ "$LAUNCH" -eq 1 ]; then
  exec "${LAUNCH_CMD[@]}"
fi
