'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Home, Music } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Redirect to home when back online
      window.location.href = '/';
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Offline Icon */}
        <div className="mb-8 relative">
          <div className="w-32 h-32 mx-auto bg-red-600/20 rounded-full flex items-center justify-center">
            <WifiOff className="w-16 h-16 text-red-500" />
          </div>
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            <Music className="w-8 h-8 text-gray-500 animate-bounce" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white mb-4">
          You&apos;re Offline
        </h1>

        {/* Description */}
        <p className="text-gray-400 mb-8 leading-relaxed">
          It looks like you&apos;ve lost your internet connection.
          Don&apos;t worry - any content you&apos;ve previously viewed
          may still be available in your cache.
        </p>

        {/* Status indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-500">
            {isOnline ? 'Connection restored!' : 'No internet connection'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleRetry}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          <button
            onClick={handleGoHome}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
          >
            <Home className="w-5 h-5" />
            Go Home
          </button>
        </div>

        {/* Cached content hint */}
        <div className="mt-12 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-2">
            While you&apos;re offline
          </h3>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>Previously viewed pages may still work</li>
            <li>Cached videos and images are available</li>
            <li>Your favorites are saved locally</li>
          </ul>
        </div>

        {/* Brand footer */}
        <div className="mt-12 text-gray-600">
          <p className="text-sm">HBCU Band Hub</p>
        </div>
      </div>
    </div>
  );
}
