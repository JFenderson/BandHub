import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@bandhub/database';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  sessionVersion?: number;
  userType?: 'user' | 'admin'; // ← Add userType
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Determine which table to query based on userType
    const userType = payload.userType || 'admin'; // Default to admin for backward compatibility
    
    let user: any;

    if (userType === 'admin') {
      // Query AdminUser table
      user = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          sessionVersion: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid or inactive user');
      }

      // Validate session version for admin users
      if (typeof payload.sessionVersion === 'number') {
        if ((user.sessionVersion ?? 0) !== payload.sessionVersion) {
          throw new UnauthorizedException('Session invalidated');
        }
      }
    } else {
      // Query User table
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Optional: Check email verification for regular users
      // if (!user.emailVerified) {
      //   throw new UnauthorizedException('Email not verified');
      // }
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      userType, // Include userType in request.user
    };
  }
}