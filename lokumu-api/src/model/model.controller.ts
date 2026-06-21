import { Controller, Post, Body, Get, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ModelService } from './model.service';

@Controller('model')
export class ModelController {
  constructor(private readonly modelService: ModelService) {}

  @Post('load')
  @HttpCode(HttpStatus.OK)
  async load(@Body() body: { model: string }) {
    const { model } = body;
    const exists = await this.modelService.loadModel(model);
    return { model, exists };
  }

  @Post('generate')
  async generate(
    @Body() body: { prompt: string; n_predict?: number; temperature?: number; top_p?: number; repeat_penalty?: number; model?: string }
  ) {
    const { prompt, n_predict, temperature, top_p, repeat_penalty, model } = body;
    return this.modelService.generate(prompt, { n_predict, temperature, top_p, repeat_penalty, model });
  }

  @Get('status')
  async status() {
    return { service: 'model', ready: true };
  }
}