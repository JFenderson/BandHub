import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { SessionService, SessionInfo } from '../services/session.service';
import { SecurityService } from '../services/security.service';

@ApiTags('Sessions')
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly securityService: SecurityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all active sessions for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of active sessions',
  })
  async listSessions(@Request() req): Promise<{
    sessions: SessionInfo[];
    currentSessionId?: string;
  }> {
    const currentSessionId = req.user.sessionId;
    const sessions = await this.sessionService.getUserSessions(
      req.user.id,
      currentSessionId,
    );

    return {
      sessions,
      currentSessionId,
    };
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID to revoke' })
  @ApiResponse({
    status: 200,
    description: 'Session revoked successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async revokeSession(
    @Request() req,
    @Param('sessionId') sessionId: string,
  ): Promise<{ message: string }> {
    await this.sessionService.revokeSession(sessionId, req.user.id, 'manual');

    await this.securityService.logSessionRevoked(
      req.user.id,
      sessionId,
      'manual',
      req.ip,
    );

    return { message: 'Session revoked successfully' };
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions except current' })
  @ApiResponse({
    status: 200,
    description: 'All other sessions revoked',
  })
  async revokeAllOtherSessions(@Request() req): Promise<{
    message: string;
    revokedCount: number;
  }> {
    const currentSessionId = req.user.sessionId;
    const count = await this.sessionService.revokeAllOtherSessions(
      req.user.id,
      currentSessionId,
    );

    await this.securityService.logEvent({
      eventType: 'SESSION_REVOKED',
      userId: req.user.id,
      description: `Revoked ${count} other sessions`,
      metadata: { revokedCount: count },
      ipAddress: req.ip,
    });

    return {
      message: `${count} session(s) revoked`,
      revokedCount: count,
    };
  }
}
