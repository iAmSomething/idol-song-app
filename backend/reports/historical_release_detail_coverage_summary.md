# Historical Catalog Completeness Summary

- generated_at: `2026-03-12`
- cutover status: `fail`

## Summary

- detail payload coverage: 815/815 (100.0%), pre-2024 198/198 (100.0%)
- detail trusted coverage: 815/815 (100.0%), pre-2024 198/198 (100.0%)
- title-track resolved coverage: 581/815 (71.3%), pre-2024 131/198 (66.2%), review queue 234
- canonical MV coverage: 79/815 (9.7%), pre-2024 0/198 (0.0%), mv review 2
- external acquisition pass: YTM attempted 0, resolved 0; MV attempted 0, resolved 0, review 2
- youtube MV search pass: not available for this execution scope
- migration-critical first slice: title-track 0/18 (0.0%), canonical MV 0/18 (0.0%), gate fail
- worst title-track cohort: 2021-2023 ep 32.5% / target 74.0%
- worst canonical MV cohort: 2024+ single 15.4% / target 72.0%
- release-detail null review queue: 799 rows
- historical catalog cutover gate: fail

## Overall Coverage

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 815 | 815 | 100.0% |
| detail trusted | 815 | 815 | 100.0% |
| title-track resolved | 581 | 815 | 71.3% |
| canonical MV | 79 | 815 | 9.7% |

## Pre-2024 Historical Slice

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 198 | 198 | 100.0% |
| detail trusted | 198 | 198 | 100.0% |
| title-track resolved | 131 | 198 | 66.2% |
| canonical MV | 0 | 198 | 0.0% |

## Migration-Critical First Slice

- entities: `BLACKPINK, BTS, SEVENTEEN, SHINee, TWICE`
- expected rows: `18`
- gate status: `fail`

| domain | before | after | threshold |
| --- | ---: | ---: | ---: |
| detail payload | 0.0% | 0.0% | 100.0% |
| detail trusted | 0.0% | 0.0% | 100.0% |
| title-track resolved | 0.0% | 0.0% | 100.0% |
| canonical MV | 0.0% | 0.0% | 100.0% |

## Cutover Gates

| gate | status | total | threshold | pre-2024 | threshold |
| --- | --- | ---: | ---: | ---: | ---: |
| detail_payload | `pass` | 100.0% | 100.0% | 100.0% | 100.0% |
| detail_trusted | `pass` | 100.0% | 85.0% | 100.0% | 50.0% |
| title_track_resolved | `fail` | 71.3% | 80.0% | 66.2% | 60.0% |
| canonical_mv | `fail` | 9.7% | 65.0% | 0.0% | 35.0% |

## Top Gap Entities (Pre-2024)

| domain | entity | gap rows | total rows | gap ratio |
| --- | --- | ---: | ---: | ---: |
| title_track | tripleS | 3 | 6 | 50.0% |
| title_track | ENHYPEN | 3 | 4 | 75.0% |
| title_track | Kep1er | 2 | 6 | 33.3% |
| title_track | THE BOYZ | 2 | 6 | 33.3% |
| title_track | SEVENTEEN | 2 | 5 | 40.0% |
| mv | IVE | 8 | 8 | 100.0% |
| mv | aespa | 6 | 6 | 100.0% |
| mv | Kep1er | 6 | 6 | 100.0% |
| mv | THE BOYZ | 6 | 6 | 100.0% |
| mv | tripleS | 6 | 6 | 100.0% |

## External Acquisition

- YTM attempted: `0`
- YTM resolved: `0`
- MV attempted: `0`
- MV resolved: `0`
- MV review needed: `2`
- MV search attempted: `0`
- MV search resolved: `0`
- MV search review needed: `0`
- MV search unresolved: `0`
- MV search coverage lift: `+0`

## Title-Track Worst Cohorts

| year band | release kind | resolved | total | ratio | target | status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2021-2023 | ep | 25 | 77 | 32.5% | 74.0% | `fail` |
| 2024+ | ep | 117 | 224 | 52.2% | 82.0% | `fail` |
| 2024+ | album | 24 | 50 | 48.0% | 76.0% | `fail` |
| 2021-2023 | album | 12 | 18 | 66.7% | 68.0% | `fail` |
| 2024+ | single | 309 | 343 | 90.1% | 90.0% | `pass` |
| 2021-2023 | single | 94 | 103 | 91.3% | 84.0% | `pass` |

## Canonical MV Worst Cohorts

| year band | release kind | resolved | total | ratio | target | status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2024+ | single | 53 | 343 | 15.4% | 72.0% | `fail` |
| 2021-2023 | single | 0 | 103 | 0.0% | 50.0% | `fail` |
| 2024+ | ep | 24 | 224 | 10.7% | 55.0% | `fail` |
| 2024+ | album | 2 | 50 | 4.0% | 40.0% | `fail` |
| 2021-2023 | ep | 0 | 77 | 0.0% | 35.0% | `fail` |
| 2021-2023 | album | 0 | 18 | 0.0% | 28.0% | `fail` |
