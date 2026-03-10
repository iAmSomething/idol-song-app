# RN Runtime Device QA 2026-03-10

## Scope
- Issue: [#486](https://github.com/iAmSomething/idol-song-app/issues/486)
- Goal: preview sign-off 직전 실제 runtime QA matrix와 accessibility/platform walkthrough 재실행
- Decision: `BLOCKED`
- Next blocker follow-up: [#488](https://github.com/iAmSomething/idol-song-app/issues/488)

## Summary
이번 패스에서는 iOS shipping-target simulator에서 preview runtime을 실제로 띄우는 데까지는 성공했다. 다만 Expo Go first-run tools modal이 앱 위를 덮고 있고, Expo Go 안에서는 앱 custom scheme deep-link도 등록되지 않아 search / team detail / release detail을 직접 열 수 없었다. Android는 emulator package, AVD, attached device가 모두 없어 runtime matrix를 시작할 수 없었다.

## Runtime Matrix
| Target | Result | Evidence | Notes |
| --- | --- | --- | --- |
| iOS simulator launch | PASS | `docs/assets/distribution/rn_ios_preview_runtime_calendar_2026-03-10.png` | `Calendar` surface가 실제 simulator에 로드됨 |
| iOS in-app flow walkthrough | BLOCKED | `docs/assets/distribution/rn_ios_preview_runtime_blocker_2026-03-10.png` | Expo Go tools modal이 first-run 상태로 남아 manual taps를 가로막음 |
| iOS deep-link jump | BLOCKED | `xcrun simctl openurl booted 'idolsongapp-preview://...'` | Expo Go runtime에서는 app custom scheme가 직접 등록되지 않아 `OSStatus -10814` |
| Android emulator runtime | BLOCKED | `find ~/Library/Android/sdk -type f -name emulator` | emulator binary 없음 |
| Android physical runtime | BLOCKED | `adb devices -l` | attached device 없음 |
| VoiceOver / TalkBack walkthrough | BLOCKED | no runnable end-to-end runtime target | screen-reader walkthrough 미실행 |
| Dynamic Type largest-text walkthrough | BLOCKED | no runnable end-to-end runtime target | largest-text runtime walkthrough 미실행 |

## Executed Checks
1. `CI=1 EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npx expo start --host lan --ios`
2. `lsof -i tcp:8081 -n -P`
3. `xcrun simctl io booted screenshot ...`
4. `xcrun simctl openurl booted 'idolsongapp-preview://search?...'`
5. `xcrun simctl openurl booted 'idolsongapp-preview://artists/yena'`
6. `xcrun simctl openurl booted 'idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album'`
7. `find ~/Library/Android/sdk -type f -name emulator`
8. `ls -la ~/.android/avd`
9. `adb devices -l`

## Findings
1. iOS simulator 기준으로 preview runtime은 실제 앱 화면까지 올라온다. 이건 `#454` 시점의 “simulator boot only”보다 한 단계 진전이다.
2. Expo Go first-run tools modal 때문에 QA-UC-01 ~ QA-UC-05를 앱 안에서 연속 수행할 수 없었다.
3. Expo Go runtime에서는 앱 custom scheme deep-link를 직접 열 수 없어 route-level 우회 진입도 막혔다.
4. Android는 QA를 시작할 수 있는 runtime target 자체가 없다.

## Decision
- `#486`의 목적이었던 runtime matrix 실행 시도와 blocker 분류는 완료했다.
- preview sign-off는 여전히 `NO-GO`다.
- 다음 액션은 [#488](https://github.com/iAmSomething/idol-song-app/issues/488)에서 runtime QA 환경 자체를 안정화한 뒤 남은 matrix를 다시 도는 것이다.
