import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureAdmin } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  await ensureAdmin();
  return <>{children}</>;
}
