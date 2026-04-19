# Historical Catalog Completeness Summary

- generated_at: `2026-04-19`
- cutover status: `fail`

## Summary

- detail payload coverage: 24/24 (100.0%), pre-2024 4/4 (100.0%)
- detail trusted coverage: 23/24 (95.8%), pre-2024 4/4 (100.0%)
- title-track resolved coverage: 15/24 (62.5%), pre-2024 1/4 (25.0%), review queue 8
- canonical MV coverage: 5/24 (20.8%), pre-2024 0/4 (0.0%), mv review 0
- external acquisition pass: YTM attempted 0, resolved 0; MV attempted 0, resolved 0, review 0
- youtube MV search pass: attempted 10, resolved 6, review 4, unresolved 1592, coverage lift +0
- migration-critical first slice: title-track 0/18 (0.0%), canonical MV 0/18 (0.0%), gate fail
- worst title-track cohort: 2021-2023 ep 25.0% / target 74.0%
- worst canonical MV cohort: 2024+ ep 14.3% / target 55.0%
- release-detail null review queue: 24 rows
- historical catalog cutover gate: fail

## Overall Coverage

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 24 | 24 | 100.0% |
| detail trusted | 23 | 24 | 95.8% |
| title-track resolved | 15 | 24 | 62.5% |
| canonical MV | 5 | 24 | 20.8% |

## Pre-2024 Historical Slice

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 4 | 4 | 100.0% |
| detail trusted | 4 | 4 | 100.0% |
| title-track resolved | 1 | 4 | 25.0% |
| canonical MV | 0 | 4 | 0.0% |

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
| detail_trusted | `pass` | 95.8% | 85.0% | 100.0% | 50.0% |
| title_track_resolved | `fail` | 62.5% | 80.0% | 25.0% | 60.0% |
| canonical_mv | `fail` | 20.8% | 65.0% | 0.0% | 35.0% |

## Top Gap Entities (Pre-2024)

| domain | entity | gap rows | total rows | gap ratio |
| --- | --- | ---: | ---: | ---: |
| title_track | YOUNITE | 2 | 2 | 100.0% |
| title_track | ZEROBASEONE | 1 | 2 | 50.0% |
| mv | YOUNITE | 2 | 2 | 100.0% |
| mv | ZEROBASEONE | 2 | 2 | 100.0% |

## External Acquisition

- YTM attempted: `0`
- YTM resolved: `0`
- MV attempted: `0`
- MV resolved: `0`
- MV review needed: `0`
- MV search attempted: `10`
- MV search resolved: `6`
- MV search review needed: `4`
- MV search unresolved: `1592`
- MV search coverage lift: `+0`

## Title-Track Worst Cohorts

| year band | release kind | resolved | total | ratio | target | status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2021-2023 | ep | 1 | 4 | 25.0% | 74.0% | `fail` |
| 2024+ | ep | 4 | 7 | 57.1% | 82.0% | `fail` |
| 2024+ | single | 9 | 12 | 75.0% | 90.0% | `fail` |
| 2024+ | album | 1 | 1 | 100.0% | 76.0% | `pass` |

## Canonical MV Worst Cohorts

| year band | release kind | resolved | total | ratio | target | status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2024+ | ep | 1 | 7 | 14.3% | 55.0% | `fail` |
| 2024+ | album | 0 | 1 | 0.0% | 40.0% | `fail` |
| 2024+ | single | 4 | 12 | 33.3% | 72.0% | `fail` |
| 2021-2023 | ep | 0 | 4 | 0.0% | 35.0% | `fail` |
