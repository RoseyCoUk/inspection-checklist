"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase, PHOTO_BUCKET } from "@/lib/supabase";
import type { ChecklistItem, Room } from "@/lib/types";
import { translateItem, useLang, useT } from "@/lib/i18n";
import LangToggle from "../../LangToggle";

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
  const [modalItem, setModalItem] = useState<ChecklistItem | null>(null);
  const [modalMode, setModalMode] = useState<"choose" | "issue">("choose");
  const [draftNote, setDraftNote] = useState("");
  const [draftPhoto, setDraftPhoto] = useState<File | null>(null);
  const [prevChecked, setPrevChecked] = useState<Record<string, { status: "good" | "bad"; worker: string }>>({});
  const [lang] = useLang();
  const t = useT();

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

      const { data: lastRep } = await supabase
        .from("reports")
        .select("id, worker_name")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastRep) {
        const { data: prevItems } = await supabase
          .from("report_items")
          .select("checklist_item_id, status")
          .eq("report_id", (lastRep as any).id);
        const map: Record<string, { status: "good" | "bad"; worker: string }> = {};
        for (const p of (prevItems ?? []) as any[]) {
          map[p.checklist_item_id] = { status: p.status, worker: (lastRep as any).worker_name };
        }
        setPrevChecked(map);
      }
    })();
  }, [roomId, router]);

  function openItem(it: ChecklistItem) {
    const cur = answers[it.id];
    setModalItem(it);
    setModalMode(cur?.status === "bad" ? "issue" : "choose");
    setDraftNote(cur?.note ?? "");
    setDraftPhoto(cur?.photo ?? null);
  }

  function closeModal() {
    setModalItem(null);
    setModalMode("choose");
    setDraftNote("");
    setDraftPhoto(null);
  }

  function markGood() {
    if (!modalItem) return;
    setAnswers((a) => ({ ...a, [modalItem.id]: { status: "good", note: "", photo: null } }));
    closeModal();
  }

  function saveIssue() {
    if (!modalItem) return;
    setAnswers((a) => ({ ...a, [modalItem.id]: { status: "bad", note: draftNote, photo: draftPhoto } }));
    closeModal();
  }

  const allAnswered = items.length > 0 && items.every((it) => answers[it.id]?.status !== null);
  const doneCount = items.filter((it) => answers[it.id]?.status !== null).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  async function submit() {
    if (!allAnswered || submitting) return;
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
  if (!room) return <main><p className="muted">{t("loading")}</p></main>;
  if (items.length === 0) return <main><div className="card"><p className="muted">{t("loading")}</p></div></main>;

  return (
    <main>
      <LangToggle />
      <Link href="/rooms" className="muted" style={{ display: "inline-block", marginBottom: 12 }}>← {t("backToRooms")}</Link>
      <div className="hdr">
        <h1>{t("room")} {room.number}</h1>
        <span className="sub">{worker}</span>
      </div>

      <div className="row-between muted" style={{ fontSize: 13 }}>
        <span>{doneCount} {t("of")} {items.length} {t("checked")}</span>
        <span>{pct}%</span>
      </div>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>

      <div className="stack" style={{ marginTop: 16 }}>
        {items.map((it) => {
          const a = answers[it.id];
          const status = a?.status;
          const prev = prevChecked[it.id];
          const isPrev = !!prev && status === null;
          const bg = "#FFFFFF";
          const borderColor = status === "good" ? "#4a7a3a" : status === "bad" ? "#a83232" : isPrev ? "#C9BAA8" : "#B8962E";
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => openItem(it)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background: bg,
                border: "1px solid #C9BAA8",
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: 6,
                cursor: "pointer",
                textAlign: "start",
                fontFamily: "inherit",
                fontSize: 16,
                color: "#3A2A1A",
                fontWeight: 500,
                width: "100%",
              }}
            >
              <span style={{
                width: 24, height: 24, borderRadius: 4,
                border: `2px solid ${borderColor}`,
                background: status ? borderColor : "transparent",
                color: "var(--white)", fontSize: 16, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {status === "good" ? "✓" : status === "bad" ? "!" : ""}
              </span>
              <span style={{
                flex: 1,
                color: isPrev ? "#6B5D4F" : "#3A2A1A",
                textDecoration: isPrev ? "line-through" : "none",
              }}>
                {translateItem(it.label, lang)}
                {isPrev && (
                  <span style={{ display: "block", fontSize: 11, marginTop: 2, textDecoration: "none", color: "#6B5D4F" }}>
                    {prev.status === "bad" ? "!" : "✓"} {prev.worker}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: status === "good" ? "#4a7a3a" : status === "bad" ? "#a83232" : "#6B5D4F" }}>
                {status === "good" ? t("good") : status === "bad" ? t("issue") : ""}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 24, position: "sticky", bottom: 16 }}>
        <button
          onClick={submit}
          disabled={!allAnswered || submitting}
          className="btn"
          style={{ width: "100%", opacity: (!allAnswered || submitting) ? 0.5 : 1 }}
        >
          {submitting ? t("saving") : !allAnswered ? `${items.length - doneCount} ${t("itemsLeft")}` : t("submitReport")}
        </button>
      </div>

      {modalItem && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(58,42,26,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16, zIndex: 100,
          }}
        >
          <div
            style={{
              background: "var(--white)", borderRadius: 10, padding: 24,
              maxWidth: 420, width: "100%", border: "1px solid var(--beige)",
              maxHeight: "90vh", overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{translateItem(modalItem.label, lang)}</h2>

            {modalMode === "choose" && (
              <>
                <p className="muted" style={{ marginBottom: 16 }}>{t("goodOrIssue")}</p>
                <div className="stack">
                  <button type="button" onClick={markGood} className="btn good">✓ {t("good")}</button>
                  <button type="button" onClick={() => setModalMode("issue")} className="btn bad">! {t("issue")}</button>
                  <button type="button" onClick={closeModal} className="btn ghost">{t("cancel")}</button>
                </div>
              </>
            )}

            {modalMode === "issue" && (
              <div className="stack">
                <label className="muted" style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {t("describeIssue")}
                </label>
                <textarea
                  className="input"
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={3}
                  placeholder={t("describeIssue")}
                />
                <label className="muted" style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>
                  {t("photo")}
                </label>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setDraftPhoto(e.target.files?.[0] ?? null)}
                />
                {draftPhoto && <span className="muted" style={{ fontSize: 12 }}>📷 {draftPhoto.name}</span>}
                <button type="button" onClick={saveIssue} className="btn">
                  {t("save")}
                </button>
                <button type="button" onClick={closeModal} className="btn ghost">{t("cancel")}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
