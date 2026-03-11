# RN iOS Personal-Team Signing Local Note (2026-03-11)

## Scope
- Issue target: `#543`

## Implemented
- checked-in iOS project no longer hardcodes one `DEVELOPMENT_TEAM`.
- preview iOS build settings now resolve signing through:
  - `IdolSongAppPreview.shared.xcconfig`
  - optional local override `IdolSongAppPreview.signing.local.xcconfig`
- Expo config now accepts:
  - `EXPO_IOS_APPLE_TEAM_ID`
  - `EXPO_IOS_BUNDLE_IDENTIFIER`
- helper script added:
  - `mobile/scripts/prepare-ios-preview-signing.sh`
- install/troubleshooting guide added:
  - `docs/specs/mobile/ios-preview-signing-personal-team.md`

## Local verification
- `mobile/scripts/prepare-ios-preview-signing.sh --team-id ABCDE12345 --bundle-id com.example.idolsongapp.preview`
- `EXPO_IOS_APPLE_TEAM_ID=ABCDE12345 EXPO_IOS_BUNDLE_IDENTIFIER=com.example.idolsongapp.preview EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run config:preview`
- `xcodebuild -list -workspace mobile/ios/IdolSongAppPreview.xcworkspace`
- file-level inspection:
  - checked-in `project.pbxproj` no longer contains hardcoded `7Y3Y9M4N4F`
  - local signing override file resolves `DEVELOPMENT_TEAM = ABCDE12345`
  - local signing override file resolves `PRODUCT_BUNDLE_IDENTIFIER = com.example.idolsongapp.preview`

## Result
- preview Expo config reflected:
  - `ios.bundleIdentifier = com.example.idolsongapp.preview`
  - `ios.appleTeamId = ABCDE12345`
- native project now supports machine-local signing override without committing personal team values.

## Limitation
- attached physical iPhone install was not rerun in this environment, so the new path was validated as a repeatable configuration/install procedure, not as a fresh on-device install proof.
