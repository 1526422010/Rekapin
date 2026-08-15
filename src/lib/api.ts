import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/utils";
import { NextResponse } from "next/server";

/** Guard: wajib login. Return user atau NextResponse 401. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user)
    return { user: null, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, res: null };
}

export function jsonOk(data: unknown) {
  return NextResponse.json(data);
}
