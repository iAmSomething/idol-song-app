# RN Android Post-Review Audit Local Evidence 2026-03-11

## Scope
- Issues: [#549](https://github.com/iAmSomething/idol-song-app/issues/549), [#550](https://github.com/iAmSomething/idol-song-app/issues/550), [#551](https://github.com/iAmSomething/idol-song-app/issues/551)
- Branch: `codex/rn-android-device-polish`
- Goal: Android preview runtime 위에서 layout fit / inset / bottom-sheet / density polish를 다시 확인하고, 최근 mobile chrome 변경 이후 regression이 없는지 evidence를 남긴다.
- Decision: `PASS`

## Device Matrix
| Target | Value |
| --- | --- |
| Emulator | `idol-song-app-preview-qa-api35` |
| Device profile | `Pixel 8` |
| Android | `API 35` |
| Navigation mode | gesture navigation |
| Orientation | portrait |
| Font scale | `1.3` |
| Runtime | preview dev client + backend API preview target |

## Executed Checks
1. `cd /Users/gimtaehun/Desktop/idol-song-app/mobile && npm run qa:preview:android:avd:prepare`
2. `"$HOME/Library/Android/sdk/emulator/emulator" -avd idol-song-app-preview-qa-api35 -wipe-data -no-snapshot -no-window -netdelay none -netspeed full -no-boot-anim -no-audio -gpu swiftshader_indirect`
3. `cd /Users/gimtaehun/Desktop/idol-song-app/mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npm run qa:preview:android:emu`
4. `adb shell settings put system font_scale 1.3`
5. Deep link + screenshot pass
   - `idolsongapp-preview://calendar?month=2026-03`
   - `idolsongapp-preview://search?q=%EC%B5%9C%EC%98%88%EB%82%98`
   - `idolsongapp-preview://radar`
   - `idolsongapp-preview://artists/yena`
   - `idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album`
6. Calendar filter sheet manual open
   - `adb shell input tap ...`
7. `adb exec-out screencap -p > ...`

## Evidence
| Surface | Result | Evidence |
| --- | --- | --- |
| Calendar main | PASS | `docs/assets/distribution/rn_android_calendar_2026-03-11.png` |
| Calendar filter sheet | PASS | `docs/assets/distribution/rn_android_calendar_filter_sheet_2026-03-11.png` |
| Search | PASS | `docs/assets/distribution/rn_android_search_2026-03-11.png` |
| Radar | PASS | `docs/assets/distribution/rn_android_radar_2026-03-11.png` |
| Team detail (`YENA`) | PASS | `docs/assets/distribution/rn_android_artist_2026-03-11.png` |
| Release detail (`LOVE CATCHER`) | PASS | `docs/assets/distribution/rn_android_release_2026-03-11.png` |

## Findings
1. Calendar, Search, Radar, Team Detail, Release Detail 모두 상단 status bar 아래로 밀리지 않고 safe-area top inset을 반영한다.
2. tab chrome은 gesture bar 위에서 잘리고 있지 않고, bottom padding이 살아 있어 마지막 row/action이 navigation area에 묻히지 않는다.
3. calendar filter sheet는 bottom gesture area를 침범하지 않고, 닫기/초기화/적용 액션이 모두 reachable 상태로 남는다.
4. release detail 상단 action row는 Android preview에서 wrap 상태를 유지하고 clipping 없이 보인다.
5. team detail의 hero / official links / next upcoming block은 font scale `1.3`에서도 vertical scan이 가능하다.
6. radar top action row와 summary strip은 Android narrow viewport에서 한 화면 안에 남는다.
7. preview dev client의 floating `Tools` 버튼은 우상단에 남지만 product UI가 아니라 dev-client overlay다. 앱 chrome regression으로 보지 않는다.
8. search keyboard overlap은 이번 representative matrix에서 blocking issue로 재현되지 않았다. 추가로 `keyboardDismissMode="on-drag"`를 넣어 stuck keyboard 상태를 줄였다.

## Implemented Fixes Tied To This Audit
1. app root에 `SafeAreaProvider`를 연결했다.
2. `useOptionalSafeAreaInsets`로 runtime/provider 부재 상황에서도 zero inset fallback을 유지했다.
3. tab layout에 bottom inset padding과 height 보정을 넣었다.
4. `calendar/search/radar/entity/release` scroll container에 top/bottom inset 기반 padding을 넣었다.
5. `BottomSheetFrame`에 Android `statusBarTranslucent` / `navigationBarTranslucent`, inset-aware padding, runtime max-height를 넣었다.
6. `ScreenFeedbackState`도 inset-aware container로 바꿔 loading/empty/error 상태가 system bar와 붙지 않게 했다.

## Conclusion
- Android post-review audit 기준 blocking layout issue는 재현되지 않았다.
- remaining visible oddity는 preview dev client의 floating `Tools` button뿐이며, 앱 UI regression이 아니라 QA runtime overlay다.
- `#549`, `#550`, `#551`은 close 가능한 상태다.
