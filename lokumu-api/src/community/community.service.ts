import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import { normalizeLanguage } from '../shared/i18n/languages';
import { CreateContributionDto } from './dto/create-contribution.dto';

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
  ) {}

  async submit(dto: CreateContributionDto) {
    const contribution = await this.prisma.communityContribution.create({
      data: {
        ...dto,
        language: normalizeLanguage(dto.language),
        status: 'pending',
      },
    });

    if (process.env.COMMUNITY_AUTO_APPROVE === 'true') {
      return this.approve(contribution.id);
    }

    return contribution;
  }

  async approve(id: string) {
    const contribution =
      await this.prisma.communityContribution.findUniqueOrThrow({
        where: { id },
      });

    const ingested = await this.ragService.ingestDocument({
      source: `community://${id}`,
      title: `Correction: ${contribution.originalQuery.slice(0, 80)}`,
      language: normalizeLanguage(contribution.language),
      content: `Q: ${contribution.originalQuery}\nR: ${contribution.correctedAnswer}\nNote: ${contribution.contributorNote ?? ''}`,
      metadata: {
        type: 'community_correction',
        source: `community://${id}`,
      },
    });

    return this.prisma.communityContribution.update({
      where: { id },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
        ingestedAt: new Date(),
        chunkId: ingested.chunks?.[0]?.id ?? null,
      },
    });
  }

  async getStats() {
    const [totalContributions, approved, pending] = await Promise.all([
      this.prisma.communityContribution.count(),
      this.prisma.communityContribution.count({
        where: { status: 'approved' },
      }),
      this.prisma.communityContribution.count({ where: { status: 'pending' } }),
    ]);
    return { totalContributions, approved, pending };
  }
}
