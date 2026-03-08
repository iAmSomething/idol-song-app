# Mobile Accessibility Audit 2026-03-09

## Scope
- `calendar`
- `search`
- `radar`
- `artists/[slug]`
- `releases/[id]`
- shared feedback states

## Issues Found And Fixed
1. Critical interactive controls were missing explicit screen-reader labels.
   - Fixed for calendar month navigation, quick jumps, filter chips, calendar day cells, radar cards, search result cards, official links, release service buttons, and back buttons.
2. Calendar date-detail sheet did not declare modal focus semantics.
   - Fixed with `accessibilityViewIsModal` on the sheet panel and a dedicated close control label.
3. Large-text layouts had multiple buttons/chips that could become cramped or ambiguous.
   - Fixed by adding `minHeight` baselines and `flexShrink`/`textAlign` adjustments to button and chip labels across calendar, search, radar, entity detail, and release detail surfaces.
4. Some tab/detail headings were plain text without header semantics.
   - Fixed by marking primary titles and section titles with `accessibilityRole="header"` where they anchor navigation.
5. Search upcoming rows could look actionable even when no team route could be opened.
   - Fixed by disabling rows without a safe team-detail target and exposing disabled state explicitly.

## Automated Verification
- component and route tests cover:
  - route restoration semantics
  - key accessibility labels on calendar/search/radar/entity detail/release detail
  - bottom-sheet modal accessibility flag
- static export completed after the pass to catch layout/runtime regressions

## Remaining Validation Notes
- Device-level VoiceOver and TalkBack walkthroughs still need to be rerun on actual iOS and Android hardware before shipping.
- Largest supported text-size checks were validated through layout-safe style changes and web export, not through simulator-level manual QA in this environment.

## Result
- No current code-level blocker remains for screen-reader semantics or large-text resilience on the implemented mobile surfaces.
- Remaining work is operational QA on real devices, not another known implementation gap.
