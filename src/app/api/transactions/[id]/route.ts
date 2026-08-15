import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};

  if (body?.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return Response.json({ error: "amount harus angka > 0" }, { status: 400 });
    data.amount = amount;
  }
  if (body?.type !== undefined) {
    if (body.type !== "INCOME" && body.type !== "EXPENSE")
      return Response.json({ error: "type harus INCOME/EXPENSE" }, { status: 400 });
    data.type = body.type;
  }
  if (body?.categoryId !== undefined) data.categoryId = String(body.categoryId);
  if (body?.note !== undefined) data.note = String(body.note).trim() || null;
  if (body?.date !== undefined) {
    const d = new Date(String(body.date));
    if (Number.isNaN(d.getTime()))
      return Response.json({ error: "date tidak valid" }, { status: 400 });
    data.date = d;
  }

  if (data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: String(data.categoryId), userId: user.id },
    });
    if (!cat) return Response.json({ error: "Kategori tidak ditemukan" }, { status: 400 });
  }

  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return Response.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });

  const tx = await prisma.transaction.update({
    where: { id },
    data,
    include: { category: true },
  });
  return Response.json(tx);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const { id } = await ctx.params;

  const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) return Response.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });

  await prisma.transaction.delete({ where: { id } });
  return Response.json({ ok: true });
}
