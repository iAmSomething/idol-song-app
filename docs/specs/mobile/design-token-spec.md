# Design Token Spec

## 1. 목적
이 문서는 모바일 앱 구현 시 사용할 디자인 토큰의 네이밍 규칙과 역할을 정의한다.
구체 값은 추후 디자인 시스템 또는 구현 상황에 맞춰 결정하되, semantic token naming은 여기서 고정한다.

## 2. 원칙
- raw color/size 값을 화면 컴포넌트에 직접 쓰지 않는다.
- semantic token을 우선 사용한다.
- 서비스 브랜드 컬러도 semantic wrapper를 통해 적용한다.

## 3. Color Tokens

### 3.1 Surface
- `surface/base`
- `surface/elevated`
- `surface/subtle`
- `surface/overlay`
- `surface/interactive`

### 3.2 Text
- `text/primary`
- `text/secondary`
- `text/tertiary`
- `text/inverse`
- `text/brand`
- `text/danger`

### 3.3 Border
- `border/default`
- `border/subtle`
- `border/strong`
- `border/focus`

### 3.4 Status
- `status/scheduled/bg`
- `status/scheduled/text`
- `status/confirmed/bg`
- `status/confirmed/text`
- `status/rumor/bg`
- `status/rumor/text`
- `status/title/bg`
- `status/title/text`

### 3.5 Service Tint
- `service/spotify/bg`
- `service/spotify/icon`
- `service/youtube-music/bg`
- `service/youtube-music/icon`
- `service/youtube-mv/bg`
- `service/youtube-mv/icon`

## 4. Spacing Tokens
- `space/4`
- `space/8`
- `space/12`
- `space/16`
- `space/20`
- `space/24`
- `space/32`

## 5. Radius Tokens
- `radius/chip`
- `radius/button`
- `radius/card`
- `radius/sheet`

## 6. Typography Tokens
- `font/screen-title`
- `font/section-title`
- `font/card-title`
- `font/body`
- `font/meta`
- `font/chip`
- `font/button-primary`
- `font/button-service`

## 7. Size Tokens
- `icon/tab`
- `icon/meta`
- `icon/service`
- `button/height-primary`
- `button/height-secondary`
- `button/height-service`
- `row/min-height`

## 8. Elevation Tokens
- `elevation/card`
- `elevation/card-prominent`
- `elevation/sheet`
- `elevation/floating`

## 9. Motion Tokens
- `motion/press/fast`
- `motion/fade/standard`
- `motion/sheet/open`
- `motion/navigation/push`

## 10. Implementation Rules
- Calendar, Radar, Search, Team Detail, Release Detail는 공통 token set만 사용한다.
- 서비스 버튼은 raw brand hex 대신 `service/*` token을 사용한다.
- 상태 칩은 `status/*` semantic token만 사용한다.
- light/dark theme 전환은 semantic token key를 유지한 채 `MobileThemeProvider`가 scheme별 값을 선택한다.
- dark-specific asset 분기는 component 안 raw `require(...)` 분기가 아니라 `mobile/src/utils/assetRegistry.ts`에서만 처리한다.
