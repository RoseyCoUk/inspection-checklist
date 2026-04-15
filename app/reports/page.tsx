"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, PHOTO_BUCKET } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import LangToggle from "../LangToggle";

type Row = {
  id: string;
  worker_name: string;
  created_at: string;
  rooms: { number: string } | null;
  bad_count: number;
};

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | "csv" | "pdf">(null);
  const t = useT();

  const photoPathsFor = (p: string | null) =>
    p ? p.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];

  async function fetchAllDetailed() {
    const { data, error } = await supabase
      .from("reports")
      .select("id, worker_name, created_at, rooms(number), report_items(id, status, note, photo_path, checklist_items(label))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as any[];
  }

  async function exportAllCsv() {
    setExporting("csv");
    try {
      const reports = await fetchAllDetailed();
      const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
      const header = ["Date", "Room", "Worker", "Item", "Status", "Note", "Photos"];
      const lines: string[][] = [header];
      for (const r of reports) {
        for (const it of r.report_items ?? []) {
          lines.push([
            new Date(r.created_at).toLocaleString(),
            r.rooms?.number ?? "",
            r.worker_name,
            it.checklist_items?.label ?? "",
            it.status,
            it.note ?? "",
            photoPathsFor(it.photo_path)
              .map((p) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl)
              .join(" | "),
          ]);
        }
      }
      const csv = lines.map((r) => r.map((c) => esc(String(c))).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `all-reports-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message ?? String(e));
    } finally {
      setExporting(null);
    }
  }

  async function exportAllPdf() {
    setExporting("pdf");
    try {
      const reports = await fetchAllDetailed();
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = margin;
      let first = true;

      const ensureSpace = (h: number) => {
        if (y + h > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      };
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

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("All Inspection Reports", margin, y);
      y += 22;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Exported ${new Date().toLocaleString()} — ${reports.length} reports`, margin, y);
      y += 20;

      for (const r of reports) {
        if (!first) {
          doc.addPage();
          y = margin;
        }
        first = false;

        const bad = (r.report_items ?? []).filter((i: any) => i.status === "bad");
        const good = (r.report_items ?? []).filter((i: any) => i.status === "good");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`Room ${r.rooms?.number ?? "?"}`, margin, y);
        y += 20;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`Worker: ${r.worker_name}`, margin, y);
        y += 14;
        doc.text(`Date: ${new Date(r.created_at).toLocaleString()}`, margin, y);
        y += 20;

        if (bad.length > 0) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          ensureSpace(18);
          doc.text("Issues", margin, y);
          y += 16;
          for (const it of bad) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            const labelLines = doc.splitTextToSize(`• ${it.checklist_items?.label ?? ""}  [BAD]`, pageW - margin * 2);
            ensureSpace(labelLines.length * 14 + 4);
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
                const maxH = 240;
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
            y += 4;
          }
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        ensureSpace(18);
        doc.text(`Passed (${good.length})`, margin, y);
        y += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        if (good.length === 0) {
          ensureSpace(14);
          doc.text("None", margin, y);
          y += 14;
        } else {
          for (const it of good) {
            const lines = doc.splitTextToSize(`• ${it.checklist_items?.label ?? ""}`, pageW - margin * 2);
            ensureSpace(lines.length * 14);
            doc.text(lines, margin, y);
            y += lines.length * 14;
          }
        }
      }

      doc.save(`all-reports-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      alert(e.message ?? String(e));
    } finally {
      setExporting(null);
    }
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, worker_name, created_at, rooms(number), report_items(status)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) { setErr(error.message); setLoading(false); return; }
      const mapped: Row[] = (data ?? []).map((r: any) => ({
        id: r.id,
        worker_name: r.worker_name,
        created_at: r.created_at,
        rooms: r.rooms,
        bad_count: (r.report_items ?? []).filter((i: any) => i.status === "bad").length,
      }));
      setRows(mapped);
      setLoading(false);
    })();
  }, []);

  return (
    <main>
      <LangToggle />
      <Link href="/" className="muted" style={{ display: "inline-block", marginBottom: 12 }}>← {t("home")}</Link>
      <div className="hdr">
        <h1>{t("reports")}</h1>
        <span className="sub">{t("managerView")}</span>
      </div>

      {!loading && !err && rows.length > 0 && (
        <div className="row-between" style={{ gap: 8, marginBottom: 12 }}>
          <button className="btn ghost" onClick={exportAllCsv} disabled={exporting !== null}>
            {exporting === "csv" ? "Exporting…" : "Export All (CSV)"}
          </button>
          <button className="btn ghost" onClick={exportAllPdf} disabled={exporting !== null}>
            {exporting === "pdf" ? "Exporting…" : "Export All (PDF)"}
          </button>
        </div>
      )}

      <div className="card">
        {loading && <p className="muted">{t("loading")}</p>}
        {err && <p style={{ color: "var(--red)" }}>Error: {err}</p>}
        {!loading && !err && rows.length === 0 && <p className="muted">{t("noReports")}</p>}
        {rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t("date")}</th>
                <th>{t("room")}</th>
                <th>{t("worker")}</th>
                <th>{t("issues")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/reports/${r.id}`}>
                      {new Date(r.created_at).toLocaleString()}
                    </Link>
                  </td>
                  <td>{r.rooms?.number ?? "?"}</td>
                  <td>{r.worker_name}</td>
                  <td>
                    {r.bad_count > 0 ? (
                      <span className="badge bad">{r.bad_count}</span>
                    ) : (
                      <span className="badge good">Clean</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Delete this report?")) return;
                        const { error } = await supabase.from("reports").delete().eq("id", r.id);
                        if (error) { alert(error.message); return; }
                        setRows((rs) => rs.filter((x) => x.id !== r.id));
                      }}
                      style={{
                        background: "transparent",
                        border: "1px solid #a83232",
                        color: "#a83232",
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
