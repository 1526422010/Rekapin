import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const categoryId = url.searchParams.get("categoryId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      ...(from ? { date: { gte: new Date(from) } } : {}),
      ...(to ? { date: { lte: new Date(`${to}T23:59:59`) } } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    include: { category: true },
    orderBy: { date: "desc" },
    take: limit,
  });
  return Response.json(transactions);
}

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const type = body?.type;
  const categoryId = String(body?.categoryId ?? "");
  const note = String(body?.note ?? "").trim() || null;
  const date = body?.date ? new Date(String(body.date)) : new Date();

  if (!Number.isFinite(amount) || amount <= 0)
    return Response.json({ error: "amount harus angka > 0" }, { status: 400 });
  if (type !== "INCOME" && type !== "EXPENSE")
    return Response.json({ error: "type harus INCOME/EXPENSE" }, { status: 400 });

  let cat = categoryId
    ? await prisma.category.findFirst({ where: { id: categoryId, userId: user.id } })
    : null;
  if (!cat) {
    const fallbackName = type === "INCOME" ? "Lainnya (Masuk)" : "Lainnya (Keluar)";
    cat =
      (await prisma.category.findFirst({
        where: { userId: user.id, name: fallbackName, type },
      })) ??
      (await prisma.category.create({
        data: { name: fallbackName, type, userId: user.id },
      }));
  }

  const tx = await prisma.transaction.create({
    data: { userId: user.id, categoryId: cat.id, amount, type, note, date },
    include: { category: true },
  });
  return Response.json(tx, { status: 201 });
}
