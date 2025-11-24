import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to protect admin routes
 * Checks for authentication tokens and redirects to login if not authenticated
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is an admin route (except login page)
  const isAdminRoute = pathname.startsWith('/admin');
  const isLoginPage = pathname === '/admin/login';

  // Allow access to login page without authentication
  if (isLoginPage) {
    // If already authenticated, redirect to admin dashboard
    const accessToken = request.cookies.get('access_token');
    if (accessToken) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }

  // Protect all other admin routes
  if (isAdminRoute) {
    const accessToken = request.cookies.get('access_token');
    
    // Redirect to login if no access token
    if (!accessToken) {
      const loginUrl = new URL('/admin/login', request.url);
      // Add return URL to redirect back after login
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

/**
 * Configure which routes this middleware should run on
 */
export const config = {
  matcher: [
    '/admin/:path*',
  ],
};
