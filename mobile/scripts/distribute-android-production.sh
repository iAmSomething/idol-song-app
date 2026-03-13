#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_ID="1:364777074329:android:3c06d1a2c73a4a44c8d208"
API_BASE_URL="${EXPO_PUBLIC_API_BASE_URL:-https://idol-song-app-production.up.railway.app}"
APK_PATH="${MOBILE_DIR}/android/app/build/outputs/apk/release/app-release.apk"
REBUILD=false
DRY_RUN=false
DIST_GROUPS=""
DIST_TESTERS=""
RELEASE_NOTES=""
RELEASE_NOTES_FILE=""

print_usage() {
  cat <<'EOF'
Usage: ./scripts/distribute-android-production.sh [options]

Build or reuse the Android production release APK and upload it to Firebase App Distribution.

Options:
  --rebuild                 Force a fresh assembleRelease before upload
  --dry-run                 Print resolved configuration without building or uploading
  --groups <aliases>        Firebase App Distribution group aliases (comma-separated)
  --testers <emails>        Tester emails (comma-separated)
  --release-notes <text>    Inline release notes text
  --release-notes-file <f>  File containing release notes
  -h, --help                Show this help message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild)
      REBUILD=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --groups)
      DIST_GROUPS="${2:-}"
      shift 2
      ;;
    --testers)
      DIST_TESTERS="${2:-}"
      shift 2
      ;;
    --release-notes)
      RELEASE_NOTES="${2:-}"
      shift 2
      ;;
    --release-notes-file)
      RELEASE_NOTES_FILE="${2:-}"
      shift 2
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "${RELEASE_NOTES}" && -n "${RELEASE_NOTES_FILE}" ]]; then
  echo "Use either --release-notes or --release-notes-file, not both." >&2
  exit 1
fi

if [[ -n "${RELEASE_NOTES_FILE}" && ! -f "${RELEASE_NOTES_FILE}" ]]; then
  echo "Release notes file not found: ${RELEASE_NOTES_FILE}" >&2
  exit 1
fi

if [[ ! -f "${MOBILE_DIR}/firebase/google-services.production.json" ]]; then
  echo "Missing Firebase production config: ${MOBILE_DIR}/firebase/google-services.production.json" >&2
  exit 1
fi

FIREBASE_NODE_BIN="${FIREBASE_NODE_BIN:-}"
if [[ -z "${FIREBASE_NODE_BIN}" ]]; then
  if [[ -x /usr/local/bin/node ]]; then
    FIREBASE_NODE_BIN="/usr/local/bin/node"
  else
    FIREBASE_NODE_BIN="$(command -v node)"
  fi
fi

FIREBASE_CLI_JS="${FIREBASE_CLI_JS:-}"
if [[ -z "${FIREBASE_CLI_JS}" ]]; then
  if [[ -f /opt/homebrew/lib/node_modules/firebase-tools/lib/bin/firebase.js ]]; then
    FIREBASE_CLI_JS="/opt/homebrew/lib/node_modules/firebase-tools/lib/bin/firebase.js"
  else
    echo "Unable to locate firebase-tools CLI script. Install firebase-tools globally first." >&2
    exit 1
  fi
fi

if [[ "${DRY_RUN}" == true ]]; then
  cat <<EOF
mode=dry-run
app_id=${APP_ID}
api_base_url=${API_BASE_URL}
apk_path=${APK_PATH}
firebase_node_bin=${FIREBASE_NODE_BIN}
firebase_cli_js=${FIREBASE_CLI_JS}
groups=${DIST_GROUPS}
testers=${DIST_TESTERS}
EOF
  exit 0
fi

LOGIN_OUTPUT="$("${FIREBASE_NODE_BIN}" "${FIREBASE_CLI_JS}" login:list 2>&1 || true)"
if [[ "${LOGIN_OUTPUT}" == *"No authorized accounts"* ]] || [[ "${LOGIN_OUTPUT}" == *"Not logged in"* ]]; then
  echo "Firebase CLI is not logged in. Run 'firebase login' first, then rerun this script." >&2
  exit 1
fi

if [[ "${REBUILD}" == true || ! -f "${APK_PATH}" ]]; then
  echo "Building Android production release APK..." >&2
  (
    cd "${MOBILE_DIR}"
    EXPO_PUBLIC_API_BASE_URL="${API_BASE_URL}" npm run android:production:assemble
  )
fi

if [[ ! -f "${APK_PATH}" ]]; then
  echo "Release APK was not generated: ${APK_PATH}" >&2
  exit 1
fi

FIREBASE_ARGS=(
  appdistribution:distribute
  "${APK_PATH}"
  --app "${APP_ID}"
)

if [[ -n "${DIST_GROUPS}" ]]; then
  FIREBASE_ARGS+=(--groups "${DIST_GROUPS}")
fi

if [[ -n "${DIST_TESTERS}" ]]; then
  FIREBASE_ARGS+=(--testers "${DIST_TESTERS}")
fi

if [[ -n "${RELEASE_NOTES}" ]]; then
  FIREBASE_ARGS+=(--release-notes "${RELEASE_NOTES}")
elif [[ -n "${RELEASE_NOTES_FILE}" ]]; then
  FIREBASE_ARGS+=(--release-notes-file "${RELEASE_NOTES_FILE}")
else
  DEFAULT_NOTES="Idol Song App Android production build $(date '+%Y-%m-%d %H:%M:%S %Z')"
  FIREBASE_ARGS+=(--release-notes "${DEFAULT_NOTES}")
fi

echo "Uploading ${APK_PATH} to Firebase App Distribution..." >&2
"${FIREBASE_NODE_BIN}" "${FIREBASE_CLI_JS}" "${FIREBASE_ARGS[@]}"
