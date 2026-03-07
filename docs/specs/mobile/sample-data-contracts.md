# Sample Data Contracts

## 1. 목적
이 문서는 모바일 구현자가 실제 JSON 스키마를 이해하기 쉽도록 최소 예시 payload를 제공한다.
실제 필드명은 데이터 생성 파이프라인과 맞춰야 하며, 여기서는 UI 관점의 계약 예시를 우선한다.

## 2. Artist Profile Example
```json
{
  "group": "TOMORROW X TOGETHER",
  "display_name": "TOMORROW X TOGETHER",
  "agency": "BIGHIT MUSIC",
  "aliases": ["TXT"],
  "search_aliases": ["TXT", "투바투", "투모로우바이투게더", "투모로우엑스투게더"],
  "badge_image_url": "https://.../txt-badge.png",
  "representative_image_url": "https://.../txt-hero.jpg",
  "official_youtube_url": "https://youtube.com/@TXT_bighit",
  "official_x_url": "https://x.com/TXT_bighit",
  "official_instagram_url": "https://instagram.com/txt_bighit",
  "debut_year": 2019
}
```

## 3. YouTube Channel Allowlist Example
```json
{
  "group": "TOMORROW X TOGETHER",
  "primary_team_channel_url": "https://youtube.com/@TXT_bighit",
  "mv_allowlist_urls": [
    "https://youtube.com/@TXT_bighit",
    "https://www.youtube.com/@HYBELABELS"
  ],
  "channels": [
    {
      "channel_url": "https://youtube.com/@TXT_bighit",
      "channel_label": "TOMORROW X TOGETHER",
      "owner_type": "team",
      "allow_mv_uploads": true,
      "display_in_team_links": true,
      "provenance": "artistProfiles.official_youtube_url"
    },
    {
      "channel_url": "https://www.youtube.com/@HYBELABELS",
      "channel_label": "HYBE LABELS",
      "owner_type": "label",
      "allow_mv_uploads": true,
      "display_in_team_links": false,
      "provenance": "curated_agency_allowlist"
    }
  ]
}
```

## 4. Release Summary Example
```json
{
  "group": "BLACKPINK",
  "release_title": "DEADLINE",
  "release_date": "2026-02-27",
  "release_kind": "mini",
  "latest_song": {
    "title": "JUMP",
    "date": "2025-07-11"
  },
  "latest_album": {
    "title": "DEADLINE",
    "date": "2026-02-27"
  },
  "spotify_url": "https://open.spotify.com/album/...",
  "youtube_music_url": "https://music.youtube.com/browse/...",
  "youtube_mv_url": "https://www.youtube.com/watch?v=..."
}
```

## 5. Upcoming Event Example
```json
{
  "group": "TOMORROW X TOGETHER",
  "scheduled_date": "2026-04-13",
  "date_status": "exact",
  "headline": "[NOTICE] Comeback Showcase to Celebrate the Release of TOMORROW X TOGETHER '7TH YEAR: A Moment of Stillness in the Thorns'",
  "release_label": "7TH YEAR: A Moment of Stillness in the Thorns",
  "source_type": "weverse_notice",
  "source_url": "https://weverse.io/...",
  "confidence": "high",
  "status": "confirmed"
}
```

## 6. Release Artwork Example
```json
{
  "group": "STAYC",
  "release_title": "STAY ALIVE",
  "release_date": "2026-02-11",
  "stream": "album",
  "image_url": "https://.../stay-alive-cover.jpg"
}
```

## 7. Release Detail Example
```json
{
  "group": "STAYC",
  "release_title": "STAY ALIVE",
  "release_date": "2026-02-11",
  "release_kind": "album",
  "spotify_url": "https://open.spotify.com/album/...",
  "youtube_music_url": "https://music.youtube.com/browse/...",
  "youtube_video_url": "https://www.youtube.com/watch?v=abc123xyz",
  "youtube_video_id": "abc123xyz",
  "youtube_video_status": "manual_override",
  "youtube_video_provenance": "official artist channel watch URL",
  "tracks": [
    {
      "order": 1,
      "title": "STAY ALIVE",
      "is_title_track": true,
      "spotify_url": "https://open.spotify.com/track/...",
      "youtube_music_url": "https://music.youtube.com/watch?..."
    },
    {
      "order": 2,
      "title": "B-Side Track",
      "is_title_track": false,
      "spotify_url": null,
      "youtube_music_url": null
    }
  ],
  "notes": "Physical and digital release aligned.",
  "credits": [
    {
      "role": "Composed by",
      "name": "Jane Doe"
    }
  ]
}
```

## 8. UI Fallback Example

### 7.1 Release Detail with Missing Track Links
```json
{
  "group": "Example Group",
  "release_title": "Example Release",
  "release_date": "2026-05-10",
  "tracks": [
    {
      "order": 1,
      "title": "Example Song",
      "is_title_track": true,
      "spotify_url": null,
      "youtube_music_url": null
    }
  ]
}
```

처리 규칙:
- 트랙명은 그대로 노출
- 트랙별 canonical URL이 없으면 검색 fallback 생성
- 검색 fallback도 불가능한 경우 해당 서비스 버튼 숨김

## 8. Lookup Key Example
```json
{
  "group": "BLACKPINK",
  "release_title": "DEADLINE",
  "release_date": "2026-02-27",
  "stream": "album"
}
```

이 키 조합을 artwork/detail lookup의 기본 exact key로 사용한다.
