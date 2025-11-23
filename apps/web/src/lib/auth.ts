/**
 * Mock Authentication Utilities
 * 
 * TODO: Replace with real authentication implementation (e.g., NextAuth.js, Auth0, Clerk)
 * This is a temporary mock implementation for development purposes.
 * 
 * SECURITY WARNING: The mock authentication is enabled for development.
 * Set NEXT_PUBLIC_DISABLE_MOCK_AUTH=true in production to prevent security issues.
 */

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR';
  isActive: boolean;
}

/**
 * Mock function to get the current user
 * 
 * TODO: Replace with real session/token validation
 * For now, this returns a mock admin user for development only if mock auth is enabled
 */
export async function getCurrentUser(): Promise<MockUser | null> {
  // Check if mock authentication is disabled (should be disabled in production)
  const disableMockAuth = process.env.NEXT_PUBLIC_DISABLE_MOCK_AUTH === 'true';
  
  if (disableMockAuth) {
    // In production, this should:
    // 1. Check session/cookies for authentication token
    // 2. Validate the token
    // 3. Fetch user from database
    // 4. Return user or null if not authenticated
    return null;
  }
  
  // MOCK: Return a mock admin user for development only
  // This should be replaced with real authentication in production
  return {
    id: 'mock-admin-id',
    email: 'admin@bandhub.com',
    name: 'Mock Admin',
    role: 'ADMIN',
    isActive: true,
  };
}

/**
 * Check if the current user has admin access
 * 
 * TODO: Update when real authentication is implemented
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  
  if (!user || !user.isActive) {
    return false;
  }
  
  // Check if user has admin role
  return ['SUPER_ADMIN', 'ADMIN', 'MODERATOR'].includes(user.role);
}

/**
 * Require admin authentication for a route
 * Throws an error if user is not authenticated or not an admin
 * 
 * TODO: Update redirect logic when real authentication is implemented
 */
export async function requireAdmin(): Promise<MockUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    // TODO: Redirect to login page
    throw new Error('Authentication required');
  }
  
  if (!user.isActive) {
    throw new Error('User account is inactive');
  }
  
  if (!['SUPER_ADMIN', 'ADMIN', 'MODERATOR'].includes(user.role)) {
    throw new Error('Insufficient permissions');
  }
  
  return user;
}
