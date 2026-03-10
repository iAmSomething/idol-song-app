# RN Release Readiness Gate 2026-03-11

## Decision
- Preview sign-off: `BLOCKED`
- Decision date: `2026-03-11`
- Runtime QA artifact: `rn-runtime-device-qa-2026-03-11.md`
- Blocking follow-up: [#493](https://github.com/iAmSomething/idol-song-app/issues/493)
- Local evidence: `docs/assets/distribution/rn_release_readiness_local_2026-03-11.md`

## Summary
이번 rerun에서 iOS largest-text blocker는 해소됐다. `Calendar`, `Search`, `Radar`, `Team Detail`, `Release Detail`을 preview runtime + `accessibility-extra-extra-extra-large`로 다시 열어도 더 이상 blocking overflow가 남지 않았다. Android external handoff return을 위해 필요한 route-resume 로직도 앱 코드와 테스트 기준으로는 들어갔다.

하지만 preview sign-off는 아직 `GO`가 아니다. Android preview runtime이 2026-03-11 cold boot에서 `Pixel is starting...`에 오래 머물렀고, install rerun은 `Broken pipe`, runtime surface는 `System UI isn't responding`로 무너졌다. VoiceOver / TalkBack manual walkthrough도 clean recorded pass가 아직 없다. 따라서 blocker는 이전의 앱 레이아웃 결함이 아니라, 남은 runtime/accessibility sign-off evidence 쪽으로 좁혀졌다.

## Gate Result
| Gate | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Product | PASS | `rn-screen-structure-validation-2026-03-10.md`, `rn-journey-walkthrough-2026-03-10.md` | core surfaces and journeys unchanged |
| Data | PASS | `npm test -- --runInBand`, `specParity.test.ts`, `routeResume.test.ts` | selector parity, fallback contract, route-resume logic all pass |
| UX | PASS | `rn-runtime-device-qa-2026-03-11.md` | iOS largest-text rerun no longer shows blocking layout failure |
| Accessibility | BLOCKED | `rn-runtime-device-qa-2026-03-11.md` | VoiceOver / TalkBack manual walkthrough not yet recorded |
| Platform | BLOCKED | `rn-runtime-device-qa-2026-03-11.md` | Android preview runtime unstable, so device handoff-return rerun incomplete |
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
| iOS simulator `iPhone 16e` / iOS `26.2` | PASS | largest-text rerun on five representative surfaces completed |
| iOS physical device | PARTIAL | attached iPhone/iPad evidence still 없음 |
| Android emulator `idol-song-app-preview-api35` | BLOCKED | cold boot + `System UI isn't responding` prevented stable rerun |
| Android physical device | BLOCKED | attached device evidence 없음 |

## Blockers
1. Android preview runtime is not stable enough to finish the external handoff-return rerun.
2. VoiceOver / TalkBack manual walkthrough is still missing from sign-off evidence.

## Resolved Since 2026-03-10
1. Search surface largest-text overlap is fixed.
2. Calendar month header and summary strip no longer break outside the viewport.
3. Detail surfaces no longer stack native header and custom app bar together.
4. Route-resume logic now preserves pending target in app state and restores it at the root entry point.

## Next Step
- [#493](https://github.com/iAmSomething/idol-song-app/issues/493)에서 Android preview runtime 안정화를 다시 확보한 뒤, handoff-return / TalkBack / VoiceOver final sign-off를 기록한다.
