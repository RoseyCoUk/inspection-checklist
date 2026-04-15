"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase, PHOTO_BUCKET } from "@/lib/supabase";

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

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const [rep, setRep] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, worker_name, created_at, rooms(number), report_items(id, status, note, photo_path, checklist_items(label))")
        .eq("id", id)
        .single();
      if (error) setErr(error.message);
      else setRep(data as unknown as Detail);
    })();
  }, [id]);

  if (err) return <main><div className="card"><p style={{ color: "var(--red)" }}>Error: {err}</p></div></main>;
  if (!rep) return <main><p className="muted">Loading…</p></main>;

  const bad = rep.report_items.filter((i) => i.status === "bad");
  const good = rep.report_items.filter((i) => i.status === "good");

  return (
    <main>
      <Link href="/reports" className="muted" style={{ display: "inline-block", marginBottom: 12 }}>← Back to reports</Link>
      <div className="hdr">
        <h1>Room {rep.rooms?.number ?? "?"}</h1>
        <span className="sub">{rep.worker_name}</span>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 20 }}>
        {new Date(rep.created_at).toLocaleString()}
      </p>

      {bad.length > 0 && (
        <>
          <h2>Issues</h2>
          <div className="stack" style={{ marginBottom: 24 }}>
            {bad.map((it) => {
              const photoUrl = it.photo_path
                ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(it.photo_path).data.publicUrl
                : null;
              return (
                <div key={it.id} className="card" style={{ borderLeft: "3px solid var(--red)" }}>
                  <div className="row-between">
                    <strong style={{ color: "var(--brown)" }}>{it.checklist_items?.label}</strong>
                    <span className="badge bad">Bad</span>
                  </div>
                  {it.note && <p style={{ marginTop: 10 }}>{it.note}</p>}
                  {photoUrl && (
                    <img
                      src={photoUrl}
                      alt=""
                      style={{ maxWidth: "100%", marginTop: 12, borderRadius: 4, border: "1px solid var(--beige)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2>Passed ({good.length})</h2>
      <div className="card">
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {good.map((it) => (
            <li key={it.id} style={{ padding: "4px 0" }}>{it.checklist_items?.label}</li>
          ))}
          {good.length === 0 && <li className="muted">None</li>}
        </ul>
      </div>

      <div style={{ marginTop: 24 }}>
        <Link href="/reports" className="muted">← All reports</Link>
      </div>
    </main>
  );
}
