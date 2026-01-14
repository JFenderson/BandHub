import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  Req,
  Delete,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { RateLimitType } from '../../common/interfaces/rate-limit.interface';
import { ApiErrorDto } from 'src/common/dto/api-error.dto';

/**
 * AuthController
 * 
 * Handles all authentication-related endpoints:
 * - Login/Logout
 * - Token refresh
 * - Password reset
 * 
 * Rate limiting applied:
 * - Login: 5 attempts per 15 minutes per IP
 * - Register: 3 attempts per hour per IP
 * - Password reset: 3 attempts per hour per IP
 * - Token refresh: 10 attempts per 15 minutes per IP
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register new admin user
   * Rate limit: 3 attempts per hour per IP
   */
@Post('register')
  @RateLimit({
    limit: 3,
    windowMs: 60 * 60 * 1000,
    type: RateLimitType.IP,
    message: 'Too many registration attempts. Please try again later.',
  })
  @ApiOperation({ 
    summary: 'Register a new admin user',
    description: `Creates a new administrator account with the specified email, password, and name.
    
**Requirements:**
- Email must be unique and valid
- Password must be at least 8 characters with uppercase, lowercase, number, and symbol
- Name is required

**Rate Limit:** 3 attempts per hour per IP address

**Response:** Returns the created user object (without password)`,
  })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully. Returns user object without password.',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'clx7yj8k90000uxl9aabbccdd' },
        email: { type: 'string', example: 'admin@bandhub.com' },
        name: { type: 'string', example: 'John Doe' },
        role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'], example: 'MODERATOR' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Validation failed - Invalid email format, weak password, or user already exists',
    type: ApiErrorDto,
    schema: {
      example: {
        statusCode: 400,
        message: ['Email already exists', 'Password must contain uppercase letter'],
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded - Too many registration attempts from this IP',
    type: ApiErrorDto,
    schema: {
      example: {
        statusCode: 429,
        message: 'Too many registration attempts. Please try again later.',
        error: 'Too Many Requests',
      },
    },
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login with email and password
   * Returns access token, refresh token, and user info
   * Rate limit: 5 attempts per 15 minutes per IP
   */
@Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    limit: 5,
    windowMs: 15 * 60 * 1000,
    type: RateLimitType.IP,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  })
  @ApiOperation({ 
    summary: 'Login with email and password',
    description: `Authenticates a user with email and password credentials.

**Process:**
1. Validates email and password
2. Checks account status (active/locked)
3. Verifies credentials
4. Generates JWT access token (15 min expiry) and refresh token (7 day expiry)
5. Creates session for tracking

**Rate Limit:** 5 attempts per 15 minutes per IP address

**Security Features:**
- Account lockout after 5 failed attempts
- Brute force protection via rate limiting
- Session tracking with device fingerprinting
- Automatic logout after password change`,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful - Returns tokens and user info',
    type: LoginResponseDto,
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expiresIn: 900,
        user: {
          id: 'clx7yj8k90000uxl9aabbccdd',
          email: 'admin@bandhub.com',
          name: 'John Doe',
          role: 'ADMIN',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication failed - Invalid credentials or account locked',
    type: ApiErrorDto,
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      },
    },
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded - Too many login attempts',
    type: ApiErrorDto,
    schema: {
      example: {
        statusCode: 429,
        message: 'Too many login attempts. Please try again in 15 minutes.',
        error: 'Too Many Requests',
      },
    },
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Refresh access token using refresh token
   * Rate limit: 10 attempts per 15 minutes per IP
   */
@Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    limit: 10,
    windowMs: 15 * 60 * 1000,
    type: RateLimitType.IP,
    message: 'Too many token refresh requests. Please try again later.',
  })
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: 'Generates a new access token using a valid refresh token.'
  })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token', type: ApiErrorDto })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  /**
   * Logout (invalidate refresh token)
   * No specific rate limit - protected by JWT auth
   */
@Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout', description: 'Invalidates the user\'s current refresh token.' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorDto })
  async logout(@Req() req: Request) {
    const userId = (req.user as any).id;
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices
   * No specific rate limit - protected by JWT auth
   */
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorDto  })
  async logoutAll(@Req() req: Request) {
    const userId = (req.user as any).id;
    await this.authService.logoutAll(userId);
    
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Get current user profile
   * No specific rate limit - protected by JWT auth
   */
@Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get current profile', description: 'Retrieves the profile information of the currently logged-in user.' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorDto })
  async getProfile(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.authService.getUserById(userId);
  }

  /**
   * Request password reset
   * Rate limit: 3 attempts per hour per IP
   */
@Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    limit: 3,
    windowMs: 60 * 60 * 1000,
    type: RateLimitType.IP,
  })
  @ApiOperation({ summary: 'Request password reset', description: 'Sends a password reset link to the registered email address.' })
  @ApiBody({ schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } } } })
  @ApiResponse({ status: 200, description: 'Reset email sent if user exists' })
  @ApiResponse({ status: 429, description: 'Too many requests', type: ApiErrorDto })
  async forgotPassword(@Body() dto: { email: string }) {
    await this.authService.sendAdminPasswordReset(dto.email);
    return { message: 'If the email exists, a reset link has been sent' };
  }

  /**
   * Reset password using token
   * Rate limit: 3 attempts per hour per IP
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    limit: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    type: RateLimitType.IP,
    message: 'Too many password reset attempts. Please try again later.',
  })
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 429, description: 'Too many reset attempts' })
  async resetPassword(@Body() dto: { token: string; password: string }) {
    await this.authService.resetAdminPassword(dto.token, dto.password);
    return { message: 'Password reset successful. Please login with your new password.' };
  }
}