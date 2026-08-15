import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";

export const runtime = "nodejs";

function monthRange(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
  return { start, end };
}

export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const url = new URL(req.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const { start, end } = monthRange(offset);
  const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 1);

  // total saldo sepanjang waktu + total bulan berjalan
  const [allAgg, monthAgg, monthTx, recent] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId: user.id },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, date: { gte: monthStart, lt: monthEnd } },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 20,
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 10,
    }),
  ]);

  const sumBy = (t: "INCOME" | "EXPENSE") =>
    monthAgg.find((a) => a.type === t)?._sum.amount ?? 0;
  const allIncome = allAgg.find((a) => a.type === "INCOME")?._sum.amount ?? 0;
  const allExpense = allAgg.find((a) => a.type === "EXPENSE")?._sum.amount ?? 0;

  return Response.json({
    period: { start: monthStart, end: monthEnd },
    balance: allIncome - allExpense,
    totals: {
      income: sumBy("INCOME"),
      expense: sumBy("EXPENSE"),
    },
    monthTransactions: monthTx,
    recent,
  });
}
