import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const MIGRATION_TABLE_NAME = "_ScholarFlowMigration";

function resolveDatabasePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("ScholarFlow local chỉ hỗ trợ DATABASE_URL dạng file:");
  }

  const value = decodeURIComponent(databaseUrl.slice("file:".length));
  if (!value || value === ":memory:") return value || ":memory:";
  return path.isAbsolute(value)
    ? value
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), value);
}

function migrationFiles(migrationsRoot: string) {
  if (!existsSync(migrationsRoot)) {
    throw new Error(`Không tìm thấy thư mục SQLite migrations: ${migrationsRoot}`);
  }

  return readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(migrationsRoot, entry.name, "migration.sql"),
    }))
    .filter((migration) => existsSync(migration.path))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function initializeSqliteDatabase(
  databaseUrl: string,
  migrationsRoot = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "prisma",
    "migrations",
  ),
) {
  const databasePath = resolveDatabasePath(databaseUrl);
  if (databasePath !== ":memory:") {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);
  try {
    database.pragma("foreign_keys = ON");
    if (databasePath !== ":memory:") database.pragma("journal_mode = WAL");
    database.exec(`
      CREATE TABLE IF NOT EXISTS "${MIGRATION_TABLE_NAME}" (
        "name" TEXT NOT NULL PRIMARY KEY,
        "appliedAt" TEXT NOT NULL
      )
    `);

    const migrations = migrationFiles(migrationsRoot);
    const appliedRows = database
      .prepare(`SELECT "name" FROM "${MIGRATION_TABLE_NAME}"`)
      .all() as Array<{ name: string }>;
    const applied = new Set(appliedRows.map((row) => row.name));
    const applicationSchemaExists = Boolean(
      database
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'User'")
        .get(),
    );
    const recordMigration = database.prepare(
      `INSERT INTO "${MIGRATION_TABLE_NAME}" ("name", "appliedAt") VALUES (?, ?)`,
    );

    migrations.forEach((migration, index) => {
      if (applied.has(migration.name)) return;

      // Databases created by an earlier SQLite development build already contain
      // the initial schema but do not have ScholarFlow's migration marker yet.
      if (index === 0 && applicationSchemaExists) {
        recordMigration.run(migration.name, new Date().toISOString());
        return;
      }

      const sql = readFileSync(migration.path, "utf8");
      database.transaction(() => {
        database.exec(sql);
        recordMigration.run(migration.name, new Date().toISOString());
      })();
    });
  } finally {
    database.close();
  }
}
