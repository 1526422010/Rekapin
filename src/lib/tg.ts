import TelegramBot from "node-telegram-bot-api";

const token = process.env.TELEGRAM_BOT_TOKEN ?? "";

/** Singleton bot. Tanpa polling — Vercel serverless pakai webhook. */
export function getBot(): TelegramBot {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum di-set");
  const g = globalThis as unknown as { bot?: TelegramBot };
  if (!g.bot) g.bot = new TelegramBot(token, { polling: false });
  return g.bot;
}

/** Bot API via fetch (untuk webhook di Vercel tanpa library berat) */
export async function tgApi<T = unknown>(
  method: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN belum di-set");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram API ${method}: ${data.description ?? "error"}`);
  return data.result as T;
}

export type TgUser = { id: number; is_bot: boolean; first_name: string };
export type TgMessage = {
  message_id: number;
  chat: { id: number };
  text?: string;
  from?: TgUser;
  date?: number;
};
