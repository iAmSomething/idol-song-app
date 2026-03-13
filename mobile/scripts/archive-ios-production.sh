#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEAM_ID="${EXPO_IOS_APPLE_TEAM_ID:-}"
BUNDLE_ID="${EXPO_IOS_BUNDLE_IDENTIFIER:-com.anonymous.idolsongappmobile}"
APP_DISPLAY_NAME="${EXPO_IOS_APP_DISPLAY_NAME:-Idol Song App}"
PRODUCT_NAME="${EXPO_IOS_PRODUCT_NAME:-IdolSongApp}"
API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-https://idol-song-app-production.up.railway.app}"
ARCHIVE_PATH="${ROOT_DIR}/ios/build/IdolSongAppProduction.xcarchive"
SKIP_PREBUILD=0
CLEAN_PREBUILD=0
NO_INSTALL=1
ALLOW_PROVISIONING_UPDATES=0
DRY_RUN=0
SIGNING_OVERRIDE_PATH="$ROOT_DIR/ios/IdolSongAppPreview/Supporting/IdolSongAppPreview.production.signing.local.xcconfig"

usage() {
  cat <<EOF
Usage:
  $(basename "$0") --team-id ABCDE12345 [--bundle-id com.example.idolsongapp] [--app-display-name "Idol Song App"] [--product-name IdolSongApp] [--archive-path /tmp/IdolSongApp.xcarchive]

Creates a production iOS archive for real device distribution.
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
    --archive-path)
      ARCHIVE_PATH="${2:-}"
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
    --with-install)
      NO_INSTALL=0
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
  -archivePath
  "$ARCHIVE_PATH"
  CODE_SIGN_STYLE=Automatic
  DEVELOPMENT_TEAM="$TEAM_ID"
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID"
  APP_DISPLAY_NAME="$APP_DISPLAY_NAME"
  PRODUCT_NAME="$PRODUCT_NAME"
  archive
)

if [[ $ALLOW_PROVISIONING_UPDATES -eq 1 ]]; then
  XCODEBUILD_COMMAND=(-allowProvisioningUpdates "${XCODEBUILD_COMMAND[@]}")
fi

if [[ $DRY_RUN -eq 1 ]]; then
  printf 'APP_ENV=%q EXPO_PUBLIC_API_BASE_URL=%q EXPO_IOS_APPLE_TEAM_ID=%q EXPO_IOS_BUNDLE_IDENTIFIER=%q\n' \
    "$APP_ENV" "$EXPO_PUBLIC_API_BASE_URL" "$EXPO_IOS_APPLE_TEAM_ID" "$EXPO_IOS_BUNDLE_IDENTIFIER"
  printf 'EXPO_IOS_APP_DISPLAY_NAME=%q EXPO_IOS_PRODUCT_NAME=%q\n' "$EXPO_IOS_APP_DISPLAY_NAME" "$EXPO_IOS_PRODUCT_NAME"
  if [[ $SKIP_PREBUILD -eq 0 ]]; then
    printf '%q ' "${PREBUILD_COMMAND[@]}"
    printf '\n'
  fi
  printf '%q ' "${XCODEBUILD_COMMAND[@]}"
  printf '\n'
  exit 0
fi

if [[ $SKIP_PREBUILD -eq 0 ]]; then
  "${PREBUILD_COMMAND[@]}"
fi

mkdir -p "$(dirname "$ARCHIVE_PATH")"
"${XCODEBUILD_COMMAND[@]}"
