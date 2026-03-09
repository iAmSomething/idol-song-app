# Historical Catalog Completeness Summary

- generated_at: `2026-03-09`
- cutover status: `fail`

## Summary

- detail payload coverage: 1770/1770 (100.0%), pre-2024 1153/1153 (100.0%)
- detail trusted coverage: 1770/1770 (100.0%), pre-2024 1153/1153 (100.0%)
- title-track resolved coverage: 1112/1770 (62.8%), pre-2024 697/1153 (60.5%), review queue 658
- canonical MV coverage: 76/1770 (4.3%), pre-2024 20/1153 (1.7%), mv review 2
- release-detail null review queue: 1760 rows
- historical catalog cutover gate: fail

## Overall Coverage

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 1770 | 1770 | 100.0% |
| detail trusted | 1770 | 1770 | 100.0% |
| title-track resolved | 1112 | 1770 | 62.8% |
| canonical MV | 76 | 1770 | 4.3% |

## Pre-2024 Historical Slice

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 1153 | 1153 | 100.0% |
| detail trusted | 1153 | 1153 | 100.0% |
| title-track resolved | 697 | 1153 | 60.5% |
| canonical MV | 20 | 1153 | 1.7% |

## Cutover Gates

| gate | status | total | threshold | pre-2024 | threshold |
| --- | --- | ---: | ---: | ---: | ---: |
| detail_payload | `pass` | 100.0% | 100.0% | 100.0% | 100.0% |
| detail_trusted | `pass` | 100.0% | 85.0% | 100.0% | 50.0% |
| title_track_resolved | `fail` | 62.8% | 80.0% | 60.5% | 60.0% |
| canonical_mv | `fail` | 4.3% | 65.0% | 1.7% | 35.0% |

## Top Gap Entities (Pre-2024)

| domain | entity | gap rows | total rows | gap ratio |
| --- | --- | ---: | ---: | ---: |
| title_track | DAY6 | 18 | 25 | 72.0% |
| title_track | Dreamcatcher | 17 | 23 | 73.9% |
| title_track | MONSTA X | 15 | 56 | 26.8% |
| title_track | SEVENTEEN | 14 | 32 | 43.8% |
| title_track | TWICE | 12 | 40 | 30.0% |
| mv | MONSTA X | 56 | 56 | 100.0% |
| mv | SHINee | 47 | 47 | 100.0% |
| mv | BTS | 42 | 42 | 100.0% |
| mv | BTOB | 37 | 37 | 100.0% |
| mv | TWICE | 36 | 40 | 90.0% |
