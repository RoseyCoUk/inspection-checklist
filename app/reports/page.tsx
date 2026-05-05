import { createServiceClient } from "@/lib/supabase";
import ReportsClient from "./ReportsClient";

type BadItem = { category: string; label: string };
export type ReportRow = {
  id: string;
  worker_name: string;
  created_at: string;
  rooms: { number: string } | null;
  bad_count: number;
  bad_items: BadItem[];
};

export default async function ReportsPage() {
  const db = createServiceClient();
  const { data, error } = await db
    .from("reports")
    .select("id, worker_name, created_at, rooms(number), report_items(status, checklist_items(label, category))")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return (
      <main>
        <div className="card">
          <p style={{ color: "var(--red)" }}>Error loading reports: {error.message}</p>
        </div>
      </main>
    );
  }

  const rows: ReportRow[] = (data ?? []).map((r: any) => {
    const bad = (r.report_items ?? [])
      .filter((i: any) => i.status === "bad")
      .map((i: any) => ({
        category: i.checklist_items?.category ?? "other",
        label: i.checklist_items?.label ?? "",
      }));
    return {
      id: r.id,
      worker_name: r.worker_name,
      created_at: r.created_at,
      rooms: r.rooms,
      bad_count: bad.length,
      bad_items: bad,
    };
  });

  return <ReportsClient initialRows={rows} />;
}
