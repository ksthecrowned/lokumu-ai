-- bytea embeddings (1024 floats) exceed btree index size limit
DROP INDEX IF EXISTS "Chunk_embedding_idx";
