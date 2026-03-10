# RN Release Readiness Gate 2026-03-10

## Decision
- Preview sign-off: `BLOCKED`
- Decision date: `2026-03-10`
- Runtime QA artifact: `rn-runtime-device-qa-2026-03-10.md`
- Blocking follow-up: [#491](https://github.com/iAmSomething/idol-song-app/issues/491)
- Local evidence: `docs/assets/distribution/rn_preview_runtime_stabilization_local_2026-03-10.md`

## Summary
자동 검증과 코드/문서 기반 구조 검증은 통과했고, `#488`에서 iOS standalone dev client와 Android emulator 기반 preview runtime도 실제로 다시 세웠다. 그래서 이전처럼 “runtime target이 없다”는 상태는 더 이상 blocker가 아니다. 다만 rerun 결과 iOS largest-text overflow와 Android external handoff/state-restore reset이 새 blocker로 드러났고, VoiceOver / TalkBack manual pass도 아직 clean하게 남지 않았다. 따라서 이번 판정은 여전히 `GO`가 아니라 `BLOCKED`다.

## Gate Result
| Gate | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Product | PASS | `rn-screen-structure-validation-2026-03-10.md`, `rn-journey-walkthrough-2026-03-10.md` | Calendar, Search, Radar, Team Detail, Release Detail 핵심 플로우 구조와 journey 검증 통과 |
| Data | PASS | `npm test -- --runInBand`, `specParity.test.ts`, `searchTab.test.tsx` | alias search, release detail, month-only separation, backend/bundled fallback contract 자동 검증 통과 |
| UX | PASS | `rn-screen-structure-validation-2026-03-10.md`, `qa-acceptance-spec.md` 기준 regression tests | action hierarchy, empty/error/partial state, sheet/list/grid 구조 유지 |
| Accessibility | BLOCKED | `rn-runtime-device-qa-2026-03-10.md` | iOS largest-text overflow 발생, VoiceOver / TalkBack clean pass 미완료 |
| Platform | BLOCKED | `rn-runtime-device-qa-2026-03-10.md` | Android external handoff return이 current detail context를 유지하지 못함 |
| Test | PASS | `lint`, `typecheck`, `test`, iOS/Android export PASS, runtime rerun artifact | 자동 검증과 runtime rerun 자체는 완료 |
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
| iOS Simulator `iPhone 16e` / iOS `26.2` | PASS | standalone preview dev client에서 `Calendar`, `Search`, `Radar`, `Team Detail`, `Release Detail` rerun 완료 |
| iOS physical device | PARTIAL | 필수 blocker는 아니지만 attached iPhone/iPad evidence는 여전히 없음 |
| Android emulator | PASS | `idol-song-app-preview-api35` AVD provision + preview build install/open 완료 |
| Android physical device | BLOCKED | `adb devices -l` returned no attached devices |

## Blockers
1. iOS `accessibility-extra-extra-extra-large`에서 Search 화면이 sign-off 불가 수준으로 깨진다.
2. Android external handoff return이 마지막 상세 컨텍스트를 유지하지 못하고 `Calendar` 루트로 되돌린다.
3. VoiceOver / TalkBack manual walkthrough 결과가 아직 clean pass로 기록되지 않았다.

## Non-Blockers
1. preview runtime config는 required env(`EXPO_PUBLIC_API_BASE_URL`)를 주면 정상 생성된다.
2. iOS standalone dev client와 Android emulator target은 둘 다 실제로 provision 가능하다.
3. 구조/여정/접근성 코드 레벨 audit에서 현재 구현 blocker는 없다.
4. JS bundle export는 iOS/Android 모두 성공했다.
5. automated regression suite는 현재 기준 clean이다.

## Sign-off Rule
- 아래 세 항목이 모두 채워지기 전까지 preview sign-off는 `NO-GO`다.
  1. largest-text overflow fix 확인
  2. Android handoff/state-restore fix 확인
  3. VoiceOver / TalkBack walkthrough 결과

## Runtime QA Update
- [#488](https://github.com/iAmSomething/idol-song-app/issues/488)에서 runtime QA 환경을 안정화했고, iOS standalone dev client와 Android emulator rerun을 완료했다.
- 세부 결과와 증적은 `rn-runtime-device-qa-2026-03-10.md`에 기록했다.

## Next Step
- [#491](https://github.com/iAmSomething/idol-song-app/issues/491)에서 accessibility/state-restore blocker를 해소한 뒤, 이 문서의 blocker를 `pass` 또는 `non-blocking residual risk`로 갱신한다.
