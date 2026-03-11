# RN iOS xcconfig path fix local evidence (2026-03-11)

- issue: `#591`
- purpose: confirm iOS preview build no longer fails on duplicated `Supporting/.../Supporting/...` xcconfig path resolution before signing

## repo change

- file: `mobile/ios/IdolSongAppPreview.xcodeproj/project.pbxproj`
- change:
  - `Supporting` PBXGroup path stays `IdolSongAppPreview/Supporting`
  - child xcconfig PBXFileReference paths were reduced to file-name-only:
    - `IdolSongAppPreview.debug.xcconfig`
    - `IdolSongAppPreview.release.xcconfig`
    - `IdolSongAppPreview.shared.xcconfig`
    - `IdolSongAppPreview.signing.local.example.xcconfig`

## direct checks

1. `find mobile/ios/IdolSongAppPreview -maxdepth 2 -type f | sort`
   - confirmed only one real file path exists for each xcconfig under:
     - `mobile/ios/IdolSongAppPreview/Supporting/*.xcconfig`

2. `xcodebuild -workspace ios/IdolSongAppPreview.xcworkspace -scheme IdolSongAppPreview -configuration Debug -showBuildSettings`
   - command succeeded
   - no `Unable to open base configuration reference file` error
   - build settings reached normal resolution and printed signing/build values

3. `EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npx expo run:ios --device "김태훈의 iPhone" --no-build-cache`
   - command resolved the physical device automatically
   - observed output:
     - `Using --device 00008110-001268210109401E`
     - `Auto signing app using team(s): 7Y3Y9M4N4F`
     - `Planning build`
     - `Clean Succeeded`
     - followed by native compilation steps
   - result interpretation:
     - build advanced past the previous xcconfig reference failure point
     - remaining failures, if any, are downstream native/signing/install concerns rather than duplicated config-path resolution

## string-level guard

- `project.pbxproj` no longer contains duplicated supporting-path file references like:
  - `IdolSongAppPreview/Supporting/IdolSongAppPreview.debug.xcconfig`
  - `IdolSongAppPreview/Supporting/IdolSongAppPreview.release.xcconfig`
  - `IdolSongAppPreview/Supporting/IdolSongAppPreview.shared.xcconfig`
  - `IdolSongAppPreview/Supporting/IdolSongAppPreview.signing.local.example.xcconfig`
