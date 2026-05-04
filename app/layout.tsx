import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

// Inter is a variable font — no weight array needed
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Cormorant Garamond is NOT variable — declare all weights used in the app
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-cormorant",
});

export const metadata: Metadata = {
  title: "Resort Checklist",
  description: "Room inspection checklist",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
