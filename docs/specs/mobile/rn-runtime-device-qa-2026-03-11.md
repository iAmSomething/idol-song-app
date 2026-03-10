# RN Runtime Device QA 2026-03-11

## Scope
- Issue: [#493](https://github.com/iAmSomething/idol-song-app/issues/493)
- Goal: Android preview runtime을 다시 안정화한 뒤 external handoff return, TalkBack, final accessibility/runtime verdict를 기록
- Decision: `BLOCKED`
- Remaining blocker follow-up: [#495](https://github.com/iAmSomething/idol-song-app/issues/495)

## Summary
앱 코드 기준 largest-text와 route-resume 수정은 이미 들어간 상태였고, 이번 패스에서는 Android preview runtime을 실제로 다시 살렸다. fresh QA AVD `idol-song-app-preview-qa-api35`를 cold boot / no snapshot / `swiftshader_indirect` 조합으로 다시 준비한 뒤 preview dev client를 띄우자 `Calendar` 화면까지 정상 진입했다. 이후 same resume contract를 Android runtime 위에서 다시 확인하기 위해 pending route state를 preview app `AsyncStorage`에 주입하고 dev-client를 relaunch해 `YENA team detail`과 `LOVE CATCHER release detail`이 각각 원래 컨텍스트로 복원되는 것도 확인했다.

TalkBack도 이번에는 preview target 위에서 실제로 bound service 상태까지 갔다. Accessibility Settings에서 `Use TalkBack -> Allow` 흐름을 밟은 뒤 `dumpsys accessibility`로 `touchExplorationEnabled=true`와 `TalkBackService` binding을 확인했고, preview runtime의 `YENA` 화면에서 focus ring이 올라온 상태를 캡처했다.

최종 sign-off는 그래도 `BLOCKED`다. 남은 blocker는 Android가 아니라 iOS VoiceOver evidence다. Simulator 26.2에서는 scriptable VoiceOver toggle을 찾지 못했고, 이번 패스에서 signed physical iPhone preview run까지 마치지는 못했다. 그래서 final verdict는 `Android PASS / iOS VoiceOver BLOCKED`로 좁혀졌다.

## Runtime Matrix
| Target | Result | Evidence | Notes |
| --- | --- | --- | --- |
| iOS largest-text `Calendar` | PASS | `docs/assets/distribution/rn_ios_preview_calendar_after_fix_2026-03-11.png` | month header / summary strip가 화면 밖으로 넘치지 않음 |
| iOS largest-text `Search` | PASS | `docs/assets/distribution/rn_ios_preview_search_after_fix_2026-03-11.png` | native header 중첩 제거, search action row 유지 |
| iOS largest-text `Radar` | PASS | `docs/assets/distribution/rn_ios_preview_radar_after_fix_2026-03-11.png` | filter/action row와 disclosure card가 모두 보임 |
| iOS largest-text `Team Detail` | PASS | `docs/assets/distribution/rn_ios_preview_artist_after_fix_2026-03-11.png` | back action / hero / metadata가 clipping 없이 유지 |
| iOS largest-text `Release Detail` | PASS | `docs/assets/distribution/rn_ios_preview_release_after_fix_2026-03-11.png` | back + team action이 wrap 상태로 유지됨 |
| iOS VoiceOver walkthrough | BLOCKED | menu inspection + no signed physical rerun | Simulator 26.2 기준 scriptable VoiceOver toggle을 찾지 못했고, attached iPhone preview run은 이번 패스 범위 밖 |
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

## Findings
1. largest-text blocker였던 iOS Search surface overflow는 재현되지 않았다.
2. Android preview runtime instability는 app logic보다 QA AVD / snapshot / GPU 조합 영향이 컸다.
3. `idol-song-app-preview-qa-api35` AVD를 cold boot + no snapshot + `swiftshader_indirect`로 띄우면 preview runtime이 다시 기동된다.
4. persisted pending route resume는 Android runtime에서도 artist/release context를 정상 복원하고, 성공 후 key를 비운다.
5. TalkBack은 preview target 위에서 실제 service binding과 focus ring까지 확인됐다.
6. 남은 blocker는 iOS VoiceOver evidence뿐이다.

## Decision
- iOS largest-text layout regression은 해소됐다.
- Android preview runtime / handoff-return / TalkBack result는 sign-off evidence로 인정할 수 있다.
- final accessibility/platform sign-off는 여전히 `NO-GO`지만, 남은 blocker는 iOS VoiceOver final pass 하나로 좁혀졌다.
- follow-up: [#495](https://github.com/iAmSomething/idol-song-app/issues/495)
