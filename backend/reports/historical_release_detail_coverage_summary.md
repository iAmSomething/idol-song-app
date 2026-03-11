# Historical Catalog Completeness Summary

- generated_at: `2026-03-11`
- cutover status: `fail`

## Summary

- detail payload coverage: 1770/1770 (100.0%), pre-2024 1153/1153 (100.0%)
- detail trusted coverage: 1770/1770 (100.0%), pre-2024 1153/1153 (100.0%)
- title-track resolved coverage: 1201/1770 (67.8%), pre-2024 752/1153 (65.2%), review queue 569
- canonical MV coverage: 153/1770 (8.6%), pre-2024 74/1153 (6.4%), mv review 2
- external acquisition pass: YTM attempted 113, resolved 0; MV attempted 56, resolved 0, review 2
- youtube MV search pass: attempted 54, resolved 41, review 13, unresolved 1616, coverage lift +1
- migration-critical first slice: title-track 18/18 (100.0%), canonical MV 18/18 (100.0%), gate pass
- worst title-track cohort: 2021-2023 ep 31.4% / target 74.0%
- worst canonical MV cohort: 2024+ single 15.4% / target 72.0%
- release-detail null review queue: 1754 rows
- historical catalog cutover gate: fail

## Overall Coverage

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 1770 | 1770 | 100.0% |
| detail trusted | 1770 | 1770 | 100.0% |
| title-track resolved | 1201 | 1770 | 67.8% |
| canonical MV | 153 | 1770 | 8.6% |

## Pre-2024 Historical Slice

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 1153 | 1153 | 100.0% |
| detail trusted | 1153 | 1153 | 100.0% |
| title-track resolved | 752 | 1153 | 65.2% |
| canonical MV | 74 | 1153 | 6.4% |

## Migration-Critical First Slice

- entities: `BLACKPINK, BTS, SEVENTEEN, SHINee, TWICE`
- expected rows: `18`
- gate status: `pass`

| domain | before | after | threshold |
| --- | ---: | ---: | ---: |
| detail payload | 100.0% | 100.0% | 100.0% |
| detail trusted | 100.0% | 100.0% | 100.0% |
| title-track resolved | 100.0% | 100.0% | 100.0% |
| canonical MV | 100.0% | 100.0% | 100.0% |

## Cutover Gates

| gate | status | total | threshold | pre-2024 | threshold |
| --- | --- | ---: | ---: | ---: | ---: |
| detail_payload | `pass` | 100.0% | 100.0% | 100.0% | 100.0% |
| detail_trusted | `pass` | 100.0% | 85.0% | 100.0% | 50.0% |
| title_track_resolved | `fail` | 67.8% | 80.0% | 65.2% | 60.0% |
| canonical_mv | `fail` | 8.6% | 65.0% | 6.4% | 35.0% |

## Top Gap Entities (Pre-2024)

| domain | entity | gap rows | total rows | gap ratio |
| --- | --- | ---: | ---: | ---: |
| title_track | DAY6 | 18 | 25 | 72.0% |
| title_track | Dreamcatcher | 16 | 23 | 69.6% |
| title_track | MONSTA X | 13 | 56 | 23.2% |
| title_track | ATEEZ | 12 | 26 | 46.2% |
| title_track | VERIVERY | 12 | 13 | 92.3% |
| mv | MONSTA X | 56 | 56 | 100.0% |
| mv | SHINee | 43 | 47 | 91.5% |
| mv | BTOB | 37 | 37 | 100.0% |
| mv | MAMAMOO | 32 | 32 | 100.0% |
| mv | THE BOYZ | 32 | 32 | 100.0% |

## External Acquisition

- YTM attempted: `113`
- YTM resolved: `0`
- MV attempted: `56`
- MV resolved: `0`
- MV review needed: `2`
- MV search attempted: `54`
- MV search resolved: `41`
- MV search review needed: `13`
- MV search unresolved: `1616`
- MV search coverage lift: `+1`

## Title-Track Worst Cohorts

| year band | release kind | resolved | total | ratio | target | status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2021-2023 | ep | 79 | 252 | 31.4% | 74.0% | `fail` |
| 2024+ | album | 23 | 50 | 46.0% | 76.0% | `fail` |
| 2024+ | ep | 117 | 224 | 52.2% | 82.0% | `fail` |
| 2018-2020 | ep | 58 | 132 | 43.9% | 68.0% | `fail` |
| 2021-2023 | album | 34 | 63 | 54.0% | 68.0% | `fail` |
| 2018-2020 | album | 19 | 37 | 51.3% | 62.0% | `fail` |
| 2024+ | single | 309 | 343 | 90.1% | 90.0% | `pass` |
| 2021-2023 | single | 242 | 270 | 89.6% | 84.0% | `pass` |
| <=2017 | ep | 46 | 75 | 61.3% | 60.0% | `pass` |
| 2018-2020 | single | 139 | 159 | 87.4% | 78.0% | `pass` |

## Canonical MV Worst Cohorts

| year band | release kind | resolved | total | ratio | target | status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2024+ | single | 53 | 343 | 15.4% | 72.0% | `fail` |
| 2021-2023 | single | 13 | 270 | 4.8% | 50.0% | `fail` |
| 2024+ | ep | 24 | 224 | 10.7% | 55.0% | `fail` |
| 2024+ | album | 2 | 50 | 4.0% | 40.0% | `fail` |
| 2021-2023 | ep | 4 | 252 | 1.6% | 35.0% | `fail` |
| 2021-2023 | album | 2 | 63 | 3.2% | 28.0% | `fail` |
| 2018-2020 | single | 16 | 159 | 10.1% | 32.0% | `fail` |
| 2018-2020 | ep | 10 | 132 | 7.6% | 22.0% | `fail` |
| <=2017 | single | 10 | 127 | 7.9% | 20.0% | `fail` |
| 2018-2020 | album | 5 | 37 | 13.5% | 16.0% | `fail` |
