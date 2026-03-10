# RN Runtime Device QA Local Evidence 2026-03-10

## Scope
- Issue: [#486](https://github.com/iAmSomething/idol-song-app/issues/486)
- Branch: `codex/486-rn-runtime-device-qa`
- Outcome: runtime QA attempt executed, preview sign-off still `BLOCKED`

## iOS Preview Runtime

### Launch command
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
CI=1 EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npx expo start --host lan --ios
```

Result: `PASS`

Notes:
- Expo CLI opened `exp://192.168.55.173:8081` on `iPhone 16e`
- `lsof -i tcp:8081 -n -P` showed:
  - Metro listening on `*:8081`
  - Expo Go established connections to `192.168.55.173:8081`

### Visible runtime evidence
- screenshot: `docs/assets/distribution/rn_ios_preview_runtime_calendar_2026-03-10.png`
- observed state:
  - app loaded to `Calendar`
  - `2026년 3월` month header visible
  - quick-jump / filter controls visible
  - Expo Go first-run tools modal visible on top

### Flow blocker evidence
- screenshot: `docs/assets/distribution/rn_ios_preview_runtime_blocker_2026-03-10.png`
- observed state:
  - Expo Go reports it can reach the development server
  - app-level flow remains blocked by Expo Go first-run modal / runtime shell behavior

### Deep-link attempts
```bash
xcrun simctl openurl booted 'idolsongapp-preview://search?q=%ED%88%AC%EB%B0%94%ED%88%AC&segment=entities'
xcrun simctl openurl booted 'idolsongapp-preview://artists/yena'
xcrun simctl openurl booted 'idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album'
```

Result: `BLOCKED`

Observed error:
- `OSStatus error -10814`

Interpretation:
- Expo Go runtime에서는 앱 custom scheme를 직접 처리하지 않아 route-level QA 우회 진입이 불가능했다.

## Android Runtime

### Emulator package check
```bash
find ~/Library/Android/sdk -type f -name emulator
ls -la ~/.android/avd
```

Result: `BLOCKED`

Observed state:
- emulator binary not found
- AVD directory empty / unavailable

### Attached device check
```bash
/Users/gimtaehun/Library/Android/sdk/platform-tools/adb devices -l
```

Result: `BLOCKED`

Observed state:
- no attached Android devices

## Accessibility / Platform Walkthrough
| Item | Result | Notes |
| --- | --- | --- |
| VoiceOver reading order | BLOCKED | runnable iOS flow not completed |
| TalkBack reading order | BLOCKED | no Android runtime target |
| Dynamic Type largest-text | BLOCKED | flow-level runtime QA not completed |
| iOS handoff / swipe-back | BLOCKED | in-app progression blocked by Expo Go modal |
| Android hardware back / handoff return / state restore | BLOCKED | no Android runtime target |

## Conclusion
- iOS simulator runtime launch itself is now proven.
- Remaining blockers are runtime QA environment blockers, not selector/build/lint/test blockers.
- Follow-up issue: [#488](https://github.com/iAmSomething/idol-song-app/issues/488)
