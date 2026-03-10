# App Routes

이 디렉터리는 Expo Router route 파일이 들어가는 위치다.

현재 포함 범위:

- `_layout.tsx`
  - root stack shell
- `index.tsx`
  - 기본 진입 시 `calendar` 탭으로 redirect
- `(tabs)/_layout.tsx`
  - `calendar`, `radar`, `search` 탭 shell
- `(tabs)/calendar.tsx`
  - backend-first + cached snapshot + bundled fallback current-month container
- `(tabs)/radar.tsx`
- `(tabs)/search.tsx`
  - backend-first search tab
- `artists/[slug].tsx`
- `releases/[id].tsx`
  - backend-first push detail screen
- `debug/metadata.tsx`
  - internal build/dataset/commit metadata inspection route

경로 계약은 아래 문서를 따른다.

- `docs/specs/mobile/expo-implementation-guide.md`
- `docs/specs/mobile/route-param-contracts.md`
