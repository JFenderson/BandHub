'use client';

import { useEffect, useState, useCallback } from 'react';

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isOffline: boolean;
  registration: ServiceWorkerRegistration | null;
  updateAvailable: boolean;
}

interface UseServiceWorkerReturn extends ServiceWorkerState {
  update: () => Promise<void>;
  unregister: () => Promise<boolean>;
  clearCache: () => void;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isOffline: false,
    registration: null,
    updateAvailable: false,
  });

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isSupported = 'serviceWorker' in navigator;
    setState((prev) => ({ ...prev, isSupported }));

    if (!isSupported) return;

    // Check online status
    const updateOnlineStatus = () => {
      setState((prev) => ({ ...prev, isOffline: !navigator.onLine }));
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Register service worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        setState((prev) => ({
          ...prev,
          isRegistered: true,
          registration,
        }));

        // Check for updates periodically
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // New service worker available
                setState((prev) => ({ ...prev, updateAvailable: true }));
              }
            });
          }
        });

        // Check for updates on page load
        registration.update();

        // Check for updates every hour
        const intervalId = setInterval(
          () => {
            registration.update();
          },
          60 * 60 * 1000
        );

        return () => clearInterval(intervalId);
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerServiceWorker();

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Update service worker
  const update = useCallback(async () => {
    if (!state.registration) return;

    const registration = state.registration;

    if (registration.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage('skipWaiting');

      // Reload the page to use the new service worker
      window.location.reload();
    }
  }, [state.registration]);

  // Unregister service worker
  const unregister = useCallback(async () => {
    if (!state.registration) return false;

    try {
      const success = await state.registration.unregister();
      if (success) {
        setState((prev) => ({
          ...prev,
          isRegistered: false,
          registration: null,
        }));
      }
      return success;
    } catch (error) {
      console.error('Service worker unregistration failed:', error);
      return false;
    }
  }, [state.registration]);

  // Clear cache
  const clearCache = useCallback(() => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('clearCache');
    }
  }, []);

  return {
    ...state,
    update,
    unregister,
    clearCache,
  };
}
