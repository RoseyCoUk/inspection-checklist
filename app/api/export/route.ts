import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, PHOTO_BUCKET } from "@/lib/supabase";
import { getSessionFromRequest, verifySession } from "@/lib/session";

export async function GET(request: NextRequest) {
  // Step 1: Verify mgr-session cookie — same pattern as proxy.ts
  // Must use request.cookies (not next/headers) per project convention
  const token = getSessionFromRequest(request.cookies);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const valid = await verifySession(token);
  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Step 2: Parse ?ids=id1,id2,... query param
  const idsParam = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ reports: [], signedUrlMap: {} });
  }

  // Step 3: Fetch full report data via service role (bypasses RLS)
  const db = createServiceClient();
  const { data, error } = await db
    .from("reports")
    .select(
      "id, worker_name, created_at, rooms(number), report_items(id, status, note, photo_path, checklist_items(label, category))"
    )
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Step 4: Collect all photo paths across all report items
  const allPaths: string[] = [];
  for (const r of data ?? []) {
    for (const item of (r.report_items as any[]) ?? []) {
      if (item.photo_path) {
        allPaths.push(
          ...String(item.photo_path)
            .split(/\r?\n/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        );
      }
    }
  }

  // Step 5: Batch generate signed URLs — 3600 seconds = 1-hour TTL (STG-02 requirement)
  // Service role bypasses storage RLS — no storage SELECT policy needed
  const signedUrlMap: Record<string, string> = {};
  if (allPaths.length > 0) {
    const { data: signed } = await db.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(allPaths, 3600);
    // Return shape: Array<{ path: string; signedUrl: string; error: string | null }>
    for (const item of signed ?? []) {
      if (item.signedUrl && item.path) {
        signedUrlMap[item.path] = item.signedUrl;
      }
    }
  }

  return NextResponse.json({ reports: data ?? [], signedUrlMap });
}
