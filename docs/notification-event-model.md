# Notification Event Model v1

## 1. 목적

이 문서는 웹과 iOS에서 공통으로 재사용할 수 있는 알림 이벤트 모델 v1을 정의한다.
범위는 실제 푸시 서버 구현이 아니라, 어떤 이벤트를 만들고 어떤 payload를 넘겨야 하는지 고정하는 것이다.

핵심 목표는 아래 두 가지다.

- 적절한 시점에 발매/컴백 정보를 알릴 수 있게 이벤트 타입을 고정한다.
- 알림을 받은 사용자가 Spotify, YouTube Music, source 원문으로 자연스럽게 handoff될 수 있게 outbound CTA 필드를 정의한다.

이 문서는 후속 이슈 `#13`의 service handoff CTA 정의가 참조하는 기반 문서다.

## 2. v1 이벤트 타입

v1 이벤트 타입은 아래 3개로 고정한다.

1. `comeback_announced`
2. `release_confirmed`
3. `weekly_digest`

### 2.1 comeback_announced

정의:
- 공식 출처에서 미래 일정이 발표된 경우 생성한다.

트리거 규칙:
- `source_type in {agency_notice, weverse_notice}`
- `date_status in {confirmed, scheduled}`
- 미래 일정으로 해석 가능한 `scheduled_date`가 존재해야 한다.
- teaser 이미지, teaser phrase, 루머성 기사 반복 게시물은 제외한다.

비생성 규칙:
- `news_rss`만 있는 경우
- `official_social`만 있고 일정이 명시되지 않은 경우
- `date_status == rumor`
- 같은 출처가 같은 일정을 반복 게시한 경우

dedupe key:
- `group + scheduled_date + headline + source_type`

### 2.2 release_confirmed

정의:
- 실제 발매가 verified release 데이터에 새 항목으로 들어온 경우 생성한다.

트리거 규칙:
- verified release snapshot에 새 row가 추가된 경우만 생성한다.
- 발매 후 메타데이터 보강, artwork 보강, notes 보강만 있는 경우는 새 이벤트를 만들지 않는다.

비생성 규칙:
- 기존 verified release row의 부가 필드만 업데이트된 경우
- watchlist fallback만 존재하고 verified release가 아닌 경우

dedupe key:
- `group + title + date + stream`

### 2.3 weekly_digest

정의:
- 최근 7일 verified release와 향후 14일 scheduled release를 묶은 주간 요약 이벤트다.

트리거 규칙:
- 주 단위 스케줄러가 한 번 실행될 때 최대 1개 생성한다.
- digest는 개별 이벤트 대체가 아니라 운영 요약 채널용 보조 이벤트다.

구성 규칙:
- `recent_verified_releases`: 기준 시점 포함 최근 7일
- `upcoming_scheduled_releases`: 기준 시점 이후 14일

dedupe key:
- `week_start`

## 3. 공통 이벤트 Envelope

모든 이벤트는 아래 공통 envelope를 따른다.

```ts
type NotificationEventBase = {
  event_type: "comeback_announced" | "release_confirmed" | "weekly_digest";
  event_version: "v1";
  dedupe_key: string;
  occurred_at: string; // ISO-8601 UTC
  title: string;
  body: string;
  outbound_cta: OutboundCta;
};

type OutboundCta = {
  spotify_search_url?: string;
  youtube_music_search_url?: string;
  source_url?: string;
};
```

원칙:
- `event_version`은 문자열 `v1`로 고정한다.
- `dedupe_key`는 저장/전송 계층에서 중복 발송 방지 기준으로 사용한다.
- `title`, `body`는 채널별 렌더링 전에 바로 사용할 수 있는 최소 copy를 포함한다.
- `outbound_cta`는 optional field다. 이벤트 특성상 불가능한 CTA는 비워 둘 수 있다.

## 4. 이벤트별 Payload Schema

### 4.1 comeback_announced

