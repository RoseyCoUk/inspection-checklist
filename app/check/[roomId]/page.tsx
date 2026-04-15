"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase, PHOTO_BUCKET } from "@/lib/supabase";
import type { ChecklistItem, Room } from "@/lib/types";

type Answer = { status: "good" | "bad" | null; note: string; photo: File | null };

export default function CheckPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [worker, setWorker] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const n = localStorage.getItem("worker_name");
    if (!n) { router.replace("/"); return; }
    setWorker(n);

    (async () => {
      const { data: r, error: e1 } = await supabase
        .from("rooms")
        .select("id, number, room_type_id, active, room_types(id, name)")
        .eq("id", roomId)
        .single();
      if (e1) { setErr(e1.message); return; }
      setRoom(r as unknown as Room);

      const { data: ci, error: e2 } = await supabase
        .from("checklist_items")
        .select("id, room_type_id, label, sort_order")
        .eq("room_type_id", (r as any).room_type_id)
        .order("sort_order");
      if (e2) { setErr(e2.message); return; }
      const list = (ci ?? []) as ChecklistItem[];
      setItems(list);
      const init: Record<string, Answer> = {};
      for (const it of list) init[it.id] = { status: null, note: "", photo: null };
      setAnswers(init);
    })();
  }, [roomId, router]);

  function setStatus(id: string, status: "good" | "bad") {
    setAnswers((a) => ({ ...a, [id]: { ...a[id], status } }));
  }
  function setNote(id: string, note: string) {
    setAnswers((a) => ({ ...a, [id]: { ...a[id], note } }));
  }
  function setPhoto(id: string, photo: File | null) {
    setAnswers((a) => ({ ...a, [id]: { ...a[id], photo } }));
  }

  const allAnswered = items.length > 0 && items.every((it) => answers[it.id]?.status !== null);
  const badIncomplete = items.some((it) => {
    const a = answers[it.id];
    return a?.status === "bad" && (!a.note.trim() || !a.photo);
  });

  async function submit() {
    if (!allAnswered || badIncomplete || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const { data: rep, error: e1 } = await supabase
        .from("reports")
        .insert({ room_id: roomId, worker_name: worker })
        .select("id")
        .single();
      if (e1) throw e1;
      const reportId = (rep as any).id as string;

      for (const it of items) {
        const ans = answers[it.id];
        let photo_path: string | null = null;
        if (ans.status === "bad" && ans.photo) {
          const ext = ans.photo.name.split(".").pop() || "jpg";
          const path = `reports/${reportId}/${it.id}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from(PHOTO_BUCKET)
            .upload(path, ans.photo, { upsert: true });
          if (upErr) throw upErr;
          photo_path = path;
        }
        const { error: e2 } = await supabase.from("report_items").insert({
          report_id: reportId,
          checklist_item_id: it.id,
          status: ans.status,
          note: ans.status === "bad" ? ans.note : null,
          photo_path,
        });
        if (e2) throw e2;
      }
      router.replace("/rooms?done=1");
    } catch (e: any) {
      setErr(e.message ?? String(e));
      setSubmitting(false);
    }
  }

  if (err) return <main><div className="card"><p style={{ color: "var(--red)" }}>Error: {err}</p></div></main>;
  if (!room) return <main><p className="muted">Loading…</p></main>;
  if (items.length === 0) return <main><div className="card"><p className="muted">No checklist items.</p></div></main>;

  const doneCount = items.filter((it) => answers[it.id]?.status !== null).length;
  const pct = Math.round((doneCount / items.length) * 100);

  return (
    <main>
      <Link href="/rooms" className="muted" style={{ display: "inline-block", marginBottom: 12 }}>← Back to rooms</Link>
      <div className="hdr">
        <h1>Room {room.number}</h1>
        <span className="sub">{worker}</span>
      </div>

      <div className="row-between muted" style={{ fontSize: 13 }}>
        <span>{doneCount} of {items.length} checked</span>
        <span>{pct}%</span>
      </div>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>

      <div className="stack" style={{ marginTop: 16 }}>
        {items.map((it) => {
          const a = answers[it.id];
          if (!a) return null;
          return (
            <div key={it.id} className="card">
              <div className="item-label" style={{ marginBottom: 12 }}>{it.label}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setStatus(it.id, "good")}
                  className={`btn good${a.status === "good" ? "" : " ghost"}`}
                  style={{ flex: 1 }}
                >
                  {a.status === "good" ? "✓ Good" : "Good"}
                </button>
                <button
                  type="button"
                  onClick={() => setStatus(it.id, "bad")}
                  className={`btn bad${a.status === "bad" ? "" : " ghost"}`}
                  style={{ flex: 1 }}
                >
                  {a.status === "bad" ? "✕ Issue" : "Issue"}
                </button>
              </div>

              {a.status === "bad" && (
                <div className="stack" style={{ marginTop: 12 }}>
                  <textarea
                    className="input"
                    value={a.note}
                    onChange={(e) => setNote(it.id, e.target.value)}
                    rows={2}
                    placeholder="Describe the issue"
                  />
                  <input
                    className="input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setPhoto(it.id, e.target.files?.[0] ?? null)}
                  />
                  {a.photo && <span className="muted" style={{ fontSize: 12 }}>📷 {a.photo.name}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24, position: "sticky", bottom: 16 }}>
        <button
          onClick={submit}
          disabled={!allAnswered || badIncomplete || submitting}
          className="btn"
          style={{ width: "100%", opacity: (!allAnswered || badIncomplete || submitting) ? 0.5 : 1 }}
        >
          {submitting ? "Saving…" : badIncomplete ? "Add note + photo for issues" : !allAnswered ? `${items.length - doneCount} item(s) left` : "Submit report"}
        </button>
      </div>
    </main>
  );
}
