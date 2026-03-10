#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-on}"
DEVICE="${2:-booted}"

if [[ "${MODE}" != "on" && "${MODE}" != "off" ]]; then
  echo "usage: $0 [on|off] [device-id|booted]" >&2
  exit 1
fi

SDK_PATH="$(xcrun --sdk iphonesimulator --show-sdk-path)"
TMP_DIR="${TMPDIR:-/tmp}/idol-song-app-voiceover-toggle"
SOURCE_FILE="${TMP_DIR}/voiceover-toggle.m"
BINARY_FILE="${TMP_DIR}/voiceover-toggle"

mkdir -p "${TMP_DIR}"

cat > "${SOURCE_FILE}" <<'EOF'
#import <Foundation/Foundation.h>

extern void _AXSVoiceOverTouchSetEnabled(BOOL enabled);
extern void _AXSVoiceOverTouchSetEnabledAndAutoConfirmUsage(BOOL enabled);
extern void _AXSVoiceOverTouchSetTutorialUsageConfirmed(BOOL enabled);
extern void _AXSVoiceOverTouchSetUsageConfirmed(BOOL enabled);
extern void _AXSVoiceOverTouchSetUserHasReadNoHomeButtonGestureDescription(BOOL enabled);
extern void _AXSVoiceOverTouchSetUIEnabled(BOOL enabled);
extern BOOL _AXSVoiceOverTouchEnabled(void);
extern BOOL _AXSVoiceOverTouchUIEnabled(void);
extern BOOL _AXSVoiceOverTouchTutorialUsageConfirmed(void);
extern BOOL _AXSVoiceOverTouchUsageConfirmed(void);
extern BOOL _AXSVoiceOverTouchUserHasReadNoHomeButtonGestureDescription(void);

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    BOOL enabled = YES;
    if (argc > 1 && strcmp(argv[1], "off") == 0) {
      enabled = NO;
    }

    if (enabled) {
      _AXSVoiceOverTouchSetEnabledAndAutoConfirmUsage(YES);
      _AXSVoiceOverTouchSetTutorialUsageConfirmed(YES);
      _AXSVoiceOverTouchSetUsageConfirmed(YES);
      _AXSVoiceOverTouchSetUserHasReadNoHomeButtonGestureDescription(YES);
      _AXSVoiceOverTouchSetUIEnabled(YES);
    } else {
      _AXSVoiceOverTouchSetTutorialUsageConfirmed(YES);
      _AXSVoiceOverTouchSetUsageConfirmed(YES);
      _AXSVoiceOverTouchSetUserHasReadNoHomeButtonGestureDescription(YES);
      _AXSVoiceOverTouchSetUIEnabled(NO);
      _AXSVoiceOverTouchSetEnabled(NO);
    }

    NSLog(
        @"enabled=%d ui=%d tutorial=%d usage=%d readNoHome=%d",
        _AXSVoiceOverTouchEnabled(),
        _AXSVoiceOverTouchUIEnabled(),
        _AXSVoiceOverTouchTutorialUsageConfirmed(),
        _AXSVoiceOverTouchUsageConfirmed(),
        _AXSVoiceOverTouchUserHasReadNoHomeButtonGestureDescription());
  }
  return 0;
}
EOF

xcrun --sdk iphonesimulator clang \
  -arch arm64 \
  -isysroot "${SDK_PATH}" \
  -mios-simulator-version-min=18.0 \
  -framework Foundation \
  -lAccessibility \
  "${SOURCE_FILE}" \
  -o "${BINARY_FILE}"

if [[ "${MODE}" == "off" ]]; then
  xcrun simctl spawn "${DEVICE}" "${BINARY_FILE}" off
else
  xcrun simctl spawn "${DEVICE}" "${BINARY_FILE}"
fi
