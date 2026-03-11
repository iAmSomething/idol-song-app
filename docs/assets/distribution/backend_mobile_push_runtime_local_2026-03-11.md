# Backend / Mobile Push Runtime Local Verification

Date: 2026-03-11

## Scope

- `#559` mobile push permission / token registration / alert preference
- `#560` trusted upcoming canonical push delivery fanout + outcome persistence
- `#561` trusted upcoming push open routing / foreground notice / fallback

## Commands

```bash
cd /Users/gimtaehun/Desktop/idol-song-app/backend && npm run build
cd /Users/gimtaehun/Desktop/idol-song-app/backend && npm test
cd /Users/gimtaehun/Desktop/idol-song-app/backend && source ~/.config/idol-song-app/neon.env && npm run migrate:apply
cd /Users/gimtaehun/Desktop/idol-song-app/backend && source ~/.config/idol-song-app/neon.env && npm run schema:verify
cd /Users/gimtaehun/Desktop/idol-song-app && source .venv/bin/activate && python -m unittest test_deliver_trusted_push_notifications.py
cd /Users/gimtaehun/Desktop/idol-song-app && python3 -m py_compile deliver_trusted_push_notifications.py sync_trusted_upcoming_notification_events.py trusted_upcoming_notification_events.py import_json_to_neon.py
cd /Users/gimtaehun/Desktop/idol-song-app/mobile && npm run typecheck
cd /Users/gimtaehun/Desktop/idol-song-app/mobile && npm run lint
cd /Users/gimtaehun/Desktop/idol-song-app/mobile && npm test -- --runInBand src/services/pushNotificationRouting.test.ts src/services/pushNotifications.test.ts src/features/route-shell.smoke.test.tsx src/features/calendarControls.test.tsx src/features/searchTab.test.tsx src/features/radarTab.test.tsx src/features/entityDetailScreen.test.tsx src/features/releaseDetailScreen.test.tsx
cd /Users/gimtaehun/Desktop/idol-song-app/mobile && EXPO_PUBLIC_API_BASE_URL=https://api.idol-song-app.example.com EXPO_PUBLIC_EXPO_PROJECT_ID=project-id-123 npm run config:preview
```

## Results

- backend build: PASS
- backend route tests including notification registration/preferences: PASS
- migration `0007_mobile_push_delivery.sql`: APPLIED
- schema verify after migration: PASS
- Python delivery helper unit tests: PASS
- mobile typecheck: PASS
- mobile lint: PASS with existing generated warning only in `.expo/types/router.d.ts`
- mobile targeted runtime/tests for push routing and registration flow: PASS
- preview config export includes `expo-notifications` plugin and `services.expoProjectId`

## Notes

- Live `deliver_trusted_push_notifications.py` fanout was **not** run against the real database during local verification, to avoid sending real push notifications to registered devices during development.
- Verification for fanout path was limited to:
  - canonical route/backend registration tests
  - schema application
  - Python delivery worker unit tests
  - workflow wiring / artifact path inspection
