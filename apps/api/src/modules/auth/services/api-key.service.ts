import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@hbcu-band-hub/prisma';
import { randomBytes } from 'crypto';

/**
 * Service for managing API keys
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a new API key
   * Format: bhub_live_[32 random hex characters]
   */
  private generateApiKey(): string {
    const randomHex = randomBytes(32).toString('hex');
    return `bhub_live_${randomHex}`;
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: {
    name: string;
    description?: string;
    expiresAt?: Date;
  }) {
    const key = this.generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        key,
        name: data.name,
        description: data.description,
        expiresAt: data.expiresAt,
      },
    });

    this.logger.log(`Created API key: ${apiKey.name} (${apiKey.id})`);

    return apiKey;
  }

  /**
   * List all API keys (excluding the actual key value for security)
   */
  async listApiKeys() {
    return this.prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(id: string) {
    const apiKey = await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.warn(`Revoked API key: ${apiKey.name} (${apiKey.id})`);

    return apiKey;
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(id: string) {
    const apiKey = await this.prisma.apiKey.delete({
      where: { id },
    });

    this.logger.warn(`Deleted API key: ${apiKey.name} (${apiKey.id})`);

    return apiKey;
  }
}