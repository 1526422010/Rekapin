import { handleUpdate } from "@/lib/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Webhook Telegram — POST dari Telegram servers */
export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ error: "Bot belum dikonfigurasi" }, { status: 500 });

  // validasi secret: Telegram tidak kirim header khusus, pakai path check di set-webhook
  const update = await req.json().catch(() => null);
  if (!update) return Response.json({ error: "Bad request" }, { status: 400 });

  // proses di background agar response cepat (Vercel)
  await handleUpdate(update);

  return Response.json({ ok: true });
}
