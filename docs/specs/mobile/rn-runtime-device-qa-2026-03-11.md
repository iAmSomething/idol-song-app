# RN Runtime Device QA 2026-03-11

## Scope
- Issues: [#493](https://github.com/iAmSomething/idol-song-app/issues/493), [#495](https://github.com/iAmSomething/idol-song-app/issues/495)
- Goal: Android preview runtime rerun 이후 남아 있던 iOS VoiceOver final pass까지 같은 preview target 기준으로 정리
- Decision: `PASS`
- Remaining blocker follow-up: none

## Summary
앱 코드 기준 largest-text와 route-resume 수정은 이미 들어간 상태였고, 이번 패스에서는 Android preview runtime을 실제로 다시 살렸다. fresh QA AVD `idol-song-app-preview-qa-api35`를 cold boot / no snapshot / `swiftshader_indirect` 조합으로 다시 준비한 뒤 preview dev client를 띄우자 `Calendar` 화면까지 정상 진입했다. 이후 same resume contract를 Android runtime 위에서 다시 확인하기 위해 pending route state를 preview app `AsyncStorage`에 주입하고 dev-client를 relaunch해 `YENA team detail`과 `LOVE CATCHER release detail`이 각각 원래 컨텍스트로 복원되는 것도 확인했다.

TalkBack도 이번에는 preview target 위에서 실제로 bound service 상태까지 갔다. Accessibility Settings에서 `Use TalkBack -> Allow` 흐름을 밟은 뒤 `dumpsys accessibility`로 `touchExplorationEnabled=true`와 `TalkBackService` binding을 확인했고, preview runtime의 `YENA` 화면에서 focus ring이 올라온 상태를 캡처했다.

남아 있던 마지막 blocker였던 iOS VoiceOver도 이번에 shipping-target simulator `iPhone 16e` 위 preview dev client에서 통과시켰다. 핵심은 VoiceOver를 Expo launcher가 아니라 active preview runtime 위에서 켜는 것이었다. `toggle-ios-simulator-voiceover.sh` helper로 VoiceOver를 켠 뒤 `Calendar`, `Search`, `YENA team detail`, `LOVE CATCHER release detail` 네 화면에서 focus ring이 보이는 상태를 캡처했다. attached physical iPhone preview rerun은 여전히 provisioning 이슈 때문에 별도로 돌리지 않았지만, 이번 sign-off 기준에서는 non-gating으로 남겼다.

최종 runtime/accessibility verdict는 `PASS`다. Android preview runtime / handoff-return / TalkBack, iOS largest-text / VoiceOver까지 모두 runnable preview target에서 증적을 남겼다.

## Runtime Matrix
| Target | Result | Evidence | Notes |
| --- | --- | --- | --- |
| iOS largest-text `Calendar` | PASS | `docs/assets/distribution/rn_ios_preview_calendar_after_fix_2026-03-11.png` | month header / summary strip가 화면 밖으로 넘치지 않음 |
| iOS largest-text `Search` | PASS | `docs/assets/distribution/rn_ios_preview_search_after_fix_2026-03-11.png` | native header 중첩 제거, search action row 유지 |
| iOS largest-text `Radar` | PASS | `docs/assets/distribution/rn_ios_preview_radar_after_fix_2026-03-11.png` | filter/action row와 disclosure card가 모두 보임 |
| iOS largest-text `Team Detail` | PASS | `docs/assets/distribution/rn_ios_preview_artist_after_fix_2026-03-11.png` | back action / hero / metadata가 clipping 없이 유지 |
| iOS largest-text `Release Detail` | PASS | `docs/assets/distribution/rn_ios_preview_release_after_fix_2026-03-11.png` | back + team action이 wrap 상태로 유지됨 |
| iOS VoiceOver `Calendar` | PASS | `docs/assets/distribution/rn_ios_voiceover_calendar_2026-03-11.png` | preview runtime 위 month header focus ring visible |
| iOS VoiceOver `Search` | PASS | `docs/assets/distribution/rn_ios_voiceover_search_2026-03-11.png` | search title focus ring visible |
| iOS VoiceOver `Team Detail` | PASS | `docs/assets/distribution/rn_ios_voiceover_artist_2026-03-11.png` | `YENA` team detail back action focus ring visible |
| iOS VoiceOver `Release Detail` | PASS | `docs/assets/distribution/rn_ios_voiceover_release_2026-03-11.png` | `LOVE CATCHER` release detail back action focus ring visible |
| Android preview runtime launch | PASS | `docs/assets/distribution/rn_android_preview_runtime_calendar_2026-03-11.png` | fresh QA AVD + preview dev client로 `Calendar` 화면까지 진입 |
| Android handoff return `YENA` | PASS | `docs/assets/distribution/rn_android_preview_handoff_resume_artist_2026-03-11.png` | persisted pending route를 소비한 뒤 `YENA` team detail로 복귀 |
| Android handoff return `LOVE CATCHER` | PASS | `docs/assets/distribution/rn_android_preview_handoff_resume_release_2026-03-11.png` | persisted pending route를 소비한 뒤 release detail로 복귀 |
| Android TalkBack walkthrough | PASS | `docs/assets/distribution/rn_android_preview_talkback_enabled_2026-03-11.png`, `docs/assets/distribution/rn_android_preview_talkback_yena_2026-03-11.png` | TalkBack service bound + preview target 위 focus ring 확인 |

## Executed Checks
1. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npx expo start --dev-client --host lan --port 8082`
2. `xcrun simctl ui booted content_size accessibility-extra-extra-extra-large`
3. `xcrun simctl openurl booted 'idolsongapp-preview://calendar?month=2026-03'`
4. `xcrun simctl openurl booted 'idolsongapp-preview://search?q=%EC%B5%9C%EC%98%88%EB%82%98'`
5. `xcrun simctl openurl booted 'idolsongapp-preview://radar'`
6. `xcrun simctl openurl booted 'idolsongapp-preview://artists/yena'`
7. `xcrun simctl openurl booted 'idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album'`
8. `osascript`로 `Simulator` 메뉴 바를 검사해 `Features` / `I/O` / `Device` 아래 VoiceOver toggle 존재 여부 확인
9. `cd mobile && npm run qa:preview:android:avd:prepare`
10. `"$HOME/Library/Android/sdk/emulator/emulator" -avd idol-song-app-preview-qa-api35 -wipe-data -no-snapshot -no-window -netdelay none -netspeed full -no-boot-anim -no-audio -gpu swiftshader_indirect`
11. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npm run qa:preview:android:emu`
12. `adb exec-out screencap -p > /tmp/idol-song-app-android-running.png`
13. pull / patch / push `RKStorage` to inject pending route resume rows, then relaunch dev client with `exp+idol-song-app-mobile-preview://expo-development-client/?url=...`
14. `adb shell am start -a android.settings.ACCESSIBILITY_SETTINGS`
15. `adb shell dumpsys accessibility`
16. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npx expo start --dev-client --host lan --port 8082`
17. `xcrun simctl openurl booted 'exp+idol-song-app-mobile-preview://expo-development-client/?url=http%3A%2F%2F192.168.55.173%3A8082'`
18. `cd mobile && npm run qa:preview:ios:voiceover:on`
19. `cd mobile && npm run qa:preview:ios:voiceover:off`
20. `xcrun simctl openurl booted 'idolsongapp-preview://calendar?month=2026-03'`
21. `xcrun simctl openurl booted 'idolsongapp-preview://search?q=%EC%B5%9C%EC%98%88%EB%82%98'`
22. `xcrun simctl openurl booted 'idolsongapp-preview://artists/yena'`
23. `xcrun simctl openurl booted 'idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album'`
24. `xcrun simctl io booted screenshot ...`

## Findings
1. largest-text blocker였던 iOS Search surface overflow는 재현되지 않았다.
2. Android preview runtime instability는 app logic보다 QA AVD / snapshot / GPU 조합 영향이 컸다.
3. `idol-song-app-preview-qa-api35` AVD를 cold boot + no snapshot + `swiftshader_indirect`로 띄우면 preview runtime이 다시 기동된다.
4. persisted pending route resume는 Android runtime에서도 artist/release context를 정상 복원하고, 성공 후 key를 비운다.
5. TalkBack은 preview target 위에서 실제 service binding과 focus ring까지 확인됐다.
6. iOS simulator VoiceOver는 active preview runtime 위에서 켰을 때 onboarding overlay 없이 focus ring 증적을 남길 수 있다.
7. attached physical iPhone preview rerun은 여전히 provisioning 이슈가 있지만, 이번 preview sign-off 기준에서는 blocker가 아니다.

## Decision
- iOS largest-text layout regression은 해소됐다.
- Android preview runtime / handoff-return / TalkBack result는 sign-off evidence로 인정할 수 있다.
- iOS VoiceOver도 runnable preview target 위에서 최종 pass로 기록됐다.
- final accessibility/runtime sign-off는 `GO`다.
