import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    return this.apiKeyService.createApiKey({
      name: dto.name,
      description: dto.description,
      expiresAt,
    });
  }

  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.MODERATOR)
  @ApiOperation({ summary: 'List all API keys' })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  async listApiKeys() {
    return this.apiKeyService.listApiKeys();
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