import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <main className="mx-auto max-w-2xl p-4">
      <nav className="mb-6 flex items-center gap-4 text-sm">
        <a href="/dashboard" className="text-slate-500 hover:text-slate-900">
          ← Dashboard
        </a>
      </nav>
      {children}
    </main>
  );
}
