import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreateContributionDto } from './dto/create-contribution.dto';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post('contributions')
  submit(@Body() dto: CreateContributionDto) {
    return this.communityService.submit(dto);
  }

  @Patch('contributions/:id/approve')
  approve(@Param('id') id: string) {
    return this.communityService.approve(id);
  }

  @Get('stats')
  stats() {
    return this.communityService.getStats();
  }
}
