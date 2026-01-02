import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto, UserLoginResponseDto } from './dto/login-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UserAuthGuard } from './guards/user-auth.guard';
import { CurrentUser, CurrentUserData } from './decorators/current-user.decorator';
import { ApiErrorDto } from '../../common/dto/api-error.dto';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Register a new user account
   */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterUserDto) {
    return this.usersService.register(registerDto);
  }

  /**
   * Login user
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes per IP
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Login successful', type: UserLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginUserDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
  ): Promise<UserLoginResponseDto> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.usersService.login(loginDto, ipAddress, userAgent);
  }

  /**
   * Logout current session
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @CurrentUser() user: CurrentUserData,
    @Headers('x-session-token') sessionToken: string,
  ) {
    await this.usersService.logout(sessionToken, user.userId);
    return { message: 'Logged out successfully' };
  }

  /**
   * Logout from all devices
   */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices' })
  @ApiResponse({ status: 200, description: 'Logged out from all devices' })
  async logoutAll(@CurrentUser() user: CurrentUserData) {
    await this.usersService.logoutAll(user.userId);
    return { message: 'Logged out from all devices' };
  }

  /**
   * Get current user profile
   */
  @Get('me')
  @UseGuards(UserAuthGuard)
  @SkipThrottle()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile' })
  async getCurrentUser(@CurrentUser() user: CurrentUserData) {
    return this.usersService.getCurrentUser(user.userId);
  }

  /**
   * Update user profile
   */
  @Patch('me')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async updateProfile(
    @CurrentUser() user: CurrentUserData,
    @Body() updateDto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(user.userId, updateDto);
  }

  /**
   * Change password
   */
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Current password is incorrect' })
  async changePassword(
    @CurrentUser() user: CurrentUserData,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user.userId, changePasswordDto);
    return { message: 'Password changed successfully. Please log in again.' };
  }

  /**
   * Delete user account
   */
  @Delete('me')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  async deleteAccount(@CurrentUser() user: CurrentUserData) {
    await this.usersService.deleteAccount(user.userId);
    return { message: 'Account deleted successfully' };
  }

  /**
   * Request password reset
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 requests per 15 minutes
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if user exists' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.usersService.forgotPassword(forgotPasswordDto);
    return { message: 'If an account exists with this email, a reset link has been sent.' };
  }

  /**
   * Reset password with token
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 requests per 15 minutes
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.usersService.resetPassword(resetPasswordDto);
    return { message: 'Password reset successful. Please log in with your new password.' };
  }

  /**
   * Verify email with token
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body('token') token: string) {
    await this.usersService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  /**
   * Resend verification email
   */
@Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend verification email', description: 'Resends the email verification link to the currently logged-in user.' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 429, description: 'Too many requests', type: ApiErrorDto })
  async resendVerification(@CurrentUser() user: CurrentUserData) {
    await this.usersService.resendVerification(user.userId);
    return { message: 'Verification email sent' };
  }

  /**
   * Get all user sessions
   */
@Get('sessions')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active sessions', description: 'Retrieves a list of all active sessions for the user.' })
  @ApiResponse({ status: 200, description: 'List of sessions' })
  async getSessions(@CurrentUser() user: CurrentUserData) {
    return this.usersService.getSessions(user.userId);
  }

  /**
   * Delete specific session
   */
  @Delete('sessions/:id')
  @UseGuards(UserAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a specific session' })
  @ApiResponse({ status: 200, description: 'Session deleted' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async deleteSession(
    @CurrentUser() user: CurrentUserData,
    @Param('id') sessionId: string,
  ) {
    await this.usersService.deleteSession(user.userId, sessionId);
    return { message: 'Session deleted' };
  }
}
