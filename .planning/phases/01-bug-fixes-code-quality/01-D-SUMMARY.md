---
phase: 01-bug-fixes-code-quality
plan: D
subsystem: ui
tags: [next/font, fonts, typescript, metadata, seo, robots]

# Dependency graph
requires:
  - phase: 01-bug-fixes-code-quality
    provides: Plan B widened DB CHECK constraint for ItemCategory to include wallpaper/aluminum/hk
provides:
  - next/font/google self-hosted fonts (no CDN request at runtime)
  - robots noindex metadata in layout
  - ItemCategory TypeScript union matching DB CHECK constraint exactly
affects: [02-auth-row-level-security, 03-storage-hardening]

# Tech tracking
tech-stack:
  added: [next/font/google]
  patterns: [CSS custom properties for fonts via next/font variable mode]

key-files:
  created: []
  modified:
    - app/layout.tsx
    - app/globals.css
    - lib/types.ts

key-decisions:
  - "next/font variable mode used (--font-inter, --font-cormorant) rather than className mode — preserves existing font-family rules in globals.css by switching string literals to CSS vars"
  - "All 'Cormorant Garamond' string references in globals.css updated to var(--font-cormorant) — ensures no string-based fallback circumvents the next/font loading"
  - "ItemCategory union ordered paint|wallpaper|aluminum|hk first then the original 7 — matches CATEGORY_LABELS ordering in reports/page.tsx"

patterns-established:
  - "Font loading: use next/font variable mode and CSS custom properties; never CDN @import"
  - "Internal tools: always set robots: { index: false, follow: false } in layout metadata"

requirements-completed: [BUG-05, BUG-14]

# Metrics
duration: 8min
completed: 2026-05-04
---

# Phase 1 Plan D: Font Migration + Type Widening Summary

**Self-hosted Inter and Cormorant Garamond via next/font CSS variables, robots noindex added, and ItemCategory union widened to 10 members matching DB CHECK constraint**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-04T08:00:00Z
- **Completed:** 2026-05-04T08:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Eliminated the render-blocking Google Fonts CDN request — fonts now self-hosted at build time via next/font
- Added `robots: { index: false, follow: false }` to layout metadata to prevent search engine indexing of this internal tool
- Widened ItemCategory TypeScript union from 7 to 10 members to match the DB CHECK constraint applied in Plan B and CATEGORY_LABELS in the reports page

## Task Commits

Each task was committed atomically:

1. **Task D-1: Migrate fonts to next/font and add robots noindex** - `26a19af` (feat)
2. **Task D-2: Widen ItemCategory TypeScript union** - `628f141` (feat)

**Plan metadata:** (see final docs commit)

## Files Created/Modified
- `app/layout.tsx` - Added next/font/google imports (Inter variable, Cormorant_Garamond with weights 400/600/700), CSS variable mode, robots noindex metadata, font variables applied to html element
- `app/globals.css` - Removed Google Fonts CDN @import; updated all font-family rules from string literals to CSS vars (--font-inter, --font-cormorant)
- `lib/types.ts` - ItemCategory union widened: added "wallpaper", "aluminum", "hk" (7 → 10 members)

## Decisions Made
- Used `variable` mode for both fonts rather than `className` mode — this exposes the fonts as `--font-inter` and `--font-cormorant` CSS custom properties, allowing the existing font-family rules in globals.css to reference them with minimal changes (just swap string literals for CSS vars)
- Updated all 4 locations in globals.css that referenced Cormorant Garamond string name (.room-tile .num, .item-label, h1/h2/h3) to maintain consistency

## Deviations from Plan

None — plan executed exactly as written. The plan noted that heading/title Cormorant Garamond references should be updated if present; they were present (h1/h2/h3, .room-tile .num, .item-label) and all were updated to CSS vars.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required. next/font downloads and self-hosts fonts at build time automatically.

## Next Phase Readiness
- Phase 1 (Plan D) complete — all 4 plans in Wave 1 now done
- Phase 2 (Auth & Row-Level Security) ready to start
- No blockers from this plan

## Threat Surface Scan
No new security-relevant surface introduced. This plan eliminated an external network boundary (Google CDN) and added a robots directive — both reductions in exposure, not additions.

## Self-Check: PASSED

- FOUND: app/layout.tsx
- FOUND: app/globals.css
- FOUND: lib/types.ts
- FOUND: .planning/phases/01-bug-fixes-code-quality/01-D-SUMMARY.md
- FOUND commit: 26a19af (Task D-1)
- FOUND commit: 628f141 (Task D-2)

---
*Phase: 01-bug-fixes-code-quality*
*Completed: 2026-05-04*
