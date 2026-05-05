import { createServiceClient } from "@/lib/supabase";
import ReportDetailClient from "./ReportDetailClient";

type Detail = {
  id: string;
  worker_name: string;
  created_at: string;
  rooms: { number: string } | null;
  report_items: {
    id: string;
    status: "good" | "bad";
    note: string | null;
    photo_path: string | null;
    checklist_items: { label: string } | null;
  }[];
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>; // Next.js 16: params is a Promise, must await
}) {
  const { id } = await params;

  const db = createServiceClient();
  const { data, error } = await db
    .from("reports")
    .select("id, worker_name, created_at, rooms(number), report_items(id, status, note, photo_path, checklist_items(label))")
    .eq("id", id)
    .single();

  if (error || !data) {
    return (
      <main>
        <div className="card">
          <p style={{ color: "var(--red)" }}>
            Error loading report: {error?.message ?? "Not found"}
          </p>
        </div>
      </main>
    );
  }

  return <ReportDetailClient rep={data as unknown as Detail} />;
}
