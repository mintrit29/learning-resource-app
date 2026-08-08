import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import { initializeSqliteDatabase } from "@/lib/storage/initialize-sqlite-database";
import { resolveScholarFlowDataRoot } from "@/lib/storage/local-storage";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const defaultDatabasePath = path
  .join(resolveScholarFlowDataRoot(), "scholarflow.db")
  .replaceAll("\\", "/");
const databaseUrl = process.env.DATABASE_URL ?? `file:${defaultDatabasePath}`;

initializeSqliteDatabase(databaseUrl);

const adapter = new PrismaBetterSqlite3({ url: databaseUrl });

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    omit: {
      documentChunk: { embedding: true },
      tag: { embedding: true },
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
