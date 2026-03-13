#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE_NAME=""
TEAM_ID="${EXPO_IOS_APPLE_TEAM_ID:-}"
BUNDLE_ID="${EXPO_IOS_BUNDLE_IDENTIFIER:-com.anonymous.idolsongappmobile}"
APP_DISPLAY_NAME="${EXPO_IOS_APP_DISPLAY_NAME:-Idol Song App}"
PRODUCT_NAME="${EXPO_IOS_PRODUCT_NAME:-IdolSongApp}"
API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-https://idol-song-app-production.up.railway.app}"
DERIVED_DATA_PATH="${ROOT_DIR}/ios/build/IdolSongAppProductionDerivedData"
SKIP_PREBUILD=0
CLEAN_PREBUILD=0
NO_INSTALL=0
NO_LAUNCH=0
ALLOW_PROVISIONING_UPDATES=0
DRY_RUN=0
SIGNING_OVERRIDE_PATH="$ROOT_DIR/ios/IdolSongAppPreview/Supporting/IdolSongAppPreview.production.signing.local.xcconfig"
PREVIEW_BUNDLE_ID="${EXPO_IOS_PREVIEW_BUNDLE_IDENTIFIER:-}"
DEV_BUNDLE_ID="${EXPO_IOS_DEV_BUNDLE_IDENTIFIER:-}"

usage() {
  cat <<EOF
Usage:
  $(basename "$0") --device "김태훈의 iPhone" --team-id ABCDE12345 [--bundle-id com.example.idolsongapp] [--app-display-name "Idol Song App"] [--product-name IdolSongApp] [--api-base-url https://idol-song-app-production.up.railway.app]

Builds a signed Release .app and installs it on a physical iPhone so the app opens directly instead of the Expo dev launcher.
EOF
}

read_local_override() {
  if [[ -f "$SIGNING_OVERRIDE_PATH" ]]; then
    if [[ -z "$TEAM_ID" ]]; then
      TEAM_ID="$(sed -n 's/^DEVELOPMENT_TEAM = //p' "$SIGNING_OVERRIDE_PATH" | head -n 1)"
    fi
    if [[ "$BUNDLE_ID" == "com.anonymous.idolsongappmobile" ]]; then
      local override_bundle
      override_bundle="$(sed -n 's/^PRODUCT_BUNDLE_IDENTIFIER = //p' "$SIGNING_OVERRIDE_PATH" | head -n 1)"
      if [[ -n "$override_bundle" ]]; then
        BUNDLE_ID="$override_bundle"
      fi
    fi
    local override_display_name override_product_name
    override_display_name="$(sed -n 's/^APP_DISPLAY_NAME = //p' "$SIGNING_OVERRIDE_PATH" | head -n 1)"
    if [[ -n "$override_display_name" ]]; then
      APP_DISPLAY_NAME="$override_display_name"
    fi
    override_product_name="$(sed -n 's/^PRODUCT_NAME = //p' "$SIGNING_OVERRIDE_PATH" | head -n 1)"
    if [[ -n "$override_product_name" ]]; then
      PRODUCT_NAME="$override_product_name"
    fi
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device)
      DEVICE_NAME="${2:-}"
      shift 2
      ;;
    --team-id)
      TEAM_ID="${2:-}"
      shift 2
      ;;
    --bundle-id)
      BUNDLE_ID="${2:-}"
      shift 2
      ;;
    --app-display-name)
      APP_DISPLAY_NAME="${2:-}"
      shift 2
      ;;
    --product-name)
      PRODUCT_NAME="${2:-}"
      shift 2
      ;;
    --api-base-url)
      API_BASE_URL="${2:-}"
      shift 2
      ;;
    --derived-data-path)
      DERIVED_DATA_PATH="${2:-}"
      shift 2
      ;;
    --skip-prebuild)
      SKIP_PREBUILD=1
      shift
      ;;
    --clean-prebuild)
      CLEAN_PREBUILD=1
      shift
      ;;
    --allow-provisioning-updates)
      ALLOW_PROVISIONING_UPDATES=1
      shift
      ;;
    --no-install)
      NO_INSTALL=1
      shift
      ;;
    --no-launch)
      NO_LAUNCH=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
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

read_local_override

if [[ -z "$PREVIEW_BUNDLE_ID" ]]; then
  PREVIEW_BUNDLE_ID="${BUNDLE_ID}.preview"
fi

if [[ -z "$DEV_BUNDLE_ID" ]]; then
  DEV_BUNDLE_ID="${BUNDLE_ID}.dev"
fi

if [[ $DRY_RUN -eq 0 && -z "$DEVICE_NAME" ]]; then
  echo "--device is required unless --dry-run is used." >&2
  exit 1
fi

