# Web Data Artifacts

이 디렉터리의 JSON은 backend migration 이후에도 당분간 유지되는 transitional artifact다.

현재 역할:

- web emergency fallback snapshot
- shadow/parity/debug 비교 기준선
- export inspection artifact
- mobile/shared consumer 전환 전의 임시 입력

이 파일들을 production source-of-truth로 취급하지 않는다.
cut-over surface가 backend-primary build로 동작할 때, 이 JSON은 정상 경로가 아니라 fallback 경로다.

대표 파일:

- `artistProfiles.json`
- `releases.json`
- `releaseHistory.json`
- `releaseDetails.json`
- `releaseArtwork.json`
- `watchlist.json`
- `upcomingCandidates.json`
- `youtubeChannelAllowlists.json`

삭제 시점은 mobile/shared consumer 전환과 emergency fallback window 종료 이후 별도 결정한다.
