# Backend Trusted Upcoming Notification Events Local Check

Date: 2026-03-11

## Scope

- `#554` operator alert emission
- `#556` persisted dedupe / suppression
- `#558` canonical notification event modeling

## Commands

```bash
python3 -m py_compile trusted_upcoming_notification_events.py sync_trusted_upcoming_notification_events.py test_trusted_upcoming_notification_events.py
python3 -m unittest test_trusted_upcoming_notification_events.py

source ~/.config/idol-song-app/neon.env
cd backend
npm run migrate:apply
npm run schema:verify

cd /Users/gimtaehun/Desktop/idol-song-app
source .venv/bin/activate
python sync_trusted_upcoming_notification_events.py --summary-path backend/reports/trusted_upcoming_notification_event_summary.json --markdown-path backend/reports/trusted_upcoming_operator_alert_report.md
python sync_trusted_upcoming_notification_events.py --summary-path backend/reports/trusted_upcoming_notification_event_summary.json --markdown-path backend/reports/trusted_upcoming_operator_alert_report.md

cd backend
npm run report:bundle -- --bundle-kind post-sync-verification --cadence-profile daily-upcoming
```

## Results

- unit fixtures passed for:
  - `new trusted signal`
  - `unchanged rerun`
  - `rumor -> confirmed + exact + high confidence`
  - `source tier improvement`
- migration `0006_notification_events.sql` applied and schema verify passed
- first DB sync seeded canonical notification event rows for current trusted signals
- current DB snapshot:
  - `notification_events = 11`
  - `notification_signal_states = 59`
  - `event_reason counts = {new_signal: 11}`
- second DB sync result:
  - `events_emitted = 0`
  - `suppressed_unchanged = 11`
  - `suppressed_untrusted = 48`
- bundle metadata includes `trusted_upcoming_notification_summary`

## Notes

- canonical destination is currently `entity_detail` only
- downstream push delivery / token registration / deep-link open handling are separate follow-up work
