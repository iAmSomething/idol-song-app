# RN Runtime Device QA 2026-03-11

## Scope
- Issues: [#490](https://github.com/iAmSomething/idol-song-app/issues/490), [#491](https://github.com/iAmSomething/idol-song-app/issues/491)
- Goal: preview runtime 기준으로 largest-text, state-restore, screen-reader sign-off를 다시 검증
- Decision: `BLOCKED`
- Remaining blocker follow-up: [#493](https://github.com/iAmSomething/idol-song-app/issues/493)

## Summary
앱 코드 기준 largest-text와 state-restore 수정은 들어갔다. iOS preview runtime에서 `accessibility-extra-extra-extra-large`를 다시 적용한 뒤 `Calendar`, `Search`, `Radar`, `YENA team detail`, `LOVE CATCHER release detail`을 확인했을 때 더 이상 blocking overflow는 재현되지 않았다. 탭/상세 route의 native header를 제거했고, shared `AppBar`/button/segment/summary strip에서 fixed `lineHeight`와 폭 제약을 줄인 결과다.

다만 최종 sign-off는 여전히 `BLOCKED`다. Android preview rerun은 cold boot가 `Pixel is starting...`에서 오래 걸린 뒤 `expo run:android` install 단계에서 `Broken pipe`로 끊겼고, 이후 emulator는 `System UI isn't responding` 상태를 보였다. VoiceOver / TalkBack manual walkthrough도 working target 위에서 clean pass로 남기지 못했다. 앱 쪽 route-resume 로직은 unit/smoke test로 통과했지만, Android device runtime에서 handoff-return을 다시 끝까지 확인하지는 못했다.

## Runtime Matrix
| Target | Result | Evidence | Notes |
| --- | --- | --- | --- |
| iOS largest-text `Calendar` | PASS | `docs/assets/distribution/rn_ios_preview_calendar_after_fix_2026-03-11.png` | month header / summary strip가 화면 밖으로 넘치지 않음 |
| iOS largest-text `Search` | PASS | `docs/assets/distribution/rn_ios_preview_search_after_fix_2026-03-11.png` | native header 중첩 제거, search action row 유지 |
| iOS largest-text `Radar` | PASS | `docs/assets/distribution/rn_ios_preview_radar_after_fix_2026-03-11.png` | filter/action row와 disclosure card가 모두 보임 |
| iOS largest-text `Team Detail` | PASS | `docs/assets/distribution/rn_ios_preview_artist_after_fix_2026-03-11.png` | back action / hero / metadata가 clipping 없이 유지 |
| iOS largest-text `Release Detail` | PASS | `docs/assets/distribution/rn_ios_preview_release_after_fix_2026-03-11.png` | back + team action이 wrap 상태로 유지됨 |
| iOS VoiceOver walkthrough | BLOCKED | menu inspection only | Simulator 26.2 기준 scriptable VoiceOver toggle을 찾지 못해 manual pass를 기록하지 못함 |
| Android preview runtime launch | BLOCKED | `docs/assets/distribution/rn_android_preview_runtime_check_2026-03-11.png` | emulator가 `System UI isn't responding` 상태로 멈춤 |
| Android external handoff return | BLOCKED | route-resume tests only | 앱 로직 테스트는 PASS지만 working emulator target에서 device rerun은 미완료 |
| Android TalkBack walkthrough | BLOCKED | none | runnable target 부재로 manual pass 미기록 |

## Executed Checks
1. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npx expo start --dev-client --host lan --port 8082`
2. `xcrun simctl ui booted content_size accessibility-extra-extra-extra-large`
3. `xcrun simctl openurl booted 'idolsongapp-preview://calendar?month=2026-03'`
4. `xcrun simctl openurl booted 'idolsongapp-preview://search?q=%EC%B5%9C%EC%98%88%EB%82%98'`
5. `xcrun simctl openurl booted 'idolsongapp-preview://radar'`
6. `xcrun simctl openurl booted 'idolsongapp-preview://artists/yena'`
7. `xcrun simctl openurl booted 'idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album'`
8. `osascript`로 `Simulator` 메뉴 바를 검사해 `Features` / `I/O` 아래 accessibility 관련 toggle 존재 여부 확인
9. `"$HOME/Library/Android/sdk/emulator/emulator" -avd idol-song-app-preview-api35 -netdelay none -netspeed full -no-snapshot-save -no-boot-anim -no-audio`
10. `cd mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npm run qa:preview:android:emu`
11. `adb -s emulator-5554 emu screenrecord screenshot docs/assets/distribution/rn_android_preview_runtime_check_2026-03-11.png`

## Findings
1. largest-text blocker였던 iOS Search surface overflow는 재현되지 않았다.
2. 탭과 detail route에서 native header를 제거해야 dynamic type에서 custom app bar와 충돌하지 않는다.
3. `SummaryStrip`은 좁은 화면에서 full-width card로 떨어뜨려야 largest-text에서 의미를 유지한다.
4. route-resume 로직은 `routeResume.test.ts`와 `route-shell.smoke.test.tsx` 기준으로는 정상이다.
5. Android preview rerun blocker는 현재 앱 로직보다는 emulator runtime 안정성 쪽이다.
6. VoiceOver / TalkBack manual pass는 working runtime target과 scriptable toggle이 확보되기 전까지 sign-off evidence로 둘 수 없다.

## Decision
- iOS largest-text layout regression은 해소됐다.
- final accessibility/platform sign-off는 아직 `NO-GO`다.
- 남은 액션은 [#493](https://github.com/iAmSomething/idol-song-app/issues/493)에서 Android preview runtime 안정화 후 TalkBack / handoff-return / final screen-reader pass를 다시 기록하는 것이다.
