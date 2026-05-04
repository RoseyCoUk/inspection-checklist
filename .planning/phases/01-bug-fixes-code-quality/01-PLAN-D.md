---
phase: 01-bug-fixes-code-quality
plan: D
type: execute
wave: 1
depends_on: []
files_modified:
  - app/layout.tsx
  - app/globals.css
  - lib/types.ts
autonomous: true
requirements:
  - BUG-05
  - BUG-14

must_haves:
  truths:
    - "app/layout.tsx imports fonts via next/font/google (Cormorant_Garamond and Inter) — no Google CDN request at runtime"
    - "app/globals.css no longer contains the @import url('https://fonts.googleapis.com') line"
    - "app/layout.tsx metadata export includes robots: { index: false } so the tool is not indexed"
    - "lib/types.ts ItemCategory union includes 'wallpaper', 'aluminum', and 'hk' in addition to the existing 7 values"
    - "TypeScript compiles with zero errors across all three files"
  artifacts:
    - path: "app/layout.tsx"
      provides: "next/font imports, robots noindex metadata"
      contains: "Cormorant_Garamond"
    - path: "app/globals.css"
      provides: "Google Fonts @import removed"
      contains: "font-family: 'Inter'"
    - path: "lib/types.ts"
      provides: "Widened ItemCategory union"
      contains: "wallpaper"
  key_links:
    - from: "app/layout.tsx font variables"
      to: "html element className"
      via: "variable CSS class from next/font applied to <html>"
      pattern: "className.*cormorant|className.*inter|variable.*className"
    - from: "lib/types.ts ItemCategory"
      to: "supabase/schema.sql CHECK constraint"
      via: "same 8+2 values — TS type must match DB constraint exactly"
      pattern: "wallpaper.*aluminum.*hk"
---

<objective>
Migrate Google Fonts from a CDN @import to next/font/google (eliminating the external request), add robots noindex to the layout metadata, and widen the ItemCategory TypeScript union to match the DB CHECK constraint applied in Plan B.

Purpose: The CDN @import adds a render-blocking network request and leaks user IPs to Google. noindex keeps an internal tool out of search engines. The ItemCategory type fix ensures TypeScript catches category mismatches at compile time.

Output: Updated layout.tsx (next/font + noindex), globals.css (CDN import removed), lib/types.ts (widened union).
</objective>

<execution_context>
@C:/Users/watkb/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/watkb/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-bug-fixes-code-quality/01-CONTEXT.md

Next.js version: 16.2.3 (App Router). next/font/google API confirmed from node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md:
- Import: `import { Inter, Cormorant_Garamond } from 'next/font/google'`
- Non-variable fonts require explicit `weight` array
- Apply via `className` on the html element, OR use `variable` option to expose as CSS custom property
- Cormorant_Garamond is NOT a variable font — weights must be declared
</context>

<interfaces>
<!-- Current state of files being modified: -->

app/layout.tsx (current, 19 lines):
```typescript
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resort Checklist",
  description: "Room inspection checklist",
  // No robots field yet
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
```

app/globals.css (first line):
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
```
CSS then uses `font-family: 'Inter'` and `font-family: 'Cormorant Garamond'` in body/heading rules.

lib/types.ts ItemCategory (current):
```typescript
export type ItemCategory = "paint" | "mechanical" | "plumbing" | "electrical" | "furniture" | "cleaning" | "other";
// Missing: "wallpaper", "aluminum", "hk"
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task D-1: Migrate fonts to next/font and add robots noindex</name>
  <files>app/layout.tsx, app/globals.css</files>
  <read_first>
    - app/layout.tsx — read current content before editing
    - app/globals.css — read to find all font-family usages that reference 'Inter' and 'Cormorant Garamond' so you know whether to keep them or replace with CSS vars
  </read_first>
  <action>
**Change 1 — app/layout.tsx: Add next/font imports, apply to html, add noindex**

Rewrite `app/layout.tsx` to:

```typescript
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

// Inter is a variable font — no weight array needed
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Cormorant Garamond is NOT variable — declare all weights used in the app
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Resort Checklist",
  description: "Room inspection checklist",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
```

Using `variable` mode exposes the fonts as CSS custom properties `--font-inter` and `--font-cormorant`. The existing `globals.css` then references those vars instead of string names.

**Change 2 — app/globals.css: Remove CDN @import and update font-family references**

1. Remove the entire line 1:
   ```
   @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
   ```
   Delete it entirely. next/font handles loading.

