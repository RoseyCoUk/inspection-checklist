"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase, PHOTO_BUCKET } from "@/lib/supabase";
import type { ChecklistItem, Room } from "@/lib/types";
import { translateItem, useLang, useT } from "@/lib/i18n";
import LangToggle from "../../LangToggle";

type Answer = { status: "good" | "bad" | null; note: string; photos: File[] };

// BUG-08: maximum photos per checklist item
const MAX_PHOTOS = 5;

// BUG-08: resize photo to ≤1600px long edge at 0.7 JPEG quality before upload
async function resizePhoto(file: File): Promise<File> {
  const MAX_LONG_EDGE = 1600;
  const QUALITY = 0.7;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;
      const longEdge = Math.max(w, h);
      if (longEdge <= MAX_LONG_EDGE) {
        resolve(file);
        return;
      }
      const scale = MAX_LONG_EDGE / longEdge;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function CheckPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [worker, setWorker] = useState("");
  // BUG-01: useRef for synchronous double-submit guard; useState only drives UI
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<ChecklistItem | null>(null);
  const [modalMode, setModalMode] = useState<"choose" | "issue">("choose");
  const [draftNote, setDraftNote] = useState("");
  const [draftPhotos, setDraftPhotos] = useState<File[]>([]);
  const [prevChecked, setPrevChecked] = useState<Record<string, { status: "good" | "bad"; worker: string }>>({});
  // BUG-10: track whether data has finished loading to distinguish "loading" from "empty"
  const [loaded, setLoaded] = useState(false);
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
      for (const it of list) init[it.id] = { status: null, note: "", photos: [] };
      setAnswers(init);
      // BUG-10: mark load complete so empty-state can be shown
      setLoaded(true);

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
    setDraftPhotos(cur?.photos ?? []);
  }

  function closeModal() {
    setModalItem(null);
    setModalMode("choose");
    setDraftNote("");
    setDraftPhotos([]);
  }

  function markGood() {
    if (!modalItem) return;
    setAnswers((a) => ({ ...a, [modalItem.id]: { status: "good", note: "", photos: [] } }));
    closeModal();
  }

  function clearAnswer() {
    if (!modalItem) return;
    setAnswers((a) => ({ ...a, [modalItem.id]: { status: null, note: "", photos: [] } }));
    closeModal();
  }

  function saveIssue() {
    if (!modalItem) return;
    setAnswers((a) => ({ ...a, [modalItem.id]: { status: "bad", note: draftNote, photos: draftPhotos } }));
    closeModal();
  }

  const allAnswered = items.length > 0 && items.every((it) => answers[it.id]?.status !== null);
  const doneCount = items.filter((it) => answers[it.id]?.status !== null).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;

  async function submit() {
    // BUG-01: synchronous ref check — fires before any await, no re-render gap
    if (!allAnswered || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setErr(null);

    // BUG-02: declare reportId here so catch block can attempt compensating delete
    // Generate UUID client-side — avoids .select("id") which requires anon SELECT on reports (blocked by RLS)
    const reportId: string = crypto.randomUUID();

    try {
      const { error: e1 } = await supabase
        .from("reports")
        .insert({ id: reportId, room_id: roomId, worker_name: worker });
      if (e1) throw e1;

      // BUG-07: resolve all photo uploads then do a single bulk INSERT
      const itemRows: {
        report_id: string;
        checklist_item_id: string;
        status: string;
        note: string | null;
        photo_path: string | null;
      }[] = [];

      for (const it of items) {
        const ans = answers[it.id];
        let photo_path: string | null = null;
        if (ans.status === "bad" && ans.photos.length > 0) {
          const uploadResults = await Promise.all(
            ans.photos.map(async (file, i) => {
              const ext = file.name.split(".").pop() || "jpg";
              const path = `reports/${reportId}/${it.id}-${i}.${ext}`;
              const { error: upErr } = await supabase.storage
                .from(PHOTO_BUCKET)
                .upload(path, file);
              if (upErr) throw upErr;
              return path;
            })
          );
          photo_path = uploadResults.join("\n");
        }
        itemRows.push({
          report_id: reportId,
          checklist_item_id: it.id,
          status: ans.status!,
          note: ans.status === "bad" ? ans.note : null,
          photo_path,
        });
      }

      // Single bulk insert — replaces N+1 per-item inserts
      const { error: e2 } = await supabase.from("report_items").insert(itemRows);
      if (e2) throw e2;

      router.replace("/rooms?done=1");
    } catch (e: any) {
      console.error("[submit error]", e);
      // BUG-02: compensating delete of the orphan reports row (best-effort, may fail if RLS blocks anon DELETE)
      try {
        await supabase.from("reports").delete().eq("id", reportId);
      } catch {
        // best-effort — ignore if delete also fails
      }
      // D-01: do NOT reset answers — worker keeps all their work
      // D-02/D-03: use i18n key, not raw error message
      setErr(t("submitError"));
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (err) return <main><div className="card"><p style={{ color: "var(--red)" }}>Error: {err}</p></div></main>;
  if (!room) return <main><p className="muted">{t("loading")}</p></main>;
  // BUG-10: only show empty-state after load completes; before that show nothing (room guard above handles spinner)
  if (loaded && items.length === 0) {
    return (
      <main>
        <div className="card">
          <p className="muted">No checklist items for this room type.</p>
        </div>
      </main>
    );
  }

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
                  {answers[modalItem.id]?.status !== null && (
                    <button type="button" onClick={clearAnswer} className="btn ghost">↺ Uncheck</button>
                  )}
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
                {/* BUG-08: disabled at cap; D-05: always-visible counter */}
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  disabled={draftPhotos.length >= MAX_PHOTOS}
                  onChange={async (e) => {
                    const incoming = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (!incoming.length) return;
                    const remaining = MAX_PHOTOS - draftPhotos.length;
                    if (remaining <= 0) return;
                    const toAdd = incoming.slice(0, remaining);
                    const resized = await Promise.all(toAdd.map(resizePhoto));
                    setDraftPhotos((prev) => [...prev, ...resized]);
                  }}
                />
                <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                  {draftPhotos.length} / {MAX_PHOTOS} photos
                </p>
                <div className="stack" style={{ gap: 4 }}>
                  {draftPhotos.map((f, i) => (
                    <div key={i} className="row-between" style={{ fontSize: 12 }}>
                      <span className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📷 {f.name}</span>
                      <button
                        type="button"
                        onClick={() => setDraftPhotos((prev) => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}
                      >×</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={saveIssue} className="btn">
                  {t("save")}
                </button>
                {answers[modalItem.id]?.status !== null && (
                  <button type="button" onClick={clearAnswer} className="btn ghost">↺ Uncheck</button>
                )}
                <button type="button" onClick={closeModal} className="btn ghost">{t("cancel")}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
