# Historical Catalog Completeness Summary

- generated_at: `2026-08-23`
- cutover status: `fail`

## Summary

- detail payload coverage: 20/20 (100.0%), pre-2024 1/1 (100.0%)
- detail trusted coverage: 20/20 (100.0%), pre-2024 1/1 (100.0%)
- title-track resolved coverage: 15/20 (75.0%), pre-2024 1/1 (100.0%), review queue 5
- canonical MV coverage: 4/20 (20.0%), pre-2024 0/1 (0.0%), mv review 0
- external acquisition pass: YTM attempted 0, resolved 0; MV attempted 0, resolved 0, review 0
- youtube MV search pass: attempted 10, resolved 6, review 4, unresolved 1592, coverage lift +0
- migration-critical first slice: title-track 0/18 (0.0%), canonical MV 0/18 (0.0%), gate fail
- worst title-track cohort: 2024+ ep 44.4% / target 82.0%
- worst canonical MV cohort: 2024+ ep 11.1% / target 55.0%
- release-detail null review queue: 20 rows
- historical catalog cutover gate: fail

## Overall Coverage

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 20 | 20 | 100.0% |
| detail trusted | 20 | 20 | 100.0% |
| title-track resolved | 15 | 20 | 75.0% |
| canonical MV | 4 | 20 | 20.0% |

## Pre-2024 Historical Slice

| domain | covered | total | ratio |
| --- | ---: | ---: | ---: |
| detail payload | 1 | 1 | 100.0% |
| detail trusted | 1 | 1 | 100.0% |
| title-track resolved | 1 | 1 | 100.0% |
| canonical MV | 0 | 1 | 0.0% |

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
| title_track_resolved | `fail` | 75.0% | 80.0% | 100.0% | 60.0% |
| canonical_mv | `fail` | 20.0% | 65.0% | 0.0% | 35.0% |

## Top Gap Entities (Pre-2024)

| domain | entity | gap rows | total rows | gap ratio |
| --- | --- | ---: | ---: | ---: |
| mv | ZEROBASEONE | 1 | 1 | 100.0% |

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
| 2024+ | ep | 4 | 9 | 44.4% | 82.0% | `fail` |
| 2021-2023 | ep | 1 | 1 | 100.0% | 74.0% | `pass` |
| 2024+ | album | 1 | 1 | 100.0% | 76.0% | `pass` |
| 2024+ | single | 9 | 9 | 100.0% | 90.0% | `pass` |

## Canonical MV Worst Cohorts

| year band | release kind | resolved | total | ratio | target | status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 2024+ | ep | 1 | 9 | 11.1% | 55.0% | `fail` |
| 2024+ | album | 0 | 1 | 0.0% | 40.0% | `fail` |
| 2024+ | single | 3 | 9 | 33.3% | 72.0% | `fail` |
| 2021-2023 | ep | 0 | 1 | 0.0% | 35.0% | `fail` |
