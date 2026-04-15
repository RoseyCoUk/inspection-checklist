"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [name, setName] = useState("");
  const router = useRouter();

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
      <div className="hdr">
        <h1>Raha Resort</h1>
        <span className="sub">Inspection</span>
      </div>
      <div className="card">
        <h2>Welcome</h2>
        <p className="muted">Enter your name to begin today&apos;s inspection.</p>
        <form onSubmit={start} className="stack" style={{ marginTop: 18 }}>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
          <button type="submit" className="btn">Start inspection</button>
        </form>
      </div>
    </main>
  );
}
