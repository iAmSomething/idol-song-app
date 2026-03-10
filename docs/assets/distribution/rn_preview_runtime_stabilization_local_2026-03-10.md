# RN Preview Runtime Stabilization Local Evidence 2026-03-10

## Scope
- Issue: [#488](https://github.com/iAmSomething/idol-song-app/issues/488)
- Branch: `codex/488-stable-preview-qa-runtime`
- Outcome: preview QA runtime stabilized on iOS standalone dev client and Android emulator, release sign-off still `BLOCKED`
- Remaining blocker: [#491](https://github.com/iAmSomething/idol-song-app/issues/491)

## iOS Preview Runtime

### Provisioning
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npx expo install expo-dev-client
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:ios:prebuild
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:ios:sim
```

Observed result:
- preview build installed on `iPhone 16e`
- Expo dev client opened `exp+idol-song-app-mobile-preview://expo-development-client/?url=http%3A%2F%2F192.168.55.173%3A8082`
- Metro bundled `node_modules/expo-router/entry.js`

### Runtime evidence
- `docs/assets/distribution/rn_ios_preview_runtime_loaded_2026-03-10.png`
- `docs/assets/distribution/rn_ios_preview_runtime_calendar_no_menu_2026-03-10.png`
- `docs/assets/distribution/rn_ios_preview_runtime_search_warm_2026-03-10.png`
- `docs/assets/distribution/rn_ios_preview_runtime_radar_2026-03-10.png`
- `docs/assets/distribution/rn_ios_preview_runtime_artist_yena_2026-03-10.png`
- `docs/assets/distribution/rn_ios_preview_runtime_release_yena_2026-03-10.png`

Observed result:
- `Calendar`, `Search`, `Radar`, `YENA team detail`, `LOVE CATCHER release detail` warm-route entry all succeeded
- Expo Go blocker is no longer relevant for preview QA

### Largest-text rerun
```bash
xcrun simctl ui booted content_size accessibility-extra-extra-extra-large
xcrun simctl openurl booted 'idolsongapp-preview://search?q=%EC%B5%9C%EC%98%88%EB%82%98'
```

Evidence:
- `docs/assets/distribution/rn_ios_preview_runtime_search_largest_text_2026-03-10.png`

Result: `BLOCKED`

Observed result:
- Search surface text overlaps and truncates heavily
- dynamic type is not sign-off ready

## Android Preview Runtime

### Provisioning
```bash
brew install --cask android-commandlinetools
yes | "$HOME/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$HOME/Library/Android/sdk" "emulator" "platforms;android-35" "system-images;android-35;google_apis;arm64-v8a"
"$HOME/Library/Android/sdk/cmdline-tools/latest/bin/avdmanager" list avd
"$HOME/Library/Android/sdk/emulator/emulator" -list-avds
```

Observed result:
- AVD created: `idol-song-app-preview-api35`
- emulator boot completed
- `adb devices -l` showed `emulator-5554 device`

### App install and launch
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:android:prebuild
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run qa:preview:android:emu
```

Observed result:
- preview build installed on `idol-song-app-preview-api35`
- Expo dev client opened `exp+idol-song-app-mobile-preview://expo-development-client/?url=http%3A%2F%2F192.168.55.173%3A8083`
- Metro bundled `node_modules/expo-router/entry.js`

### Runtime evidence
- `docs/assets/distribution/rn_android_preview_runtime_calendar_no_menu_2026-03-10.png`
- `docs/assets/distribution/rn_android_preview_runtime_artist_yena_2026-03-10.png`
- `docs/assets/distribution/rn_android_preview_runtime_after_back_2026-03-10.png`

Observed result:
- `Calendar` surface load succeeded
- direct tap to `YENA` team detail succeeded
- hardware back returned to `Calendar`

### Handoff and state restore rerun
```bash
adb shell am start -W -a android.intent.action.VIEW -d 'https://example.com'
adb shell am start -W -n com.anonymous.idolsongappmobile.preview/.MainActivity
```

Evidence:
- `docs/assets/distribution/rn_android_preview_runtime_handoff_return_2026-03-10.png`

Result: `BLOCKED`

Observed result:
- app task returned to foreground
- current detail context was not preserved
- foreground return landed on `Calendar`

### Font scale rerun
```bash
adb shell settings put system font_scale 1.3
adb shell am force-stop com.anonymous.idolsongappmobile.preview
adb shell am start -W -a android.intent.action.VIEW -d 'exp+idol-song-app-mobile-preview://expo-development-client/?url=http%3A%2F%2F192.168.55.173%3A8083' com.anonymous.idolsongappmobile.preview
```

Evidence:
- `docs/assets/distribution/rn_android_preview_runtime_largest_text_2026-03-10.png`

Result: `PARTIAL`

Observed result:
- font scale snapshot captured on runnable emulator target
- no immediate catastrophic overflow observed from this single sample
- TalkBack/manual accessibility pass still not executed

## Conclusion
- Runtime availability blocker is resolved on both iOS and Android.
- Current release blocker moved to actual behavior defects and incomplete accessibility sign-off.
- Follow-up issue: [#491](https://github.com/iAmSomething/idol-song-app/issues/491)
