import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('search')
@Controller('search')
export class SearchController {
  @Get()
  search() {
    return { message: 'Search endpoint - coming soon' };
  }
}