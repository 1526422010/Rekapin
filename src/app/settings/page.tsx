import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LinkTelegram from "./link-telegram";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { telegramChatId: true },
      })
    : null;

  return (
    <main className="mx-auto max-w-2xl p-4">
      <LinkTelegram initialChatId={user?.telegramChatId ?? null} />
    </main>
  );
}
