import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
    @Body() body: { prompt: string; temperature?: number; model?: string },
  ) {
    const { prompt, temperature, model } = body;
    return this.modelService.generate(prompt, { temperature, model });
  }

  @Get('status')
  async status() {
    return { service: 'model', ready: true };
  }
}
