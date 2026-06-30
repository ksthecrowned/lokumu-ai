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
  private readonly KEYWORD_STOPWORDS = new Set([
    'donne',
    'donnez',
    'moi',
    'une',
    'un',
    'des',
    'les',
    'the',
    'and',
    'for',
    'with',
    'comment',
    'dit',
    'comment',
    'na',
    'ya',
    'mpo',
    'lobi',
    'pesa',
    'mono',
    'kituba',
    'kitúba',
    'lingala',
    'lingála',
  ]);
  private mockEmbeddingsActive =
    process.env.EMBEDDING_FALLBACK_MOCK === 'true';
  private pgvectorAvailable: boolean | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (this.mockEmbeddingsActive) {
      this.featureExtractor = null;
      console.warn(
        'EMBEDDING_FALLBACK_MOCK=true, using deterministic mock embeddings',
      );
      return;
    }

    try {
      this.featureExtractor = await pipeline(
        'feature-extraction',
        this.EMBEDDING_MODEL,
        { quantized: false },
      );
    } catch (error) {
      this.mockEmbeddingsActive = true;
      this.featureExtractor = null;
      console.warn(
        'BGE-M3 failed to load, falling back to mock embeddings:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  async onModuleDestroy() {
    this.featureExtractor = null;
  }

  isModelLoaded(): boolean {
    return this.featureExtractor !== null || this.mockEmbeddingsActive;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.featureExtractor) {
      if (this.mockEmbeddingsActive) {
        return this.generateMockEmbedding(text);
      }
      throw new Error(
        'Embedding model not loaded. Set EMBEDDING_FALLBACK_MOCK=true for local dev.',
      );
    }

    const output = await this.featureExtractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    const values: number[] = Array.from(
      (output.data ?? output) as ArrayLike<number>,
    );
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
      try {
        await this.prisma.$executeRawUnsafe(
          'UPDATE "Chunk" SET "embedding_vec" = $1::vector WHERE "id" = $2',
          `[${embedding.join(',')}]`,
          created.id,
        );
      } catch {
        // pgvector not installed — bytea embedding still stored
      }
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
    const intent = this.classifyQueryIntent(query);
    const finalize = (results: RagSearchResult[]) =>
      this.rerankByMetadata(
        this.prioritizeResults(results, query, limit),
        intent,
      ).slice(0, limit);

    const keywordResults = await this.searchByKeywords({ query, language, limit });

    if (!(await this.isPgvectorAvailable())) {
      return finalize(
        await this.finalizeSearchResults(keywordResults, query, language, limit),
      );
    }

    try {
      const vectorResults = await this.searchByPgvector({ query, language, limit });
      if (this.mockEmbeddingsActive || vectorResults.length === 0) {
        return finalize(
          await this.finalizeSearchResults(
            this.mergeSearchResults(keywordResults, vectorResults, limit),
            query,
            language,
            limit,
          ),
        );
      }
      if (vectorResults.length < limit) {
        return finalize(
          await this.finalizeSearchResults(
            this.mergeSearchResults(vectorResults, keywordResults, limit),
            query,
            language,
            limit,
          ),
        );
      }
      return finalize(vectorResults);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('embedding_vec') || message.includes('42703')) {
        this.pgvectorAvailable = false;
        return finalize(
          await this.finalizeSearchResults(keywordResults, query, language, limit),
        );
      }
      throw error;
    }
  }

  rerankByMetadata(
    results: RagSearchResult[],
    intent: 'greeting' | 'translation' | 'grammar' | 'proverb' | 'general',
  ): RagSearchResult[] {
    const typeBoost: Record<string, string[]> = {
      greeting: ['dialogue_example', 'dialogue', 'greeting'],
      translation: ['lexicon', 'grammar', 'comparative'],
      grammar: ['grammar'],
      proverb: ['proverb', 'cultural_note'],
      general: ['dialogue_example', 'lexicon'],
    };
    const preferred = typeBoost[intent] ?? [];

    return [...results].sort((a, b) => {
      const aType =
        typeof a.metadata === 'object' &&
        a.metadata &&
        !Array.isArray(a.metadata)
          ? String((a.metadata as Record<string, unknown>).type ?? '')
          : '';
      const bType =
        typeof b.metadata === 'object' &&
        b.metadata &&
        !Array.isArray(b.metadata)
          ? String((b.metadata as Record<string, unknown>).type ?? '')
          : '';

      const aBoost = preferred.includes(aType) ? 0.15 : 0;
      const bBoost = preferred.includes(bType) ? 0.15 : 0;
      return b.score + bBoost - (a.score + aBoost);
    });
  }

  private classifyQueryIntent(
    query: string,
  ): 'greeting' | 'translation' | 'grammar' | 'proverb' | 'general' {
    if (
      /^(bonjour|bonsoir|salut|mbote|hello|hi|hey)[\s!.?]*$/i.test(
        query.trim(),
      ) ||
      /mbote|sango nini|salut|bonjour|bonsoir|hello|hi|kimia/i.test(query)
    ) {
      return 'greeting';
    }
    if (/comment dit-on|how do you say|traduire|translate/i.test(query)) {
      return 'translation';
    }
    if (/conjugaison|grammar|grammaire|verbe|pronom/i.test(query)) {
      return 'grammar';
    }
    if (/proverbe|proverb|ndakisa/i.test(query)) {
      return 'proverb';
    }
    return 'general';
  }

  private mergeSearchResults(
    primary: RagSearchResult[],
    secondary: RagSearchResult[],
    limit: number,
  ): RagSearchResult[] {
    const seen = new Set<string>();
    const merged: RagSearchResult[] = [];
    for (const item of [...primary, ...secondary]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
    return merged.slice(0, limit);
  }

  private async finalizeSearchResults(
    results: RagSearchResult[],
    query: string,
    language: string | undefined,
    limit: number,
  ): Promise<RagSearchResult[]> {
    if (results.length > 0) {
      return results;
    }
    if (/proverbe|proverb|ndakisa/i.test(query)) {
      return this.searchByContentType({ language, type: 'proverb', limit });
    }
    return results;
  }

  private async searchByContentType({
    language,
    type,
    limit,
  }: {
    language?: string;
    type: string;
    limit: number;
  }): Promise<RagSearchResult[]> {
    const normalizedLanguage = language ? normalizeLanguage(language) : null;
    const chunks = await this.prisma.chunk.findMany({
      where: normalizedLanguage ? { language: normalizedLanguage } : undefined,
      take: 200,
      select: {
        id: true,
        content: true,
        metadata: true,
        language: true,
      },
    });

    return chunks
      .filter((chunk) => {
        const metadata = chunk.metadata as Record<string, unknown> | null;
        return metadata?.type === type;
      })
      .sort((a, b) => {
        const aHasNative = !/^\(FR:/i.test(a.content.trim());
        const bHasNative = !/^\(FR:/i.test(b.content.trim());
        return Number(bHasNative) - Number(aHasNative);
      })
      .slice(0, limit)
      .map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        metadata: chunk.metadata,
        language: chunk.language,
        score: 0.6,
        community: this.isCommunitySource(chunk.metadata),
      }));
  }

  private prioritizeResults(
    results: RagSearchResult[],
    query: string,
    limit: number,
  ): RagSearchResult[] {
    if (!/proverbe|proverb|ndakisa/i.test(query)) {
      return results.slice(0, limit);
    }

    const proverbs = results.filter((item) => {
      const metadata = item.metadata as Record<string, unknown> | null;
      return metadata?.type === 'proverb';
    });
    const others = results.filter((item) => {
      const metadata = item.metadata as Record<string, unknown> | null;
      return metadata?.type !== 'proverb';
    });

    const sortedProverbs = [...proverbs].sort((a, b) => {
      const aHasNative = !/^\(FR:/i.test(a.content.trim());
      const bHasNative = !/^\(FR:/i.test(b.content.trim());
      return Number(bHasNative) - Number(aHasNative);
    });

    return [...sortedProverbs, ...others].slice(0, limit);
  }

  private async isPgvectorAvailable(): Promise<boolean> {
    if (this.pgvectorAvailable !== null) {
      return this.pgvectorAvailable;
    }
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ exists: boolean }[]>(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'Chunk'
            AND column_name = 'embedding_vec'
        ) AS exists`,
      );
      this.pgvectorAvailable = rows[0]?.exists === true;
    } catch {
      this.pgvectorAvailable = false;
    }
    return this.pgvectorAvailable;
  }

  private async searchByPgvector({
    query,
    language,
    limit,
  }: {
    query: string;
    language?: string;
    limit: number;
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

  private async searchByKeywords({
    query,
    language,
    limit,
  }: {
    query: string;
    language?: string;
    limit: number;
  }): Promise<RagSearchResult[]> {
    const normalizedLanguage = language ? normalizeLanguage(language) : null;
    const queryLower = query.toLowerCase();
    const terms = queryLower
      .split(/[^\p{L}\p{N}]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !this.KEYWORD_STOPWORDS.has(t));
    const proverbQuery = /proverbe|proverb|ndakisa/i.test(queryLower);

    const chunks = await this.prisma.chunk.findMany({
      where: normalizedLanguage ? { language: normalizedLanguage } : undefined,
      take: 80,
      select: {
        id: true,
        content: true,
        metadata: true,
        language: true,
      },
    });

    const KEYWORD_THRESHOLD = 0.35;

    return chunks
      .map((chunk) => {
        const contentLower = chunk.content.toLowerCase();
        const metadata = (chunk.metadata as Record<string, unknown>) ?? {};
        const titleLower = String(metadata.title ?? '').toLowerCase();
        const typeLower = String(metadata.type ?? '').toLowerCase();
        const tagsLower = Array.isArray(metadata.tags)
          ? metadata.tags.map((tag) => String(tag).toLowerCase())
          : [];
        const tagsText = tagsLower.join(' ');

        let score = 0;
        if (
          contentLower.includes(queryLower) ||
          titleLower.includes(queryLower) ||
          tagsText.includes(queryLower)
        ) {
          score += 0.85;
        } else if (terms.length > 0) {
          const contentMatches = terms.filter((t) =>
            contentLower.includes(t),
          ).length;
          const titleMatches = terms.filter((t) => titleLower.includes(t)).length;
          const tagMatches = terms.filter(
            (t) => tagsText.includes(t) || typeLower.includes(t),
          ).length;
          if (contentMatches > 0) {
            score += 0.2 + (contentMatches / terms.length) * 0.5;
          }
          if (titleMatches > 0) {
            score += 0.25 + (titleMatches / terms.length) * 0.5;
          }
          if (tagMatches > 0) {
            score += 0.3 + (tagMatches / terms.length) * 0.45;
          }
          if (
            normalizedLanguage &&
            terms.some((t) => ['lingala', 'lin', 'lingála'].includes(t))
          ) {
            score += 0.15;
          }
          if (proverbQuery && (typeLower === 'proverb' || tagsText.includes('proverbe'))) {
            score += 0.55;
          }
          if (/^\(fr:/i.test(contentLower.trim())) {
            score *= 0.35;
          } else if (
            /comment dit-on|how do you say|traduire|translate/i.test(queryLower)
          ) {
            score += 0.2;
          }
        }
        score = Math.min(score, 1);

        return {
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          language: chunk.language,
          score,
          community: this.isCommunitySource(chunk.metadata),
        };
      })
      .filter((row) => row.score >= KEYWORD_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
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
    return paragraphs.length > 0
      ? paragraphs
      : [content.trim()].filter(Boolean);
  }
}