2. In the `body` rule, update `font-family`:
   ```css
   /* BEFORE */
   font-family: 'Inter', system-ui, sans-serif;
   /* AFTER */
   font-family: var(--font-inter), system-ui, sans-serif;
   ```

3. If any heading/title rule uses `'Cormorant Garamond'`, update it to:
   ```css
   font-family: var(--font-cormorant), serif;
   ```
   If no heading rule exists, do not add one — the variable is available if CSS needs it.

Do not modify any other rules in globals.css.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `app/layout.tsx` contains `from "next/font/google"` import
    - `app/layout.tsx` contains `Cormorant_Garamond` import name
    - `app/layout.tsx` contains `Inter` import name
    - `app/layout.tsx` contains `robots: { index: false` in the metadata export
    - `app/layout.tsx` applies `inter.variable` and `cormorant.variable` on the `<html>` element
    - `app/globals.css` does NOT contain `fonts.googleapis.com`
    - `app/globals.css` does NOT contain `@import url` at any point
    - `app/globals.css` contains `var(--font-inter)` in the body font-family rule
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>Fonts loaded via next/font (no CDN request); robots noindex set; globals.css references CSS variables instead of string font names</done>
</task>

<task type="auto">
  <name>Task D-2: Widen ItemCategory TypeScript union (BUG-05 TS side)</name>
  <files>lib/types.ts</files>
  <read_first>lib/types.ts — read the full file (it is short) to see the current ItemCategory definition and all types before editing</read_first>
  <action>
In `lib/types.ts`, update the `ItemCategory` type union to add the three missing values that exist in the UI (`CATEGORY_LABELS` in reports/page.tsx) and are now enforced by the DB CHECK constraint (Plan B):

```typescript
// BEFORE:
export type ItemCategory = "paint" | "mechanical" | "plumbing" | "electrical" | "furniture" | "cleaning" | "other";

// AFTER:
export type ItemCategory = "paint" | "wallpaper" | "aluminum" | "hk" | "mechanical" | "plumbing" | "electrical" | "furniture" | "cleaning" | "other";
```

Add `"wallpaper"`, `"aluminum"`, and `"hk"` — these are the three values present in `CATEGORY_LABELS` in `app/reports/page.tsx` but absent from the type.

No other changes to `lib/types.ts`.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `lib/types.ts` contains `"wallpaper"` in the `ItemCategory` union
    - `lib/types.ts` contains `"aluminum"` in the `ItemCategory` union
    - `lib/types.ts` contains `"hk"` in the `ItemCategory` union
    - `lib/types.ts` `ItemCategory` union has exactly 10 members: paint, wallpaper, aluminum, hk, mechanical, plumbing, electrical, furniture, cleaning, other
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>
  <done>ItemCategory union matches the DB CHECK constraint and CATEGORY_LABELS exactly; TypeScript now catches any category drift at compile time</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Google CDN | External font request (eliminated by this plan) |
| Search engine crawlers → app | Metadata robots directive |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01D-01 | Information Disclosure | Google CDN font request exposes user IPs to Google | mitigate | next/font/google self-hosts fonts at build time — no browser request to Google CDN (BUG-14) |
| T-01D-02 | Information Disclosure | Internal manager tool indexed by search engines | mitigate | `robots: { index: false, follow: false }` in layout metadata prevents indexing (BUG-14 per CONTEXT.md discretion) |
| T-01D-03 | Tampering | TypeScript type narrower than DB CHECK allows silent category drift | mitigate | ItemCategory union widened to exactly match DB CHECK constraint — compiler catches mismatches (BUG-05) |
</threat_model>

<verification>
1. `grep -n "fonts.googleapis.com" app/globals.css` — returns no output (import removed)
2. `grep -n "next/font/google" app/layout.tsx` — shows import line
3. `grep -n "robots" app/layout.tsx` — shows noindex line
4. `grep -n "wallpaper.*aluminum.*hk\|hk.*wallpaper\|aluminum.*wallpaper" lib/types.ts` — returns ≥ 1 match (all three in union)
5. `npx tsc --noEmit` — exits 0
</verification>

<success_criteria>
- Google Fonts CDN @import removed from globals.css; fonts load via next/font at build time
- layout.tsx metadata has robots noindex
- ItemCategory includes wallpaper, aluminum, hk
- TypeScript compiles clean across all modified files
</success_criteria>

<output>
After completion, create `.planning/phases/01-bug-fixes-code-quality/01-D-SUMMARY.md` using the summary template.
</output>
