# Progressive Web App (PWA) Documentation

HBCU Band Hub supports Progressive Web App functionality, enabling users to install the app on their devices and access content offline.

## Features

- **Installable**: Users can add the app to their home screen on mobile and desktop
- **Offline Support**: Cached content available without internet connection
- **Push Notifications**: Support for web push notifications (requires backend integration)
- **App-like Experience**: Full-screen mode without browser UI when installed

## Architecture

### Files Overview

| File | Purpose |
|------|---------|
| `public/manifest.json` | PWA manifest with app metadata, icons, and shortcuts |
| `public/sw.js` | Service worker with caching strategies |
| `public/icons/` | App icons in various sizes |
| `src/app/offline/page.tsx` | Offline fallback page |
| `src/components/pwa/AddToHomeScreen.tsx` | Install prompt component |
| `src/components/pwa/PWAProvider.tsx` | PWA context and update notifications |
| `src/hooks/useServiceWorker.ts` | Service worker registration hook |

### Caching Strategies

| Content Type | Strategy | Description |
|--------------|----------|-------------|
| Static assets (JS, CSS, fonts) | Cache-first | Serve from cache, update in background |
| Images | Cache-first | Serve from cache, fall back to network |
| API calls | Network-first | Try network, fall back to cached response |
| HTML pages | Network-first | Try network, fall back to offline page |

## Setup

### 1. Generate Icons

The PWA requires icons in multiple sizes. Generate them using the provided script:

```bash
cd apps/web
npm install sharp --save-dev
node scripts/generate-icons.js
```

This generates:
- Icons: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
- Apple touch icon (180x180)
- Favicon (32x32)

### 2. Customize the Base Icon

Edit `public/icons/icon.svg` to customize the app icon, then regenerate.

### 3. Add Screenshots (Optional)

For a better install experience, add screenshots:
- `public/screenshots/home.png` (1280x720) - Desktop view
- `public/screenshots/mobile.png` (750x1334) - Mobile view

## Testing

### Development Mode

Service workers are disabled in development. To test PWA features:

```bash
npm run build
npm start
```

### Chrome DevTools

1. Open `http://localhost:3000`
2. Open DevTools (F12) → **Application** tab
3. Check:
   - **Manifest**: App metadata and icons
   - **Service Workers**: Registration status
   - **Cache Storage**: Cached assets

### Offline Testing

1. DevTools → Network tab → Check "Offline"
2. Navigate the app - cached pages should work
3. Visit `/offline` to see the fallback page

### Lighthouse PWA Audit

1. DevTools → **Lighthouse** tab
2. Check "Progressive Web App"
3. Click "Analyze page load"

Target scores:
- Installable: Yes
- PWA Optimized: 100%

### Mobile Testing

**Android (Chrome):**
- Visit the site
- Wait 3 seconds for install prompt
- Or use browser menu → "Add to Home Screen"

**iOS (Safari):**
- Visit the site
- Tap Share button
- Scroll down → "Add to Home Screen"

## Configuration

### Manifest Settings

Edit `public/manifest.json` to customize:

```json
{
  "name": "HBCU Band Hub",
  "short_name": "Band Hub",
  "theme_color": "#dc2626",
  "background_color": "#ffffff",
  "display": "standalone"
}
```

### Service Worker Cache

Edit `public/sw.js` to modify caching behavior:

```javascript
const CACHE_NAME = 'hbcu-band-hub-v1';  // Increment to bust cache

const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  // Add more URLs to pre-cache
];
```

### Next.js Config

PWA headers are configured in `next.config.js`:

```javascript
async headers() {
  return [
    {
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    },
  ];
}
```

## Components

### PWAProvider

Wraps the app to provide PWA context:

```tsx
import { PWAWrapper } from '@/components/pwa';

<PWAWrapper>
  <App />
</PWAWrapper>
```

### usePWA Hook

Access PWA state in components:

```tsx
import { usePWA } from '@/components/pwa';

function MyComponent() {
  const { isOffline, isInstalled, updateAvailable, update } = usePWA();

  if (updateAvailable) {
    return <button onClick={update}>Update Available</button>;
  }
}
```

### useServiceWorker Hook

Low-level service worker control:

```tsx
import { useServiceWorker } from '@/hooks/useServiceWorker';

function MyComponent() {
  const { isRegistered, clearCache, unregister } = useServiceWorker();
}
```

## Updating the App

When deploying updates:

1. Update `CACHE_NAME` in `sw.js` to bust the cache
2. Users will see an "Update Available" banner
3. Clicking update reloads with the new version

## Troubleshooting

### Service Worker Not Registering

- Ensure HTTPS (or localhost for development)
- Check browser console for errors
- Verify `sw.js` is accessible at `/sw.js`

### Cache Not Updating

- Increment `CACHE_NAME` in `sw.js`
- Clear browser cache and service worker
- In DevTools: Application → Service Workers → Unregister

### Install Prompt Not Showing

- Requires HTTPS
- Must have valid manifest
- Must have registered service worker
- User must not have dismissed prompt recently

### iOS Issues

- iOS requires Safari for PWA installation
- Some features (push notifications) not supported on iOS
- Add to Home Screen instructions shown instead of native prompt

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Service Workers | Yes | Yes | Yes | Yes |
| Install Prompt | Yes | No | No | Yes |
| Push Notifications | Yes | Yes | No | Yes |
| Background Sync | Yes | No | No | Yes |

## Resources

- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)
- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox (Google's SW library)](https://developers.google.com/web/tools/workbox)
