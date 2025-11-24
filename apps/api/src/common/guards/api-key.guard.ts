import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@hbcu-band-hub/prisma';
import { Request } from 'express';

/**
 * ApiKeyGuard validates API keys from the X-API-Key header.
 * Used for machine-to-machine authentication (e.g., worker services).
 * 
 * API keys are checked against the database for:
 * - Existence
 * - Active status
 * - Expiration date
 * 
 * Last used timestamp is updated on successful validation.
 * 
 * @example
 * @UseGuards(ApiKeyGuard)
 * @Post('sync/trigger')
 * async triggerSync() { ... }
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('API key is required. Provide it via X-API-Key header.');
    }

    const keyRecord = await this.validateApiKey(apiKey);

    if (!keyRecord) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    // Attach key info to request for logging/audit purposes
    request['apiKey'] = {
      id: keyRecord.id,
      name: keyRecord.name,
    };

    return true;
  }

  /**
   * Extract API key from X-API-Key header
   */
  private extractApiKey(request: Request): string | undefined {
    const apiKey = request.headers['x-api-key'];
    
    if (Array.isArray(apiKey)) {
      return apiKey[0];
    }
    
    return apiKey;
  }

  /**
   * Validate API key against database
   */
  private async validateApiKey(key: string) {
    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { key },
      select: {
        id: true,
        name: true,
        isActive: true,
        expiresAt: true,
      },
    });

    // Check if key exists and is active
    if (!apiKeyRecord || !apiKeyRecord.isActive) {
      return null;
    }

    // Check if key has expired
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp (fire and forget - don't await)
    this.updateLastUsed(apiKeyRecord.id).catch((error) => {
      // Log error but don't fail the request
      console.error('Failed to update API key last used timestamp:', error);
    });

    return apiKeyRecord;
  }

  /**
   * Update last used timestamp for the API key
   */
  private async updateLastUsed(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }
}