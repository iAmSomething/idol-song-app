# Mobile Web Handoff QA Matrix

이 문서는 웹의 모바일 handoff가 어떤 브라우저 컨텍스트에서 무엇을 보장하고, 어디서부터 best-effort인지 명시한다.
핵심 목적은 `Spotify`, `YouTube Music`, `YouTube MV` handoff가 서비스별로 다르게 동작한다는 점을 ad hoc으로 발견하지 않게 만드는 것이다.

## 범위

- Android Chrome
- iOS Safari
- representative iOS in-app browser
- app installed / not installed
- canonical URL / search fallback URL

## 기준 구현

- production helper: `web/src/lib/mobileWebHandoff.ts`
- UI entrypoint: `web/src/App.tsx`
- evidence generator: `web/scripts/build-mobile-web-handoff-qa-matrix.ts`

이 이슈의 QA evidence는 실제 handoff helper에서 직접 파생된다.
즉 handoff 규칙이 바뀌면 matrix도 같은 helper를 통해 다시 생성해야 한다.

## 서비스 차이

### Spotify

- Android Chrome: `spotify:` URI로 app-first를 시도하고, 브라우저가 그대로 남아 있으면 동일 서비스 웹으로 fallback 한다.
- iOS Safari: `spotify:` custom scheme로 app-first를 시도하고, Safari가 계속 visible이면 동일 서비스 웹으로 fallback 한다.
- search fallback도 여전히 Spotify search URL을 사용한다.

### YouTube Music

- Android Chrome: Android intent 기반 app-first가 있다.
- iOS Safari: 현재 웹 구현에는 iOS용 app-aware YouTube Music path가 없다.
- 따라서 iOS에서는 앱 설치 여부와 무관하게 web-only로 취급한다.

### YouTube MV

- Android Chrome: Android intent 기반 app-first가 있다.
- iOS Safari: `vnd.youtube://` custom scheme로 app-first를 시도한다.
- iOS in-app browser: 외부 앱 점프가 container policy에 막힐 수 있으므로 best-effort로만 취급한다.

## QA 클래스

- `expected`
  - 현재 구현에 app-first path가 있고, app-open 실패 시 동일 서비스 웹 fallback이 계속 가능해야 한다.
- `best_effort`
  - 현재 구현은 app-first를 시도하지만, browser/container 정책이 external-app jump를 막을 수 있다.
  - QA는 browser가 visible로 남을 때 동일 서비스 웹 fallback이 계속 동작하는지 본다.
- `web_only`
  - 현재 구현에 app-aware path가 없어서, 설치 여부와 무관하게 동일 서비스 웹 URL이 정답이다.

## Evidence Artifact

- markdown: `web/reports/mobile-web-handoff-qa-matrix.md`
- json: `web/reports/mobile-web-handoff-qa-matrix.json`

두 파일은 아래 명령으로 재생성한다.

```bash
cd web
npm run verify:mobile-web-handoff-qa
```

## 운영 규칙

1. handoff helper를 바꾸면 같은 PR에서 matrix artifact도 다시 생성한다.
2. iOS YouTube Music가 web-only인 상태는 의도된 현재 계약으로 간주한다.
3. in-app browser row는 "지원 보장"이 아니라 "대표 best-effort 검증 row"로 읽는다.
4. 실제 단말 재검증을 할 때도 service / mode / install-state row는 이 matrix 구조를 그대로 유지한다.
