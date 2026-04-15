"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
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
  const t = useT();

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
