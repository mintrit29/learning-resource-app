import { existsSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

export const EMBEDDING_DIMENSIONS = 1024;

const VECTOR_TABLE_NAME = "ChunkEmbeddingIndex";

export type ChunkVectorMatch = {
  chunkId: string;
  distance: number;
  semanticScore: number;
};

type VectorInput = number[] | Float32Array;

function sqliteVecPackage() {
  const key = `${process.platform}-${process.arch}`;
  const packages: Record<string, { name: string; extension: string }> = {
    "darwin-arm64": { name: "sqlite-vec-darwin-arm64", extension: "dylib" },
    "darwin-x64": { name: "sqlite-vec-darwin-x64", extension: "dylib" },
    "linux-arm64": { name: "sqlite-vec-linux-arm64", extension: "so" },
    "linux-x64": { name: "sqlite-vec-linux-x64", extension: "so" },
    "win32-x64": { name: "sqlite-vec-windows-x64", extension: "dll" },
  };
  const selected = packages[key];
  if (!selected) throw new Error(`sqlite-vec chưa hỗ trợ nền tảng ${key}`);
  return selected;
}

export function resolveSqliteVecExtensionPath(
  configuredPath = process.env.SCHOLARFLOW_SQLITE_VEC_PATH,
) {
  if (configuredPath) {
    if (!path.isAbsolute(configuredPath)) {
      throw new Error("SCHOLARFLOW_SQLITE_VEC_PATH phải là đường dẫn tuyệt đối");
    }
    if (!existsSync(configuredPath)) {
      throw new Error(`Không tìm thấy sqlite-vec extension: ${configuredPath}`);
    }
    return configuredPath;
  }

  const selected = sqliteVecPackage();
  const extensionPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "node_modules",
    selected.name,
    `vec0.${selected.extension}`,
  );
  if (!existsSync(extensionPath)) {
    throw new Error(`Không tìm thấy sqlite-vec extension: ${extensionPath}`);
  }
  return extensionPath;
}

