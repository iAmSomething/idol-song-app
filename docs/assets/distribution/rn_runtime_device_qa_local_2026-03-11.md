# RN Runtime Device QA Local Evidence 2026-03-11

## Scope
- Issues: [#490](https://github.com/iAmSomething/idol-song-app/issues/490), [#491](https://github.com/iAmSomething/idol-song-app/issues/491)
- Branch: `codex/490-491-rn-accessibility-state-restore`
- Outcome: app-side layout/state-restore fix landed, final runtime sign-off still `BLOCKED`
- Remaining blocker: [#493](https://github.com/iAmSomething/idol-song-app/issues/493)

## Quality Gates

### Preview config
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run config:preview
```

Result: `PASS`

Notes:
- output redirected to `/tmp/idol-song-app-mobile-config-preview-2026-03-11.json`
- preview profile / backend API base URL resolution 확인

### Static validation
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run typecheck
npm run lint
npm test -- --runInBand
```

Result:
- `typecheck`: `PASS`
- `lint`: `PASS` (generated file warning 1건 only)
- `test`: `PASS`

Test summary:
- Suites: `35`
- Tests: `139`
- Failed: `0`

Lint note:
- `mobile/.expo/types/router.d.ts`
- warning: `Unused eslint-disable directive`
- exit code는 `0`

## iOS Preview Runtime

### Runtime server
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npx expo start --dev-client --host lan --port 8082
```

Observed result:
- Metro started on `http://192.168.55.173:8082`
- installed preview dev client reused on booted `iPhone 16e`

### Largest-text rerun
```bash
xcrun simctl ui booted content_size accessibility-extra-extra-extra-large
xcrun simctl openurl booted 'idolsongapp-preview://calendar?month=2026-03'
xcrun simctl openurl booted 'idolsongapp-preview://search?q=%EC%B5%9C%EC%98%88%EB%82%98'
xcrun simctl openurl booted 'idolsongapp-preview://radar'
xcrun simctl openurl booted 'idolsongapp-preview://artists/yena'
xcrun simctl openurl booted 'idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album'
```

Evidence:
- `docs/assets/distribution/rn_ios_preview_calendar_after_fix_2026-03-11.png`
- `docs/assets/distribution/rn_ios_preview_search_after_fix_2026-03-11.png`
- `docs/assets/distribution/rn_ios_preview_radar_after_fix_2026-03-11.png`
- `docs/assets/distribution/rn_ios_preview_artist_after_fix_2026-03-11.png`
- `docs/assets/distribution/rn_ios_preview_release_after_fix_2026-03-11.png`

Result: `PASS`

Observed result:
- Search native header overlap disappeared
- Calendar month header and summary strip no longer break outside the viewport
- Release detail trailing action wraps instead of clipping
- Team/release/detail entry points stay visually navigable under largest-text

### VoiceOver inspection attempt
```bash
osascript -e 'tell application "System Events" to tell process "Simulator" to get the name of every menu item of menu 1 of menu bar item "Features" of menu bar 1'
osascript -e 'tell application "System Events" to tell process "Simulator" to get the name of every menu item of menu 1 of menu bar item "I/O" of menu bar 1'
```

Result: `BLOCKED`

Observed result:
- `Features` menu exposed text-size controls but no scriptable `VoiceOver` toggle
- `I/O` menu에도 VoiceOver/TTS toggle이 없음
- working simulator target 위에서 manual VoiceOver pass를 automation-friendly 방식으로 남기지 못함

## Android Preview Runtime

### Emulator launch
```bash
"$HOME/Library/Android/sdk/emulator/emulator" -avd idol-song-app-preview-api35 -netdelay none -netspeed full -no-snapshot-save -no-boot-anim -no-audio
```

Observed result:
- emulator process started
- cold boot progressed slowly and stayed on `Pixel is starting...`

### Preview install rerun
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npm run qa:preview:android:emu
```

Result: `BLOCKED`

Observed error:
- `adb: failed to install ... app-debug.apk: cmd: Failure calling service package: Broken pipe (32)`

### Runtime evidence
```bash
adb -s emulator-5554 emu screenrecord screenshot /Users/gimtaehun/Desktop/idol-song-app/docs/assets/distribution/rn_android_preview_runtime_check_2026-03-11.png
```

Evidence:
- `docs/assets/distribution/rn_android_preview_runtime_check_2026-03-11.png`

Result: `BLOCKED`

Observed result:
- emulator surfaced `System UI isn't responding`
- Android preview target did not reach a stable app state

## State-Restore Evidence
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm test -- --runInBand src/services/routeResume.test.ts src/features/route-shell.smoke.test.tsx
```

Result: `PASS`

Observed result:
- pending route resume is persisted, consumed once, and cleared on failure
- root route restores saved target instead of unconditional Calendar redirect

## Conclusion
- iOS largest-text blocker is fixed.
- Android runtime sign-off is still blocked by emulator instability, not by the JS route-resume logic.
- Manual VoiceOver / TalkBack evidence is still missing.
- Follow-up issue: [#493](https://github.com/iAmSomething/idol-song-app/issues/493)
