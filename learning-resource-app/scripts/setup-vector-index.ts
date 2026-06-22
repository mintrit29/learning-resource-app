import { db } from "../src/lib/db";

await db.$executeRawUnsafe(`
  CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx"
  ON "DocumentChunk"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
`);

console.log("HNSW cosine index is ready.");
await db.$disconnect();
