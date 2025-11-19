import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BandsService } from './bands.service';
import {
  CreateBandDto,
  UpdateBandDto,
  BandQueryDto,
  BandResponseDto,
  BandWithVideoCountDto,
} from './dto';

@ApiTags('bands')
@Controller('bands')
export class BandsController {
  constructor(private bandsService: BandsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all bands with optional filtering' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of bands',
  })
  async findAll(@Query() query: BandQueryDto) {
    return this.bandsService.findAll(query);
  }

  @Get(':identifier')
  @ApiOperation({ summary: 'Get a band by ID or slug' })
  @ApiParam({
    name: 'identifier',
    description: 'Band ID (cuid) or slug',
    example: 'sonic-boom-of-the-south',
  })
  @ApiResponse({
    status: 200,
    description: 'Band details',
    type: BandWithVideoCountDto,
  })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async findOne(@Param('identifier') identifier: string) {
    // Check if identifier is a slug (contains hyphens or lowercase letters only)
    const isSlug = /^[a-z0-9-]+$/.test(identifier) && identifier.includes('-');
    
    if (isSlug) {
      return this.bandsService.findBySlug(identifier);
    }
    
    return this.bandsService.findById(identifier);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new band' })
  @ApiResponse({
    status: 201,
    description: 'Band created successfully',
    type: BandResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() dto: CreateBandDto) {
    return this.bandsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a band' })
  @ApiParam({ name: 'id', description: 'Band ID' })
  @ApiResponse({
    status: 200,
    description: 'Band updated successfully',
    type: BandResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateBandDto) {
    return this.bandsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a band' })
  @ApiParam({ name: 'id', description: 'Band ID' })
  @ApiResponse({ status: 204, description: 'Band deleted successfully' })
  @ApiResponse({ status: 404, description: 'Band not found' })
  async delete(@Param('id') id: string) {
    await this.bandsService.delete(id);
  }
}