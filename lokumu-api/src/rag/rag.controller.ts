import { Controller, Post, Body, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { RagService } from './rag.service';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.CREATED)
  async ingest(@Body() body: { source: string; title?: string; language: string; content: string }) {
    return this.ragService.ingestDocument(body);
  }

  @Get('search')
  async search(
    @Query('query') query: string,
    @Query('language') language?: string,
    @Query('limit') limitStr?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 5;
    if (!query) {
      throw new Error('Query parameter is required');
    }
    return this.ragService.search({ query, language, limit });
  }
}