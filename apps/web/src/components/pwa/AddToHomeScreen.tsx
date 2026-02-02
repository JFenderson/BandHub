'use client';

import { useState, useEffect } from 'react';
import { X, Download, Smartphone, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function AddToHomeScreen() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    if (standalone) return;

    // Check if dismissed before
    const dismissed = localStorage.getItem('a2hs-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Show again after 7 days
    if (dismissed && daysSinceDismissed < 7) return;

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      // For iOS, show instructions after a delay
      const timer = setTimeout(() => {
        setShowIOSInstructions(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Handle beforeinstallprompt for Android/Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a delay to not be intrusive
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Install prompt error:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setShowIOSInstructions(false);
    localStorage.setItem('a2hs-dismissed', Date.now().toString());
  };

  // Don't show if already installed
  if (isStandalone) return null;

  // iOS instructions modal
  if (showIOSInstructions && isIOS) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
        <div className="max-w-md mx-auto bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Add to Home Screen</h3>
                <p className="text-xs text-gray-400">Install HBCU Band Hub</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Instructions */}
          <div className="p-4 space-y-4">
            <p className="text-sm text-gray-300">
              Install this app on your iPhone for quick access and offline support:
            </p>
            <ol className="space-y-3 text-sm text-gray-400">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-white">
                  1
                </span>
                <span>
                  Tap the <Share className="w-4 h-4 inline text-blue-400" /> Share button in Safari
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-white">
                  2
                </span>
                <span>Scroll down and tap &quot;Add to Home Screen&quot;</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium text-white">
                  3
                </span>
                <span>Tap &quot;Add&quot; to install</span>
              </li>
            </ol>
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-900/50">
            <button
              onClick={handleDismiss}
              className="w-full py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Standard install prompt for Android/Desktop
  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
      <div className="max-w-md mx-auto bg-gray-800 rounded-2xl shadow-xl border border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
              <img
                src="/icons/icon-96x96.png"
                alt="HBCU Band Hub"
                className="w-8 h-8"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div>
              <h3 className="font-semibold text-white">HBCU Band Hub</h3>
              <p className="text-xs text-gray-400">Install app for the best experience</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Benefits */}
        <div className="p-4">
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              Quick access from your home screen
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              Works offline with cached content
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              Get push notifications for new videos
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 bg-gray-900/50">
          <button
            onClick={handleDismiss}
            className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
