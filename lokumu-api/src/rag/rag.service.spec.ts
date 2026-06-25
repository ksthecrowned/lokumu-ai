import { RagService } from './rag.service';

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));

const { pipeline } = jest.requireMock('@xenova/transformers');

describe('RagService', () => {
  const prismaMock = {
    document: { create: jest.fn() },
    chunk: { create: jest.fn(), findMany: jest.fn() },
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };

  let service: RagService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMBEDDING_FALLBACK_MOCK = 'false';
    pipeline.mockResolvedValue(
      jest.fn().mockResolvedValue({ data: new Float32Array(1024).fill(0.25) }),
    );
    service = new RagService(prismaMock as any);
  });

  it('loads embedding model on init', async () => {
    await service.onModuleInit();
    expect(pipeline).toHaveBeenCalledWith(
      'feature-extraction',
      'Xenova/bge-m3',
      {
        quantized: false,
      },
    );
  });

  it('falls back to keyword search when pgvector column is missing', async () => {
    process.env.EMBEDDING_FALLBACK_MOCK = 'true';
    service = new RagService(prismaMock as any);
    await service.onModuleInit();

    prismaMock.$queryRawUnsafe.mockResolvedValue([{ exists: false }]);
    prismaMock.chunk.findMany.mockResolvedValue([
      {
        id: '1',
        content: 'Molili mpiko, osopá eloko',
        metadata: { title: 'Proverbe lingala', source: 'seed://lin-1' },
        language: 'lin',
      },
    ]);

    const results = await service.search({
      query: 'proverbe lingala',
      language: 'lin',
      limit: 3,
    });

    expect(prismaMock.chunk.findMany).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].score).toBeGreaterThan(0.35);
  });

  it('returns chunks ordered by similarity score', async () => {
    process.env.EMBEDDING_FALLBACK_MOCK = 'false';
    service = new RagService(prismaMock as any);
    await service.onModuleInit();

    prismaMock.$queryRawUnsafe
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([
      {
        id: '1',
        content: 'Mbote na yo',
        metadata: { source: 'community://abc' },
        language: 'lin',
        score: 0.89,
      },
      {
        id: '2',
        content: 'Sango nini',
        metadata: { source: 'seed://lin-1' },
        language: 'lin',
        score: 0.42,
      },
    ]);

    const results = await service.search({
      query: 'mbote salutation',
      language: 'lin',
      limit: 3,
    });

    expect(prismaMock.$queryRawUnsafe).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: '1',
      community: true,
    });
    expect(results[0].score).toBeGreaterThan(0.5);
  });

  it('reranks greeting intent to prefer greeting metadata', () => {
    const reranked = service.rerankByMetadata(
      [
        {
          id: '1',
          content: 'Lexicon entry',
          metadata: { type: 'lexicon' },
          language: 'lin',
          score: 0.85,
          community: false,
        },
        {
          id: '2',
          content: 'Greeting phrase',
          metadata: { type: 'greeting' },
          language: 'lin',
          score: 0.74,
          community: false,
        },
      ],
      'greeting',
    );

    expect(reranked.map((item) => item.id)).toEqual(['2', '1']);
  });
});
