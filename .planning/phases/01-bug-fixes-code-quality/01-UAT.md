---
status: complete
phase: 01-bug-fixes-code-quality
source: [01-A-SUMMARY.md, 01-B-SUMMARY.md, 01-C-SUMMARY.md, 01-D-SUMMARY.md]
started: 2026-05-04T00:00:00Z
updated: 2026-05-04T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Photo upload cap — 5 max with disabled input and counter
expected: |
  Open any checklist room. Add 5 photos to a single item.
  After the 5th photo, the photo upload button is disabled (greyed out / not tappable).
  A counter shows "5/5" or similar indicating the cap is reached.
  Attempting to add a 6th photo is not possible.
result: pass

### 2. Photo resize — large photos upload without timeout or quality loss
expected: |
  Take or select a high-resolution photo (e.g. from a modern iPhone camera, ~4-12 MB).
  Attach it to a checklist item and submit the report.
  The upload completes without a timeout error. The stored photo is ≤400 KB.
  (No error message appears during or after submission.)
result: pass
note: "6MB source photo compressed to 340KB — well within cap"

### 3. Empty-state for zero-item room type
expected: |
  Navigate to a room type that has no checklist items configured.
  The page should show a message like "No items for this room type" (or similar) instead of a
  loading spinner that never resolves.
result: pass
note: "Shows 'No checklist items for this room type.' — confirmed via screenshot"

### 4. Submission error message is translated
expected: |
  If a submission fails (e.g. briefly go offline, then try submitting a report), an error message
  appears in the current language (Arabic or English — whichever is selected).
  The raw Supabase error is NOT shown. The message is localized.
result: pass
note: "Shows 'Error: Submission failed — please try again' — clean English message, no raw Supabase error"

### 5. Delete report removes photos from storage
expected: |
  On the reports page, delete a report that has photos attached.
  The row disappears from the list.
  (Optional advanced check: confirm in Supabase Storage dashboard that checklist-photos
  bucket no longer contains that report's files — the bucket does not grow on repeated delete+submit cycles.)
result: pass
note: "Initially failed — missing anon DELETE policy on storage bucket. Fixed by adding policy to both test and production projects. Confirmed working after fix."

### 6. 200-cap notice on reports page
expected: |
  On the reports page, if there are more than 200 reports in the system, a notice appears near
  the top of the list saying something like "Showing most recent 200 reports. Use filters to narrow results."
  (If fewer than 200 reports exist, this test can be skipped.)
result: skipped
reason: "Fewer than 200 reports in test environment — not triggerable without production data"

### 7. Date filter returns correct day results
expected: |
  On the reports page, set the "From" date filter to today's date.
  Reports submitted today should appear in the results.
  Reports from yesterday or earlier should not appear.
  (Tests that the timezone boundary is correct — reports from 00:00 to 23:59 local time today.)
result: skipped
reason: "Not enough historical test data to verify boundary behaviour"

### 8. Floor grouping on rooms page
expected: |
  On the rooms page, rooms with numbers like 1001, 1002, 1003 should be grouped under floor "10",
  not floor "1".
  Rooms 201, 202 should group under floor "2".
  Multi-digit floor prefixes should be handled correctly.
result: pass
note: "Floor grouping correct (1001/1002 → Floor 10, not Floor 1). Floors displayed in lexicographic order (1,10,11,2,9) — user requested numeric ascending sort as follow-up fix."

## Summary

total: 8
passed: 6
issues: 0
pending: 0
skipped: 2
skipped: 0
blocked: 0

## Gaps

- truth: "Deleting a report removes its photos from the checklist-photos storage bucket"
  status: resolved
  reason: "Missing anon DELETE policy on storage — fixed by adding policy to both projects. Confirmed working."
  severity: major
  test: 5
