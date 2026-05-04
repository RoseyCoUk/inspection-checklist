---
phase: 01-bug-fixes-code-quality
plan: A
type: execute
wave: 1
depends_on: []
files_modified:
  - app/check/[roomId]/page.tsx
  - lib/i18n.ts
autonomous: true
requirements:
  - BUG-01
  - BUG-02
  - BUG-07
  - BUG-08
  - BUG-10
  - BUG-11

must_haves:
  truths:
    - "A fast double-tap of Submit never creates two report rows — the guard fires before any await"
    - "When submission fails mid-flight the compensating delete fires and the worker's form answers are intact (not reset)"
    - "The error 'Submission failed — please try again' appears in English or Arabic based on current lang"
    - "Items are inserted in a single bulk INSERT, not one-by-one"
    - "Photos are resized client-side to ≤1600px long edge at 0.7 JPEG quality before upload"
    - "The Add Photo input is disabled when 5 photos exist; a counter shows 'X / 5 photos' in real time"
    - "When checklist_items for the room type is empty, an empty-state message is shown rather than an infinite spinner"
    - "localStorage lang value is validated as 'en' or 'ar' before use; invalid values fall back to 'en'"
    - "submitError key exists in lib/i18n.ts for both en and ar"
  artifacts:
    - path: "app/check/[roomId]/page.tsx"
      provides: "Updated submission flow with all BUG-01/02/07/08/10/11 fixes"
      contains: "submittingRef"
    - path: "lib/i18n.ts"
      provides: "submitError i18n key in both en and ar"
      contains: "submitError"
  key_links:
    - from: "submit() function"
      to: "submittingRef.current"
      via: "synchronous set before first await"
      pattern: "submittingRef\\.current = true"
    - from: "submit() catch block"
      to: "supabase.from(\"reports\").delete()"
      via: "compensating delete — preserves answers, shows i18n error"
      pattern: "compensat|delete.*reportId"
    - from: "photo file input onChange"
      to: "draftPhotos.length"
      via: "disabled attribute when >= MAX_PHOTOS"
      pattern: "MAX_PHOTOS"
---

<objective>
Fix all six bugs that touch `app/check/[roomId]/page.tsx` and the i18n layer. This plan is the heaviest in the phase — it rewrites the submission function from scratch to be atomic and guarded, adds client-side photo resize, enforces the 5-photo cap, and wires a translated error message.

Purpose: Workers on slow mobile connections must never lose their work or create duplicates. The check page is the primary revenue-critical path for this app.

Output: A submission function that is double-submit-safe, atomic, bulk-writing, and photo-resizing; an i18n key for submission failure; an empty-state for zero-item rooms; and a validated lang read.
</objective>

<execution_context>
@C:/Users/watkb/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/watkb/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/01-bug-fixes-code-quality/01-CONTEXT.md

AGENTS.md note: Next.js 16.2.3 is installed. Read node_modules/next/dist/docs/ before writing layout or metadata APIs — but this plan touches no Next.js framework APIs beyond useRouter/useParams (already in use). No new Next.js API surface is introduced here.
</context>

<interfaces>
<!-- Current signatures and state in app/check/[roomId]/page.tsx that the executor must understand before editing. -->

State (lines 14-27 of current file):
```typescript
const [submitting, setSubmitting] = useState(false);    // BUG-01: replace with useRef
const [err, setErr] = useState<string | null>(null);    // reuse for submitError
const [draftPhotos, setDraftPhotos] = useState<File[]>([]);  // BUG-08: cap logic here
```

Current submit() (lines 113-157):
- Sets submitting via useState (not atomic — BUG-01)
- Inserts report_items one at a time in a for loop (BUG-07)
- No compensating delete on failure (BUG-02)
- No photo resize (BUG-08)
- Error shows raw e.message instead of i18n key (BUG-02/D-02/D-03)

Photo file input onChange (lines 302-307):
- Appends all selected files with no cap check (BUG-08)
- No counter display (D-05)

