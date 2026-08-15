import type { NextAuthConfig } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null };
  }
}

export const authConfig: Omit<NextAuthConfig, "providers"> = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
};

export function authCallbacks(): NextAuthConfig["callbacks"] {
  return {
    jwt({ token, user }: { token: Record<string, unknown>; user?: { id?: string } }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({
      session,
      token,
    }: {
      session: { user: { id?: string }; expires: string };
      token: Record<string, unknown>;
    }) {
      if (token.id && session.user) session.user.id = token.id as string;
      return session;
    },
  };
}
