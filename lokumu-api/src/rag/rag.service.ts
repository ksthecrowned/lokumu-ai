import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { pipeline } from '@xenova/transformers';

@Injectable()
export class RagService implements OnModuleInit, OnModuleDestroy {
  private featureExtractor: any; // for embeddings
  private readonly EMBEDDING_MODEL = 'Xenova/bge-m3'; // Multilingual model supporting target languages

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    console.log('Loading embedding model...');
    this.featureExtractor = await pipeline(
      'feature-extraction',
      this.EMBEDDING_MODEL,
      { quantized: false } // we can use quantized later if needed
    );
    console.log('Embedding model loaded');
  }

  async onModuleDestroy() {
    // cleanup if needed
    this.featureExtractor = null;
  }

  /**
   * Generate embedding for a given text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.featureExtractor) {
      throw new Error('Embedding model not initialized');
    }
    const output = await this.featureExtractor(text, {
      pooling: 'mean', // mean pooling over tokens
      normalize: true, // normalize to unit length
    });
    // output is a Float32Array or number[]
    return Array.from(output.data || output);
  }

  /**
   * Ingest a document: split into chunks, generate embeddings, store
   */
  async ingestDocument({
    source,
    title,
    language,
    content,
  }: {
    source: string;
    title?: string;
    language: string; // ISO-639-3 code e.g., 'fra', 'lin', 'swa', 'eng'
    content: string;
  }) {
    // Simple chunking: split by paragraphs, limit size
    const PARAGRAPH_SPLIT = /\n\s*\n/;
    const MAX_CHUNK_TOKENS = 256; // approximate token limit; we'll just use characters for simplicity
    const paragraphs = content.split(PARAGRAPH_SPLIT).map(p => p.trim()).filter(p => p.length > 0);

    const chunks: { content: string; tokenCount: number; language: string; embedding: number[]; metadata: {} }[] = [];
    for (const para of paragraphs) {
      // naive token estimate: 4 chars per token
      const tokenCount = Math.ceil(para.length / 4);
      if (tokenCount > MAX_CHUNK_TOKENS) {
        // split further by sentences
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
        let buffer = '';
        for (const sent of sentences) {
          if ((buffer + sent).length / 4 > MAX_CHUNK_TOKENS) {
            if (buffer) {
              const emb = await this.generateEmbedding(buffer);
              chunks.push({ content: buffer, tokenCount: Math.ceil(buffer.length / 4), language, embedding: emb, metadata: {} });
              buffer = '';
            }
            buffer = sent;
          } else {
            buffer += (buffer ? ' ' : '') + sent;
          }
        }
        if (buffer) {
          const emb = await this.generateEmbedding(buffer);
          chunks.push({ content: buffer, tokenCount: Math.ceil(buffer.length / 4), language, embedding: emb, metadata: {} });
        }
      } else {
        const emb = await this.generateEmbedding(para);
        chunks.push({ content: para, tokenCount: Math.ceil(para.length / 4), language, embedding: emb, metadata: {} });
      }
    }

    // Store document and chunks in DB
    const document = await this.prisma.document.create({
      data: {
        source,
        title,
        language,
        content,
        chunks: {
          create: chunks.map(chunk => ({
            content: chunk.content,
            tokenCount: chunk.tokenCount,
            language: chunk.language,
            // Store embedding as Bytes; Prisma expects Uint8Array
            embedding: new Uint8Array(new Float32Array(chunk.embedding).buffer),
            metadata: chunk.metadata,
          })),
        },
      },
    });

    return document;
  }

  /**
   * Search for relevant chunks given a query
   */
  async search({
    query,
    language,
    limit = 5,
  }: {
    query: string;
    language?: string;
    limit?: number;
  }) {
    const queryEmbedding = await this.generateEmbedding(query);
    const queryEmbeddingBuffer = new Float32Array(queryEmbedding).buffer;

    // Use raw SQL for pgvector cosine distance
    // Assuming embedding column is of type vector(1024) and we stored as bytea (but we stored as Buffer)
    // We'll need to cast: embedding::vector
    const results = await this.prisma.$queryRaw`
      SELECT c.id, c.content, c.tokenCount, c.metadata,
             1 - (c.embedding <=> ${queryEmbeddingBuffer}::vector) AS similarity
      FROM "Chunk" c
      JOIN "Document" d ON c."documentId" = d.id
      ${language ? Prisma.sql`WHERE d.language = ${language}` : Prisma.sql``}
      ORDER BY similarity DESC
      LIMIT ${limit}
    `;
    return results;
  }
}