Empty-state guard (line 161):
```typescript
if (items.length === 0) return <main><div className="card"><p className="muted">{t("loading")}</p></div></main>;
// BUG-10: shows "Loading…" forever when room type has zero items. Must show empty-state message.
```

lang read in useLang() (lib/i18n.ts line 169):
```typescript
const saved = (localStorage.getItem("lang") as Lang) || "en";
// BUG-11: type cast bypasses runtime check — invalid values accepted silently
```

lib/i18n.ts dict structure (lines 7-117):
- English keys in `dict.en`, Arabic in `dict.ar`
- Key type is `keyof typeof dict.en`
- Access pattern: `t("submitError")` via `useT()` hook
</interfaces>

<tasks>

<task type="auto">
  <name>Task A-1: Add submitError i18n key and fix lang validation</name>
  <files>lib/i18n.ts</files>
  <read_first>lib/i18n.ts — read the full file to understand the dict structure, Key type, and useLang implementation before editing</read_first>
  <action>
Two changes to lib/i18n.ts:

1. Add `submitError` key to both `dict.en` and `dict.ar` objects (per D-02, D-03):
   - `dict.en.submitError`: `"Submission failed — please try again"`
   - `dict.ar.submitError`: `"فشل الإرسال — يرجى المحاولة مرة أخرى"`
   Place it after the `saving` key in both objects to keep related keys together.

2. Fix lang validation in `useLang()` (per BUG-11). Current code (line 169):
   ```typescript
   const saved = (localStorage.getItem("lang") as Lang) || "en";
   ```
   Replace with a runtime guard:
   ```typescript
   const raw = localStorage.getItem("lang");
   const saved: Lang = (raw === "en" || raw === "ar") ? raw : "en";
   ```
   This eliminates the unsafe type cast. Any value other than the two valid literals falls back to "en".
  </action>
  <verify>
    <automated>grep -n "submitError" "lib/i18n.ts" | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - `lib/i18n.ts` contains `submitError: "Submission failed — please try again"` in the `en` block
    - `lib/i18n.ts` contains `submitError:` in the `ar` block with an Arabic string (not empty)
    - `lib/i18n.ts` does NOT contain `(localStorage.getItem("lang") as Lang)` — the unsafe cast is gone
    - `lib/i18n.ts` contains `raw === "en" || raw === "ar"` runtime guard
    - TypeScript compiles without errors: `npx tsc --noEmit` exits 0 (run from project root)
  </acceptance_criteria>
  <done>submitError key exists in both locales with correct English text; lang read validates at runtime instead of casting</done>
</task>

<task type="auto">
  <name>Task A-2: Rewrite submit(), fix photo cap/resize/counter, fix empty-state</name>
  <files>app/check/[roomId]/page.tsx</files>
  <read_first>app/check/[roomId]/page.tsx — read the full file so you understand the current state, import list, and where each fix lands before writing a single line</read_first>
  <action>
Six changes to app/check/[roomId]/page.tsx. Make them all in one edit pass.

**Change 1 — BUG-01: Replace useState submitting guard with useRef (per D-10)**

Remove: `const [submitting, setSubmitting] = useState(false);`

Add at the top of component state declarations (after other useState calls):
```typescript
import { useEffect, useRef, useState } from "react";
// ...
const submittingRef = useRef(false);
```

At the start of `submit()`:
```typescript
async function submit() {
  if (!allAnswered || submittingRef.current) return;
  submittingRef.current = true;   // synchronous — no state re-render gap
  setErr(null);
  // ...
}
```

The `submitting` state variable is still needed for the button UI (disabled + label). Keep it as `useState` but only for UI feedback — the GUARD is the ref. Set `setSubmitting(true)` immediately after `submittingRef.current = true`. In the finally block: `submittingRef.current = false; setSubmitting(false);`

**Change 2 — BUG-07: Replace per-item INSERT loop with a single bulk insert**

Replace the `for (const it of items)` loop that calls `supabase.from("report_items").insert(...)` once per item with a single bulk insert AFTER all uploads:

