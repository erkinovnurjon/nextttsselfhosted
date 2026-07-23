import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
  interface User {
    role?: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        // "email" kaliti tarixiy — qiymat email YOKI username bo'lishi mumkin.
        email: { label: "Email yoki username", type: "text" },
        password: { label: "Parol", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const ident = String(credentials.email).trim();
        const password = String(credentials.password);

        let user;
        if (ident.includes("@")) {
          user = await db.user.findUnique({
            where: { email: ident.toLowerCase() },
          });
        } else {
          // Username = User.name (registerda bandlik tekshiriladi). Bir xil nomli
          // eski hisoblar bo'lsa — noaniq, xavfsizlik uchun rad etamiz (email bilan kirsin).
          const matches = await db.user.findMany({
            where: { name: { equals: ident, mode: "insensitive" } },
            take: 2,
          });
          if (matches.length !== 1) return null;
          user = matches[0];
        }
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
      } else if (token.id) {
        // Rolni har safar DB'dan yangilab turamiz — set-role.mjs bilan
        // o'zgartirilgan rol qayta login qilmasdan darrov kuchga kiradi.
        const fresh = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (fresh) token.role = fresh.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "user";
      }
      return session;
    },
  },
});
