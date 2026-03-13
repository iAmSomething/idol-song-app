#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_PATH="$ROOT_DIR/ios/IdolSongAppPreview/Supporting/IdolSongAppPreview.production.signing.local.xcconfig"
TEAM_ID="${EXPO_IOS_APPLE_TEAM_ID:-}"
BUNDLE_ID="${EXPO_IOS_BUNDLE_IDENTIFIER:-com.anonymous.idolsongappmobile}"
APP_DISPLAY_NAME="${EXPO_IOS_APP_DISPLAY_NAME:-Idol Song App}"
PRODUCT_NAME="${EXPO_IOS_PRODUCT_NAME:-IdolSongApp}"

usage() {
  cat <<EOF
Usage:
  $(basename "$0") --team-id ABCDE12345 [--bundle-id com.example.idolsongapp] [--app-display-name "Idol Song App"] [--product-name IdolSongApp] [--out /custom/path]

Writes a local xcconfig override for personal Apple team production signing.
EOF
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
    --out)
      OUTPUT_PATH="${2:-}"
      shift 2
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

if [[ ! "$TEAM_ID" =~ ^[A-Z0-9]{10}$ ]]; then
  echo "--team-id must be a 10-character Apple team identifier." >&2
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

mkdir -p "$(dirname "$OUTPUT_PATH")"

cat >"$OUTPUT_PATH" <<EOF
DEVELOPMENT_TEAM = $TEAM_ID
PRODUCT_BUNDLE_IDENTIFIER = $BUNDLE_ID
APP_DISPLAY_NAME = $APP_DISPLAY_NAME
PRODUCT_NAME = $PRODUCT_NAME
EOF

cat <<EOF
Prepared iOS production signing override:
  $OUTPUT_PATH

Next steps:
  export EXPO_IOS_APPLE_TEAM_ID=$TEAM_ID
  export EXPO_IOS_BUNDLE_IDENTIFIER=$BUNDLE_ID
  export EXPO_IOS_APP_DISPLAY_NAME="$APP_DISPLAY_NAME"
  export EXPO_IOS_PRODUCT_NAME=$PRODUCT_NAME
  export EXPO_PUBLIC_API_BASE_URL=https://idol-song-app-production.up.railway.app
  npm run config:production
  npm run ios:production:install -- --device "Your iPhone"
EOF
