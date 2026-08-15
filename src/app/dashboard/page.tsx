import { prisma } from "@/lib/prisma";
import { formatIDR } from "@/lib/utils";
import DashboardClient from "./client";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [allAgg, monthAgg, categories, transactions] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: { userId, date: { gte: monthStart, lt: monthEnd } },
      _sum: { amount: true },
    }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 100,
    }),
  ]);

  const txs = transactions.map((t) => ({ ...t, date: t.date.toISOString() }));

  const sum = (list: { type: string; _sum: { amount: number | null } | null }[], t: string) =>
    list.find((a) => a.type === t)?._sum?.amount ?? 0;
  const income = sum(monthAgg, "INCOME");
  const expense = sum(monthAgg, "EXPENSE");
  const balance = sum(allAgg, "INCOME") - sum(allAgg, "EXPENSE");

  return (
    <DashboardClient
      initial={{ income, expense, balance, categories, txs }}
      formatIDR={formatIDR}
    />
  );
}
