import { auth, signOut } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  if (session) await signOut({ redirect: false });
  return Response.json({ ok: true });
}
