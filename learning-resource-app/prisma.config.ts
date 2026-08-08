import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabasePath = path
  .join(projectRoot, "storage", "scholarflow.db")
  .replaceAll("\\", "/");
const databaseUrl = process.env.DATABASE_URL ?? `file:${defaultDatabasePath}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
