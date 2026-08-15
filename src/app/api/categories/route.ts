import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res;
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return Response.json(categories);
}

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res;
  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const type = body?.type;
  if (!name || (type !== "INCOME" && type !== "EXPENSE"))
    return Response.json({ error: "name & type (INCOME/EXPENSE) wajib" }, { status: 400 });

  const existing = await prisma.category.findFirst({
    where: { userId: user.id, name, type },
  });
  if (existing)
    return Response.json({ error: "Kategori sudah ada" }, { status: 409 });

  const cat = await prisma.category.create({
    data: { name, type, userId: user.id },
  });
  return Response.json(cat, { status: 201 });
}
