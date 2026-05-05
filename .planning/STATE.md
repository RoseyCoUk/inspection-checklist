# Project State — inspection-checklist Fix Pass

**Current phase:** 3
**Last updated:** 2026-05-05

## Phase Status

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Bug Fixes & Code Quality | Complete | 4 |
| 2 | Auth & Row-Level Security | Complete | 4 |
| 3 | Storage Hardening | Complete | 3 |

## Active Work

**All phases complete.** Phase 3: Storage Hardening executed 2026-05-05. Production deployment pending — see PRODUCTION-DEPLOY.md.

## Completed Plans

| Plan | Name | Commit | Completed |
|------|------|--------|-----------|
| 01-A | Bug Fixes — Check Page + i18n | f43902b | 2026-05-04 |
| 01-B | Schema Migrations & Storage-Delete Fix | 7eb52e9 | 2026-05-04 |
| 01-C | UI Bug Fixes — 200-cap notice, dateFrom timezone, floor grouping | 5bdcb3c | 2026-05-04 |
| 01-D | Font Migration, robots noindex, ItemCategory widening | 628f141 | 2026-05-04 |

## Decisions

- useRef for double-submit guard (not useState): ref mutation is synchronous, fires before first await, closes re-render gap
- Compensating delete uses nested try/catch (not .catch()): Supabase FilterBuilder type has no .catch() method
- photo_path stores newline-joined paths: maintains backward compatibility with existing report readers
- i18n error display: always use t('key') in catch blocks, never expose raw Supabase error messages
- Storage remove errors are non-blocking (console.warn only): orphan files preferable to stuck delete UI
- Three schema migrations run as individual DDL statements via supabase CLI: additive DDL is idempotent via IF NOT EXISTS guards
- Date range filters use T00:00:00/T23:59:59 suffix for local-timezone boundary alignment
- Floor key extraction uses slice(0,-2) on room number string for correct multi-floor grouping
- next/font variable mode used for Inter and Cormorant Garamond: exposes fonts as CSS custom properties, preserves existing globals.css font-family rules with minimal changes
- ItemCategory union ordered paint|wallpaper|aluminum|hk first then original 7: matches CATEGORY_LABELS ordering in reports/page.tsx

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | A | 3min | 2 | 2 |
| 01 | B | 5min | 2 | 2 |
| 01 | C | 2min | 2 | 2 |
| 01 | D | 8min | 2 | 3 |

## Last Session

**Timestamp:** 2026-05-05
**Stopped at:** Phase 3 complete — all 3 plans executed. Storage hardened on test project. Production deployment pending — see PRODUCTION-DEPLOY.md.
