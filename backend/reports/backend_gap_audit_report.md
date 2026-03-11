# Backend Gap Audit Report

- generated_at: 2026-03-11T15:10:28.264Z
- parent_issue: #529
- closure_recommendation: close_parent_keep_children_open

## Summary

- parent issue #529 audit status: audit_complete
- current readiness score: 56.3% (fail)
- baseline deltas: latest release drift 3 -> 0, title-track 64.5% -> 67.8%, canonical MV 6.3% -> 8.6%
- allowlist progress: mv_source_channels 0/117 -> 92/117
- entity metadata unchanged: debut_year 8/117, representative_image 0/117
- runtime-facing duplicate artifacts still present: 4
- direct blocker follow-ups: #600 backend runtime health, #601 web backend-only stability, #602 backend deploy parity, #603 catalog completeness

## Baseline vs Current

| Metric | Baseline | Current | Status |
| --- | ---: | ---: | --- |
| Latest verified release selection drift count | 3 | 0 | resolved |
| Historical title-track resolved coverage (%) | 64.5 | 67.8 | improved |
| Historical canonical MV coverage (%) | 6.3 | 8.6 | improved |
| Rows with mv_source_channels populated | 0 | 92 | improved |
| Artist profiles with debut_year populated | 8 | 8 | unchanged |
| Artist profiles with representative_image_url populated | 0 | 0 | unchanged |

## Blocker Mapping

### Backend runtime health

- status: fail
- blocker_reason: projection_freshness=fail
- blocker_reason: worker_cadence=fail
- blocker_reason: stage_gate:shadow_to_web_cutover=fail
- blocker_reason: stage_gate:web_cutover_to_json_demotion=fail
- follow_up: [#600](https://github.com/iAmSomething/idol-song-app/issues/600) Restore backend runtime-health cutover gate by clearing projection freshness lag and scheduled worker cadence evidence

### Backend deploy parity

- status: fail
- blocker_reason: parity_clean=false (latest_verified_release_selection drift=0)
- follow_up: [#602](https://github.com/iAmSomething/idol-song-app/issues/602) Resolve backend deploy parity drift for YouTube allowlists, title-track/service-link state, and review-required counts

### Web backend-only stability

- status: fail
- blocker_reason: entity_detail clean_ratio=0.5
- blocker_reason: release_detail clean_ratio=0
- follow_up: [#601](https://github.com/iAmSomething/idol-song-app/issues/601) Close remaining backend-only shadow drift on web entity detail and release detail surfaces

### Catalog completeness

- status: fail
- blocker_reason: title_track_resolved overall=67.9 pre_2024=65.2
- blocker_reason: canonical_mv overall=8.6 pre_2024=6.4
- blocker_reason: releases.title_track latest 29.1% < 95.0%
- blocker_reason: release_service_links.youtube_mv latest 10.2% < 80.0%
- blocker_reason: entities.official_youtube latest 75.3% < 100.0%
- blocker_reason: entities.official_x latest 97.8% < 100.0%
- blocker_reason: entities.official_instagram latest 98.9% < 100.0%
- blocker_reason: releases.title_track recent 0.0% < 85.0%
- blocker_reason: release_service_links.youtube_mv recent 0.0% < 55.0%
- blocker_reason: entities.official_youtube recent 72.2% < 95.0%
- follow_up: [#603](https://github.com/iAmSomething/idol-song-app/issues/603) Raise catalog completeness for title-track, MV, official-link, and visual metadata blocker cohorts
- follow_up: [#538](https://github.com/iAmSomething/idol-song-app/issues/538) Integrate collected social links, agency names, and debut-year metadata into canonical entity data with provenance and review states
- follow_up: [#539](https://github.com/iAmSomething/idol-song-app/issues/539) Backfill representative entity images and broaden release artwork coverage beyond the latest-snapshot subset
- follow_up: [#580](https://github.com/iAmSomething/idol-song-app/issues/580) Define export-import manual curation bundles for unresolved canonical nulls across key field families

## Related Operational Follow-ups

- [#525](https://github.com/iAmSomething/idol-song-app/issues/525) [RN] Provision a stable public preview backend URL for external iPhone and Android device testing
- [#540](https://github.com/iAmSomething/idol-song-app/issues/540) Remove duplicate generated artifacts and define one canonical retention policy for runtime-facing JSON and pipeline scripts

## Resolved Workstreams

- Latest verified release selection drift cleared: #532
- Historical release enrichment and MV allowlist foundation landed: #534, #535, #536, #537, #591
- Trusted upcoming notification event and push runtime path landed: #554, #556, #557, #558, #559, #560, #561
- Null hygiene cadence, workbench, and bundle reporting landed: #566, #567, #568, #569, #570, #571, #572, #573, #574, #575, #577, #578, #579, #582, #583
- Worker cadence / runtime gate semantics were added even though operational pass is still pending: #530

## Runtime-facing Duplicate Artifacts

- build_release_details_musicbrainz 2.py
- web/src/data/artistProfiles 2.json
- web/src/data/releaseArtwork 2.json
- web/src/data/releaseDetails 2.json

## Null Hygiene Snapshot

- YouTube MV Canonical Link: coverage 1.5%, unresolved 1744
- Title Track Resolution: coverage 4.3%, unresolved 1694
- Official YouTube: coverage 75.2%, unresolved 29
- Debut Year: coverage 6.8%, unresolved 109
- Representative Image: coverage 0%, unresolved 117

