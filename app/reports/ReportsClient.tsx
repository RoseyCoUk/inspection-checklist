"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { PHOTO_BUCKET } from "@/lib/supabase";
import { useT } from "@/lib/i18n";
import LangToggle from "../LangToggle";
import { deleteReportAction } from "@/app/actions/delete-report";
import type { ReportRow } from "./page";

type BadItem = { category: string; label: string };

const CATEGORY_LABELS: Record<string, string> = {
  paint: "Paint",
  wallpaper: "Wallpaper",
  aluminum: "Aluminum",
  electrical: "Electrical",
  hk: "HK",
  mechanical: "Mechanical",
  plumbing: "Plumbing",
  furniture: "Furniture",
  cleaning: "Cleaning",
  other: "Other",
};

export default function ReportsClient({ initialRows }: { initialRows: ReportRow[] }) {
  const [rows, setRows] = useState<ReportRow[]>(initialRows);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState<null | "csv" | "pdf">(null);
  const [progress, setProgress] = useState(0);
  const [filterRoom, setFilterRoom] = useState("");
  const [filterWorker, setFilterWorker] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "clean" | "issues">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<"date" | "room" | "worker" | "issues">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterIssue, setFilterIssue] = useState("");
  const t = useT();

  const rooms = useMemo(() => Array.from(new Set(rows.map((r) => r.rooms?.number).filter(Boolean) as string[])).sort(), [rows]);
  const workers = useMemo(() => Array.from(new Set(rows.map((r) => r.worker_name).filter(Boolean))).sort(), [rows]);
  const issueLabels = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const it of r.bad_items) {
      if (!filterCategory || it.category === filterCategory) set.add(it.label);
    }
    return Array.from(set).sort();
  }, [rows, filterCategory]);

  const matchingBadCount = (r: ReportRow) => r.bad_items.filter((it) =>
    (!filterCategory || it.category === filterCategory) &&
    (!filterIssue || it.label === filterIssue)
  ).length;

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const it of r.bad_items) set.add(it.category);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows.filter((r) => {
      if (filterRoom && r.rooms?.number !== filterRoom) return false;
      if (filterWorker && r.worker_name !== filterWorker) return false;
      if (filterStatus === "clean" && r.bad_count > 0) return false;
      if (filterStatus === "issues" && r.bad_count === 0) return false;
      if (dateFrom && new Date(r.created_at) < new Date(dateFrom + "T00:00:00")) return false;
      if (dateTo && new Date(r.created_at) > new Date(dateTo + "T23:59:59")) return false;
      if ((filterCategory || filterIssue) && matchingBadCount(r) === 0) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortKey === "date") { av = a.created_at; bv = b.created_at; }
      else if (sortKey === "room") { av = a.rooms?.number ?? ""; bv = b.rooms?.number ?? ""; }
      else if (sortKey === "worker") { av = a.worker_name; bv = b.worker_name; }
      else if (sortKey === "issues") { av = a.bad_count; bv = b.bad_count; }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return out;
  }, [rows, filterRoom, filterWorker, filterStatus, dateFrom, dateTo, sortKey, sortDir, filterCategory, filterIssue]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "date" ? "desc" : "asc"); }
  }

  function clearFilters() {
    setFilterRoom(""); setFilterWorker(""); setFilterStatus("all"); setDateFrom(""); setDateTo("");
    setFilterCategory(""); setFilterIssue("");
  }

  const photoPathsFor = (p: string | null) =>
    p ? p.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];

  const itemPassesFilter = (it: any) => {
    if (filterCategory && (it.checklist_items?.category ?? "other") !== filterCategory) return false;
    if (filterIssue && (it.checklist_items?.label ?? "") !== filterIssue) return false;
    return true;
  };

  // STG-03/STG-04: Replaces the prior anon-client export function (blocked by RLS).
  // Calls authenticated route handler that returns report data + pre-signed photo URLs.
  async function fetchExportData(): Promise<{ reports: any[]; signedUrlMap: Record<string, string> }> {
    const ids = filtered.map((r) => r.id);
    if (ids.length === 0) return { reports: [], signedUrlMap: {} };
    const res = await fetch(`/api/export?ids=${ids.join(",")}`);
    if (!res.ok) throw new Error(`Export fetch failed: ${res.status}`);
    return res.json();
  }

  async function exportAllCsv() {
    setExporting("csv");
    setProgress(0);
    try {
      const { reports, signedUrlMap } = await fetchExportData();
      setProgress(0.15);
      const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
      const header = ["Date", "Room", "Worker", "Item", "Category", "Status", "Note", "Photos"];
      const lines: string[][] = [header];
      const categoryActive = !!(filterCategory || filterIssue);
      const total = reports.length || 1;
      let done = 0;
      for (const r of reports) {
        for (const it of r.report_items ?? []) {
          if (categoryActive && (it.status !== "bad" || !itemPassesFilter(it))) continue;
          lines.push([
            new Date(r.created_at).toLocaleString(),
            r.rooms?.number ?? "",
            r.worker_name,
            it.checklist_items?.label ?? "",
            it.checklist_items?.category ?? "other",
            it.status,
            it.note ?? "",
            photoPathsFor(it.photo_path)
              .map((p) => signedUrlMap[p] ?? "")
              .join(" | "),
          ]);
        }
        done++;
        setProgress(0.15 + 0.8 * (done / total));
      }
      const csv = lines.map((r) => r.map((c) => esc(String(c))).join(",")).join("\r\n");
      setProgress(0.98);
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
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
      setProgress(0);
    }
  }

  async function exportAllPdf() {
    setExporting("pdf");
    setProgress(0);
    try {
      const { reports, signedUrlMap } = await fetchExportData();
      setProgress(0.05);
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
      doc.text("Inspection Issues", margin, y);
      y += 24;

      let totalUnits = 0;
      for (const r of reports) {
        const bad = (r.report_items ?? []).filter((i: any) => i.status === "bad" && itemPassesFilter(i));
        if (bad.length === 0) continue;
        totalUnits += 1;
        for (const it of bad) totalUnits += photoPathsFor(it.photo_path).length;
      }
      totalUnits = Math.max(totalUnits, 1);
      let unitsDone = 0;
      const tick = (n = 1) => {
        unitsDone += n;
        setProgress(0.05 + 0.93 * (unitsDone / totalUnits));
      };

      for (const r of reports) {
        const bad = (r.report_items ?? []).filter((i: any) => i.status === "bad" && itemPassesFilter(i));
        if (bad.length === 0) continue;

        if (!first) {
          doc.addPage();
          y = margin;
        }
        first = false;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(`Room ${r.rooms?.number ?? "?"}`, margin, y);
        y += 24;

        {
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
              const url = signedUrlMap[p] ?? "";
              const img = await loadImg(url);
              tick();
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
        tick();
      }

      if (first) {
        alert("No issues in the filtered reports — nothing to export.");
        return;
      }
      setProgress(1);
      doc.save(`issues-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e: any) {
      alert(e.message ?? String(e));
    } finally {
      setExporting(null);
      setProgress(0);
    }
  }

  // D-10/D-11/D-12: Delete handler — server action with session verification
  async function handleDelete(id: string) {
    if (!confirm("Delete this report?")) return;
    setErr(null);

    const result = await deleteReportAction(id);
    if ("error" in result) {
      setErr(result.error);
      return;
    }
    setRows((rs) => rs.filter((x) => x.id !== id));
  }

  return (
    <main>
      <LangToggle />
      <Link href="/" className="muted" style={{ display: "inline-block", marginBottom: 12 }}>← {t("home")}</Link>
      <div className="hdr">
        <h1>{t("reports")}</h1>
        <span className="sub">{t("managerView")}</span>
      </div>

      {rows.length > 0 && (
        <>
          {rows.length === 200 && (
            <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
              Showing most recent 200 reports. Use filters to narrow results.
            </p>
          )}
          <div className="card" style={{ marginBottom: 12, padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <select className="input" value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)}>
                <option value="">All rooms</option>
                {rooms.map((r) => <option key={r} value={r}>Room {r}</option>)}
              </select>
              <select className="input" value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)}>
                <option value="">All workers</option>
                {workers.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
                <option value="all">All statuses</option>
                <option value="clean">Clean only</option>
                <option value="issues">With issues</option>
              </select>
              <div style={{ display: "flex", gap: 4 }}>
                <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" />
                <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" />
              </div>
              <select className="input" value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setFilterIssue(""); }}>
                <option value="">{t("allCategories")}</option>
                {categoryOptions.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
              </select>
              <select className="input" value={filterIssue} onChange={(e) => setFilterIssue(e.target.value)}>
                <option value="">{t("allIssues")}</option>
                {issueLabels.map((lbl) => <option key={lbl} value={lbl}>{lbl}</option>)}
              </select>
            </div>
            <div className="row-between" style={{ marginTop: 10 }}>
              <span className="muted" style={{ fontSize: 13 }}>{filtered.length} of {rows.length}</span>
              <button type="button" className="btn ghost" style={{ width: "auto", padding: "6px 12px", fontSize: 13 }} onClick={clearFilters}>Clear filters</button>
            </div>
          </div>
          <div className="row-between" style={{ gap: 8, marginBottom: 12 }}>
            <button className="btn ghost" onClick={exportAllCsv} disabled={exporting !== null || filtered.length === 0}>
              {exporting === "csv" ? `Exporting… ${Math.round(progress * 100)}%` : `Export ${filtered.length === rows.length ? "All" : "Filtered"} (CSV)`}
            </button>
            <button className="btn ghost" onClick={exportAllPdf} disabled={exporting !== null || filtered.length === 0}>
              {exporting === "pdf" ? `Exporting… ${Math.round(progress * 100)}%` : `Export ${filtered.length === rows.length ? "All" : "Filtered"} (PDF)`}
            </button>
          </div>
          {exporting !== null && (
            <div style={{ height: 6, background: "var(--beige)", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ width: `${Math.round(progress * 100)}%`, height: "100%", background: "var(--gold)", transition: "width 120ms linear" }} />
            </div>
          )}
        </>
      )}

      <div className="card">
        {rows.length === 0 && <p className="muted">{t("noReports")}</p>}
        {rows.length > 0 && filtered.length === 0 && (
          <p className="muted">No reports match the current filters.</p>
        )}
        {filtered.length > 0 && (
          <table>
            <thead>
              <tr>
                {([["date", t("date")], ["room", t("room")], ["worker", t("worker")], ["issues", t("issues")]] as const).map(([k, label]) => (
                  <th key={k} onClick={() => toggleSort(k)} style={{ cursor: "pointer", userSelect: "none" }}>
                    {label}{sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/reports/${r.id}`}>
                      {new Date(r.created_at).toLocaleString()}
                    </Link>
                  </td>
                  <td>{r.rooms?.number ?? "?"}</td>
                  <td>{r.worker_name}</td>
                  <td>
                    {(() => {
                      const n = (filterCategory || filterIssue) ? matchingBadCount(r) : r.bad_count;
                      return n > 0 ? <span className="badge bad">{n}</span> : <span className="badge good">Clean</span>;
                    })()}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id)}
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
        {err && <p style={{ color: "var(--red)", marginTop: 8 }}>{err}</p>}
      </div>
    </main>
  );
}
