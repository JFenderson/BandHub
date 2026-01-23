'use client';

import dynamic from 'next/dynamic';

/**
 * Lazy-loaded admin modals
 * 
 * Note: Add lazy modals here as needed. For modals with complex prop types,
 * import them directly where used with dynamic() to avoid type inference issues.
 * 
 * Example usage in a component:
 * 
 * import dynamic from 'next/dynamic';
 * const LazyModal = dynamic(() => import('./MyModal'), { ssr: false });
 */

// Template for future lazy-loaded modals
// export const LazyExampleModal = dynamic(
//   () => import('@/components/admin/ExampleModal'),
//   {
//     loading: () => <div>Loading...</div>,
//     ssr: false,
//   }
// );

export {};
