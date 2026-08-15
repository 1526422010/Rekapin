"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LinkTelegram({
  initialChatId,
}: {
  initialChatId: string | null;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch("/api/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setMsg({ ok: res.ok, text: data.message ?? data.error ?? "Gagal" });
    if (res.ok) {
      setCode("");
      router.refresh();
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-bold">Hubungkan Telegram</h1>
      <p className="mt-1 text-sm text-slate-500">
        Catat transaksi langsung dari chat bot.
      </p>

      {initialChatId ? (
        <div className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          ✅ Terhubung ke chat <code>{initialChatId}</code>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>
              Buka bot Telegram kamu (buat via @BotFather), ketik{" "}
              <code>/start</code>
            </li>
            <li>
              Bot akan kirim kode 6 digit (berlaku 10 menit)
            </li>
            <li>Masukkan kode di bawah</li>
          </ol>
          <form onSubmit={link} className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Kode 6 digit"
              inputMode="numeric"
              className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-widest"
            />
            <button
              disabled={loading || code.length !== 6}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "..." : "Hubungkan"}
            </button>
          </form>
          {msg && (
            <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>
              {msg.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
