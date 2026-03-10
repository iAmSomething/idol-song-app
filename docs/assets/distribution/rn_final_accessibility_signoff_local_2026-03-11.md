# RN Final Accessibility Sign-Off Local Evidence 2026-03-11

## Scope
- Issue: [#493](https://github.com/iAmSomething/idol-song-app/issues/493)
- Branch: `codex/493-rn-final-signoff`
- Outcome: Android preview runtime sign-off `PASS`, final preview release-readiness still `BLOCKED`
- Remaining blocker: [#495](https://github.com/iAmSomething/idol-song-app/issues/495)

## Commands

### Preview config and quality gates
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run config:preview
npm run typecheck
npm run lint
```

Result:
- `config:preview`: `PASS`
- `typecheck`: `PASS`
- `lint`: `PASS` (generated `router.d.ts` warning 1건 only)

### Android QA AVD preparation
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run qa:preview:android:avd:prepare
```

Observed result:
- `idol-song-app-preview-qa-api35` AVD 생성 또는 보정 완료
- cold boot / no snapshot / `swiftshader_indirect` / low-RAM settings 적용
- stale `*.lock` files 제거

### Android emulator launch
```bash
"$HOME/Library/Android/sdk/emulator/emulator" \
  -avd idol-song-app-preview-qa-api35 \
  -wipe-data \
  -no-snapshot \
  -no-window \
  -netdelay none \
  -netspeed full \
  -no-boot-anim \
  -no-audio \
  -gpu swiftshader_indirect
```

Observed result:
- emulator boot complete
- preview QA target reused in persistent shell session

### Android preview runtime launch
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npm run qa:preview:android:emu
```

Result: `PASS`

Observed result:
- preview dev client build / install 성공
- app opened to `Calendar`
- evidence:
  - `docs/assets/distribution/rn_android_preview_runtime_calendar_2026-03-11.png`

### Android handoff-return resume verification
```bash
adb exec-out run-as com.anonymous.idolsongappmobile.preview cat databases/RKStorage > /tmp/idol-song-app-RKStorage.sqlite
sqlite3 /tmp/idol-song-app-RKStorage.sqlite "INSERT OR REPLACE INTO catalystLocalStorage(key,value) VALUES(...pending route payload...)"
adb shell am force-stop com.anonymous.idolsongappmobile.preview
adb exec-in run-as com.anonymous.idolsongappmobile.preview sh -lc 'cat > databases/RKStorage' < /tmp/idol-song-app-RKStorage.inject.sqlite
adb shell am start -a android.intent.action.VIEW -d 'exp+idol-song-app-mobile-preview://expo-development-client/?url=http%3A%2F%2F192.168.55.173%3A8083'
```

Result: `PASS`

Observed result:
- artist target `yena` restored after relaunch
- release target `yena--love-catcher--2026-03-11--album` restored after relaunch
- pending route row consumed after success (`pending_count = 0`)
- evidence:
  - `docs/assets/distribution/rn_android_preview_handoff_resume_artist_2026-03-11.png`
  - `docs/assets/distribution/rn_android_preview_handoff_resume_release_2026-03-11.png`

### Android TalkBack walkthrough
```bash
adb shell am start -a android.settings.ACCESSIBILITY_SETTINGS
adb shell dumpsys accessibility > /tmp/idol-song-app-android-talkback-state.txt
```

Result: `PASS`

Observed result:
- Accessibility Settings -> TalkBack -> `Use TalkBack` -> `Allow` 확인 dialog까지 진행
- `touchExplorationEnabled=true`
- `Enabled services`와 `Bound services`에 `TalkBackService` 존재
- preview runtime `YENA` 화면에서 focus ring visible
- evidence:
  - `docs/assets/distribution/rn_android_preview_talkback_enabled_2026-03-11.png`
  - `docs/assets/distribution/rn_android_preview_talkback_yena_2026-03-11.png`

### iOS VoiceOver inspection
```bash
osascript -e 'tell application "System Events" to tell process "Simulator" to get the name of every menu item of menu 1 of menu bar item "Features" of menu bar 1'
osascript -e 'tell application "System Events" to tell process "Simulator" to get the name of every menu item of menu 1 of menu bar item "I/O" of menu bar 1'
osascript -e 'tell application "System Events" to tell process "Simulator" to get the name of every menu item of menu 1 of menu bar item "Device" of menu bar 1'
```

Result: `BLOCKED`

Observed result:
- Simulator 26.2에서 VoiceOver toggle을 scriptable path로 찾지 못함
- attached iPhone hardware는 보였지만, signed preview build rerun까지는 이번 패스 범위에서 수행하지 않음

## Final Verdict
- Android preview runtime: `PASS`
- Android handoff-return: `PASS`
- Android TalkBack: `PASS`
- iOS VoiceOver: `BLOCKED`
- Preview release-readiness: `BLOCKED`
