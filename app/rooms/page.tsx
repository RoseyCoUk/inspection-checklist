"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Room } from "@/lib/types";
import { useT } from "@/lib/i18n";
import LangToggle from "../LangToggle";

export default function RoomsPage() {
  return (
    <Suspense fallback={<main><p className="muted">Loading…</p></main>}>
      <RoomsPageInner />
    </Suspense>
  );
}

function RoomsPageInner() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const sp = useSearchParams();
  const justDone = sp.get("done") === "1";
  const t = useT();

  useEffect(() => {
    const n = localStorage.getItem("worker_name");
    if (!n) { router.replace("/"); return; }
    setName(n);
    supabase
      .from("rooms")
      .select("id, number, room_type_id, active, room_types(id, name)")
      .eq("active", true)
      .order("number")
      .then(({ data, error }) => {
        if (error) setErr(error.message);
        else setRooms((data ?? []) as unknown as Room[]);
        setLoading(false);
      });
  }, [router]);

  const grouped: Record<string, Room[]> = {};
  for (const r of rooms) {
    const key = r.number.slice(0, -2);
    (grouped[key] ??= []).push(r);
  }
  const floorKeys = Object.keys(grouped).sort();
  const isVillaKey = (k: string) => k.toUpperCase() === "V";

  return (
    <main>
      <LangToggle />
      <Link href="/" className="muted" style={{ display: "inline-block", marginBottom: 12 }}>← {t("home")}</Link>
      <div className="hdr">
        <h1>{t("rooms")}</h1>
        <span className="sub">{name}</span>
      </div>

      {justDone && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--green)" }}>
          <strong style={{ color: "var(--green)" }}>{t("reportSaved")}</strong>{" "}
          <span className="muted">{t("pickNext")}</span>
        </div>
      )}

      {loading && <p className="muted">{t("loading")}</p>}
      {err && <p style={{ color: "var(--red)" }}>Error: {err}</p>}

      {floorKeys.map((floor) => {
        const villa = isVillaKey(floor);
        const heading = villa ? t("villas") : `${t("floor")} ${floor}`;
        return (
          <details key={floor} style={{ marginBottom: 12 }}>
            <summary style={{ cursor: "pointer", padding: "14px 18px", background: "var(--white)", border: "1px solid var(--beige)", borderLeft: "3px solid var(--gold)", borderRadius: 6, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 22, color: "var(--brown)", letterSpacing: 2 }}>
              {heading} <span className="muted" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 14, letterSpacing: 0 }}>({grouped[floor].length} {t("roomsCount")})</span>
            </summary>
            <div className="stack" style={{ marginTop: 8 }}>
              {grouped[floor].map((r) => (
                <Link key={r.id} href={`/check/${r.id}`} className="room-tile">
                  <div className="row-between">
                    <span className="num">
                      {villa ? `${t("villa")} ${r.number.slice(1)}` : `${t("room")} ${r.number}`}
                    </span>
                    <span className="muted">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </details>
        );
      })}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <Link href="/" className="muted">{t("changeWorker")}</Link>
      </div>
    </main>
  );
}
