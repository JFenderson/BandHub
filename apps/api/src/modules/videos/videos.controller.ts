import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  @Get()
  findAll() {
    return { message: 'Videos endpoint - coming soon' };
  }
}