# RN Release Readiness Gate 2026-03-10

## Decision
- Preview sign-off: `BLOCKED`
- Decision date: `2026-03-10`
- Runtime QA artifact: `rn-runtime-device-qa-2026-03-10.md`
- Blocking follow-up: [#488](https://github.com/iAmSomething/idol-song-app/issues/488)
- Local evidence: `docs/assets/distribution/rn_release_readiness_local_2026-03-10.md`

## Summary
자동 검증과 코드/문서 기반 구조 검증은 통과했다. 다만 preview sign-off 차단 조건인 실제 iOS/Android runtime QA matrix와 VoiceOver/TalkBack, largest text 재검증이 이 환경에서 완료되지 않았다. 따라서 이번 판정은 `GO`가 아니라 `BLOCKED`다.

## Gate Result
| Gate | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Product | PASS | `rn-screen-structure-validation-2026-03-10.md`, `rn-journey-walkthrough-2026-03-10.md` | Calendar, Search, Radar, Team Detail, Release Detail 핵심 플로우 구조와 journey 검증 통과 |
| Data | PASS | `npm test -- --runInBand`, `specParity.test.ts`, `searchTab.test.tsx` | alias search, release detail, month-only separation, backend/bundled fallback contract 자동 검증 통과 |
| UX | PASS | `rn-screen-structure-validation-2026-03-10.md`, `qa-acceptance-spec.md` 기준 regression tests | action hierarchy, empty/error/partial state, sheet/list/grid 구조 유지 |
| Accessibility | BLOCKED | `accessibility-audit-2026-03-09.md` | 코드 레벨 blocker는 해소됐지만 실제 iOS/Android VoiceOver/TalkBack, largest text walkthrough 미실행 |
| Platform | BLOCKED | iOS simulator boot evidence, Android runtime availability check | iOS handoff/gesture, Android hardware back/handoff/state restore를 실제 runtime에서 재검증하지 못함 |
| Test | BLOCKED | `lint`, `typecheck`, `test`, iOS/Android export PASS | 자동 검증은 통과했지만 QA-UC-01~05 manual checklist가 완료되지 않음 |
| Ops | PASS | `config:preview`, export smoke, handoff/analytics guards existing tests | preview runtime config는 required env를 주면 정상 생성됨 |

## Automated Checks
| Check | Result | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL=... npm run config:preview` | PASS | preview profile, backend-api mode, API base URL 포함 config 생성 확인 |
| `npm run lint` | PASS | no lint errors |
| `npm run typecheck` | PASS | no type errors |
| `npm test -- --runInBand` | PASS | `34` suites, `134` tests |
| `npx expo export --platform ios` | PASS | output: `/tmp/idol-song-app-mobile-export-ios-2026-03-10` |
| `npx expo export --platform android` | PASS | output: `/tmp/idol-song-app-mobile-export-android-2026-03-10` |

## Device And Runtime Matrix
| Runtime target | Result | Notes |
| --- | --- | --- |
| iOS Simulator `iPhone 16 Pro` / iOS `18.5` | PARTIAL | simulator boot completed with `xcrun simctl bootstatus`; app-level manual walkthrough는 이 환경에서 미실행 |
| iOS physical device | BLOCKED | `xcrun xcdevice list` 기준 attached iPhone/iPad evidence 없음 |
| Android emulator | BLOCKED | `emulator -list-avds` command unavailable |
| Android physical device | BLOCKED | `adb devices -l` returned no attached devices |

## Blockers
1. `qa-acceptance-spec.md`의 QA-UC-01 ~ QA-UC-05 manual walkthrough 결과가 실제 iOS/Android runtime 기준으로 남아 있지 않다.
2. `accessibility-platform-spec.md` 기준 VoiceOver / TalkBack / largest text 재검증 결과가 없다.
3. Android runtime에서 hardware back, external handoff return, state restoration을 실제로 확인하지 못했다.

## Non-Blockers
1. preview runtime config는 required env(`EXPO_PUBLIC_API_BASE_URL`)를 주면 정상 생성된다.
2. 구조/여정/접근성 코드 레벨 audit에서 현재 구현 blocker는 없다.
3. JS bundle export는 iOS/Android 모두 성공했다.
4. automated regression suite는 현재 기준 clean이다.

## Sign-off Rule
- 아래 세 항목이 모두 채워지기 전까지 preview sign-off는 `NO-GO`다.
  1. iOS runtime manual matrix 결과
  2. Android runtime manual matrix 결과
  3. VoiceOver / TalkBack / largest text walkthrough 결과

## Runtime QA Update
- [#486](https://github.com/iAmSomething/idol-song-app/issues/486)에서 runtime QA 실행을 시도했고, iOS shipping-target simulator launch 자체는 확인했다.
- 세부 결과와 증적은 `rn-runtime-device-qa-2026-03-10.md`에 기록했다.

## Next Step
- [#488](https://github.com/iAmSomething/idol-song-app/issues/488)에서 runtime QA 환경 blocker를 해소한 뒤, 이 문서의 blocker를 `pass` 또는 `non-blocking residual risk`로 갱신한다.
