# RN Runtime Device QA 2026-03-10

## Scope
- Issue: [#488](https://github.com/iAmSomething/idol-song-app/issues/488)
- Goal: preview sign-off 직전 runtime target을 안정화하고 실제 runtime QA matrix와 accessibility/platform walkthrough를 다시 실행
- Decision: `BLOCKED`
- Next blocker follow-up: [#491](https://github.com/iAmSomething/idol-song-app/issues/491)

## Summary
이번 패스에서는 preview QA runtime 자체는 안정화됐다. iOS는 `expo-dev-client`가 포함된 standalone preview build로 `Calendar`, `Search`, `Radar`, `YENA team detail`, `LOVE CATCHER release detail`까지 실제로 열 수 있었고, Android는 command-line tools, emulator, AVD를 provision한 뒤 preview build를 emulator에 설치해 `Calendar -> YENA team detail -> hardware back` 흐름을 검증했다. 다만 sign-off는 여전히 `BLOCKED`다. iOS largest-text(`accessibility-extra-extra-extra-large`)에서 Search 화면 레이아웃이 심하게 무너졌고, Android 외부 handoff return은 마지막 상세 컨텍스트가 아니라 `Calendar` 루트로 복귀했다. VoiceOver / TalkBack 수동 walkthrough도 아직 clean pass로 남기지 못했다.

## Runtime Matrix
| Target | Result | Evidence | Notes |
| --- | --- | --- | --- |
| iOS simulator launch | PASS | `docs/assets/distribution/rn_ios_preview_runtime_calendar_no_menu_2026-03-10.png` | standalone preview dev client에서 `Calendar` surface 로드 확인 |
| iOS in-app flow walkthrough | PASS | `docs/assets/distribution/rn_ios_preview_runtime_search_warm_2026-03-10.png`, `docs/assets/distribution/rn_ios_preview_runtime_radar_2026-03-10.png` | `Search`, `Radar` warm route 진입 확인 |
| iOS deep-link jump | PASS | `docs/assets/distribution/rn_ios_preview_runtime_artist_yena_2026-03-10.png`, `docs/assets/distribution/rn_ios_preview_runtime_release_yena_2026-03-10.png` | `artists/yena`, `releases/yena--love-catcher--2026-03-11--album` warm deep link 성공 |
| Android emulator runtime | PASS | `docs/assets/distribution/rn_android_preview_runtime_calendar_no_menu_2026-03-10.png` | preview build install, dev client load, `Calendar` surface 확인 |
| Android hardware back | PASS | `docs/assets/distribution/rn_android_preview_runtime_after_back_2026-03-10.png` | `YENA` team detail에서 hardware back 후 `Calendar` 복귀 확인 |
| Android external handoff return / state restore | BLOCKED | `docs/assets/distribution/rn_android_preview_runtime_handoff_return_2026-03-10.png` | 브라우저 handoff 후 앱을 다시 foreground로 올리면 마지막 detail context가 아니라 `Calendar` 루트로 돌아옴 |
| VoiceOver / TalkBack walkthrough | BLOCKED | runnable runtime target exists, but screen-reader pass not recorded | 실제 수동 스크린리더 walkthrough 미완료 |
| Dynamic Type / font scale walkthrough | BLOCKED | `docs/assets/distribution/rn_ios_preview_runtime_search_largest_text_2026-03-10.png`, `docs/assets/distribution/rn_android_preview_runtime_largest_text_2026-03-10.png` | iOS largest-text는 blocking overflow 발생, Android font scale은 snapshot만 확보 |

## Executed Checks
1. `cd mobile && npx expo install expo-dev-client`
2. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:ios:prebuild`
3. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:ios:sim`
4. `xcrun simctl openurl booted 'idolsongapp-preview://artists/yena'`
5. `xcrun simctl openurl booted 'idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album'`
6. `xcrun simctl openurl booted 'idolsongapp-preview://search?q=최예나'`
7. `xcrun simctl openurl booted 'idolsongapp-preview://radar'`
8. `xcrun simctl ui booted content_size accessibility-extra-extra-extra-large`
9. `brew install --cask android-commandlinetools`
10. `yes | "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$HOME/Library/Android/sdk" "emulator" "platforms;android-35" "system-images;android-35;google_apis;arm64-v8a"`
11. `"$HOME/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager" create avd --force --name idol-song-app-preview-api35 --package "system-images;android-35;google_apis;arm64-v8a" --tag google_apis --abi arm64-v8a --device pixel_8`
12. `"$HOME/Library/Android/sdk/emulator/emulator" -list-avds`
13. `"$HOME/Library/Android/sdk/emulator/emulator" -avd idol-song-app-preview-api35 -netdelay none -netspeed full -no-snapshot-save -no-boot-anim -no-audio`
14. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:android:prebuild`
15. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:android:emu`
16. `adb shell input tap ...`
17. `adb shell input keyevent 4`
18. `adb shell am start -W -a android.intent.action.VIEW -d 'https://example.com'`
19. `adb shell am start -W -n com.anonymous.idolsongappmobile.preview/.MainActivity`
20. `adb shell settings put system font_scale 1.3`
21. `adb exec-out screencap -p > ...`

## Findings
1. `expo-dev-client`와 native identifier를 넣은 뒤에는 iOS preview runtime이 Expo Go blocker 없이 실제 app shell까지 올라온다.
2. iOS에서는 warm deep link로 `Search`, `Radar`, `Team Detail`, `Release Detail`을 모두 직접 열 수 있었다.
3. Android는 emulator package, AVD, attached device 부재 상태에서 벗어나 실제 preview build install/open까지 성공했다.
4. Android hardware back은 정상이다.
5. 남은 blocker는 runtime availability가 아니라 accessibility/state behavior다.
6. iOS largest-text에서 Search 화면 텍스트가 심하게 겹치고 잘려서 sign-off를 막는다.
7. Android external handoff return은 마지막 screen context를 보존하지 못하고 `Calendar` 루트로 돌아간다.

## Decision
- `#488`의 목적이었던 preview runtime 안정화와 rerun은 완료했다.
- preview sign-off는 여전히 `NO-GO`다.
- 다음 액션은 [#491](https://github.com/iAmSomething/idol-song-app/issues/491)에서 accessibility/state restore blocker를 해결한 뒤 sign-off를 다시 판정하는 것이다.
