# RN iOS VoiceOver Sign-Off Local Evidence 2026-03-11

## Scope
- Issue: [#495](https://github.com/iAmSomething/idol-song-app/issues/495)
- Branch: `codex/495-ios-voiceover-signoff`
- Target: runnable iOS preview target 위 final VoiceOver walkthrough
- Verdict: `PASS`

## Preview Runtime

### Metro / dev client attach
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com APP_ENV=preview npx expo start --dev-client --host lan --port 8082
xcrun simctl openurl booted 'exp+idol-song-app-mobile-preview://expo-development-client/?url=http%3A%2F%2F192.168.55.173%3A8082'
```

Observed result:
- booted target: `iPhone 16e` simulator / iOS `26.2`
- preview dev client attached to active runtime
- app surface opened to `Calendar`

## VoiceOver Toggle

### Helper command
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run qa:preview:ios:voiceover:on
npm run qa:preview:ios:voiceover:off
```

Observed result:
- helper compiles a simulator-only Objective-C binary via `xcrun --sdk iphonesimulator clang`
- private accessibility call path:
  - `_AXSVoiceOverTouchSetEnabledAndAutoConfirmUsage`
  - `_AXSVoiceOverTouchSetUIEnabled`
  - `_AXSVoiceOverTouchSetTutorialUsageConfirmed`
  - `_AXSVoiceOverTouchSetUsageConfirmed`
  - `_AXSVoiceOverTouchSetUserHasReadNoHomeButtonGestureDescription`
- on the active preview runtime, VoiceOver enabled without the full-screen onboarding overlay
- focus ring became visible immediately on the current control

## Manual Walkthrough

### Calendar
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run qa:preview:ios:voiceover:off
xcrun simctl openurl booted 'idolsongapp-preview://calendar?month=2026-03'
npm run qa:preview:ios:voiceover:on
xcrun simctl io booted screenshot /Users/gimtaehun/Desktop/idol-song-app/docs/assets/distribution/rn_ios_voiceover_calendar_2026-03-11.png
```

Observed result:
- `2026년 3월` month header visible
- VoiceOver focus ring visible on month header container

### Search
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run qa:preview:ios:voiceover:off
xcrun simctl openurl booted 'idolsongapp-preview://search?q=%EC%B5%9C%EC%98%88%EB%82%98'
npm run qa:preview:ios:voiceover:on
xcrun simctl io booted screenshot /Users/gimtaehun/Desktop/idol-song-app/docs/assets/distribution/rn_ios_voiceover_search_2026-03-11.png
```

Observed result:
- `검색` title visible
- VoiceOver focus ring visible on the title region

### Team Detail
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run qa:preview:ios:voiceover:off
xcrun simctl openurl booted 'idolsongapp-preview://artists/yena'
npm run qa:preview:ios:voiceover:on
xcrun simctl io booted screenshot /Users/gimtaehun/Desktop/idol-song-app/docs/assets/distribution/rn_ios_voiceover_artist_2026-03-11.png
```

Observed result:
- `YENA` team detail visible
- VoiceOver focus ring visible on `뒤로` action

### Release Detail
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run qa:preview:ios:voiceover:off
xcrun simctl openurl booted 'idolsongapp-preview://releases/yena--love-catcher--2026-03-11--album'
npm run qa:preview:ios:voiceover:on
xcrun simctl io booted screenshot /Users/gimtaehun/Desktop/idol-song-app/docs/assets/distribution/rn_ios_voiceover_release_2026-03-11.png
```

Observed result:
- `LOVE CATCHER` release detail visible
- VoiceOver focus ring visible on `뒤로` action

## Notes
- attached physical iPhone preview rerun은 이번 패스에서 다시 수행하지 않았다.
- earlier blocker였던 Xcode signing / provisioning 문제는 여전히 남아 있지만, `#495` acceptance 기준인 runnable iOS preview target은 simulator preview dev client로 충족했다.
- final preview sign-off gate verdict는 `GO`로 갱신했다.
