import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rekapin — Catat Keuangan",
  description: "Pencatatan keuangan pribadi + bot Telegram",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
