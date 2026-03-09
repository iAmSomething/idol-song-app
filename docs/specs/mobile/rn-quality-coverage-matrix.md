# RN Quality Coverage Matrix

## Scope
- Issues: `#451`, `#452`, `#453`
- Surfaces: `calendar`, `search`, `radar`, `entity detail`, `release detail`

## Shared component coverage
- `ServiceButtonGroup`
  - File: `mobile/src/components/actions/ServiceButtonGroup.test.tsx`
  - Covers: action hierarchy wiring, disabled state, service button rendering
- `DayCell`
  - File: `mobile/src/components/calendar/DayCell.test.tsx`
  - Covers: selected-state accessibility, badge rendering, overflow semantics
- `DateDetailSheet`
  - File: `mobile/src/components/calendar/DateDetailSheet.test.tsx`
  - Covers: bottom-sheet structure, reading order, verified/upcoming sections, close action
- `TrackRow`
  - File: `mobile/src/components/release/TrackRow.test.tsx`
  - Covers: title-track badge rendering, grouped service actions

## Screen coverage
- Calendar
  - Files: `calendarControls.test.tsx`, `calendarBottomSheet.test.tsx`
  - Covers: month navigation, filter state, quick jump, bottom-sheet drill-in
- Search
  - File: `searchTab.test.tsx`
  - Covers: recent query persistence, segmented results, feedback states
- Radar
  - File: `radarTab.test.tsx`
  - Covers: featured/weekly/change-feed/long-gap/rookie rendering, degraded/partial/error states
- Entity detail
  - File: `entityDetailScreen.test.tsx`
  - Covers: hero, official links, next upcoming, latest release, album list, timeline toggle
- Release detail
  - File: `releaseDetailScreen.test.tsx`
  - Covers: header, service buttons, track rows, title-track badges, MV state, handoff failure feedback

## Smoke coverage
- File: `mobile/src/features/route-shell.smoke.test.tsx`
- Covers: Expo Router shell can render tab and push-route entrypoints without crashing

## Performance and layout guardrails
- Shared components are `React.memo` wrapped where repeated lists are expected.
- Large-text safety is enforced through:
  - `allowFontScaling`
  - `minHeight`
  - `flexShrink`
  - wrapped action rows instead of fixed horizontal stacks
- Export verification:
  - `CI=1 npx expo export --platform web ...`

## Remaining manual QA
- Device-level VoiceOver / TalkBack reading order
- Dynamic Type / font scaling inspection on actual simulators/devices
- Gesture feel and sheet motion tuning on device
