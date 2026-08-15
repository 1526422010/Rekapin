import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
import { tgApi } from "@/lib/tg";
import {
  formatConfirm,
  formatSaldo,
  getBalance,
  replaceStatus,
  sendRaw,
  editMsg,
  clamp,
} from "@/lib/bot-helpers";
import { parseTransaction } from "@/lib/parse";
import { sendReportExcel } from "@/lib/bot-helpers";
import type { Transaction, Category } from "@/generated/prisma/client";

type TxRow = Transaction & { category: Category };

const MSG = {
  start:
    "👋 *Selamat datang di Rekapin!*\n\n" +
    "Bot pencatatan keuangan pribadi.\n\n" +
    "*Cara pakai:*\n" +
    "• Catat pemasukan: `masuk 500000 gaji` atau `+500000 gaji`\n" +
    "• Catat pengeluaran: `keluar 20000 makan siang` atau `-20000 makan siang`\n" +
    "• `/saldo` — lihat saldo & ringkasan bulan ini\n" +
    "• `/laporan` — download laporan Excel bulanan\n" +
    "• `/kategori` — lihat daftar kategori\n\n" +
    "Mulai dengan ketik `/start` untuk menghubungkan akun.",
  help:
    "🆘 *Bantuan Rekapin*\n\n" +
    "• `masuk 500000 gaji` — catat pemasukan\n" +
    "• `keluar 20000 makan` — catat pengeluaran\n" +
    "• `/saldo` — saldo & ringkasan bulan ini\n" +
    "• `/laporan` — laporan Excel bulan ini\n" +
    "• `/kategori` — daftar kategori\n" +
    "• `/start` — hubungkan akun\n\n" +
    "Format angka bebas: `500000`, `20.000`, `1.000.000`.",
  notLinked:
    "Akun belum terhubung.\n\n" +
    "Ketik `/start` dan masukkan kode akses dari email admin untuk menghubungkan chat ini.",
  unregistered:
    "Kode tidak dikenal. Cek email admin untuk kode akses yang benar.",
};

/** Handle pesan dari webhook Telegram */
export async function handleUpdate(update: {
  message?: { message_id: number; chat: { id: number }; text?: string };
  callback_query?: {
    id: string;
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}) {
  // ---- Callback (tombol inline) ----
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = String(cq.message?.chat.id ?? "");
    const msgId = cq.message?.message_id ?? 0;
    const data = cq.data ?? "";
    try {
      await tgApi("answerCallbackQuery", { callback_query_id: cq.id });
    } catch { /* ignore */ }

    if (data.startsWith("report:")) {
      await handleReportCallback(chatId, msgId, data);
    } else if (data.startsWith("del:")) {
      await handleDeleteCallback(chatId, msgId, data, cq.id);
    }
    return;
  }

  // ---- Pesan biasa / command ----
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });

  // /start: hubungkan akun
  if (text === "/start") {
    if (user) {
      await replaceStatus(chatId, "✅ Akun sudah terhubung. Ketik `/saldo` untuk cek saldo.");
    } else {
      const code = await startCode();
      await replaceStatus(
        chatId,
        "🔑 *Hubungkan Akun*\n\n" +
          `Masukkan kode akses ini ke aplikasi web:\n\n` +
          `\`${code}\`\n\n` +
          "Kode berlaku 10 menit. Buka dashboard → halaman Pengaturan → 'Hubungkan Telegram'."
      );
      await prisma.pendingLink.upsert({
        where: { chatId },
        create: { chatId, code, expiresAt: new Date(Date.now() + 10 * 60_000) },
        update: { code, expiresAt: new Date(Date.now() + 10 * 60_000) },
      });
    }
    return;
  }

  // kode link 6 digit dari /start
  if (/^\d{6}$/.test(text) && !user) {
    const pending = await prisma.pendingLink.findUnique({ where: { chatId } });
    if (pending && pending.code === text && pending.expiresAt > new Date()) {
      await replaceStatus(chatId, "Kode benar! Buka aplikasi web dan masukkan kode ini di halaman Pengaturan → Hubungkan Telegram.");
    } else {
      await replaceStatus(chatId, MSG.unregistered);
    }
    return;
  }

  // belum terhubung
  if (!user) {
    await replaceStatus(chatId, MSG.notLinked);
    return;
  }

  // command
  if (text.startsWith("/")) {
    const [cmd, ...rest] = text.split(/\s+/);
    switch (cmd) {
      case "/saldo":
        await replaceStatus(chatId, clamp(await formatSaldo(chatId)));
        break;
      case "/kategori":
        await replaceStatus(chatId, await kategoriList(user.id));
        break;
      case "/laporan":
        await reportMenu(chatId, msg.message_id);
        break;
      case "/help":
        await replaceStatus(chatId, MSG.help);
        break;
      case "/start":
        // sudah terhubung, tampilkan menu
        await replaceStatus(chatId, MSG.start);
        break;
      case "/delete":
        await lastTxDeleteMenu(user.id, chatId);
        break;
      default:
        await replaceStatus(
          chatId,
          "Perintah tidak dikenal. Ketik `/help` untuk bantuan."
        );
    }
    return;
  }

  // ---- catat transaksi ----
  const parsed = parseTransaction(text);
  if (!parsed) {
    await replaceStatus(
      chatId,
      "Format tidak dikenali. Contoh:\n`masuk 500000 gaji`\n`keluar 20000 makan`\nKetik `/help`."
    );
    return;
  }

  // cari/muat kategori
  const cat = await resolveCategory(user.id, parsed.type, parsed.note);
  const tx = await prisma.transaction.create({
    data: {
      userId: user.id,
      categoryId: cat.id,
      amount: parsed.amount,
      type: parsed.type,
      note: parsed.note || null,
    },
    include: { category: true },
  });
  const balance = await getBalance(user.id);
  await sendRaw(
    chatId,
    clamp(
      formatConfirm({
        amount: tx.amount,
        type: tx.type,
        categoryName: tx.category.name,
        note: tx.note,
        balance,
      })
    ),
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🗑 Hapus", callback_data: `del:${tx.id}` },
          ],
        ],
      },
    }
  );
}