if [[ $DRY_RUN -eq 0 && ! "$TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "A valid Apple team id is required. Pass --team-id or prepare a local signing override first." >&2
  exit 1
fi

if [[ ! "$BUNDLE_ID" =~ ^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$ ]]; then
  echo "--bundle-id must be a reverse-DNS style bundle identifier." >&2
  exit 1
fi

if [[ -z "$APP_DISPLAY_NAME" || -z "$PRODUCT_NAME" ]]; then
  echo "--app-display-name and --product-name must not be empty." >&2
  exit 1
fi

export APP_ENV=production
export EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL"
export EXPO_IOS_APPLE_TEAM_ID="$TEAM_ID"
export EXPO_IOS_BUNDLE_IDENTIFIER="$BUNDLE_ID"
export EXPO_IOS_APP_DISPLAY_NAME="$APP_DISPLAY_NAME"
export EXPO_IOS_PRODUCT_NAME="$PRODUCT_NAME"

PREBUILD_COMMAND=(
  npx
  expo
  prebuild
  --platform
  ios
)

if [[ $NO_INSTALL -eq 1 ]]; then
  PREBUILD_COMMAND+=(--no-install)
fi

if [[ $CLEAN_PREBUILD -eq 1 ]]; then
  PREBUILD_COMMAND+=(--clean)
fi

XCODEBUILD_COMMAND=(
  xcodebuild
  -workspace
  "$ROOT_DIR/ios/IdolSongAppPreview.xcworkspace"
  -scheme
  IdolSongAppPreview
  -configuration
  Release
  -destination
  generic/platform=iOS
  -derivedDataPath
  "$DERIVED_DATA_PATH"
  CODE_SIGN_STYLE=Automatic
  DEVELOPMENT_TEAM="$TEAM_ID"
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID"
  APP_DISPLAY_NAME="$APP_DISPLAY_NAME"
  PRODUCT_NAME="$PRODUCT_NAME"
  build
)

if [[ $ALLOW_PROVISIONING_UPDATES -eq 1 ]]; then
  XCODEBUILD_COMMAND=(-allowProvisioningUpdates "${XCODEBUILD_COMMAND[@]}")
fi

INSTALL_COMMAND=(
  xcrun
  devicectl
  device
  install
  app
  --device
  "$DEVICE_NAME"
)

LAUNCH_COMMAND=(
  xcrun
  devicectl
  device
  process
  launch
  --device
  "$DEVICE_NAME"
  --terminate-existing
  --activate
  "$BUNDLE_ID"
)

if [[ $DRY_RUN -eq 1 ]]; then
  printf 'APP_ENV=%q EXPO_PUBLIC_API_BASE_URL=%q EXPO_IOS_APPLE_TEAM_ID=%q EXPO_IOS_BUNDLE_IDENTIFIER=%q EXPO_IOS_PREVIEW_BUNDLE_IDENTIFIER=%q EXPO_IOS_DEV_BUNDLE_IDENTIFIER=%q ' \
    "$APP_ENV" "$EXPO_PUBLIC_API_BASE_URL" "$EXPO_IOS_APPLE_TEAM_ID" "$EXPO_IOS_BUNDLE_IDENTIFIER" "$PREVIEW_BUNDLE_ID" "$DEV_BUNDLE_ID"
  printf 'EXPO_IOS_APP_DISPLAY_NAME=%q EXPO_IOS_PRODUCT_NAME=%q ' "$EXPO_IOS_APP_DISPLAY_NAME" "$EXPO_IOS_PRODUCT_NAME"
  printf '\n'
  if [[ $SKIP_PREBUILD -eq 0 ]]; then
    printf '%q ' "${PREBUILD_COMMAND[@]}"
    printf '\n'
  fi
  printf '%q ' "${XCODEBUILD_COMMAND[@]}"
  printf '\n'
  if [[ $NO_INSTALL -eq 0 ]]; then
    printf '%q <APP_PATH>\n' "${INSTALL_COMMAND[@]}"
  fi
  if [[ $NO_INSTALL -eq 0 && $NO_LAUNCH -eq 0 ]]; then
    printf '%q ' "${LAUNCH_COMMAND[@]}"
    printf '\n'
  fi
  exit 0
fi

cleanup_existing_client() {
  local bundle_id="$1"

  if [[ -z "$bundle_id" || "$bundle_id" == "$BUNDLE_ID" ]]; then
    return 0
  fi

  xcrun devicectl device uninstall app --device "$DEVICE_NAME" "$bundle_id" >/dev/null 2>&1 || true
}

cleanup_existing_client "$PREVIEW_BUNDLE_ID"
cleanup_existing_client "$DEV_BUNDLE_ID"

if [[ $SKIP_PREBUILD -eq 0 ]]; then
  "${PREBUILD_COMMAND[@]}"
fi

mkdir -p "$DERIVED_DATA_PATH"
"${XCODEBUILD_COMMAND[@]}"

APP_PATH="$DERIVED_DATA_PATH/Build/Products/Release-iphoneos/${PRODUCT_NAME}.app"

if [[ ! -d "$APP_PATH" ]]; then
  APP_PATH="$(find "$DERIVED_DATA_PATH/Build/Products/Release-iphoneos" -maxdepth 1 -type d -name '*.app' | head -n 1)"
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Unable to locate built .app inside $DERIVED_DATA_PATH/Build/Products/Release-iphoneos" >&2
  exit 1
fi

if [[ $NO_INSTALL -eq 0 ]]; then
  "${INSTALL_COMMAND[@]}" "$APP_PATH"
fi

if [[ $NO_INSTALL -eq 0 && $NO_LAUNCH -eq 0 ]]; then
  "${LAUNCH_COMMAND[@]}"
fi
