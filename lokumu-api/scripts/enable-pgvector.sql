-- Optional: run manually after installing pgvector on PostgreSQL.
-- See: https://github.com/pgvector/pgvector#installation
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "embedding_vec" vector(1024);
