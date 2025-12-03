import { cookies } from 'next/headers';
import { getAccessToken } from './auth-actions';

/**
 * Authentication Utilities
 * 
 * Production-ready authentication implementation using JWT tokens.
 * Uses httpOnly cookies for secure token storage.
 */

export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

/**
 * JWT Payload structure from the API
 */
interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  role: AdminRole;
  exp: number;
  iat: number;
}

/**
 * Parse a JWT token and extract the payload
 * Note: This does not verify the token signature - that's done on the server
 */
function parseJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Get the current authenticated user from the session
 * Returns null if not authenticated
 * 
 * This function reads the access token from httpOnly cookies
 * and extracts user information from the JWT payload.
 * 
 * Note: For production use, consider validating the token with the API
 * on sensitive operations.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return null;
    }
    
    const payload = parseJwt(accessToken);
    
    if (!payload) {
      return null;
    }
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }
    
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      role: payload.role,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Check if the current user has admin access
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  
  if (!user) {
    return false;
  }
  
  // Check if user has admin role
  return ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'].includes(user.role);
}

/**
 * Require admin authentication for a route
 * Throws an error if user is not authenticated or not an admin
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  if (!['SUPER_ADMIN', 'ADMIN', 'MODERATOR'].includes(user.role)) {
    throw new Error('Insufficient permissions');
  }
  
  return user;
}

/**
 * Check if a user has a specific role
 */
export function hasRole(user: AuthUser | null, roles: AdminRole[]): boolean {
  if (!user) {
    return false;
  }
  return roles.includes(user.role);
}

/**
 * Check if a user is a super admin
 */
export function isSuperAdmin(user: AuthUser | null): boolean {
  return hasRole(user, ['SUPER_ADMIN']);
}

