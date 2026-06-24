import { Module } from '@nestjs/common';
import { ModelService } from './model.service';
import { ModelController } from './model.controller';

@Module({
  providers: [ModelService],
  controllers: [ModelController],
  exports: [ModelService],
})
export class ModelModule {}
