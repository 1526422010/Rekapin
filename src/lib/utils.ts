import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

/** format angka ke Rupiah: 1.500.000 */
export function formatIDR(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

/** Cari user aktif berdasarkan sesi (NextAuth) */
export async function getSessionUser() {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}

/** Pastikan admin ada (dibuat dari env saat pertama kali dipakai) */
export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;
  await prisma.user.create({
    data: {
      email,
      name: email.split("@")[0],
      passwordHash: await hash(password, 10),
      categories: {
        create: [
          { name: "Gaji", type: "INCOME" },
          { name: "Bonus", type: "INCOME" },
          { name: "Lainnya (Masuk)", type: "INCOME" },
          { name: "Makan", type: "EXPENSE" },
          { name: "Transport", type: "EXPENSE" },
          { name: "Belanja", type: "EXPENSE" },
          { name: "Tagihan", type: "EXPENSE" },
          { name: "Hiburan", type: "EXPENSE" },
          { name: "Kesehatan", type: "EXPENSE" },
          { name: "Lainnya (Keluar)", type: "EXPENSE" },
        ],
      },
    },
  });
}
