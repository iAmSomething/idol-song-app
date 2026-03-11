#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_PATH="$ROOT_DIR/ios/IdolSongAppPreview/Supporting/IdolSongAppPreview.signing.local.xcconfig"
TEAM_ID=""
BUNDLE_ID=""

usage() {
  cat <<EOF
Usage:
  $(basename "$0") --team-id ABCDE12345 --bundle-id com.example.idolsongapp.preview [--out /custom/path]

Writes a local xcconfig override for personal Apple team preview signing.
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

mkdir -p "$(dirname "$OUTPUT_PATH")"

cat >"$OUTPUT_PATH" <<EOF
DEVELOPMENT_TEAM = $TEAM_ID
PRODUCT_BUNDLE_IDENTIFIER = $BUNDLE_ID
EOF

cat <<EOF
Prepared iOS signing override:
  $OUTPUT_PATH

Next steps:
  export EXPO_IOS_APPLE_TEAM_ID=$TEAM_ID
  export EXPO_IOS_BUNDLE_IDENTIFIER=$BUNDLE_ID
  EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run config:preview
  EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:ios:sim
EOF
