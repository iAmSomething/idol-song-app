# RN Release Readiness Gate 2026-03-11

## Decision
- Preview sign-off: `BLOCKED`
- Decision date: `2026-03-11`
- Runtime QA artifact: `rn-runtime-device-qa-2026-03-11.md`
- Blocking follow-up: [#495](https://github.com/iAmSomething/idol-song-app/issues/495)
- Local evidence: `docs/assets/distribution/rn_final_accessibility_signoff_local_2026-03-11.md`

## Summary
이번 rerun에서 iOS largest-text blocker는 해소된 상태를 유지했고, Android 쪽 remaining blocker도 실제로 다시 검증했다. fresh QA AVD로 preview dev client를 다시 띄워 `Calendar` 진입을 확인했고, persisted pending route resume를 Android runtime 위에서 `YENA team detail` / `LOVE CATCHER release detail` 두 경로로 다시 검증했다. TalkBack도 preview target 위에서 실제로 bound service + focus ring evidence를 남겼다.

하지만 preview sign-off는 아직 `GO`가 아니다. 남은 blocker는 Android가 아니라 iOS VoiceOver evidence 하나다. Simulator 26.2에서는 scriptable VoiceOver toggle을 찾지 못했고, 이번 패스에서 signed physical iPhone preview rerun까지 마치지는 못했다. 따라서 blocker는 `iOS VoiceOver final pass` 한 건으로 좁혀졌다.

## Gate Result
| Gate | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Product | PASS | `rn-screen-structure-validation-2026-03-10.md`, `rn-journey-walkthrough-2026-03-10.md` | core surfaces and journeys unchanged |
| Data | PASS | `npm test -- --runInBand`, `specParity.test.ts`, `routeResume.test.ts` | selector parity, fallback contract, route-resume logic all pass |
| UX | PASS | `rn-runtime-device-qa-2026-03-11.md` | iOS largest-text rerun no longer shows blocking layout failure |
| Accessibility | BLOCKED | `rn-runtime-device-qa-2026-03-11.md` | Android TalkBack는 기록됐지만 iOS VoiceOver evidence가 아직 없음 |
| Platform | PASS | `rn-runtime-device-qa-2026-03-11.md` | Android preview runtime and handoff-return rerun completed |
| Test | PASS | `typecheck`, `lint`, `test -- --runInBand` | `35` suites / `139` tests clean |
| Ops | PASS | `config:preview`, preview dev-client runtime reuse | preview config still resolves backend API mode correctly |

## Automated Checks
| Check | Result | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL=... npm run config:preview` | PASS | output saved to `/tmp/idol-song-app-mobile-config-preview-2026-03-11.json` |
| `npm run typecheck` | PASS | no type errors |
| `npm run lint` | PASS | generated `router.d.ts` warning 1건 only |
| `npm test -- --runInBand` | PASS | `35` suites, `139` tests |

## Device And Runtime Matrix
| Runtime target | Result | Notes |
| --- | --- | --- |
| iOS simulator `iPhone 16e` / iOS `26.2` | PARTIAL | largest-text rerun은 PASS, VoiceOver manual pass는 미완료 |
| iOS physical device | BLOCKED | attached iPhone visibility는 확인했지만 signed preview rerun evidence 없음 |
| Android emulator `idol-song-app-preview-qa-api35` | PASS | fresh QA AVD + preview dev client runtime / handoff-return / TalkBack 확인 |
| Android physical device | N/A | emulator evidence로 이번 gate 범위 충족 |

## Blockers
1. iOS VoiceOver manual walkthrough evidence is still missing from a runnable preview target.

## Resolved Since 2026-03-10
1. Search surface largest-text overlap is fixed.
2. Calendar month header and summary strip no longer break outside the viewport.
3. Detail surfaces no longer stack native header and custom app bar together.
4. Route-resume logic now preserves pending target in app state and restores it at the root entry point.
5. Android preview runtime relaunch is stable enough to reach the app surface again.
6. Android handoff-return preserves artist/release context on runtime rerun.
7. Android TalkBack result is now recorded on the preview target.

## Next Step
- [#495](https://github.com/iAmSomething/idol-song-app/issues/495)에서 runnable iOS preview target 위 VoiceOver final pass를 기록한 뒤 gate를 최종 판정한다.
