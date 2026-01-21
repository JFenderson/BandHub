import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { OAuthService, OAuthProvider } from '../services/oauth.service';
import { AuthService } from '../auth.service';
import { UserAuthGuard } from '../../users/guards/user-auth.guard';
import { CurrentUser, CurrentUserData } from '../../users/decorators/current-user.decorator';

@ApiTags('OAuth')
@Controller({ path: 'auth', version: '1' })
export class OAuthController {
  constructor(
    private readonly oauthService: OAuthService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth' })
  async googleAuth(@Res() res: Response) {
    const config = this.oauthService.getOAuthConfig('google');
    
    if (!config.isConfigured) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${config.clientId}&` +
      `redirect_uri=${encodeURIComponent(config.callbackUrl)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('openid email profile')}&` +
      `access_type=offline&` +
      `prompt=consent`;

    return res.redirect(authUrl);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiQuery({ name: 'code', required: true })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with token' })
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    try {
      const config = this.oauthService.getOAuthConfig('google');
      
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId!,
          client_secret: config.clientSecret!,
          redirect_uri: config.callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokens.access_token) {
        throw new UnauthorizedException('Failed to obtain access token');
      }

      // Get user profile
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const profile = await profileResponse.json();

      // Find or create user
      const { user, isNewUser } = await this.oauthService.findOrCreateFromOAuth({
        provider: 'google',
        providerUserId: profile.id,
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.picture,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
      });

      // Generate JWT token using login flow
      const loginResult = await this.authService.loginWithUser(user, 'user');

      const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
      return res.redirect(`${frontendUrl}/auth/callback?token=${loginResult.accessToken}&newUser=${isNewUser}`);
    } catch (error) {
      const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
      return res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }

  @Get('facebook')
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Facebook OAuth' })
  async facebookAuth(@Res() res: Response) {
    const clientId = this.configService.get<string>('FACEBOOK_CLIENT_ID');
    const baseUrl = this.configService.get<string>('API_URL', 'http://localhost:3001');
    
    if (!clientId) {
      throw new BadRequestException('Facebook OAuth is not configured');
    }

    const redirectUri = `${baseUrl}/auth/facebook/callback`;
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent('email,public_profile')}&` +
      `response_type=code`;

    return res.redirect(authUrl);
  }

  @Get('facebook/callback')
  @ApiOperation({ summary: 'Handle Facebook OAuth callback' })
  @ApiQuery({ name: 'code', required: true })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with token' })
  async facebookCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      throw new BadRequestException('Authorization code is required');
    }

    try {
      const clientId = this.configService.get<string>('FACEBOOK_CLIENT_ID');
      const clientSecret = this.configService.get<string>('FACEBOOK_CLIENT_SECRET');
      const baseUrl = this.configService.get<string>('API_URL', 'http://localhost:3001');
      const redirectUri = `${baseUrl}/auth/facebook/callback`;

      // Exchange code for access token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${clientId}&` +
        `client_secret=${clientSecret}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `code=${code}`
      );

      const tokens = await tokenResponse.json();

      if (!tokens.access_token) {
        throw new UnauthorizedException('Failed to obtain access token');
      }

      // Get user profile
      const profileResponse = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${tokens.access_token}`
      );

      const profile = await profileResponse.json();

      // Note: Facebook OAuth integration is simplified here
      // In production, you'd implement similar to Google OAuth
      throw new BadRequestException('Facebook OAuth not yet fully implemented');
    } catch (error) {
      const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
      return res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
    }
  }

  @Get('apple')
  @ApiOperation({ summary: 'Initiate Apple OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Apple OAuth' })
  async appleAuth(@Res() res: Response) {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    const baseUrl = this.configService.get<string>('API_URL', 'http://localhost:3001');
    
    if (!clientId) {
      throw new BadRequestException('Apple OAuth is not configured');
    }

    const redirectUri = `${baseUrl}/auth/apple/callback`;
    const authUrl = `https://appleid.apple.com/auth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('email name')}&` +
      `response_mode=form_post`;

    return res.redirect(authUrl);
  }

  @Get('apple/callback')
  @ApiOperation({ summary: 'Handle Apple OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with token' })
  async appleCallback(@Res() res: Response) {
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    return res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent('Apple OAuth not yet fully implemented')}`);
  }

  @Post('oauth/link')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link OAuth account to existing user' })
  @ApiResponse({ status: 200, description: 'OAuth account linked successfully' })
  @ApiResponse({ status: 409, description: 'OAuth account already linked' })
  async linkOAuthAccount(
    @CurrentUser() user: CurrentUserData,
    // In production, you'd accept provider and OAuth code in the body
    // This is a simplified implementation
  ) {
    throw new BadRequestException('OAuth linking must be done through provider auth flow');
  }

  @Delete('oauth/:provider')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink OAuth account from user' })
  @ApiParam({ name: 'provider', enum: ['google', 'microsoft', 'facebook', 'apple'] })
  @ApiResponse({ status: 200, description: 'OAuth account unlinked successfully' })
  @ApiResponse({ status: 404, description: 'OAuth account not found' })
  async unlinkOAuthAccount(
    @CurrentUser() user: CurrentUserData,
    @Param('provider') provider: string,
  ) {
    const validProviders: OAuthProvider[] = ['google', 'microsoft'];
    
    if (!validProviders.includes(provider as OAuthProvider)) {
      throw new BadRequestException(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
    }

    await this.oauthService.unlinkOAuthAccount(user.userId, provider as OAuthProvider);

    return {
      message: `${provider} account unlinked successfully`,
    };
  }

  @Get('oauth/accounts')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get linked OAuth accounts' })
  @ApiResponse({ status: 200, description: 'List of linked OAuth accounts' })
  async getLinkedAccounts(@CurrentUser() user: CurrentUserData) {
    const accounts = await this.oauthService.getLinkedAccounts(user.userId);
    return { accounts };
  }
}
