import { RagService } from './rag.service';

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));

const { pipeline } = jest.requireMock('@xenova/transformers') as {
  pipeline: jest.Mock;
};

describe('RagService', () => {
  const prismaMock = {
    document: { create: jest.fn() },
    chunk: { create: jest.fn() },
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
    expect(pipeline).toHaveBeenCalledWith('feature-extraction', 'Xenova/bge-m3', {
      quantized: false,
    });
  });

  it('returns chunks ordered by similarity score', async () => {
    await service.onModuleInit();
    prismaMock.$queryRawUnsafe.mockResolvedValue([
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
});
