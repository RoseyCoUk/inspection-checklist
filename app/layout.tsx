import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resort Checklist",
  description: "Room inspection checklist",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