function validateVector(values: ArrayLike<number>) {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Vector phải có đúng ${EMBEDDING_DIMENSIONS} phần tử`);
  }

  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) {
      throw new Error("Vector chỉ được chứa các số hữu hạn");
    }
  }
}

export function toSqliteVectorBlob(vector: VectorInput) {
  validateVector(vector);
  const buffer = Buffer.allocUnsafe(EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT);

  for (let index = 0; index < vector.length; index += 1) {
    buffer.writeFloatLE(vector[index], index * Float32Array.BYTES_PER_ELEMENT);
  }

  return buffer;
}

export function fromSqliteVectorBlob(blob: Uint8Array) {
  const expectedBytes = EMBEDDING_DIMENSIONS * Float32Array.BYTES_PER_ELEMENT;
  if (blob.byteLength !== expectedBytes) {
    throw new Error(`Embedding BLOB phải có đúng ${expectedBytes} byte`);
  }

  const bytes = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
  const vector = new Float32Array(EMBEDDING_DIMENSIONS);
  for (let index = 0; index < EMBEDDING_DIMENSIONS; index += 1) {
    vector[index] = bytes.readFloatLE(index * Float32Array.BYTES_PER_ELEMENT);
  }
  return vector;
}

export function cosineSimilarity(left: ArrayLike<number>, right: ArrayLike<number>) {
  validateVector(left);
  validateVector(right);
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < EMBEDDING_DIMENSIONS; index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dotProduct / Math.sqrt(leftMagnitude * rightMagnitude);
}

export function resolveSqliteDatabasePath(
  databaseUrl = process.env.DATABASE_URL ?? "file:./storage/scholarflow.db",
) {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("ScholarFlow local chỉ hỗ trợ DATABASE_URL dạng file:");
  }

  const value = decodeURIComponent(databaseUrl.slice("file:".length));
  if (!value || value === ":memory:") return value || ":memory:";
  return path.isAbsolute(value)
    ? value
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), value);
}

export class SqliteVectorStore {
  readonly databasePath: string;
  private readonly database: Database.Database;

  constructor(databaseUrl?: string) {
    this.databasePath = resolveSqliteDatabasePath(databaseUrl);
    this.database = new Database(this.databasePath);
    this.database.pragma("journal_mode = WAL");
    this.database.pragma("foreign_keys = ON");
    this.database.pragma("busy_timeout = 5000");
    this.database.loadExtension(resolveSqliteVecExtensionPath());
    this.bootstrap();
  }

  private bootstrap() {
    this.database.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS "${VECTOR_TABLE_NAME}" USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[${EMBEDDING_DIMENSIONS}] distance_metric=cosine
      )
    `);
  }

  upsertChunkEmbedding(chunkId: string, vector: VectorInput) {
    const cleanChunkId = chunkId.trim();
    if (!cleanChunkId) throw new Error("chunkId không được để trống");
    const blob = toSqliteVectorBlob(vector);
    const remove = this.database.prepare(
      `DELETE FROM "${VECTOR_TABLE_NAME}" WHERE chunk_id = ?`,
    );
    const insert = this.database.prepare(
      `INSERT INTO "${VECTOR_TABLE_NAME}" (chunk_id, embedding) VALUES (?, ?)`,
    );
    this.database.transaction(() => {
      remove.run(cleanChunkId);
      insert.run(cleanChunkId, blob);
    })();
  }

  deleteChunkEmbedding(chunkId: string) {
    this.database
      .prepare(`DELETE FROM "${VECTOR_TABLE_NAME}" WHERE chunk_id = ?`)
      .run(chunkId);
  }

  deleteChunkEmbeddings(chunkIds: string[]) {
    const uniqueIds = [...new Set(chunkIds.filter(Boolean))];
    if (!uniqueIds.length) return 0;

    const remove = this.database.prepare(
      `DELETE FROM "${VECTOR_TABLE_NAME}" WHERE chunk_id = ?`,
    );
    const removeAll = this.database.transaction((ids: string[]) => {
      let changes = 0;
      for (const id of ids) changes += remove.run(id).changes;
      return changes;
    });
    return removeAll(uniqueIds);
  }

  searchChunkEmbeddings(
    vector: VectorInput,
    limit: number,
    allowedChunkIds?: string[],
  ): ChunkVectorMatch[] {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    const vectorBlob = toSqliteVectorBlob(vector);
    const uniqueAllowedIds = allowedChunkIds
      ? [...new Set(allowedChunkIds.filter(Boolean))]
      : undefined;
    if (uniqueAllowedIds?.length === 0) return [];

    const groups: Array<string[] | undefined> = uniqueAllowedIds
      ? Array.from(
          { length: Math.ceil(uniqueAllowedIds.length / 30_000) },
          (_, index) => uniqueAllowedIds.slice(index * 30_000, (index + 1) * 30_000),
        )
      : [undefined];
    const rows: Array<{ chunkId: string; distance: number }> = [];

    for (const group of groups) {
      const allowedSql = group
        ? ` AND chunk_id IN (${group.map(() => "?").join(", ")})`
        : "";
      const groupRows = this.database
        .prepare(
          `SELECT chunk_id AS "chunkId", distance
           FROM "${VECTOR_TABLE_NAME}"
           WHERE embedding MATCH ? AND k = ?${allowedSql}
           ORDER BY distance ASC`,
        )
        .all(vectorBlob, safeLimit, ...(group ?? [])) as Array<{
        chunkId: string;
        distance: number;
      }>;
      rows.push(...groupRows);
    }

    return rows
      .sort((left, right) => left.distance - right.distance)
      .slice(0, safeLimit)
      .map((row) => ({
        chunkId: row.chunkId,
        distance: row.distance,
        semanticScore: 1 - row.distance,
      }));
  }

  count() {
    const row = this.database
      .prepare(`SELECT count(*) AS "count" FROM "${VECTOR_TABLE_NAME}"`)
      .get() as { count: number };
    return row.count;
  }

  close() {
    if (this.database.open) this.database.close();
  }
}

let sharedStore: SqliteVectorStore | undefined;

export function getSqliteVectorStore() {
  sharedStore ??= new SqliteVectorStore();
  return sharedStore;
}

export function closeSqliteVectorStore() {
  sharedStore?.close();
  sharedStore = undefined;
}
