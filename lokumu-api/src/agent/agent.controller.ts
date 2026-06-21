import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';

@Controller('agent')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Post('ask')
  async ask(@Body() body: { prompt: string; language?: string }) {
    return this.agentService.processRequest(body.prompt, body.language);
  }
}