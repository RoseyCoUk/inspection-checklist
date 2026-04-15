"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Room } from "@/lib/types";

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
    const key = `Floor ${r.number.charAt(0)}`;
    (grouped[key] ??= []).push(r);
  }
  const floorKeys = Object.keys(grouped).sort();

  return (
    <main>
      <Link href="/" className="muted" style={{ display: "inline-block", marginBottom: 12 }}>← Home</Link>
      <div className="hdr">
        <h1>Rooms</h1>
        <span className="sub">{name}</span>
      </div>

      {justDone && (
        <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--green)" }}>
          <strong style={{ color: "var(--green)" }}>Report saved.</strong>{" "}
          <span className="muted">Pick the next room.</span>
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}
      {err && <p style={{ color: "var(--red)" }}>Error: {err}</p>}
      {!loading && !err && rooms.length === 0 && (
        <div className="card"><p className="muted">No rooms yet. Add some in Supabase.</p></div>
      )}

      {floorKeys.map((floor) => (
        <details key={floor} style={{ marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", padding: "14px 18px", background: "var(--white)", border: "1px solid var(--beige)", borderLeft: "3px solid var(--gold)", borderRadius: 6, fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, fontSize: 22, color: "var(--brown)", letterSpacing: 2 }}>
            {floor} <span className="muted" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 14, letterSpacing: 0 }}>({grouped[floor].length} rooms)</span>
          </summary>
          <div className="stack" style={{ marginTop: 8 }}>
            {grouped[floor].map((r) => (
              <Link key={r.id} href={`/check/${r.id}`} className="room-tile">
                <div className="row-between">
                  <span className="num">Room {r.number}</span>
                  <span className="muted">Start →</span>
                </div>
              </Link>
            ))}
          </div>
        </details>
      ))}

      <div style={{ marginTop: 32, textAlign: "center" }}>
        <Link href="/" className="muted">Change worker</Link>
      </div>
    </main>
  );
}
