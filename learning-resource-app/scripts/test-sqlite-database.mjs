import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { initializeSqliteDatabase } from "../src/lib/storage/initialize-sqlite-database.ts";

const tempDirectory = await mkdtemp(path.join(tmpdir(), "scholarflow-db-"));
const databasePath = path.join(tempDirectory, "scholarflow.db");
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const migrationsRoot = path.resolve("prisma", "migrations");

try {
  initializeSqliteDatabase(databaseUrl, migrationsRoot);
  initializeSqliteDatabase(databaseUrl, migrationsRoot);

  const database = new Database(databasePath, { readonly: true });
  try {
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name);
    assert.ok(tables.includes("User"));
    assert.ok(tables.includes("Document"));
    assert.ok(tables.includes("DocumentChunk"));
    assert.ok(tables.includes("_ScholarFlowMigration"));

    const migrationCount = database
      .prepare('SELECT count(*) AS count FROM "_ScholarFlowMigration"')
      .get().count;
    assert.equal(migrationCount, 2, "Every migration must be applied exactly once");
  } finally {
    database.close();
  }

  console.log("PASS sqlite database: first-run migration and idempotent restart");
} finally {
  await rm(tempDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