```typescript
// Phase 1: resolve photo uploads in parallel per item
const itemRows: {
  report_id: string;
  checklist_item_id: string;
  status: string;
  note: string | null;
  photo_path: string | null;
}[] = [];

for (const it of items) {
  const ans = answers[it.id];
  let photo_path: string | null = null;
  if (ans.status === "bad" && ans.photos.length > 0) {
    const uploadResults = await Promise.all(
      ans.photos.map(async (file, i) => {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `reports/${reportId}/${it.id}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(PHOTO_BUCKET)
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        return path;
      })
    );
    photo_path = uploadResults.join("\n");
  }
  itemRows.push({
    report_id: reportId,
    checklist_item_id: it.id,
    status: ans.status!,
    note: ans.status === "bad" ? ans.note : null,
    photo_path,
  });
}

// Phase 2: single bulk insert
const { error: e2 } = await supabase.from("report_items").insert(itemRows);
if (e2) throw e2;
```

**Change 3 — BUG-02: Compensating delete + preserve form answers on error (per D-01, D-02)**

In the catch block of `submit()`, after the report row has been created (i.e., `reportId` is defined), attempt to delete the orphan reports row. Preserve the `answers` state — do NOT reset it. Show the i18n error string:

```typescript
} catch (e: any) {
  // Attempt compensating delete of the orphan reports row.
  // reportId may be undefined if the INSERT failed before returning an id.
  if (typeof reportId !== "undefined") {
    await supabase.from("reports").delete().eq("id", reportId).catch(() => {});
  }
  // D-01: do NOT reset answers — worker keeps all their work
  // D-02/D-03: use i18n key, not raw error message
  setErr(t("submitError"));
  submittingRef.current = false;
  setSubmitting(false);
}
```

Declare `let reportId: string | undefined;` before the try block so it is in scope in catch.

**Change 4 — BUG-08: Client-side photo resize + MAX_PHOTOS constant**

Add constant at module scope (outside component, per D-06):
```typescript
const MAX_PHOTOS = 5;
```

Add a canvas resize helper function at module scope:
```typescript
async function resizePhoto(file: File): Promise<File> {
  const MAX_LONG_EDGE = 1600;
  const QUALITY = 0.7;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const longEdge = Math.max(w, h);
      if (longEdge <= MAX_LONG_EDGE) {
        resolve(file);
        return;
      }
      const scale = MAX_LONG_EDGE / longEdge;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
```

In the photo file input `onChange` handler in the modal, replace the current handler with:
```typescript
onChange={async (e) => {
  const incoming = Array.from(e.target.files ?? []);
  e.target.value = "";
  if (!incoming.length) return;
  const remaining = MAX_PHOTOS - draftPhotos.length;
  if (remaining <= 0) return;
  const toAdd = incoming.slice(0, remaining);
  const resized = await Promise.all(toAdd.map(resizePhoto));
  setDraftPhotos((prev) => [...prev, ...resized]);
}}
```

**Change 5 — D-04/D-05: Disable input at cap; show photo counter**

In the modal's issue view, update the file input element:
```tsx
<input
  className="input"
  type="file"
  accept="image/*"
  capture="environment"
  multiple
  disabled={draftPhotos.length >= MAX_PHOTOS}
  onChange={/* as above */}
/>
```

After the input, add the counter (per D-05), shown at all times (not just when >0):
```tsx
<p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
  {draftPhotos.length} / {MAX_PHOTOS} photos
</p>
```

Remove the old `{draftPhotos.length > 0 && ...}` photo list wrapper; always render the photo list (the list naturally renders nothing when empty). Keep the individual photo remove buttons.

**Change 6 — BUG-10: Empty-state for zero checklist items**

Replace line:
```typescript
if (items.length === 0) return <main><div className="card"><p className="muted">{t("loading")}</p></div></main>;
```

With a proper loaded-but-empty guard. Add a `loaded` boolean state:
```typescript
const [loaded, setLoaded] = useState(false);
```

In the useEffect, after `setItems(list)` (and `setAnswers(init)`), set `setLoaded(true)`.

Change the empty-state guard to:
```typescript
if (loaded && items.length === 0) {
  return (
    <main>
      <div className="card">
        <p className="muted">No checklist items for this room type.</p>
      </div>
    </main>
  );
}
// Keep the existing loading guard (when !room) before this
```

The existing `if (!room)` guard handles the pre-load spinner. The new guard only fires after load completes with zero items.
  </action>
  <verify>
    <automated>npx tsc --noEmit 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `app/check/[roomId]/page.tsx` contains `submittingRef` (useRef guard) — `grep -c "submittingRef" app/check/[roomId]/page.tsx` returns ≥ 3
    - File contains `MAX_PHOTOS = 5` constant at module scope
    - File contains `resizePhoto` async function at module scope
    - File does NOT contain a `for.*items.*insert` pattern — the N+1 loop is gone; `grep -c "from..report_items..insert" app/check/[roomId]/page.tsx` returns 1 (the single bulk call)
    - File contains `supabase.from("reports").delete().eq("id", reportId)` in the catch block
    - File contains `t("submitError")` (not a raw error string) in the catch block
    - File contains `disabled={draftPhotos.length >= MAX_PHOTOS}` on the file input
    - File contains `/ ${MAX_PHOTOS} photos` for the counter
    - File contains `loaded` state and the empty-state message `No checklist items for this room type`
    - `npx tsc --noEmit` exits 0 — no TypeScript errors
  </acceptance_criteria>
  <done>All six bugs (BUG-01, BUG-02, BUG-07, BUG-08, BUG-10, BUG-11 via Plan A-1) are addressed; TypeScript compiles clean</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User device → Supabase storage | Photo file bytes uploaded from untrusted client |
| localStorage → component state | lang value read from user-controlled storage |
| Submit button → DB INSERT | Unauthenticated anon key can INSERT reports |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01A-01 | Denial of Service | submit() double-tap | mitigate | useRef guard set synchronously before first await prevents concurrent submissions from same session (BUG-01) |
| T-01A-02 | Tampering | Non-atomic submission leaves orphan rows | mitigate | Compensating delete in catch block removes partial report row (BUG-02) |
| T-01A-03 | Tampering | localStorage lang injection | mitigate | Runtime validation `raw === "en" \|\| raw === "ar"` before use; only two valid values accepted (BUG-11) |
| T-01A-04 | Denial of Service | Unbounded photo upload (size/count) | mitigate | MAX_PHOTOS=5 cap enforced in onChange; resize to ≤1600px at 0.7 quality before upload (BUG-08) |
| T-01A-05 | Information Disclosure | Raw Supabase error message shown to worker | mitigate | Catch block shows t("submitError") i18n string, not technical error detail (D-02) |
</threat_model>

<verification>
1. `npx tsc --noEmit` — exits 0
2. `grep -c "submittingRef" "app/check/[roomId]/page.tsx"` — returns ≥ 3
3. `grep -n "MAX_PHOTOS" "app/check/[roomId]/page.tsx"` — shows constant definition and usage sites
4. `grep -n "submitError" lib/i18n.ts` — shows 2 lines (one per locale)
5. `grep -v "^//" lib/i18n.ts | grep -c "submitError"` — returns 2
6. `grep -c "submittingRef.current = true" "app/check/[roomId]/page.tsx"` — returns 1
7. `grep -c "from.*reports.*delete.*reportId" "app/check/[roomId]/page.tsx"` — returns 1
</verification>

<success_criteria>
- TypeScript compiles with zero errors
- `app/check/[roomId]/page.tsx` contains useRef guard, bulk insert, compensating delete, resize helper, photo cap/counter, loaded empty-state
- `lib/i18n.ts` has submitError in both locales, lang validation uses runtime guard not type cast
- No deferred items (alert() replacement is explicitly out of scope per CONTEXT.md)
</success_criteria>

<output>
After completion, create `.planning/phases/01-bug-fixes-code-quality/01-A-SUMMARY.md` using the summary template.
</output>
