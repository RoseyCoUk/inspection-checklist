"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, PHOTO_BUCKET } from "@/lib/supabase";
import type { ChecklistItem, Room } from "@/lib/types";

type Answer = { status: "good" | "bad"; note?: string; photo?: File };

export default function CheckPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [mode, setMode] = useState<"ask" | "bad">("ask");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
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
      setItems((ci ?? []) as ChecklistItem[]);
    })();
  }, [roomId, router]);

  const current = items[idx];
  const done = items.length > 0 && idx >= items.length;
  const pct = items.length ? Math.round((idx / items.length) * 100) : 0;

  function markGood() {
    setAnswers((a) => [...a, { status: "good" }]);
    setIdx((i) => i + 1);
  }

  function markBadStart() {
    setMode("bad");
    setNote("");
    setPhoto(null);
  }

  function submitBad(e: React.FormEvent) {
    e.preventDefault();
    setAnswers((a) => [...a, { status: "bad", note, photo: photo ?? undefined }]);
    setMode("ask");
    setIdx((i) => i + 1);
  }

  useEffect(() => {
    if (!done || submitting) return;
    (async () => {
      setSubmitting(true);
      try {
        const { data: rep, error: e1 } = await supabase
          .from("reports")
          .insert({ room_id: roomId, worker_name: worker })
          .select("id")
          .single();
        if (e1) throw e1;
        const reportId = (rep as any).id as string;

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const ans = answers[i];
          let photo_path: string | null = null;

          if (ans.status === "bad" && ans.photo) {
            const ext = ans.photo.name.split(".").pop() || "jpg";
            const path = `reports/${reportId}/${item.id}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from(PHOTO_BUCKET)
              .upload(path, ans.photo, { upsert: true });
            if (upErr) throw upErr;
            photo_path = path;
          }

          const { error: e2 } = await supabase.from("report_items").insert({
            report_id: reportId,
            checklist_item_id: item.id,
            status: ans.status,
            note: ans.note ?? null,
            photo_path,
          });
          if (e2) throw e2;
        }

        router.replace("/rooms?done=1");
      } catch (e: any) {
        setErr(e.message ?? String(e));
        setSubmitting(false);
      }
    })();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <main><div className="card"><p style={{ color: "var(--red)" }}>Error: {err}</p></div></main>;
  if (!room) return <main><p className="muted">Loading…</p></main>;
  if (items.length === 0) return <main><div className="card"><p className="muted">No checklist items for this room type.</p></div></main>;
  if (done) return <main><div className="card"><p className="muted">Saving report…</p></div></main>;

  return (
    <main>
      <div className="hdr">
        <h1>Room {room.number}</h1>
        <span className="sub">{room.room_types?.name}</span>
      </div>

      <div className="row-between muted" style={{ fontSize: 13 }}>
        <span>Step {idx + 1} of {items.length}</span>
        <span>{worker}</span>
      </div>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>

      <div className="card">
        <div className="item-label">{current.label}</div>

        {mode === "ask" && (
          <div className="stack" style={{ marginTop: 20 }}>
            <button onClick={markGood} className="btn good">Good</button>
            <button onClick={markBadStart} className="btn bad">Report Issue</button>
          </div>
        )}

        {mode === "bad" && (
          <form onSubmit={submitBad} className="stack" style={{ marginTop: 16 }}>
            <label className="muted" style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
              What&apos;s wrong?
            </label>
            <textarea
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              rows={3}
              placeholder="Describe the issue"
            />
            <label className="muted" style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
              Photo
            </label>
            <input
              className="input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              required
            />
            <button type="submit" className="btn">Save & continue</button>
            <button type="button" onClick={() => setMode("ask")} className="btn ghost">Cancel</button>
          </form>
        )}
      </div>
    </main>
  );
}
