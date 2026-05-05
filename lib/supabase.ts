import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon);

export const PHOTO_BUCKET = "checklist-photos";

// Server-only service-role client — bypasses RLS by design.
// Only import this in server components and server actions, NEVER in client components.
// Protected by the proxy.ts session gate on all /reports/* routes.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
