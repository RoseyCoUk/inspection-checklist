# Project State — inspection-checklist Fix Pass

**Current phase:** 1
**Last updated:** 2026-05-04

## Phase Status

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Bug Fixes & Code Quality | In progress (Plans A, B, C complete) | 4 |
| 2 | Auth & Row-Level Security | Pending | — |
| 3 | Storage Hardening | Pending | — |

## Active Work

**Phase 1: Bug Fixes & Code Quality** — 4 plans, 1 wave, all autonomous.

Plans A, B, C complete 2026-05-04. Plan D pending.

## Completed Plans

| Plan | Name | Commit | Completed |
|------|------|--------|-----------|
| 01-A | Bug Fixes — Check Page + i18n | f43902b | 2026-05-04 |
| 01-B | Schema Migrations & Storage-Delete Fix | 7eb52e9 | 2026-05-04 |
| 01-C | UI Bug Fixes — 200-cap notice, dateFrom timezone, floor grouping | 5bdcb3c | 2026-05-04 |

## Decisions

- useRef for double-submit guard (not useState): ref mutation is synchronous, fires before first await, closes re-render gap
- Compensating delete uses nested try/catch (not .catch()): Supabase FilterBuilder type has no .catch() method
- photo_path stores newline-joined paths: maintains backward compatibility with existing report readers
- i18n error display: always use t('key') in catch blocks, never expose raw Supabase error messages
- Storage remove errors are non-blocking (console.warn only): orphan files preferable to stuck delete UI
- Three schema migrations run as individual DDL statements via supabase CLI: additive DDL is idempotent via IF NOT EXISTS guards
- Date range filters use T00:00:00/T23:59:59 suffix for local-timezone boundary alignment
- Floor key extraction uses slice(0,-2) on room number string for correct multi-floor grouping

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | A | 3min | 2 | 2 |
| 01 | B | 5min | 2 | 2 |
| 01 | C | 2min | 2 | 2 |

## Last Session

**Timestamp:** 2026-05-04T07:40:30Z
**Stopped at:** Completed 01-C plan (Plan C — UI bug fixes: 200-cap notice, dateFrom timezone, floor grouping)
**Resume file:** None
