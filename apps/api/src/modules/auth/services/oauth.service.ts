import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../../../database/database.service';

export type OAuthProvider = 'google' | 'microsoft';

export interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface OAuthAccountInfo {
  id: string;
  provider: string;
  email: string | null;
  displayName: string | null;
  linkedAt: Date;
}

@Injectable()
export class OAuthService {
  constructor(
    private prisma: DatabaseService,
    private configService: ConfigService,
  ) {}

  /**
   * Link an OAuth account to an existing user
   */
  async linkOAuthAccount(
    userId: string,
    profile: OAuthProfile,
  ): Promise<OAuthAccountInfo> {
    // Check if this OAuth account is already linked to another user
    const existingAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
    });

    if (existingAccount) {
      if (existingAccount.userId === userId) {
        throw new ConflictException('This account is already linked to your profile');
      } else {
        throw new ConflictException(
          'This account is already linked to a different user',
        );
      }
    }

    // Check if user already has an account with this provider
    const existingProviderAccount = await this.prisma.oAuthAccount.findFirst({
      where: {
        userId,
        provider: profile.provider,
      },
    });

    if (existingProviderAccount) {
      throw new ConflictException(
        `You already have a ${profile.provider} account linked`,
      );
    }

    // Create the OAuth account link
    const oauthAccount = await this.prisma.oAuthAccount.create({
      data: {
        userId,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        tokenExpiresAt: profile.tokenExpiresAt,
      },
    });

    return {
      id: oauthAccount.id,
      provider: oauthAccount.provider,
      email: oauthAccount.email,
      displayName: oauthAccount.displayName,
      linkedAt: oauthAccount.createdAt,
    };
  }

  /**
   * Unlink an OAuth account from a user
   */
  async unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<void> {
    const account = await this.prisma.oAuthAccount.findFirst({
      where: { userId, provider },
    });

    if (!account) {
      throw new NotFoundException(`No ${provider} account linked to this user`);
    }

    // Check if user has a password - don't allow unlinking if it's the only auth method
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
      include: {
        oauthAccounts: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hasPassword = !!user.passwordHash;
    const hasOtherOAuth = user.oauthAccounts.some(
      (a) => a.provider !== provider,
    );

    if (!hasPassword && !hasOtherOAuth) {
      throw new BadRequestException(
        'Cannot unlink the only authentication method. Please set a password first.',
      );
    }

    await this.prisma.oAuthAccount.delete({
      where: { id: account.id },
    });
  }

  /**
   * Find user by OAuth profile
   */
  async findUserByOAuth(
    provider: OAuthProvider,
    providerUserId: string,
  ): Promise<any | null> {
    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId,
        },
      },
      include: { user: true },
    });

    return oauthAccount?.user || null;
  }

  /**
   * Get all linked OAuth accounts for a user
   */
  async getLinkedAccounts(userId: string): Promise<OAuthAccountInfo[]> {
    const accounts = await this.prisma.oAuthAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      email: account.email,
      displayName: account.displayName,
      linkedAt: account.createdAt,
    }));
  }

  /**
   * Update OAuth tokens
   */
  async updateTokens(
    userId: string,
    provider: OAuthProvider,
    accessToken: string,
    refreshToken?: string,
    tokenExpiresAt?: Date,
  ): Promise<void> {
    await this.prisma.oAuthAccount.updateMany({
      where: { userId, provider },
      data: {
        accessToken,
        refreshToken: refreshToken || undefined,
        tokenExpiresAt: tokenExpiresAt || undefined,
      },
    });
  }

  /**
   * Get OAuth configuration for a provider
   */
  getOAuthConfig(provider: OAuthProvider): {
    clientId: string | undefined;
    clientSecret: string | undefined;
    callbackUrl: string;
    isConfigured: boolean;
  } {
    const baseUrl = this.configService.get<string>('API_URL') || 'http://localhost:3001';

    switch (provider) {
      case 'google':
        return {
          clientId: this.configService.get<string>('GOOGLE_CLIENT_ID'),
          clientSecret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
          callbackUrl: `${baseUrl}/auth/google/callback`,
          isConfigured:
            !!this.configService.get<string>('GOOGLE_CLIENT_ID') &&
            !!this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
        };
      case 'microsoft':
        return {
          clientId: this.configService.get<string>('MICROSOFT_CLIENT_ID'),
          clientSecret: this.configService.get<string>('MICROSOFT_CLIENT_SECRET'),
          callbackUrl: `${baseUrl}/auth/microsoft/callback`,
          isConfigured:
            !!this.configService.get<string>('MICROSOFT_CLIENT_ID') &&
            !!this.configService.get<string>('MICROSOFT_CLIENT_SECRET'),
        };
      default:
        throw new BadRequestException(`Unknown OAuth provider: ${provider}`);
    }
  }

  /**
   * Check which OAuth providers are available
   */
  getAvailableProviders(): OAuthProvider[] {
    const providers: OAuthProvider[] = [];

    if (this.getOAuthConfig('google').isConfigured) {
      providers.push('google');
    }

    if (this.getOAuthConfig('microsoft').isConfigured) {
      providers.push('microsoft');
    }

    return providers;
  }

  /**
   * Create or update user from OAuth profile (for SSO login)
   */
  async findOrCreateFromOAuth(profile: OAuthProfile): Promise<{
    user: any;
    isNewUser: boolean;
  }> {
    // First, try to find existing OAuth account
    const existingOAuth = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { user: true },
    });

    if (existingOAuth) {
      // Update tokens
      await this.prisma.oAuthAccount.update({
        where: { id: existingOAuth.id },
        data: {
          accessToken: profile.accessToken,
          refreshToken: profile.refreshToken,
          tokenExpiresAt: profile.tokenExpiresAt,
        },
      });

      return { user: existingOAuth.user, isNewUser: false };
    }

    // Try to find user by email
    if (profile.email) {
      const existingUser = await this.prisma.adminUser.findUnique({
        where: { email: profile.email.toLowerCase() },
      });

      if (existingUser) {
        // Link the OAuth account to existing user
        await this.linkOAuthAccount(existingUser.id, profile);
        return { user: existingUser, isNewUser: false };
      }
    }

    // Create new user with OAuth
    if (!profile.email) {
      throw new BadRequestException(
        'Email is required to create a new account',
      );
    }

    const newUser = await this.prisma.adminUser.create({
      data: {
        email: profile.email.toLowerCase(),
        name: profile.displayName || profile.email.split('@')[0],
        passwordHash: '', // No password for OAuth-only users
        role: 'ADMIN',
        isActive: true,
      },
    });

    // Link OAuth account
    await this.linkOAuthAccount(newUser.id, profile);

    return { user: newUser, isNewUser: true };
  }
}
