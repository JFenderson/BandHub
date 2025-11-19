import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  @Get()
  findAll() {
    return { message: 'Categories endpoint - coming soon' };
  }
}