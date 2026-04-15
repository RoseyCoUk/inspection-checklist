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

  const photoPathsFor = (p: string | null) =>
    p ? p.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];

  const roomNum = rep.rooms?.number ?? "unknown";
  const dateStr = new Date(rep.created_at).toISOString().slice(0, 10);
  const fileBase = `report-room-${roomNum}-${dateStr}`;

  const exportCsv = () => {
    const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Room", "Worker", "Date", "Item", "Status", "Note", "Photo"],
      ...rep.report_items.map((it) => [
        roomNum,
        rep.worker_name,
        new Date(rep.created_at).toLocaleString(),
        it.checklist_items?.label ?? "",
        it.status,
        it.note ?? "",
        photoPathsFor(it.photo_path)
          .map((p) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl)
          .join(" | "),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => esc(String(c))).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    const ensureSpace = (h: number) => {
      if (y + h > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`Room ${roomNum}`, margin, y);
    y += 24;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Worker: ${rep.worker_name}`, margin, y);
    y += 16;
    doc.text(`Date: ${new Date(rep.created_at).toLocaleString()}`, margin, y);
    y += 24;

    const loadImg = (url: string) =>
      new Promise<{ dataUrl: string; w: number; h: number } | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d")?.drawImage(img, 0, 0);
          try {
            resolve({ dataUrl: c.toDataURL("image/jpeg", 0.8), w: img.naturalWidth, h: img.naturalHeight });
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });

    if (bad.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      ensureSpace(20);
      doc.text("Issues", margin, y);
      y += 18;

      for (const it of bad) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        const label = it.checklist_items?.label ?? "";
        const labelLines = doc.splitTextToSize(`• ${label}  [BAD]`, pageW - margin * 2);
        ensureSpace(labelLines.length * 14 + 6);
        doc.text(labelLines, margin, y);
        y += labelLines.length * 14 + 2;

        if (it.note) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(11);
          const noteLines = doc.splitTextToSize(it.note, pageW - margin * 2 - 12);
          ensureSpace(noteLines.length * 13 + 4);
          doc.text(noteLines, margin + 12, y);
          y += noteLines.length * 13 + 4;
        }

        for (const p of photoPathsFor(it.photo_path)) {
          const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl;
          const img = await loadImg(url);
          if (img) {
            const maxW = pageW - margin * 2 - 12;
            const maxH = 260;
            let w = img.w;
            let h = img.h;
            const scale = Math.min(maxW / w, maxH / h, 1);
            w *= scale;
            h *= scale;
            ensureSpace(h + 8);
            doc.addImage(img.dataUrl, "JPEG", margin + 12, y, w, h);
            y += h + 8;
          }
        }
        y += 6;
      }
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    ensureSpace(20);
    doc.text(`Passed (${good.length})`, margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    if (good.length === 0) {
      ensureSpace(14);
      doc.text("None", margin, y);
    } else {
      for (const it of good) {
        const lines = doc.splitTextToSize(`• ${it.checklist_items?.label ?? ""}`, pageW - margin * 2);
        ensureSpace(lines.length * 14);
        doc.text(lines, margin, y);
        y += lines.length * 14;
      }
    }

    doc.save(`${fileBase}.pdf`);
  };

  return (
    <main>
      <style>{`@media print { .no-print { display: none !important; } main { max-width: 100% !important; } a { color: #000 !important; } }`}</style>
      <Link href="/reports" className="muted no-print" style={{ display: "inline-block", marginBottom: 12 }}>← Back to reports</Link>
      <div className="hdr">
        <h1>Room {rep.rooms?.number ?? "?"}</h1>
        <span className="sub">{rep.worker_name}</span>
      </div>
      <p className="muted" style={{ marginTop: -10, marginBottom: 16 }}>
        {new Date(rep.created_at).toLocaleString()}
      </p>
      <div className="no-print row-between" style={{ marginBottom: 20, gap: 8 }}>
        <button className="btn ghost" onClick={exportCsv}>Export CSV</button>
        <button className="btn ghost" onClick={exportPdf}>Export PDF</button>
      </div>

      {bad.length > 0 && (
        <>
          <h2>Issues</h2>
          <div className="stack" style={{ marginBottom: 24 }}>
            {bad.map((it) => {
              const photoUrls = photoPathsFor(it.photo_path).map(
                (p) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl
              );
              return (
                <div key={it.id} className="card" style={{ borderLeft: "3px solid var(--red)" }}>
                  <div className="row-between">
                    <strong style={{ color: "var(--brown)" }}>{it.checklist_items?.label}</strong>
                    <span className="badge bad">Bad</span>
                  </div>
                  {it.note && <p style={{ marginTop: 10 }}>{it.note}</p>}
                  {photoUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt=""
                      style={{ maxWidth: "100%", marginTop: 12, borderRadius: 4, border: "1px solid var(--beige)" }}
                    />
                  ))}
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

      <div style={{ marginTop: 24 }} className="no-print">
        <Link href="/reports" className="muted">← All reports</Link>
      </div>
    </main>
  );
}
