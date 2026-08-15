import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
import { tgApi } from "@/lib/tg";
import { buildWorkbook } from "@/lib/excel";
import type { Transaction, Category } from "@/generated/prisma/client";

type TxRow = Transaction & { category: Category };

const MAX_STATUS = 4096;

/** Format pesan saldo: saldo total + ringkasan bulan berjalan */
export async function formatSaldo(chatId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user) return "Akun belum terhubung. Ketik /start dulu.";
  return renderSummary(user.id);
}

async function renderSummary(userId: string): Promise<string> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [allAgg, monthAgg] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
  ]);

  const all = (t: "INCOME" | "EXPENSE") => allAgg.find((a) => a.type === t)?._sum.amount ?? 0;
  const m = (t: "INCOME" | "EXPENSE") => monthAgg.find((a) => a.type === t)?._sum.amount ?? 0;

  return [
    "💰 *Rekap Keuangan*",
    "",
    `Saldo: *Rp ${formatIDR(all("INCOME") - all("EXPENSE"))}*`,
    "",
    `📅 *${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}*`,
    `  Masuk : Rp ${formatIDR(m("INCOME"))}`,
    `  Keluar: Rp ${formatIDR(m("EXPENSE"))}`,
    `  Selisih: Rp ${formatIDR(m("INCOME") - m("EXPENSE"))}`,
  ].join("\n");
}

/** Format konfirmasi transaksi baru */
export function formatConfirm(tx: {
  amount: number;
  type: "INCOME" | "EXPENSE";
  categoryName: string;
  note: string | null;
  balance: number;
}): string {
  const sign = tx.type === "INCOME" ? "➕ Masuk" : "➖ Keluar";
  const lines = [
    `✅ *Transaksi dicatat*`,
    "",
    `${sign}`,
    `Jumlah : *Rp ${formatIDR(tx.amount)}*`,
    `Kategori: ${tx.categoryName}`,
  ];
  if (tx.note) lines.push(`Catatan: ${tx.note}`);
  lines.push("", `Saldo sekarang: *Rp ${formatIDR(tx.balance)}*`);
  return lines.join("\n");
}

/** Ambil saldo user dari DB (untuk konfirmasi) */
export async function getBalance(userId: string): Promise<number> {
  const agg = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId },
    _sum: { amount: true },
  });
  const inc = agg.find((a) => a.type === "INCOME")?._sum.amount ?? 0;
  const exp = agg.find((a) => a.type === "EXPENSE")?._sum.amount ?? 0;
  return inc - exp;
}

/** Status helper: hapus pesan menu lama sebelum kirim status baru (auto-clean) */
export async function replaceStatus(chatId: string, text: string, extra?: Record<string, unknown>) {
  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (user?.lastBotMessageId) {
    try {
      await tgApi("deleteMessage", { chat_id: Number(chatId), message_id: user.lastBotMessageId });
    } catch {
      // pesan mungkin sudah dihapus user
    }
  }
  const sent = await tgApi<{ message_id: number }>("sendMessage", {
    chat_id: Number(chatId),
    text,
    parse_mode: "Markdown",
    ...(extra ?? {}),
  });
  await prisma.user.update({
    where: { telegramChatId: chatId },
    data: { lastBotMessageId: sent.message_id },
  });
  return sent;
}

/** Kirim pesan baru (histori penting — konfirmasi transaksi) */
export async function sendRaw(chatId: string, text: string, extra?: Record<string, unknown>) {
  return tgApi<{ message_id: number }>("sendMessage", {
    chat_id: Number(chatId),
    text,
    parse_mode: "Markdown",
    ...(extra ?? {}),
  });
}

/** Edit pesan (untuk navigasi inline keyboard — tetap di 1 bubble) */
export async function editMsg(chatId: string, messageId: number, text: string, extra?: Record<string, unknown>) {
  return tgApi("editMessageText", {
    chat_id: Number(chatId),
    message_id: messageId,
    text,
    parse_mode: "Markdown",
    ...(extra ?? {}),
  });
}

/** Kirim Excel laporan bulan ke chat (multipart FormData) */
export async function sendReportExcel(chatId: string, txs: TxRow[]) {
  const wb = await buildWorkbook(txs);
  const buf = await wb.xlsx.writeBuffer();
  const month = new Date().toISOString().slice(0, 7);
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append(
    "document",
    new Blob([buf as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `rekapin-${month}.xlsx`
  );
  form.append("caption", `📊 Laporan ${month}`);
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`,
    { method: "POST", body: form }
  );
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) throw new Error(`Telegram sendDocument: ${data.description ?? "error"}`);
}

/** Command list untuk setMyCommands */
export const COMMANDS = [
  { command: "start", description: "Mulai & hubungkan akun" },
  { command: "saldo", description: "Lihat saldo & ringkasan bulan ini" },
  { command: "laporan", description: "Download laporan Excel bulanan" },
  { command: "kategori", description: "Lihat daftar kategori" },
  { command: "help", description: "Bantuan cara pakai bot" },
];

/** Cek panjang pesan — Telegram batasi 4096 char */
export function clamp(s: string): string {
  return s.length > MAX_STATUS ? `${s.slice(0, MAX_STATUS - 3)}...` : s;
}
