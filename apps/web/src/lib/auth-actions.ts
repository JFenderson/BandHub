'use server';

import { cookies } from 'next/headers';

/**
 * Server actions for managing authentication cookies
 * These run on the server and can safely set httpOnly cookies
 */

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

interface SetTokensParams {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

/**
 * Set authentication tokens in httpOnly cookies
 */
export async function setAuthTokens({ accessToken, refreshToken, expiresIn = MAX_AGE }: SetTokensParams) {
  const cookieStore = await cookies();
  
  // Set access token
  cookieStore.set(ACCESS_TOKEN_KEY, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: expiresIn,
    path: '/',
  });

  // Set refresh token with longer expiry
  cookieStore.set(REFRESH_TOKEN_KEY, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });
}

/**
 * Get access token from cookies
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_KEY);
  return token?.value || null;
}

/**
 * Get refresh token from cookies
 */
export async function getRefreshToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(REFRESH_TOKEN_KEY);
  return token?.value || null;
}

/**
 * Clear all authentication tokens
 */
export async function clearAuthTokens() {
  const cookieStore = await cookies();
  
  cookieStore.delete(ACCESS_TOKEN_KEY);
  cookieStore.delete(REFRESH_TOKEN_KEY);
}

/**
 * Check if user is authenticated (has valid tokens)
 */
export async function isAuthenticated(): Promise<boolean> {
  const accessToken = await getAccessToken();
  return !!accessToken;
}
