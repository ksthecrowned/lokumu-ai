import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../rag/rag.service';
import { ModelService } from '../model/model.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RagService,
    private readonly modelService: ModelService,
  ) {}

  @Get()
  async check() {
    const llm = this.modelService.getLlmStatus();
    const llmAvailable = await this.modelService.isAvailable();
    let database = false;
    let chunksCount = 0;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
      chunksCount = await this.prisma.chunk.count();
    } catch {
      database = false;
    }

    const embeddings = this.ragService.isModelLoaded();
    const status =
      llmAvailable && database ? (embeddings ? 'ok' : 'degraded') : 'down';

    return {
      status,
      llm: { ...llm, available: llmAvailable },
      database,
      embeddings,
      chunksCount,
    };
  }
}
