/**
 * Get a cookie value by name
 * @param name The name of the cookie to retrieve
 * @returns The cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

/**
 * Set a cookie with the given name, value, and expiration days
 * @param name The name of the cookie
 * @param value The value to store
 * @param days Number of days until expiration
 */
export function setCookie(name: string, value: string, days: number): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

/**
 * Delete a cookie by name
 * @param name The name of the cookie to delete
 */
export function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
}

/**
 * Get authentication tokens from cookies
 * @returns Object containing accessToken and sessionToken
 */
export function getAuthTokens(): { accessToken: string | null; sessionToken: string | null } {
  return {
    accessToken: getCookie('user_access_token'),
    sessionToken: getCookie('user_session_token'),
  };
}
