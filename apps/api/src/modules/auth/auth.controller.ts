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
  Ip,
  Param,
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
import { ApiErrorDto } from '../../common/dto/api-error.dto';

/**
 * AuthController
 * 
 * Handles all authentication-related endpoints:
 * - Registration (User and Admin)
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
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register new user (regular User table)
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
    summary: 'Register a new user',
    description: `Creates a new regular user account.
    
**Requirements:**
- Email must be unique and valid
- Password must be at least 8 characters
- Name is required

**Rate Limit:** 3 attempts per hour per IP address`,
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed', type: ApiErrorDto })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded', type: ApiErrorDto })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
 * Verify email with token
 */
@Get('verify-email/:token')
@ApiOperation({ summary: 'Verify email address' })
@ApiResponse({ status: 200, description: 'Email verified successfully' })
@ApiResponse({ status: 400, description: 'Invalid or expired token' })
async verifyEmail(@Param('token') token: string) {
  return this.authService.verifyEmail(token);
}

  /**
   * Register new admin user (AdminUser table)
   * Rate limit: 3 attempts per hour per IP
   */
  @Post('register-admin')
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

**Response:** Returns the created admin user object (without password)`,
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Admin user registered successfully',
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Validation failed',
    type: ApiErrorDto,
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded',
    type: ApiErrorDto,
  })
  async registerAdmin(@Body() registerDto: RegisterDto) {
    return this.authService.registerAdmin(registerDto);
  }

  /**
   * Login with email and password
   * Works for both User and AdminUser tables
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
    description: `Authenticates a user with email and password credentials. Works for both regular users and admin users.

**Process:**
1. Checks both User and AdminUser tables
2. Validates email and password
3. Checks account status (active/locked)
4. Generates JWT tokens with userType
5. Creates session for tracking

**Rate Limit:** 5 attempts per 15 minutes per IP address`,
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Authentication failed',
    type: ApiErrorDto,
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Rate limit exceeded',
    type: ApiErrorDto,
  })
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ipAddress: string,
  ) {
    loginDto.ipAddress = ipAddress;
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
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout', description: 'Invalidates the user\'s current refresh token.' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorDto })
  async logout(@Req() req: Request) {
    const userId = (req.user as any).sub; // Use 'sub' from JWT payload
    await this.authService.logout(userId);
    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices
   */
  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorDto })
  async logoutAll(@Req() req: Request) {
    const userId = (req.user as any).sub;
    await this.authService.logoutAll(userId);
    
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Get current user profile
   * Works for both User and AdminUser
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get current profile', 
    description: 'Retrieves the profile information of the currently logged-in user (works for both regular users and admins).' 
  })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorDto })
  async getProfile(@Req() req: Request) {
    const userId = (req.user as any).sub;
    const userType = (req.user as any).userType || 'admin';
    
    return this.authService.getUserById(userId, userType);
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
  @ApiOperation({ 
    summary: 'Request password reset', 
    description: 'Sends a password reset link to the registered email address.' 
  })
  @ApiBody({ 
    schema: { 
      type: 'object', 
      properties: { 
        email: { type: 'string', format: 'email' },
        userType: { type: 'string', enum: ['user', 'admin'], default: 'admin' }
      } 
    } 
  })
  @ApiResponse({ status: 200, description: 'Reset email sent if user exists' })
  @ApiResponse({ status: 429, description: 'Too many requests', type: ApiErrorDto })
  async forgotPassword(@Body() dto: { email: string; userType?: 'user' | 'admin' }) {
    await this.authService.sendPasswordReset(dto.email, dto.userType || 'admin');
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
    windowMs: 60 * 60 * 1000,
    type: RateLimitType.IP,
    message: 'Too many password reset attempts. Please try again later.',
  })
  @ApiOperation({ summary: 'Reset password using token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 429, description: 'Too many reset attempts' })
  async resetPassword(@Body() dto: { token: string; password: string }) {
    await this.authService.resetPassword(dto.token, dto.password);
    return { message: 'Password reset successful. Please login with your new password.' };
  }
}