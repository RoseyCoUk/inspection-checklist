"use client";
import { useLang } from "@/lib/i18n";

export default function LangToggle() {
  const [lang, setLang] = useLang();
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "ar" : "en")}
        style={{
          padding: "6px 14px",
          fontSize: 13,
          fontFamily: "inherit",
          border: "1px solid var(--beige)",
          background: "var(--white)",
          color: "var(--brown)",
          borderRadius: 4,
          cursor: "pointer",
          letterSpacing: 1,
        }}
      >
        {lang === "en" ? "عربي" : "English"}
      </button>
    </div>
  );
}
