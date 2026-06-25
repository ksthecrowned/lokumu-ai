import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateTrainingDialogueDto } from './dto/create-training-dialogue.dto';
import { TrainingService } from './training.service';

@Controller('training/dialogues')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post()
  submit(@Body() dto: CreateTrainingDialogueDto) {
    return this.trainingService.submit(dto);
  }

  @Get()
  list(@Query('status') status?: string) {
    return this.trainingService.list(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string) {
    return this.trainingService.approve(id);
  }
}
