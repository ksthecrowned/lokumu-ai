import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeLanguage } from '../shared/i18n/languages';

export type RagSearchResult = {
  id: string;
  content: string;
  metadata: Prisma.JsonValue;
  language: string;
  score: number;
  community: boolean;
};

type IngestDocumentInput = {
  source: string;
  title?: string;
  language: string;
  content: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class RagService implements OnModuleInit, OnModuleDestroy {
  private featureExtractor: any | null = null;
  private readonly EMBEDDING_MODEL = 'Xenova/bge-m3';
  private readonly EMBEDDING_DIMENSION = 1024;
  private readonly SCORE_THRESHOLD = 0.5;
  private readonly mockFallbackEnabled =
    process.env.EMBEDDING_FALLBACK_MOCK === 'true';

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (this.mockFallbackEnabled) {
      this.featureExtractor = null;
      console.warn(
        'EMBEDDING_FALLBACK_MOCK=true, using deterministic mock embeddings',
      );
      return;
    }

    this.featureExtractor = await pipeline(
      'feature-extraction',
      this.EMBEDDING_MODEL,
      { quantized: false },
    );
  }

  async onModuleDestroy() {
    this.featureExtractor = null;
  }

  isModelLoaded(): boolean {
    return this.featureExtractor !== null || this.mockFallbackEnabled;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.featureExtractor) {
      if (!this.mockFallbackEnabled) {
        throw new Error(
          'Embedding model not loaded. Set EMBEDDING_FALLBACK_MOCK=true for CI.',
        );
      }
      return this.generateMockEmbedding(text);
    }

    const output = await this.featureExtractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    const values = Array.from(output.data || output) as number[];
    if (values.length >= this.EMBEDDING_DIMENSION) {
      return values.slice(0, this.EMBEDDING_DIMENSION);
    }
    return values.concat(
      new Array(this.EMBEDDING_DIMENSION - values.length).fill(0),
    );
  }

  private generateMockEmbedding(text: string): number[] {
    const vector = new Array(this.EMBEDDING_DIMENSION).fill(0);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    for (let i = 0; i < this.EMBEDDING_DIMENSION; i += 1) {
      const seed = Math.sin(hash + i * 0.37) * 10000;
      vector[i] = (seed - Math.floor(seed)) * 2 - 1;
    }
    return vector;
  }

  async ingestDocument({
    source,
    title,
    language,
    content,
    metadata = {},
  }: IngestDocumentInput) {
    const internalLanguage = normalizeLanguage(language);
    const document = await this.prisma.document.create({
      data: {
        source,
        title,
        language: internalLanguage,
        content,
      },
    });

    const chunks = this.chunkText(content);
    const createdChunks: Array<{ id: string }> = [];

    for (const chunkContent of chunks) {
      const embedding = await this.generateEmbedding(chunkContent);
      const created = await this.prisma.chunk.create({
        data: {
          documentId: document.id,
          content: chunkContent,
          tokenCount: Math.max(1, Math.ceil(chunkContent.length / 4)),
          language: internalLanguage,
          embedding: new Uint8Array(new Float32Array(embedding).buffer),
          metadata: {
            source,
            title,
            ...metadata,
          },
        },
        select: { id: true },
      });
      await this.prisma.$executeRawUnsafe(
        'UPDATE "Chunk" SET "embedding_vec" = $1::vector WHERE "id" = $2',
        `[${embedding.join(',')}]`,
        created.id,
      );
      createdChunks.push(created);
    }

    return { ...document, chunks: createdChunks };
  }

  async search({
    query,
    language,
    limit = 5,
  }: {
    query: string;
    language?: string;
    limit?: number;
  }): Promise<RagSearchResult[]> {
    const queryEmbedding = await this.generateEmbedding(query);
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;
    const normalizedLanguage = language ? normalizeLanguage(language) : null;

    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        content: string;
        metadata: Prisma.JsonValue;
        language: string;
        score: number;
      }>
    >(
      `SELECT
        c."id",
        c."content",
        c."metadata",
        c."language",
        1 - (c."embedding_vec" <=> $1::vector) AS score
      FROM "Chunk" c
      WHERE c."embedding_vec" IS NOT NULL
        AND ($2::text IS NULL OR c."language" = $2)
      ORDER BY c."embedding_vec" <=> $1::vector
      LIMIT $3`,
      vectorLiteral,
      normalizedLanguage,
      limit,
    );

    return rows
      .filter((row) => Number(row.score) >= this.SCORE_THRESHOLD)
      .map((row) => ({
        ...row,
        score: Number(row.score),
        community: this.isCommunitySource(row.metadata),
      }));
  }

  private isCommunitySource(metadata: Prisma.JsonValue): boolean {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return false;
    }
    const source = (metadata as Record<string, unknown>).source;
    return typeof source === 'string' && source.startsWith('community://');
  }

  private chunkText(content: string): string[] {
    const paragraphs = content
      .split(/\n\s*\n/g)
      .map((part) => part.trim())
      .filter(Boolean);
    return paragraphs.length > 0 ? paragraphs : [content.trim()].filter(Boolean);
  }
}