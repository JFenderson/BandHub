'use client';

import dynamic from 'next/dynamic';

/**
 * Lazy-loaded admin dashboard components for better code splitting
 * Admin pages are only loaded when accessed, reducing initial bundle size
 * 
 * Note: Add lazy components here as needed. Use ComponentType to avoid
 * type inference issues with complex prop types.
 */

// Example: Lazy load a simple component without complex props
// export const LazySimpleComponent = dynamic(
//   () => import('@/components/admin/SimpleComponent'),
//   {
//     loading: () => <div className="animate-pulse"><div className="h-96 bg-gray-200 rounded-lg"></div></div>,
//     ssr: false,
//   }
// );

// For components with complex prop types, use ComponentType:
// import type { ComponentType } from 'react';
// export const LazyComplexComponent = dynamic<ComponentType<ComplexProps>>(
//   () => import('@/components/admin/ComplexComponent'),
//   { ssr: false }
// );
