# Bundled Dataset Contract

모바일 v1의 bundled dataset base path는 `mobile/assets/datasets/v1/`이다.

이 이슈 범위에서는 실제 JSON snapshot을 복사하지 않고, source-selection layer가 참조할 고정 경로 계약만 먼저 연다.

후속 dataset packaging 작업은 아래 파일명을 기준으로 채운다.

- `artistProfiles.json`
- `releases.json`
- `releaseArtwork.json`
- `releaseDetails.json`
- `releaseHistory.json`
- `watchlist.json`
- `upcomingCandidates.json`
- `teamBadgeAssets.json`
