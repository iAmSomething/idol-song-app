# Web Data Artifacts

이 디렉터리의 JSON은 backend migration 이후에도 당분간 유지되는 transitional artifact다.

현재 역할:

- import / backfill seed
- shadow/parity/debug 비교 기준선
- export inspection artifact
- mobile/shared consumer 전환 전의 임시 입력

이 파일들을 production source-of-truth로 취급하지 않는다.
현재 shipped web runtime은 cut-over surface에서 이 JSON을 source switch나 runtime fallback으로 사용하지 않는다.
즉 committed JSON은 import/parity/reporting/debug artifact이지, 정상 사용자 read 경로가 아니다.

대표 파일:

- `artistProfiles.json`
- `releases.json`
- `releaseHistory.json`
- `releaseDetails.json`
- `releaseArtwork.json`
- `watchlist.json`
- `upcomingCandidates.json`
- `youtubeChannelAllowlists.json`

삭제 시점은 mobile/shared consumer 전환 이후 별도 결정한다.
