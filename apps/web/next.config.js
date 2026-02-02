const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hbcu-band-hub/shared-types'],
  output: 'standalone',

  // Enable SWC minification for better performance
  swcMinify: true,

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Enable compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  // PWA-related headers
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // Configure webpack optimizations
  webpack: (config, { dev, isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@hbcu-band-hub/shared-types': path.resolve(__dirname, '../../libs/shared/types/src'),
    };
    
    // Add bundle analyzer in dev mode
    if (dev && !isServer) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'disabled',
          generateStatsFile: true,
          statsOptions: { source: false },
        })
      );
    }
    
    // Configure code splitting and chunk optimization
    if (!isServer) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Split React and React-DOM into separate chunks
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react-vendor',
              priority: 40,
              reuseExistingChunk: true,
            },
            // Split chart libraries
            charts: {
              test: /[\\/]node_modules[\\/](recharts|chart\.js|react-chartjs-2)[\\/]/,
              name: 'charts',
              priority: 30,
              reuseExistingChunk: true,
            },
            // Split date utilities
            dateUtils: {
              test: /[\\/]node_modules[\\/](date-fns)[\\/]/,
              name: 'date-utils',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Default vendor chunk for other dependencies
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 20,
              reuseExistingChunk: true,
              maxSize: 150000, // 150KB max chunk size
            },
            // Common code used across pages
            common: {
              minChunks: 2,
              priority: 10,
              reuseExistingChunk: true,
              maxSize: 100000, // 100KB max chunk size
            },
          },
          maxSize: 150000, // Global max size: 150KB
        },
      };
    }
    
    return config;
  },
  
  // Image optimization configuration
  images: {
    formats: ['image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: 'yt3.googleusercontent.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    unoptimized: false,
  },
  
  // Font optimization
  optimizeFonts: true,
  
  // Enable output file tracing for smaller serverless bundles
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
    optimizePackageImports: ['date-fns', 'lodash-es'],
  },
  
  // Production source maps configuration
  productionBrowserSourceMaps: false,
};

module.exports = nextConfig;