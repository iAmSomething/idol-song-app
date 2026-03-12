# Same-day Release Acceptance Report

- generated_at: 2026-03-12T11:01:15.594Z
- reference_date: 2026-03-12
- overall_status: fail

## Summary

- YENA same-day suppression: pass
- P1Harmony same-day release acceptance: fail (released_row, album_cover, track_list, official_mv, title_track, user_surface_suppression)

## Fixtures

### YENA same-day suppression

- status: pass
- exact upcoming present: yes
- promoted release present: yes
- user-facing upcoming suppressed: yes
- upcoming-only surface state: no
- missing requirements: none
- promoted release: LOVE CATCHER / 2026-03-11 / album

### P1Harmony same-day release acceptance

- status: fail
- exact upcoming present: yes
- promoted release present: no
- album cover attached: no
- track list attached: no
- official MV attached: no
- title track attached: no
- user-facing not upcoming-only: no
- missing requirements: released_row, album_cover, track_list, official_mv, title_track, user_surface_suppression

## Failed-cycle update template

```md
## same-day acceptance status
- reference date: 2026-03-12
- status: FAIL
- fixture: P1Harmony same-day release acceptance
  - missing: released_row, album_cover, track_list, official_mv, title_track, user_surface_suppression
  - promoted release: none
```

