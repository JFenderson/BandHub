# Performance Optimization Quick Reference

## 🎯 Quick Stats
- ✅ Image optimization with Next.js Image component
- ✅ Code splitting and lazy loading implemented
- ✅ Bundle size optimizations configured
- ✅ Prefetching strategy for common routes
- 🎯 **Target:** 30% bundle size reduction

## 📦 Installation

Install the new dev dependency:
```bash
cd apps/web
npm install
```

## 🚀 Usage

### Run Development
```bash
npm run dev
```

### Build and Analyze Bundle
```bash
# Build with stats generation
npm run build

# View bundle analysis
npm run analyze
```

### Measure Performance
```bash
# Lighthouse audit
npx lighthouse http://localhost:3000 --view

# Check build output
npm run build
# Look for chunk sizes in output
```

## 📸 Image Components

### Import
```tsx
import { BandLogo, VideoThumbnail, UserAvatar } from '@/components/images';
```

### Usage
```tsx
// Band logo (300x300)
<BandLogo src={band.logoUrl} alt={band.name} size={300} />

// Video thumbnail (480x270)
<VideoThumbnail src={video.thumbnailUrl} alt={video.title} />

// User avatar (32x32 default)
<UserAvatar src={user.avatar} alt={user.name} size={32} />
```

## 🔄 Lazy Loading

### Video Player
```tsx
import { LazyYouTubeEmbed } from '@/components/videos/LazyYouTubeEmbed';

<LazyYouTubeEmbed videoId="..." title="..." />
```

### Modals
```tsx
import { LazyCreatePlaylistModal } from '@/components/playlists/LazyModals';
import { LazyFollowersModal } from '@/components/social/LazyModals';
import { LazyBandFormModal } from '@/components/admin/LazyModals';
```

### Admin Components
```tsx
import { 
  LazyJobMonitoringDashboard,
  LazyVideoModerationTable 
} from '@/components/admin/LazyComponents';
```

## 🔗 Prefetching

```tsx
import { PrefetchLinks } from '@/components/ui/PrefetchLinks';

// In your page
<PrefetchLinks links={['/bands', '/videos', '/about']} />
```

## 📊 Bundle Analysis

### View Stats After Build
```bash
npm run build
npm run analyze
```

This opens an interactive visualization showing:
- Chunk sizes
- Module composition
- Optimization opportunities

## ⚙️ Configuration

### Key Settings in next.config.js

```javascript
// SWC Minification
swcMinify: true

// Image Optimization
images: {
  formats: ['image/webp'],
  quality: 85,
  remotePatterns: [...]
}

// Code Splitting
splitChunks: {
  maxSize: 150000, // 150KB
  cacheGroups: { react, charts, dateUtils, vendors }
}

// Font Optimization
optimizeFonts: true

// Output Tracing
experimental: {
  outputFileTracingRoot: ...,
  optimizePackageImports: ['date-fns', 'lodash-es']
}
```

## 🎨 Loading Skeletons

```tsx
import { 
  AdminDashboardSkeleton,
  VideoPlayerSkeleton,
  ModalSkeleton 
} from '@/components/ui/LoadingSkeletons';
```

## 📝 What Changed

### Updated Components
- `BandCard.tsx` → Uses BandLogo
- `VideoCard.tsx` → Uses VideoThumbnail
- `Header.tsx` → Uses UserAvatar
- `app/videos/[id]/page.tsx` → Uses LazyYouTubeEmbed
- `app/page.tsx` → Added PrefetchLinks

### New Files Created
```
apps/web/src/components/
├── images/
│   ├── BandLogo.tsx          # Optimized band logos
│   ├── VideoThumbnail.tsx    # Optimized video thumbnails
│   ├── UserAvatar.tsx        # Optimized user avatars
│   └── index.ts
├── videos/
│   └── LazyYouTubeEmbed.tsx  # Lazy-loaded video player
├── ui/
│   ├── LoadingSkeletons.tsx  # Loading states
│   └── PrefetchLinks.tsx     # Route prefetching
├── playlists/
│   └── LazyModals.tsx        # Lazy playlist modals
├── social/
│   └── LazyModals.tsx        # Lazy social modals
└── admin/
    ├── LazyModals.tsx        # Lazy admin modals
    └── LazyComponents.tsx    # Lazy admin components
```

## 🎯 Performance Targets

| Metric | Target | How to Check |
|--------|--------|--------------|
| Initial Load | < 200KB | `npm run build` output |
| Largest Chunk | < 150KB | Bundle analyzer |
| TTI (Time to Interactive) | < 3s | Lighthouse |
| FCP (First Contentful Paint) | < 1.5s | Lighthouse |
| LCP (Largest Contentful Paint) | < 2.5s | Lighthouse |

## 🔍 Debugging

### Check if Image is Optimized
Look for:
- WebP format in Network tab
- Proper dimensions (not over-sized)
- Lazy loading behavior (below fold)

### Check Code Splitting
1. Run `npm run build`
2. Look for separate chunk files
3. Verify react-vendor, charts, date-utils chunks

### Common Issues

**Images not loading:**
- Check `remotePatterns` in next.config.js
- Verify image URL is accessible
- Check browser console for errors

**Large bundle size:**
- Run bundle analyzer
- Look for duplicate dependencies
- Check for large libraries

**Slow page loads:**
- Use Lighthouse to identify bottlenecks
- Check Network tab for large resources
- Verify lazy loading is working

## 📚 Further Reading

- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [Next.js Code Splitting](https://nextjs.org/docs/advanced-features/dynamic-import)
- [Web Vitals](https://web.dev/vitals/)
- [Bundle Size Optimization](https://nextjs.org/docs/advanced-features/measuring-performance)

## 🤝 Contributing

When adding new features:
1. Use Image components for all images
2. Lazy load modals and heavy components
3. Run bundle analyzer to check impact
4. Update this guide if needed
