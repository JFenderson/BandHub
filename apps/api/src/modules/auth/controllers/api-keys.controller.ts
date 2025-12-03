import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ApiKeyService } from '../services/api-key.service';

class CreateApiKeyDto {
  name: string;
  description?: string;
  expiresInDays?: number; // Optional: set expiration in days
}

class RotateApiKeyDto {
  gracePeriodDays?: number; // Optional: grace period before old key stops working
}

class ExtendExpirationDto {
  additionalDays: number;
}

@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new API key (SUPER_ADMIN only)' })
  @ApiResponse({ status: 201, description: 'API key created successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createApiKey(@Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.createApiKey({
      name: dto.name,
      description: dto.description,
      expiresInDays: dto.expiresInDays,
    });
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR)
  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  async listApiKeys() {
    return this.apiKeyService.listApiKeys();
  }

  @Get('expiring')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Get API keys expiring soon' })
  @ApiQuery({ name: 'days', required: false, description: 'Days threshold (default: 7)' })
  @ApiResponse({ status: 200, description: 'Expiring API keys retrieved' })
  async getExpiringKeys(@Query('days') days?: string) {
    const daysThreshold = days ? parseInt(days, 10) : 7;
    return this.apiKeyService.getExpiringKeys(daysThreshold);
  }

  @Get(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Get API key details by ID' })
  @ApiResponse({ status: 200, description: 'API key details retrieved' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getApiKey(@Param('id') id: string) {
    return this.apiKeyService.getApiKeyById(id);
  }

  @Get(':id/usage')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Get API key usage statistics' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async getApiKeyUsage(@Param('id') id: string) {
    return this.apiKeyService.getUsageStats(id);
  }

  @Post(':id/rotate')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rotate an API key (generate new key value)' })
  @ApiResponse({ status: 200, description: 'API key rotated successfully. Returns new key value.' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async rotateApiKey(
    @Param('id') id: string,
    @Body() dto: RotateApiKeyDto,
  ) {
    return this.apiKeyService.rotateApiKey(id, dto.gracePeriodDays);
  }

  @Patch(':id/extend')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Extend API key expiration date' })
  @ApiResponse({ status: 200, description: 'Expiration extended successfully' })
  @ApiResponse({ status: 400, description: 'Invalid additional days value' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async extendExpiration(
    @Param('id') id: string,
    @Body() dto: ExtendExpirationDto,
  ) {
    return this.apiKeyService.extendExpiration(id, dto.additionalDays);
  }

  @Delete(':id/revoke')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'API key revoked successfully' })
  async revokeApiKey(@Param('id') id: string) {
    return this.apiKeyService.revokeApiKey(id);
  }

  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an API key permanently (SUPER_ADMIN only)' })
  @ApiResponse({ status: 204, description: 'API key deleted successfully' })
  async deleteApiKey(@Param('id') id: string) {
    await this.apiKeyService.deleteApiKey(id);
  }
}