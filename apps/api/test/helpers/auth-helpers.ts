/**
 * Authentication Test Helpers
 * 
 * Provides utilities for mocking authentication in tests
 */

import { AdminRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

/**
 * Generate a test JWT token for a given role
 * @param role - Admin role for the token
 * @param userId - Optional user ID (defaults to 'test-user-id')
 * @param email - Optional email (defaults to role-based email)
 * @returns JWT token string
 */
export function generateJwtToken(
  role: AdminRole = AdminRole.MODERATOR,
  userId: string = 'test-user-id',
  email?: string
): string {
  const jwtService = new JwtService({
    secret: 'test-secret-key-for-testing',
  });

  const payload = {
    sub: userId,
    email: email ?? `${role.toLowerCase()}@test.com`,
    role: role,
    sessionVersion: 1,
  };

  return jwtService.sign(payload);
}

/**
 * Mock the JwtAuthGuard to allow all requests
 * Useful for integration tests that don't need full auth
 */
export function mockAuthGuard() {
  return {
    canActivate: jest.fn().mockReturnValue(true),
  };
}

/**
 * Mock the RolesGuard to allow all requests
 * Useful for integration tests that don't need role checking
 */
export function mockRolesGuard() {
  return {
    canActivate: jest.fn().mockReturnValue(true),
  };
}

/**
 * Mock the RolesGuard to check for specific roles
 * @param allowedRoles - Array of roles that should be allowed
 */
export function mockRolesGuardWithCheck(allowedRoles: AdminRole[]) {
  return {
    canActivate: jest.fn((context) => {
      const request = context.switchToHttp().getRequest();
      const userRole = request.user?.role;
      return allowedRoles.includes(userRole);
    }),
  };
}

/**
 * Create an authenticated request object for testing
 * @param role - Admin role for the request user
 * @param userId - Optional user ID
 * @param additionalData - Additional user data to include
 */
export function createAuthenticatedRequest(
  role: AdminRole = AdminRole.MODERATOR,
  userId: string = 'test-user-id',
  additionalData: Record<string, any> = {}
) {
  return {
    user: {
      sub: userId,
      id: userId,
      email: `${role.toLowerCase()}@test.com`,
      role: role,
      sessionVersion: 1,
      ...additionalData,
    },
    headers: {
      authorization: `Bearer ${generateJwtToken(role, userId)}`,
    },
  };
}

/**
 * Create a request with user context for ExecutionContext
 * Used in guard tests
 */
export function createMockExecutionContext(role: AdminRole = AdminRole.MODERATOR) {
  const request = createAuthenticatedRequest(role);

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

/**
 * Create mock user payload from JWT token
 */
export function createMockJwtPayload(
  role: AdminRole = AdminRole.MODERATOR,
  userId: string = 'test-user-id'
) {
  return {
    sub: userId,
    email: `${role.toLowerCase()}@test.com`,
    role: role,
    sessionVersion: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  };
}

/**
 * Helper to extract role hierarchy for testing
 * SUPER_ADMIN > ADMIN > MODERATOR
 */
export function getRoleHierarchy(): AdminRole[] {
  return [AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MODERATOR];
}

/**
 * Check if a role has permission over another role
 * @param userRole - Role of the user performing the action
 * @param targetRole - Role required for the action
 */
export function hasRolePermission(userRole: AdminRole, targetRole: AdminRole): boolean {
  const hierarchy = getRoleHierarchy();
  return hierarchy.indexOf(userRole) <= hierarchy.indexOf(targetRole);
}

/**
 * Create mock admin user for testing
 */
export function createMockAdminUser(overrides: Partial<any> = {}) {
  return {
    id: overrides.id ?? 'test-user-id',
    email: overrides.email ?? 'test@example.com',
    name: overrides.name ?? 'Test User',
    role: overrides.role ?? AdminRole.MODERATOR,
    isActive: overrides.isActive ?? true,
    sessionVersion: overrides.sessionVersion ?? 1,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    ...overrides,
  };
}

/**
 * Create mock refresh token for testing
 */
export function createMockRefreshToken(userId: string = 'test-user-id') {
  return {
    id: 'refresh-token-id',
    token: 'hashed-refresh-token',
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    isRevoked: false,
    createdAt: new Date(),
  };
}

/**
 * Create mock session for testing
 */
export function createMockSession(userId: string = 'test-user-id') {
  return {
    id: 'session-id',
    userId,
    token: 'hashed-session-token',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    isRevoked: false,
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };
}
