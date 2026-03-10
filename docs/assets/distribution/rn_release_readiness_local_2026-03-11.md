# RN Release Readiness Local Evidence 2026-03-11

## Scope
- Issues: [#490](https://github.com/iAmSomething/idol-song-app/issues/490), [#491](https://github.com/iAmSomething/idol-song-app/issues/491)
- Branch: `codex/490-491-rn-accessibility-state-restore`
- Target: preview sign-off gate rerun after largest-text/state-restore fixes

## Commands

### Preview config
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com npm run config:preview
```

Result: `PASS`

### Quality gates
```bash
cd /Users/gimtaehun/Desktop/idol-song-app/mobile
npm run typecheck
npm run lint
npm test -- --runInBand
```

Result:
- `typecheck`: `PASS`
- `lint`: `PASS` (generated warning only)
- `test`: `PASS`

Test summary:
- Suites: `35`
- Tests: `139`
- Failed: `0`

### Runtime QA artifact
- `docs/specs/mobile/rn-runtime-device-qa-2026-03-11.md`

Runtime verdict:
- iOS largest-text: `PASS`
- Android runtime / handoff rerun: `BLOCKED`
- VoiceOver / TalkBack manual pass: `BLOCKED`

## Decision
- preview sign-off remains `BLOCKED`
- remaining blocker follow-up: [#493](https://github.com/iAmSomething/idol-song-app/issues/493)
