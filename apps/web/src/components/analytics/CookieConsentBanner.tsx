'use client';

import React, { useState, useEffect } from 'react';
import { X, Shield, Cookie, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getConsentState,
  setConsentState,
  isDoNotTrackEnabled,
  ConsentState,
} from '@/lib/analytics';

interface CookieConsentBannerProps {
  /** Custom privacy policy URL */
  privacyPolicyUrl?: string;
  /** Custom cookie policy URL */
  cookiePolicyUrl?: string;
  /** Called when consent is given or updated */
  onConsentChange?: (consent: Omit<ConsentState, 'timestamp'>) => void;
  /** Position of the banner */
  position?: 'bottom' | 'top';
  /** Show detailed options by default */
  showDetailsDefault?: boolean;
}

export function CookieConsentBanner({
  privacyPolicyUrl = '/privacy',
  cookiePolicyUrl = '/cookies',
  onConsentChange,
  position = 'bottom',
  showDetailsDefault = false,
}: CookieConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(showDetailsDefault);
  const [consent, setLocalConsent] = useState({
    analytics: true,
    marketing: false,
    functional: true,
  });

  useEffect(() => {
    // Check if user has already made a consent decision
    const existingConsent = getConsentState();
    if (!existingConsent) {
      // Show banner if no consent recorded and DNT is not enabled
      const dnt = isDoNotTrackEnabled();
      if (!dnt) {
        setIsVisible(true);
      } else {
        // Auto-set consent to deny all if DNT is enabled
        handleSaveConsent({
          analytics: false,
          marketing: false,
          functional: true,
          method: 'implicit' as const,
        });
      }
    }
  }, []);

  const handleSaveConsent = (
    consentData: Omit<ConsentState, 'timestamp'>
  ) => {
    setConsentState(consentData);
    setIsVisible(false);
    onConsentChange?.(consentData);
  };

  const handleAcceptAll = () => {
    handleSaveConsent({
      analytics: true,
      marketing: true,
      functional: true,
      method: 'explicit',
    });
  };

  const handleAcceptSelected = () => {
    handleSaveConsent({
      ...consent,
      method: 'explicit',
    });
  };

  const handleRejectAll = () => {
    handleSaveConsent({
      analytics: false,
      marketing: false,
      functional: true, // Functional cookies are always needed
      method: 'explicit',
    });
  };

  if (!isVisible) return null;

  const positionClasses = position === 'bottom'
    ? 'bottom-0 left-0 right-0'
    : 'top-0 left-0 right-0';

  return (
    <div
      className={`fixed ${positionClasses} z-50 p-4 sm:p-6`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-consent-title"
    >
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 sm:p-6 pb-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Cookie className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2
                  id="cookie-consent-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Cookie Preferences
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  We use cookies to enhance your experience
                </p>
              </div>
            </div>
            <button
              onClick={handleRejectAll}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Close and reject all cookies"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            We use cookies and similar technologies to help personalize content, enhance your experience,
            and analyze site usage. You can customize your preferences below or accept our recommended settings.
            See our{' '}
            <a
              href={privacyPolicyUrl}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>{' '}
            and{' '}
            <a
              href={cookiePolicyUrl}
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cookie Policy
            </a>{' '}
            for more information.
          </p>

          {/* Toggle Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 mb-4"
            aria-expanded={showDetails}
          >
            {showDetails ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Hide cookie preferences
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Customize cookie preferences
              </>
            )}
          </button>

          {/* Detailed Options */}
          {showDetails && (
            <div className="space-y-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              {/* Essential Cookies */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      Essential Cookies
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                      Always Active
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Required for the website to function. Cannot be disabled.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="w-5 h-5 text-green-600 rounded cursor-not-allowed"
                  aria-label="Essential cookies (always enabled)"
                />
              </div>

              {/* Functional Cookies */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">
                    Functional Cookies
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Remember your preferences and personalize your experience.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.functional}
                  onChange={(e) => setLocalConsent({ ...consent, functional: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  aria-label="Functional cookies"
                />
              </div>

              {/* Analytics Cookies */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">
                    Analytics Cookies
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Help us understand how visitors interact with our website.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.analytics}
                  onChange={(e) => setLocalConsent({ ...consent, analytics: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  aria-label="Analytics cookies"
                />
              </div>

              {/* Marketing Cookies */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">
                    Marketing Cookies
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Used to deliver relevant advertisements and track campaigns.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.marketing}
                  onChange={(e) => setLocalConsent({ ...consent, marketing: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  aria-label="Marketing cookies"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAcceptAll}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Accept All
            </button>
            {showDetails && (
              <button
                onClick={handleAcceptSelected}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Save Preferences
              </button>
            )}
            <button
              onClick={handleRejectAll}
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Reject All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CookieConsentBanner;
