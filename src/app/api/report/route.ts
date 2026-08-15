import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api";
import { buildWorkbook } from "@/lib/excel";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res;

  const url = new URL(req.url);
  const ym = url.searchParams.get("month"); // format: YYYY-MM
  const m = /^\d{4}-\d{2}$/.test(ym ?? "") ? ym! : null;
  const start = m ? new Date(`${m}-01T00:00:00`) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = m ? new Date(start.getFullYear(), start.getMonth() + 1, 1) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, date: { gte: start, lt: end } },
    include: { category: true },
    orderBy: { date: "asc" },
  });

  const wb = await buildWorkbook(txs);
  const buf = await wb.xlsx.writeBuffer();
  const monthLabel = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rekapin-${monthLabel}.xlsx"`,
    },
  });
}
