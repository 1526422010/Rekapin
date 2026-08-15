"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Tx = {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  note: string | null;
  date: string;
  category: { id: string; name: string; type: "INCOME" | "EXPENSE" };
};

type Category = { id: string; name: string; type: "INCOME" | "EXPENSE" };

export default function DashboardClient({
  initial,
  formatIDR,
}: {
  initial: { income: number; expense: number; balance: number; categories: Category[]; txs: Tx[] };
  formatIDR: (n: number) => string;
}) {
  const router = useRouter();
  const [txs, setTxs] = useState<Tx[]>(initial.txs);
  const [income, setIncome] = useState(initial.income);
  const [expense, setExpense] = useState(initial.expense);
  const [balance, setBalance] = useState(initial.balance);
  const [categories, setCategories] = useState<Category[]>(initial.categories);
  const [filterCat, setFilterCat] = useState("");
  const [filterType, setFilterType] = useState("");
  const [form, setForm] = useState({
    amount: "",
    type: "EXPENSE" as "INCOME" | "EXPENSE",
    categoryId: "",
    note: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<Tx | null>(null);

  const filtered = useMemo(
    () =>
      txs.filter(
        (t) =>
          (!filterCat || t.category.id === filterCat) &&
          (!filterType || t.type === filterType)
      ),
    [txs, filterCat, filterType]
  );

  const flash = useCallback((ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 3000);
  }, []);

  async function saveTx(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return flash(false, "Nominal harus > 0");
    if (!form.categoryId) return flash(false, "Pilih kategori");
    const body = {
      amount,
      type: form.type,
      categoryId: form.categoryId,
      note: form.note,
      date: new Date(form.date).toISOString(),
    };
    const method = editing ? "PATCH" : "POST";
    const url = editing ? `/api/transactions/${editing.id}` : "/api/transactions";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return flash(false, data.error ?? "Gagal simpan");
    flash(true, editing ? "Transaksi diubah" : "Transaksi ditambahkan");
    setForm({ amount: "", type: "EXPENSE", categoryId: "", note: "", date: new Date().toISOString().slice(0, 10) });
    setEditing(null);
    refresh();
  }

  async function delTx(id: string) {
    if (!confirm("Hapus transaksi ini?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (!res.ok) return flash(false, "Gagal hapus");
    flash(true, "Transaksi dihapus");
    refresh();
  }

  function refresh() {
    router.refresh();
  }

  function editTx(t: Tx) {
    setEditing(t);
    setForm({
      amount: String(t.amount),
      type: t.type,
      categoryId: t.category.id,
      note: t.note ?? "",
      date: t.date.slice(0, 10),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const catForType = categories.filter((c) => c.type === form.type);

  return (
    <main className="mx-auto max-w-5xl p-4 pb-24">
      <header className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-2xl font-bold">Rekapin</h1>
          <p className="text-sm text-slate-500">Keuangan keluarga</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
            Keluar
          </button>
        </form>
      </header>

      {msg && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Ringkasan */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Saldo</p>
          <p className="mt-1 text-xl font-bold">Rp {formatIDR(balance)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Masuk bulan ini</p>
          <p className="mt-1 text-xl font-bold text-green-600">
            +Rp {formatIDR(income)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Keluar bulan ini</p>
          <p className="mt-1 text-xl font-bold text-red-600">
            -Rp {formatIDR(expense)}
          </p>
        </div>
      </section>

      {/* Form tambah/edit */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">
          {editing ? "Edit Transaksi" : "Tambah Transaksi"}
        </h2>
        <form onSubmit={saveTx} className="grid gap-3 sm:grid-cols-5">
          <select
            value={form.type}
            onChange={(e) => {
              setForm({ ...form, type: e.target.value as "INCOME" | "EXPENSE", categoryId: "" });
            }}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="EXPENSE">Keluar</option>
            <option value="INCOME">Masuk</option>
          </select>
          <input
            type="number"
            min="1"
            placeholder="Nominal"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          />
          <select
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          >
            <option value="">Kategori...</option>
            {catForType.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            {editing ? "Simpan" : "Tambah"}
          </button>
          <input
            type="text"
            placeholder="Catatan (opsional)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm sm:col-span-5"
          />
        </form>
      </section>

      {/* Filter + tabel */}
      <section className="mt-6">
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Semua tipe</option>
            <option value="INCOME">Masuk</option>
            <option value="EXPENSE">Keluar</option>
          </select>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <a
            href="/api/report"
            className="ml-auto rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            ⬇ Download Excel
          </a>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Kategori</th>
                <th className="px-3 py-2">Catatan</th>
                <th className="px-3 py-2 text-right">Nominal</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString("id-ID")}
                  </td>
                  <td className="px-3 py-2">{t.category.name}</td>
                  <td className="px-3 py-2 text-slate-600">{t.note ?? "—"}</td>
                  <td
                    className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                      t.type === "INCOME" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {t.type === "INCOME" ? "+" : "-"}Rp {formatIDR(t.amount)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => editTx(t)}
                      className="mr-2 text-slate-500 hover:text-slate-900"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => delTx(t.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                    Belum ada transaksi
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
