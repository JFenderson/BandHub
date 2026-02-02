'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Home, Music, Database, Video } from 'lucide-react';

interface CachedBand {
  id: string;
  name?: string;
  bandName?: string;
  schoolName?: string;
  school?: string;
  conference?: string;
  slug?: string;
  logoUrl?: string;
}

interface CachedVideo {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  bandId?: string;
}

interface CacheStatus {
  [key: string]: {
    size: number;
    limit: number | string;
  };
}

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [cachedBands, setCachedBands] = useState<CachedBand[]>([]);
  const [cachedVideos, setCachedVideos] = useState<CachedVideo[]>([]);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
  const [loading, setLoading] = useState(true);

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

    // Load cached data from service worker
    loadCachedData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadCachedData = async () => {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // Get cached bands
        const bandsChannel = new MessageChannel();
        bandsChannel.port1.onmessage = (event) => {
          if (event.data.bands) {
            setCachedBands(event.data.bands);
          }
        };
        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_OFFLINE_BANDS' },
          [bandsChannel.port2]
        );

        // Get cached videos
        const videosChannel = new MessageChannel();
        videosChannel.port1.onmessage = (event) => {
          if (event.data.videos) {
            setCachedVideos(event.data.videos);
          }
        };
        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_OFFLINE_VIDEOS' },
          [videosChannel.port2]
        );

        // Get cache status
        const statusChannel = new MessageChannel();
        statusChannel.port1.onmessage = (event) => {
          if (event.data.status) {
            setCacheStatus(event.data.status);
          }
        };
        navigator.serviceWorker.controller.postMessage(
          { type: 'GET_CACHE_STATUS' },
          [statusChannel.port2]
        );
      }
    } catch (error) {
      console.error('Failed to load cached data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8 pt-8">
          {/* Offline Icon */}
          <div className="mb-6 relative inline-block">
            <div className="w-24 h-24 mx-auto bg-red-600/20 rounded-full flex items-center justify-center">
              <WifiOff className="w-12 h-12 text-red-500" />
            </div>
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
              <Music className="w-6 h-6 text-gray-500 animate-bounce" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-3">
            You&apos;re Offline
          </h1>

          {/* Description */}
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Don&apos;t worry - you can still browse your cached content below.
          </p>

          {/* Status indicator */}
          <div className="mb-6 flex items-center justify-center gap-2">
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
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <button
              onClick={handleRetry}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={handleGoHome}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              <Home className="w-4 h-4" />
              Go Home
            </button>
          </div>
        </div>

        {/* Cache Status */}
        {cacheStatus && (
          <div className="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-300">Cache Status</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {Object.entries(cacheStatus).map(([key, value]) => (
                <div key={key} className="bg-gray-800 rounded p-2">
                  <div className="text-gray-500 text-xs capitalize">{key}</div>
                  <div className="text-gray-300">{formatBytes(value.size)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cached Bands Section */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading cached content...</p>
          </div>
        ) : cachedBands.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-red-500" />
              Cached Bands ({cachedBands.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {cachedBands.map((band) => (
                <div
                  key={band.id}
                  className="bg-gray-800/60 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  {band.logoUrl && (
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full overflow-hidden bg-gray-700">
                      <img
                        src={band.logoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="text-sm font-medium text-white truncate text-center">
                    {band.name || band.bandName || 'Unknown Band'}
                  </div>
                  <div className="text-xs text-gray-500 truncate text-center">
                    {band.schoolName || band.school || ''}
                  </div>
                  {band.conference && (
                    <div className="mt-1 text-center">
                      <span className="inline-block text-xs bg-red-600/20 text-red-400 px-2 py-0.5 rounded">
                        {band.conference}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8 p-6 bg-gray-800/30 rounded-lg border border-gray-700 text-center">
            <Music className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500">No cached bands available.</p>
            <p className="text-gray-600 text-sm mt-1">
              Visit the bands page while online to cache them for offline access.
            </p>
          </div>
        )}

        {/* Cached Videos Section */}
        {cachedVideos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-red-500" />
              Cached Video Metadata ({cachedVideos.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cachedVideos.slice(0, 12).map((video) => (
                <div
                  key={video.id}
                  className="bg-gray-800/60 rounded-lg overflow-hidden border border-gray-700"
                >
                  {video.thumbnailUrl && (
                    <div className="aspect-video bg-gray-700">
                      <img
                        src={video.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/icons/icon-96x96.png';
                        }}
                      />
                    </div>
                  )}
                  <div className="p-2">
                    <div className="text-xs text-gray-300 line-clamp-2">
                      {video.title || 'Untitled Video'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {cachedVideos.length > 12 && (
              <p className="text-sm text-gray-500 text-center mt-3">
                And {cachedVideos.length - 12} more videos cached...
              </p>
            )}
          </div>
        )}

        {/* Tips Section */}
        <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 mb-8">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Tips for offline access
          </h3>
          <ul className="text-sm text-gray-500 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              Previously viewed pages and images are cached automatically
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              Video metadata is saved for offline browsing
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              Actions made offline will sync when you&apos;re back online
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">•</span>
              Install the app for the best offline experience
            </li>
          </ul>
        </div>

        {/* Brand footer */}
        <div className="text-center text-gray-600 pb-8">
          <p className="text-sm">HBCU Band Hub</p>
        </div>
      </div>
    </div>
  );
}
