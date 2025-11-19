import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  @Get()
  dashboard() {
    return { message: 'Admin endpoint - coming soon' };
  }
}