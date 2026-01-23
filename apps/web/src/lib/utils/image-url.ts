/**
 * Utility functions for handling image URLs
 * Static uploads are served at the root server URL, not under /api/v1
 */

/**
 * Get the base URL for static uploads (without /api/v1 suffix)
 */
export function getUploadsBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  // Remove /api/v1 suffix to get the base server URL for static files
  return apiUrl.replace(/\/api\/v\d+$/, '');
}

/**
 * Convert a relative upload path to a full URL
 * @param url - The URL, either absolute (http...) or relative (/uploads/...)
 * @returns Full URL for the image, or null if input is null/undefined
 */
export function getFullImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  // Local static assets from public directory (e.g., /band-logos/) are served directly by Next.js
  if (url.startsWith('/band-logos/')) return url;
  return `${getUploadsBaseUrl()}${url}`;
}
