import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainingDialogueDto } from './dto/create-training-dialogue.dto';

@Injectable()
export class TrainingService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: CreateTrainingDialogueDto) {
    if (!dto.turns || dto.turns.length < 2) {
      throw new Error('minimum_2_turns');
    }
    const hasUser = dto.turns.some((turn) => turn.role === 'user');
    const hasAssistant = dto.turns.some((turn) => turn.role === 'assistant');
    if (!hasUser || !hasAssistant) {
      throw new Error('requires_user_and_assistant');
    }

    const dialogue = await this.prisma.trainingDialogue.create({
      data: {
        title: dto.title,
        language: dto.language,
        turns: dto.turns,
        tags: dto.tags ?? [],
        contributorNote: dto.contributorNote,
        status: 'pending',
      },
    });

    if (process.env.TRAINING_AUTO_APPROVE === 'true') {
      return this.approve(dialogue.id);
    }

    return dialogue;
  }

  async approve(id: string) {
    return this.prisma.trainingDialogue.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
      },
    });
  }

  async list(status?: string) {
    return this.prisma.trainingDialogue.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }
}