```ts
type ComebackAnnouncedEvent = NotificationEventBase & {
  event_type: "comeback_announced";
  payload: {
    group: string;
    scheduled_date: string;
    date_status: "confirmed" | "scheduled";
    headline: string;
    source_type: "agency_notice" | "weverse_notice";
    source_domain: string;
    source_url: string;
    release_format?: "single" | "ep" | "album" | "";
    context_tags?: string[];
  };
};
```

필드 규칙:
- `source_url`은 `comeback_announced`에서 사실상 핵심 CTA로 본다.
- `spotify_search_url`, `youtube_music_search_url`는 release title이 충분히 안정적으로 추정되는 경우에만 채운다.
- release title이 불명확하면 `outbound_cta.source_url`만 유지해도 된다.

### 4.2 release_confirmed

```ts
type ReleaseConfirmedEvent = NotificationEventBase & {
  event_type: "release_confirmed";
  payload: {
    group: string;
    title: string;
    date: string; // YYYY-MM-DD
    stream: "song" | "album";
    release_kind: "single" | "ep" | "album";
    source_url: string;
    artist_source?: string;
    music_handoffs?: {
      spotify?: string;
      youtube_music?: string;
    };
  };
};
```

필드 규칙:
- verified release는 title/date/stream이 고정되므로 music search CTA를 안정적으로 만들 수 있다.
- `music_handoffs`에 canonical URL이 있어도 v1 알림 모델은 `spotify_search_url`, `youtube_music_search_url`를 같이 허용한다.
- 채널 소비자는 canonical URL이 아니라 event payload에 포함된 CTA만 사용한다.

### 4.3 weekly_digest

```ts
type WeeklyDigestEvent = NotificationEventBase & {
  event_type: "weekly_digest";
  payload: {
    week_start: string; // YYYY-MM-DD
    week_end: string;   // YYYY-MM-DD
    recent_verified_releases: DigestReleaseItem[];
    upcoming_scheduled_releases: DigestUpcomingItem[];
  };
};

type DigestReleaseItem = {
  group: string;
  title: string;
  date: string;
  stream: "song" | "album";
  release_kind: "single" | "ep" | "album";
  outbound_cta: OutboundCta;
};

type DigestUpcomingItem = {
  group: string;
  headline: string;
  scheduled_date: string;
  date_status: "confirmed" | "scheduled";
  source_type: string;
  outbound_cta: OutboundCta;
};
```

필드 규칙:
- digest item도 독립 CTA를 가질 수 있다.
- `recent_verified_releases`는 release detail handoff 중심이다.
- `upcoming_scheduled_releases`는 source 원문 확인 중심이다.

## 5. Outbound CTA 규칙

알림 이벤트의 outbound CTA는 아래 필드만 v1 공통 필드로 인정한다.

- `spotify_search_url`
- `youtube_music_search_url`
- `source_url`

### 5.1 URL 생성 원칙

- `spotify_search_url`는 `https://open.spotify.com/search/{encoded query}` 형식을 사용한다.
- `youtube_music_search_url`는 `https://music.youtube.com/search?q={encoded query}` 형식을 사용한다.
- query 기본값은 `group + title` 조합이다.
- title이 없거나 안정적으로 파싱되지 않으면 search URL을 생략할 수 있다.

### 5.2 소비자 규칙

- 알림 소비자는 payload에 없는 CTA를 임의로 추론하지 않는다.
- `comeback_announced`는 기본적으로 `source_url` 우선이다.
- `release_confirmed`는 music search CTA를 우선 노출할 수 있다.
- `weekly_digest`는 item 단위 CTA를 사용하고, 이벤트 루트 CTA는 digest 전체를 여는 용도로만 사용한다.

### 5.3 비범위

- Spotify/YouTube Music OAuth
- deep link 강제
- 앱 내 직접 재생
- canonical track id 보장

## 6. 생성 제외 규칙

v1에서는 아래 항목을 알림 이벤트 생성 대상에서 제외한다.

- teaser image만 있는 게시물
- 날짜 없는 티저 문구 반복 게시물
- rumor 상태 기사 반복 게시물
- source provenance가 약한 비공식 반복 기사
- verified release가 아닌 watchlist fallback만 존재하는 상태

## 7. Sample Payload

### 7.1 comeback_announced

