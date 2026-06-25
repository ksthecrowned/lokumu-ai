import { TrainingService } from './training.service';

describe('TrainingService', () => {
  const prismaMock = {
    trainingDialogue: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TRAINING_AUTO_APPROVE = 'false';
  });

  it('rejects dialogues with fewer than 2 turns', async () => {
    const service = new TrainingService(prismaMock as any);

    await expect(
      service.submit({
        title: 'Bad',
        language: 'kit',
        turns: [{ role: 'user', content: 'Mbote' }],
      }),
    ).rejects.toThrow('minimum_2_turns');
  });

  it('rejects dialogues missing assistant turns', async () => {
    const service = new TrainingService(prismaMock as any);

    await expect(
      service.submit({
        title: 'Bad roles',
        language: 'lin',
        turns: [
          { role: 'user', content: 'Mbote' },
          { role: 'user', content: 'Ndenge nini?' },
        ],
      }),
    ).rejects.toThrow('requires_user_and_assistant');
  });

  it('creates pending dialogue when auto-approve is disabled', async () => {
    const service = new TrainingService(prismaMock as any);
    prismaMock.trainingDialogue.create.mockResolvedValue({
      id: 'd1',
      status: 'pending',
    });

    const result = await service.submit({
      title: 'Greeting',
      language: 'kit',
      turns: [
        { role: 'user', content: 'Mbote' },
        { role: 'assistant', content: 'Mbote na nge' },
      ],
      tags: ['greeting'],
    });

    expect(result).toEqual({ id: 'd1', status: 'pending' });
    expect(prismaMock.trainingDialogue.create).toHaveBeenCalledWith({
      data: {
        title: 'Greeting',
        language: 'kit',
        turns: [
          { role: 'user', content: 'Mbote' },
          { role: 'assistant', content: 'Mbote na nge' },
        ],
        tags: ['greeting'],
        contributorNote: undefined,
        status: 'pending',
      },
    });
  });

  it('auto-approves dialogue when TRAINING_AUTO_APPROVE is true', async () => {
    process.env.TRAINING_AUTO_APPROVE = 'true';
    const service = new TrainingService(prismaMock as any);
    prismaMock.trainingDialogue.create.mockResolvedValue({ id: 'd2' });
    prismaMock.trainingDialogue.update.mockResolvedValue({
      id: 'd2',
      status: 'approved',
    });

    const result = await service.submit({
      title: 'Auto',
      language: 'lin',
      turns: [
        { role: 'user', content: 'Sango nini?' },
        { role: 'assistant', content: 'Malamu' },
      ],
    });

    expect(prismaMock.trainingDialogue.update).toHaveBeenCalled();
    expect(result).toEqual({ id: 'd2', status: 'approved' });
  });

  it('lists dialogues filtered by status', async () => {
    const service = new TrainingService(prismaMock as any);
    prismaMock.trainingDialogue.findMany.mockResolvedValue([]);

    await service.list('approved');

    expect(prismaMock.trainingDialogue.findMany).toHaveBeenCalledWith({
      where: { status: 'approved' },
      orderBy: { createdAt: 'desc' },
    });
  });
});
