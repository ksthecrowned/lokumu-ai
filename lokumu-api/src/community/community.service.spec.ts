import { CommunityService } from './community.service';

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));

describe('CommunityService', () => {
  const prismaMock = {
    communityContribution: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };
  const ragMock = {
    ingestDocument: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.COMMUNITY_AUTO_APPROVE = 'false';
  });

  it('approves contribution and sets ingestedAt', async () => {
    prismaMock.communityContribution.findUniqueOrThrow.mockResolvedValue({
      id: 'c1',
      language: 'lin',
      originalQuery: 'Mbote?',
      correctedAnswer: 'Mbote na yo!',
      contributorNote: 'common greeting',
    });
    ragMock.ingestDocument.mockResolvedValue({ chunks: [{ id: 'chunk-1' }] });
    prismaMock.communityContribution.update.mockImplementation(
      async ({ where, data }) => ({
        id: where.id,
        ...data,
      }),
    );

    const service = new CommunityService(prismaMock as any, ragMock as any);
    const approved = await service.approve('c1');

    expect(approved.status).toBe('approved');
    expect(approved.ingestedAt).not.toBeNull();
    expect(approved.chunkId).toBe('chunk-1');
  });
});
