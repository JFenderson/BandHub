'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { AddToHomeScreen } from './AddToHomeScreen';
import { RefreshCw, X } from 'lucide-react';

interface PWAContextType {
  isOffline: boolean;
  isInstalled: boolean;
  updateAvailable: boolean;
  update: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType | null>(null);

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const { isOffline, updateAvailable, update, isRegistered } = useServiceWorker();
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if running as installed PWA
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsInstalled(isStandalone);
  }, []);

  // Show update banner when new version is available
  useEffect(() => {
    if (updateAvailable) {
      setShowUpdateBanner(true);
    }
  }, [updateAvailable]);

  const handleUpdate = async () => {
    await update();
    setShowUpdateBanner(false);
  };

  const contextValue: PWAContextType = {
    isOffline,
    isInstalled,
    updateAvailable,
    update,
  };

  return (
    <PWAContext.Provider value={contextValue}>
      {children}

      {/* Offline indicator */}
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-600 text-white text-center py-2 text-sm">
          You are currently offline. Some features may be limited.
        </div>
      )}

      {/* Update available banner */}
      {showUpdateBanner && (
        <div className="fixed bottom-20 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
          <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white">Update available</h4>
                <p className="text-xs text-gray-400 mt-1">
                  A new version of HBCU Band Hub is available.
                </p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleUpdate}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors"
                  >
                    Update now
                  </button>
                  <button
                    onClick={() => setShowUpdateBanner(false)}
                    className="px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
                  >
                    Later
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowUpdateBanner(false)}
                className="text-gray-500 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Home Screen prompt */}
      {isRegistered && <AddToHomeScreen />}
    </PWAContext.Provider>
  );
}
