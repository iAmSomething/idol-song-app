# Historical Catalog Completeness Summary

- generated_at: `2026-03-10`
- cutover status: `fail`

## Summary

- detail payload coverage: 1770/1770 (100.0%), pre-2024 1153/1153 (100.0%)
- detail trusted coverage: 1770/1770 (100.0%), pre-2024 1153/1153 (100.0%)
- title-track resolved coverage: 1141/1770 (64.5%), pre-2024 715/1153 (62.0%), review queue 629
- canonical MV coverage: 112/1770 (6.3%), pre-2024 38/1153 (3.3%), mv review 2
- migration-critical first slice: title-track 18/18 (100.0%), canonical MV 18/18 (100.0%), gate pass
- release-detail null review queue: 1754 rows
- historical catalog cutover gate: fail

## Overall Coverage

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 1770 | 1770 | 100.0% |
| detail trusted | 1770 | 1770 | 100.0% |
| title-track resolved | 1141 | 1770 | 64.5% |
| canonical MV | 112 | 1770 | 6.3% |

## Pre-2024 Historical Slice

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 1153 | 1153 | 100.0% |
| detail trusted | 1153 | 1153 | 100.0% |
| title-track resolved | 715 | 1153 | 62.0% |
| canonical MV | 38 | 1153 | 3.3% |

## Migration-Critical First Slice

- entities: `BLACKPINK, BTS, SEVENTEEN, SHINee, TWICE`
- expected rows: `18`
- gate status: `pass`

| domain | before | after | threshold |
| --- | ---: | ---: | ---: |
| detail payload | 100.0% | 100.0% | 100.0% |
| detail trusted | 100.0% | 100.0% | 100.0% |
| title-track resolved | 100.0% | 100.0% | 100.0% |
| canonical MV | 11.1% | 100.0% | 100.0% |

## Cutover Gates

| gate | status | total | threshold | pre-2024 | threshold |
| --- | --- | ---: | ---: | ---: | ---: |
| detail_payload | `pass` | 100.0% | 100.0% | 100.0% | 100.0% |
| detail_trusted | `pass` | 100.0% | 85.0% | 100.0% | 50.0% |
| title_track_resolved | `fail` | 64.5% | 80.0% | 62.0% | 60.0% |
| canonical_mv | `fail` | 6.3% | 65.0% | 3.3% | 35.0% |

## Top Gap Entities (Pre-2024)

| domain | entity | gap rows | total rows | gap ratio |
| --- | --- | ---: | ---: | ---: |
| title_track | DAY6 | 18 | 25 | 72.0% |
| title_track | Dreamcatcher | 17 | 23 | 73.9% |
| title_track | MONSTA X | 15 | 56 | 26.8% |
| title_track | ATEEZ | 12 | 26 | 46.2% |
| title_track | ONEWE | 12 | 21 | 57.1% |
| mv | MONSTA X | 56 | 56 | 100.0% |
| mv | SHINee | 43 | 47 | 91.5% |
| mv | BTS | 37 | 42 | 88.1% |
| mv | BTOB | 37 | 37 | 100.0% |
| mv | MAMAMOO | 32 | 32 | 100.0% |
