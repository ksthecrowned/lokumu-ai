import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AssistantController {
  constructor(private assistantService: AssistantService) {}

  @Post('ask')
  async ask(@Body() body: { prompt: string; language?: string }) {
    return this.assistantService.processRequest(body.prompt, body.language);
  }
}
