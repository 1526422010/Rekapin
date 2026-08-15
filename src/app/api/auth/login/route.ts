import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { ensureAdmin } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await ensureAdmin();
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: "Email atau password salah" }, { status: 401 });
    }
    throw e;
  }
}
