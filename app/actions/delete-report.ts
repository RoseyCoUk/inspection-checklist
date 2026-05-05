"use server";

import { getSession } from "@/lib/session";
import { createServiceClient, PHOTO_BUCKET } from "@/lib/supabase";

export type DeleteResult = { error: string } | { ok: true };

export async function deleteReportAction(reportId: string): Promise<DeleteResult> {
  // D-12: Verify session before any mutation.
  // proxy.ts already blocked unauthenticated access to the page,
  // but server actions are reachable via direct POST — always verify inside.
  const authenticated = await getSession();
  if (!authenticated) {
    return { error: "Session expired — please log in again." };
  }

  const db = createServiceClient();

  // Step 1: Fetch photo_paths for all items in this report
  const { data: items, error: fetchErr } = await db
    .from("report_items")
    .select("photo_path")
    .eq("report_id", reportId);

  if (fetchErr) {
    return { error: fetchErr.message };
  }

  // Step 2: Collect all storage object paths (same logic as current client-side code)
  const storagePaths: string[] = [];
  for (const item of items ?? []) {
    if (item.photo_path) {
      const paths = item.photo_path
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter(Boolean);
      storagePaths.push(...paths);
    }
  }

  // Step 3: Delete storage objects before the DB row (BUG-06 pattern from Phase 1)
  if (storagePaths.length > 0) {
    const { error: storageErr } = await db.storage
      .from(PHOTO_BUCKET)
      .remove(storagePaths);
    if (storageErr) {
      // Non-blocking — orphan files preferable to stuck UI (Phase 1 decision)
      console.warn("Storage delete partial failure:", storageErr.message);
    }
  }

  // Step 4: Delete the DB row (cascade removes report_items)
  const { error: deleteErr } = await db
    .from("reports")
    .delete()
    .eq("id", reportId);

  if (deleteErr) {
    return { error: deleteErr.message };
  }

  return { ok: true };
}
