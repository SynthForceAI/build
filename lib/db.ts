/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads route handlers in dev, which would otherwise create
 * a new Prisma client on every reload and exhaust the database connection
 * pool. We cache the instance on `globalThis` so HMR reuses it.
 *
 * In production (Vercel serverless), each function invocation gets a
 * fresh module scope, so the global cache is a no-op there.
 */
import { config } from "dotenv";
// Only load .env.local as a fallback for contexts that don't populate env
// themselves (e.g. `prisma/seed.ts` run via tsx). Next.js dev/build and the
// Vercel runtime already inject DATABASE_URL, so we never override them here.
if (!process.env.DATABASE_URL) config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
