import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";

/**
 * Hubungkan Telegram ke akun web.
 * Body: { code } — kode 6 digit yang ditampilkan bot saat /start.
 */
export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim();
  if (!/^\d{6}$/.test(code))
    return Response.json({ error: "Kode harus 6 digit" }, { status: 400 });

  const link = await prisma.pendingLink.findFirst({
    where: { code, expiresAt: { gt: new Date() } },
  });
  if (!link) return Response.json({ error: "Kode tidak valid atau sudah kedaluwarsa" }, { status: 400 });

  const chatAlreadyUsed = await prisma.user.findUnique({
    where: { telegramChatId: link.chatId },
  });
  if (chatAlreadyUsed && chatAlreadyUsed.id !== user.id)
    return Response.json({ error: "Chat Telegram ini sudah terhubung ke akun lain" }, { status: 409 });

  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: link.chatId },
  });
  await prisma.pendingLink.delete({ where: { chatId: link.chatId } });

  return Response.json({ ok: true, message: "Telegram berhasil dihubungkan!" });
}
