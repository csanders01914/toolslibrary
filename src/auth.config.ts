import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const authConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.alias = user.alias;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.alias = token.alias as string;
        session.user.role = token.role as string;
        session.user.mustChangePassword = token.mustChangePassword === true;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const isProtected =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/tools/new") ||
        pathname.startsWith("/skills/new") ||
        pathname.startsWith("/messages") ||
        pathname.startsWith("/admin");

      if (isProtected) {
        if (!auth?.user) return false;
        if (pathname.startsWith("/admin") && auth.user.role !== "ADMIN") {
          return false;
        }
      }

      return true;
    },
  },
  session: {
    strategy: "jwt",
    // Ephemeral login token: the JWT and its cookie are re-issued with a fresh
    // expiry on every session fetch, so this acts as an inactivity timeout.
    // One hour of inactivity invalidates the token; active browsing keeps it alive.
    maxAge: 60 * 60,
  },
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;

// Create edge-safe auth function for middleware
export const { auth } = NextAuth(authConfig);