# Same-day Release Acceptance Report

- generated_at: 2026-03-12T12:36:23.495Z
- reference_date: 2026-03-12
- overall_status: fail

## Summary

- YENA same-day suppression: pass
- P1Harmony same-day release acceptance: fail (official_mv)

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
- exact upcoming present: no
- promoted release present: yes
- album cover attached: yes
- track list attached: yes
- official MV attached: no
- title track attached: yes
- user-facing not upcoming-only: yes
- missing requirements: official_mv
- promoted release: UNIQUE / 2026-03-12 / album

## Failed-cycle update template

```md
## same-day acceptance status
- reference date: 2026-03-12
- status: FAIL
- fixture: P1Harmony same-day release acceptance
  - missing: official_mv
  - promoted release: UNIQUE / 2026-03-12 / album
```

