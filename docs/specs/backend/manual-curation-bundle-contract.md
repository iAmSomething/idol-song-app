# Manual Curation Bundle Contract

`#580` 범위의 manual curation bundle은 사람이 unresolved canonical null queue를 받아
`release_detail_overrides.json` / `artistProfiles.json`에 다시 흡수할 수 있게 만드는
thin export-import contract다.

## 대상 field family

1. `service_link`
   - `release_service_links.spotify`
   - `release_service_links.youtube_music`
   - `release_service_links.youtube_mv`
2. `title_track`
   - `release_detail.title_tracks`
3. `entity_identity`
   - `entities.representative_image`
   - `entities.official_youtube`
   - `entities.official_x`
   - `entities.official_instagram`
   - `entities.agency_name`
   - `entities.debut_year`

## Export 입력

- `backend/reports/service_link_gap_queues.json`
- `backend/reports/title_track_gap_queue.json`
- `backend/reports/entity_identity_workbench.json`

## Export 출력

- `backend/reports/manual_curation_bundle_service_links.json`
- `backend/reports/manual_curation_bundle_title_tracks.json`
- `backend/reports/manual_curation_bundle_entity_identity.json`

## 공통 envelope

```json
{
  "bundle_version": 1,
  "bundle_kind": "manual_curation_bundle",
  "field_family": "service_link",
  "generated_at": "2026-03-12T00:00:00.000Z",
  "source_artifact": "backend/reports/service_link_gap_queues.json",
  "allowed_decisions": ["set_manual_override", "mark_no_link", "mark_review_needed", "skip"],
  "summary": {},
  "rows": []
}
```

## 공통 row shape

```json
{
  "bundle_row_key": "stable queue key",
  "field_family_key": "release_service_links.youtube_mv",
  "target": {},
  "context": {},
  "current_state": {},
  "curation": {
    "decision": null,
    "value": null,
    "values": null,
    "provenance": null,
    "reviewer": null,
    "reviewed_at": null,
    "notes": null
  }
}
```

## Decision contract

### `service_link`

- `set_manual_override`
  - `curation.value`: canonical URL
- `mark_no_link`
  - explicit absence를 고정
- `mark_review_needed`
  - `youtube_mv`만 허용
- `skip`

Sink:

- `release_detail_overrides.json`
  - `spotify_url`, `spotify_status`, `spotify_provenance`
  - `youtube_music_url`, `youtube_music_status`, `youtube_music_provenance`
  - `youtube_video_url`, `youtube_video_id`, `youtube_video_status`, `youtube_video_provenance`

### `title_track`

- `set_manual_override`
  - `curation.values`: selected title track array
- `mark_review_needed`
- `mark_unresolved`
- `skip`

Sink:

- `release_detail_overrides.json`
  - `title_tracks`
  - `title_track_status`
  - `title_track_provenance`
  - `title_track_review_reason`

### `entity_identity`

- `set_value`
  - `curation.value`: field value
- `keep_unresolved`
- `skip`

Sink:

- `web/src/data/artistProfiles.json`
  - `representative_image_url`, `representative_image_source`
  - `official_youtube_url`, `official_youtube_source`
  - `official_x_url`, `official_x_source`
  - `official_instagram_url`, `official_instagram_source`
  - `agency`, `agency_source`
  - `debut_year`, `debut_year_source`

## Reviewer trace

import가 실제 값을 흡수하면 target row에 `manual_curation_traces` array를 append한다.

trace entry shape:

```json
{
  "bundle_field_family": "service_link",
  "bundle_version": 1,
  "bundle_generated_at": "2026-03-12T00:00:00.000Z",
  "bundle_row_key": "stable queue key",
  "field_family_key": "release_service_links.youtube_music",
  "decision": "set_manual_override",
  "value": "https://music.youtube.com/...",
  "values": null,
  "provenance": "official platform url",
  "reviewer": "gimtaehun",
  "reviewed_at": "2026-03-12T09:00:00+09:00",
  "notes": "manual verification",
  "imported_at": "2026-03-12T00:05:00.000Z"
}
```

## 실행 명령

export:

```bash
cd backend
npm run curation:export
```

import:

```bash
cd backend
npm run curation:import
```

dry-run:

```bash
cd backend
npm run curation:import -- --dry-run
```
