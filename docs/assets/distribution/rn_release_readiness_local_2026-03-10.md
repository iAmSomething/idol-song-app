# RN Release Readiness Local Evidence 2026-03-10

## Scope
- Issue: [#454](https://github.com/iAmSomething/idol-song-app/issues/454)
- Branch: `codex/454-rn-release-readiness-gate`
- Target: preview sign-off 전 RN release-readiness gate 실행

## Commands

### Preview config
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run config:preview
```

Result: `PASS`

Notes:
- `name`: `Idol Song App (Preview)`
- `extra.mobileProfile`: `preview`
- `extra.runtimeConfig.services.apiBaseUrl`: `https://api.idol-song-app.example.com/`
- `extra.runtimeConfig.dataSource.mode`: `backend-api`

### Quality gates
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run lint
npm run typecheck
npm test -- --runInBand
```

Result:
- `lint`: `PASS`
- `typecheck`: `PASS`
- `test`: `PASS`

Test summary:
- Suites: `34`
- Tests: `134`
- Failed: `0`

### Static export smoke
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npx expo export --platform ios --output-dir /tmp/idol-song-app-mobile-export-ios-2026-03-10
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npx expo export --platform android --output-dir /tmp/idol-song-app-mobile-export-android-2026-03-10
```

Result:
- iOS export: `PASS`
- Android export: `PASS`

Outputs:
- `/tmp/idol-song-app-mobile-export-ios-2026-03-10`
- `/tmp/idol-song-app-mobile-export-android-2026-03-10`

## Runtime Availability Checks

### iOS simulator inventory
```bash
xcrun simctl list devices available
xcrun xcdevice list
```

Result:
- available simulator confirmed: `iPhone 16 Pro` / iOS `18.5`
- attached physical iOS device evidence: none

### iOS simulator boot
```bash
xcrun simctl boot 'iPhone 16 Pro'
xcrun simctl bootstatus 'iPhone 16 Pro' -b
xcrun simctl shutdown 'iPhone 16 Pro'
```

Result: `PASS`

Notes:
- bootstatus finished after simulator-side migration/bootstrap
- this proves simulator runtime availability only
- app-level manual walkthrough was not executed in this environment

### Android runtime inventory
```bash
emulator -list-avds
adb devices -l
```

Result:
- `emulator -list-avds`: `BLOCKED` (`command not found`)
- `adb devices -l`: `BLOCKED` (no attached devices)

## Manual QA Matrix Status
| Scenario | iOS | Android | Notes |
| --- | --- | --- | --- |
| QA-UC-01 Calendar Drill-in | NOT RUN | BLOCKED | runtime interaction evidence missing |
| QA-UC-02 Empty Day | NOT RUN | BLOCKED | runtime interaction evidence missing |
| QA-UC-03 Alias Search | NOT RUN | BLOCKED | backend/search logic auto-tested, manual runtime not executed |
| QA-UC-04 Team Detail Hub | NOT RUN | BLOCKED | runtime interaction evidence missing |
| QA-UC-05 Release Detail Consumption | NOT RUN | BLOCKED | runtime interaction evidence missing |

## Accessibility / Platform Status
- Code-level accessibility audit: `PASS`
  - ref: `docs/specs/mobile/accessibility-audit-2026-03-09.md`
- VoiceOver / TalkBack walkthrough on actual runtime: `BLOCKED`
- largest text walkthrough on actual runtime: `BLOCKED`
- iOS swipe-back / sheet gesture runtime QA: `NOT RUN`
- Android hardware back / handoff return / state restore runtime QA: `BLOCKED`

## Conclusion
- Automated and document-backed readiness signals are strong.
- Preview sign-off remains `BLOCKED` because the device matrix and accessibility/platform walkthrough are incomplete.
- Follow-up issue: [#486](https://github.com/iAmSomething/idol-song-app/issues/486)
