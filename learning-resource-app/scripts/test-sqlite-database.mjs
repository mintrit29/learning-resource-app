import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { initializeSqliteDatabase } from "../src/lib/storage/initialize-sqlite-database.ts";

const tempDirectory = await mkdtemp(path.join(tmpdir(), "scholarflow-db-"));
const databasePath = path.join(tempDirectory, "scholarflow.db");
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const legacyDatabasePath = path.join(tempDirectory, "legacy.db");
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
    assert.equal(tables.includes("User"), false);
    assert.ok(tables.includes("Document"));
    assert.ok(tables.includes("DocumentChunk"));
    assert.ok(tables.includes("_ScholarFlowMigration"));
    assert.equal(tables.includes("Account"), false);
    assert.equal(tables.includes("Session"), false);
    assert.equal(tables.includes("VerificationToken"), false);


    const migrationCount = database
      .prepare('SELECT count(*) AS count FROM "_ScholarFlowMigration"')
      .get().count;
    assert.equal(migrationCount, 3, "Every migration must be applied exactly once");
  } finally {
    database.close();
  }

  const legacy = new Database(legacyDatabasePath);
  try {
    legacy.exec(await readFile(path.join(migrationsRoot, "20260731153000_init_sqlite", "migration.sql"), "utf8"));
    legacy.exec(await readFile(path.join(migrationsRoot, "20260810120000_add_curriculum_initialization", "migration.sql"), "utf8"));
    legacy.exec('CREATE TABLE "_ScholarFlowMigration" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" TEXT NOT NULL)');
    legacy.prepare('INSERT INTO "_ScholarFlowMigration" VALUES (?, ?)').run("20260731153000_init_sqlite", new Date().toISOString());
    legacy.prepare('INSERT INTO "_ScholarFlowMigration" VALUES (?, ?)').run("20260810120000_add_curriculum_initialization", new Date().toISOString());
    legacy.prepare('INSERT INTO "User" ("id", "email", "updatedAt") VALUES (?, ?, ?)').run("old-user", "old@example.test", new Date().toISOString());
    legacy.prepare('INSERT INTO "Tag" ("id", "name", "normalizedName", "createdByUserId", "updatedAt", "isClassificationEnabled") VALUES (?, ?, ?, ?, ?, ?)').run("kept-tag", "Kept topic", "kept topic", "old-user", new Date().toISOString(), 1);
    legacy.prepare('INSERT INTO "AiProvider" ("id", "userId", "type", "displayName", "isActive", "updatedAt") VALUES (?, ?, ?, ?, ?, ?)').run("kept-provider", "old-user", "OLLAMA", "Local Ollama", 1, new Date().toISOString());
    legacy.prepare('INSERT INTO "Document" ("id", "userId", "title", "originalFileName", "fileType", "filePath", "fileSize", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run("removed-document", "old-user", "Old document", "old.pdf", "PDF", "uploads/old.pdf", 1, new Date().toISOString());
  } finally {
    legacy.close();
  }

  initializeSqliteDatabase(`file:${legacyDatabasePath.replaceAll("\\", "/")}`, migrationsRoot);
  const migrated = new Database(legacyDatabasePath, { readonly: true });
  try {
    assert.equal(migrated.prepare('SELECT count(*) AS count FROM "Document"').get().count, 0);
    assert.equal(migrated.prepare('SELECT count(*) AS count FROM "Tag" WHERE id = ?').get("kept-tag").count, 1);
    assert.equal(migrated.prepare('SELECT count(*) AS count FROM "AiProvider" WHERE id = ?').get("kept-provider").count, 1);
    assert.equal(migrated.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'User'").get().count, 0);
  } finally {
    migrated.close();
  }

  console.log("PASS sqlite database: first-run migration and idempotent restart");
} finally {
  await rm(tempDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
