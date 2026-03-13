#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE_NAME=""
TEAM_ID="${EXPO_IOS_APPLE_TEAM_ID:-}"
BUNDLE_ID="${EXPO_IOS_BUNDLE_IDENTIFIER:-com.anonymous.idolsongappmobile}"
API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-https://idol-song-app-production.up.railway.app}"
PORT="8081"
NO_BUILD_CACHE=0
NO_INSTALL=0
NO_BUNDLER=1
DRY_RUN=0
SIGNING_OVERRIDE_PATH="$ROOT_DIR/ios/IdolSongAppPreview/Supporting/IdolSongAppPreview.production.signing.local.xcconfig"

usage() {
  cat <<EOF
Usage:
  $(basename "$0") --device "김태훈의 iPhone" --team-id ABCDE12345 [--bundle-id com.example.idolsongapp] [--api-base-url https://idol-song-app-production.up.railway.app]

Installs the production Release build on a physical iPhone so the app opens directly instead of the Expo dev launcher.
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
    --api-base-url)
      API_BASE_URL="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    --no-build-cache)
      NO_BUILD_CACHE=1
      shift
      ;;
    --no-install)
      NO_INSTALL=1
      shift
      ;;
    --with-bundler)
      NO_BUNDLER=0
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

export APP_ENV=production
export EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL"
export EXPO_IOS_APPLE_TEAM_ID="$TEAM_ID"
export EXPO_IOS_BUNDLE_IDENTIFIER="$BUNDLE_ID"

COMMAND=(
  npx
  expo
  run:ios
  --configuration
  Release
  --device
  "$DEVICE_NAME"
  --port
  "$PORT"
)

if [[ $NO_BUNDLER -eq 1 ]]; then
  COMMAND+=(--no-bundler)
fi

if [[ $NO_BUILD_CACHE -eq 1 ]]; then
  COMMAND+=(--no-build-cache)
fi

if [[ $NO_INSTALL -eq 1 ]]; then
  COMMAND+=(--no-install)
fi

if [[ $DRY_RUN -eq 1 ]]; then
  printf 'APP_ENV=%q EXPO_PUBLIC_API_BASE_URL=%q EXPO_IOS_APPLE_TEAM_ID=%q EXPO_IOS_BUNDLE_IDENTIFIER=%q ' \
    "$APP_ENV" "$EXPO_PUBLIC_API_BASE_URL" "$EXPO_IOS_APPLE_TEAM_ID" "$EXPO_IOS_BUNDLE_IDENTIFIER"
  printf '%q ' "${COMMAND[@]}"
  printf '\n'
  exit 0
fi

"${COMMAND[@]}"
