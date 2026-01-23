'use client';

/**
 * Lazy-loaded YouTube embed component
 * 
 * Note: Due to TypeScript type inference issues with complex props in dynamic imports,
 * use dynamic() directly in the component where you need it:
 * 
 * import dynamic from 'next/dynamic';
 * 
 * const YouTubeEmbed = dynamic(
 *   () => import('@/components/videos/YouTubeEmbed').then((mod) => ({ default: mod.YouTubeEmbed })),
 *   { 
 *     ssr: true,
 *     loading: () => <div>Loading...</div>
 *   }
 * );
 * 
 * Then use: <YouTubeEmbed videoId="xyz" title="Video" />
 */

export {};
