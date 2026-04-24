/**
 * lib/db.ts
 *
 * Prisma client singleton.
 * Prevents multiple PrismaClient instances during hot-reload in development.
 */

import { PrismaClient } from "../generated/prisma/client";
// Use better-sqlite3 adapter for Prisma v7 (no Rust engine)
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const dbPath = rawUrl.replace(/^file:/, "");
  const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
  const adapter = new PrismaBetterSqlite3({ url: absolutePath });
  return new PrismaClient({ adapter } as never);
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
