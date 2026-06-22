import { db } from "../src/lib/db";

await db.$executeRawUnsafe(`
  CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx"
  ON "DocumentChunk"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
`);

await db.$executeRawUnsafe(`
  CREATE INDEX IF NOT EXISTS "Tag_embedding_hnsw_idx"
  ON "Tag"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
`);

console.log("DocumentChunk and Tag HNSW cosine indexes are ready.");
await db.$disconnect();
