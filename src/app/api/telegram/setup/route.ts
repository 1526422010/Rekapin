import { tgApi, getBot } from "@/lib/tg";
import { COMMANDS } from "@/lib/bot-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/telegram/setup — set webhook + setMyCommands. Panggil sekali setelah deploy. */
export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = process.env.WEBHOOK_URL;
  if (!token) return Response.json({ error: "TELEGRAM_BOT_TOKEN belum di-set" }, { status: 500 });
  if (!url) return Response.json({ error: "WEBHOOK_URL belum di-set" }, { status: 500 });

  const results: Record<string, unknown> = {};

  try {
    results.webhook = await tgApi("setWebhook", {
      url: `${url.replace(/\/$/, "")}/api/telegram/webhook`,
    });
  } catch (e) {
    results.webhookError = String(e);
  }

  try {
    results.commands = await tgApi("setMyCommands", { commands: COMMANDS });
  } catch (e) {
    results.commandsError = String(e);
  }

  // cek status webhook
  const info = await getBot().getWebHookInfo().catch((e) => String(e));
  results.webhookInfo = info;

  return Response.json(results);
}