/** Halaman kategori */
async function kategoriList(userId: string): Promise<string> {
  const cats = await prisma.category.findMany({
    where: { userId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  const inc = cats.filter((c) => c.type === "INCOME").map((c) => c.name);
  const exp = cats.filter((c) => c.type === "EXPENSE").map((c) => c.name);
  const fmt = (list: string[]) => (list.length ? list.map((n) => `• ${n}`).join("\n") : "—");
  return [
    "📂 *Kategori*",
    "",
    `*Masuk:*\n${fmt(inc)}`,
    "",
    `*Keluar:*\n${fmt(exp)}`,
  ].join("\n");
}

/** Pilih kategori dari note: cocokkan kata pertama dengan nama kategori */
async function resolveCategory(userId: string, type: "INCOME" | "EXPENSE", note: string) {
  const cats = await prisma.category.findMany({ where: { userId, type } });
  const fallback = cats.find((c) => c.name.startsWith("Lainnya")) ?? cats[0];

  if (note) {
    const first = note.trim().split(/\s+/)[0]?.toLowerCase();
    const match = cats.find((c) => c.name.toLowerCase() === first);
    if (match) return match;
  }
  return fallback;
}

/** Menu laporan: pilih bulan (3 terakhir + bulan lain) */
async function reportMenu(chatId: string, msgId: number) {
  const now = new Date();
  const months: { label: string; data: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    months.push({ label, data: `report:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` });
  }

  await editMsg(chatId, msgId, "📊 *Laporan bulan apa?*", {
    reply_markup: {
      inline_keyboard: [
        months.map((m) => ({ text: m.label, callback_data: m.data })),
        [{ text: "📅 Bulan lain", callback_data: "report:other" }],
      ],
    },
  });
}

/** Callback laporan: kirim Excel atau tampilkan pilihan bulan lain */
async function handleReportCallback(chatId: string, msgId: number, data: string) {
  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user) return;

  if (data === "report:other") {
    await editMsg(chatId, msgId, "📅 Ketik bulan dalam format `YYYY-MM`, contoh: `2026-07`");
    return;
  }

  const ym = data.replace("report:", "");
  const start = new Date(`${ym}-01T00:00:00`);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, date: { gte: start, lt: end } },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  if (!txs.length) {
    await editMsg(chatId, msgId, `📭 Tidak ada transaksi di ${ym}.`);
    return;
  }

  await editMsg(chatId, msgId, `📊 *Laporan ${ym}* — sedang dibuat...`);
  try {
    await sendReportExcelFromTxs(chatId, txs);
    await editMsg(chatId, msgId, `✅ Laporan ${ym} terkirim!`);
  } catch (e) {
    console.error("report fail", e);
    await editMsg(chatId, msgId, "❌ Gagal membuat laporan. Coba lagi.");
  }
}

/** Kirim laporan Excel dari daftar transaksi */
async function sendReportExcelFromTxs(chatId: string, txs: TxRow[]) {
  return sendReportExcel(chatId, txs);
}

/** Menu hapus transaksi terakhir */
async function lastTxDeleteMenu(userId: string, chatId: string) {
  const last = await prisma.transaction.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });
  if (!last) {
    await replaceStatus(chatId, "Belum ada transaksi.");
    return;
  }
  const sign = last.type === "INCOME" ? "➕" : "➖";
  await replaceStatus(chatId, "", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `🗑 Hapus: ${sign} Rp ${formatIDR(last.amount)} — ${last.note ?? last.category.name}`,
            callback_data: `del:${last.id}`,
          },
          { text: "Batal", callback_data: "del:cancel" },
        ],
      ],
    },
  });
}

/** Callback hapus transaksi */
async function handleDeleteCallback(
  chatId: string,
  msgId: number,
  data: string,
  cqId: string
) {
  if (data === "del:cancel") {
    await tgApi("answerCallbackQuery", { callback_query_id: cqId, text: "Batal" }).catch(() => {});
    await editMsg(chatId, msgId, "Dibatalkan.");
    return;
  }
  const id = data.replace("del:", "");
  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user) return;
  const tx = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!tx) {
    await editMsg(chatId, msgId, "Transaksi tidak ditemukan.");
    return;
  }
  await prisma.transaction.delete({ where: { id } });
  await editMsg(chatId, msgId, `🗑 Transaksi dihapus:\nRp ${formatIDR(tx.amount)} — ${tx.note ?? ""}`);
  await tgApi("answerCallbackQuery", { callback_query_id: cqId, text: "Dihapus" }).catch(() => {});
}

/** Kode link 6 digit acak */
async function startCode(): Promise<string> {
  return String(Math.floor(100000 + Math.random() * 900000));
}