```json
{
  "event_type": "comeback_announced",
  "event_version": "v1",
  "dedupe_key": "IVE::2026-03-18::IVE announces fourth EP comeback::agency_notice",
  "occurred_at": "2026-03-07T00:15:00Z",
  "title": "IVE comeback announced",
  "body": "Official notice confirms a scheduled comeback on 2026-03-18.",
  "outbound_cta": {
    "source_url": "https://company.example.com/notices/ive-comeback-20260318"
  },
  "payload": {
    "group": "IVE",
    "scheduled_date": "2026-03-18",
    "date_status": "confirmed",
    "headline": "IVE announces fourth EP comeback",
    "source_type": "agency_notice",
    "source_domain": "company.example.com",
    "source_url": "https://company.example.com/notices/ive-comeback-20260318",
    "release_format": "ep",
    "context_tags": []
  }
}
```

### 7.2 release_confirmed

```json
{
  "event_type": "release_confirmed",
  "event_version": "v1",
  "dedupe_key": "IVE::ATTITUDE::2026-03-18::song",
  "occurred_at": "2026-03-18T09:05:00Z",
  "title": "IVE release confirmed",
  "body": "ATTITUDE is now verified as a live release in the catalog.",
  "outbound_cta": {
    "spotify_search_url": "https://open.spotify.com/search/IVE%20ATTITUDE",
    "youtube_music_search_url": "https://music.youtube.com/search?q=IVE%20ATTITUDE",
    "source_url": "https://release.example.com/ive-attitude"
  },
  "payload": {
    "group": "IVE",
    "title": "ATTITUDE",
    "date": "2026-03-18",
    "stream": "song",
    "release_kind": "single",
    "source_url": "https://release.example.com/ive-attitude",
    "artist_source": "https://artist.example.com/ive",
    "music_handoffs": {
      "spotify": "https://open.spotify.com/track/example",
      "youtube_music": "https://music.youtube.com/watch?v=example"
    }
  }
}
```

### 7.3 weekly_digest

```json
{
  "event_type": "weekly_digest",
  "event_version": "v1",
  "dedupe_key": "2026-03-09",
  "occurred_at": "2026-03-09T00:05:00Z",
  "title": "Weekly K-pop release digest",
  "body": "2 verified releases landed and 3 scheduled comebacks are coming up.",
  "outbound_cta": {},
  "payload": {
    "week_start": "2026-03-09",
    "week_end": "2026-03-15",
    "recent_verified_releases": [
      {
        "group": "IVE",
        "title": "ATTITUDE",
        "date": "2026-03-07",
        "stream": "song",
        "release_kind": "single",
        "outbound_cta": {
          "spotify_search_url": "https://open.spotify.com/search/IVE%20ATTITUDE",
          "youtube_music_search_url": "https://music.youtube.com/search?q=IVE%20ATTITUDE",
          "source_url": "https://release.example.com/ive-attitude"
        }
      }
    ],
    "upcoming_scheduled_releases": [
      {
        "group": "NMIXX",
        "headline": "NMIXX confirms March comeback",
        "scheduled_date": "2026-03-21",
        "date_status": "scheduled",
        "source_type": "weverse_notice",
        "outbound_cta": {
          "source_url": "https://weverse.example.com/nmixx-comeback"
        }
      }
    ]
  }
}
```

## 8. 후속 구현 가이드

- `#13`은 이 문서의 `outbound_cta` 필드와 search URL 규칙을 사용해 실제 service handoff UI를 연결한다.
- 모바일 구현은 알림 payload를 그대로 받아 채널별 UI만 다르게 렌더링한다.
- 웹 구현은 event payload를 직접 소비하지 않더라도, 같은 query builder 규칙을 재사용해야 한다.

## 9. v1 수용 기준

- 이벤트 타입과 발생 조건이 문서로 정리되어 있다.
- dedupe 규칙이 이벤트별로 명시되어 있다.
- sample payload만 보고도 후속 구현자가 서버/클라이언트 contract를 잡을 수 있다.
- `spotify_search_url`, `youtube_music_search_url`, `source_url` CTA 필드가 `#13` 참조용으로 고정되어 있다.
