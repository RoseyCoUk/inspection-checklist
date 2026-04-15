"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import LangToggle from "./LangToggle";

export default function Home() {
  const [name, setName] = useState("");
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    const saved = localStorage.getItem("worker_name");
    if (saved) setName(saved);
  }, []);

  function start(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    localStorage.setItem("worker_name", name.trim());
    router.push("/rooms");
  }

  return (
    <main>
      <LangToggle />
      <div className="hdr">
        <h1>{t("appTitle")}</h1>
        <span className="sub">{t("inspection")}</span>
      </div>
      <div className="card">
        <h2>{t("welcome")}</h2>
        <p className="muted">{t("enterName")}</p>
        <form onSubmit={start} className="stack" style={{ marginTop: 18 }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("yourName")}
            autoFocus
          />
          <button type="submit" className="btn">{t("startInspection")}</button>
        </form>
      </div>
    </main>
  );
}
