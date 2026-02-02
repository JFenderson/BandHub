'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  initializeAnalytics,
  getAnalytics,
  AnalyticsConfig,
  AnalyticsProvider as ProviderType,
  UserProperties,
  getConsentState,
} from '@/lib/analytics';
import { CookieConsentBanner } from './CookieConsentBanner';

interface AnalyticsContextValue {
  isInitialized: boolean;
  isConsentGiven: boolean;
  identify: (userId: string, properties?: Partial<UserProperties>) => void;
  setUserProperties: (properties: Partial<UserProperties>) => void;
  reset: () => void;
  track: (event: string, properties?: Record<string, unknown>) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

interface AnalyticsProviderProps {
  children: ReactNode;
  /** Analytics provider to use */
  provider?: ProviderType;
  /** API key for the analytics provider */
  apiKey?: string;
  /** Custom endpoint for backend analytics */
  endpoint?: string;
  /** Enable debug mode */
  debug?: boolean;
  /** Respect browser Do Not Track setting */
  respectDoNotTrack?: boolean;
  /** Require cookie consent before tracking */
  requireConsent?: boolean;
  /** Show cookie consent banner */
  showConsentBanner?: boolean;
  /** Privacy policy URL */
  privacyPolicyUrl?: string;
  /** Cookie policy URL */
  cookiePolicyUrl?: string;
}

export function AnalyticsProvider({
  children,
  provider = 'custom',
  apiKey,
  endpoint,
  debug = process.env.NODE_ENV === 'development',
  respectDoNotTrack = true,
  requireConsent = true,
  showConsentBanner = true,
  privacyPolicyUrl,
  cookiePolicyUrl,
}: AnalyticsProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConsentGiven, setIsConsentGiven] = useState(false);

  useEffect(() => {
    // Check for existing consent
    const consent = getConsentState();
    const hasConsent = consent?.analytics ?? false;
    setIsConsentGiven(hasConsent);

    // Initialize analytics
    const config: AnalyticsConfig = {
      provider,
      apiKey: apiKey || process.env.NEXT_PUBLIC_ANALYTICS_KEY,
      endpoint: endpoint || process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT,
      debug,
      respectDoNotTrack,
      cookieConsent: requireConsent,
    };

    try {
      initializeAnalytics(config);
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize analytics:', error);
    }
  }, [provider, apiKey, endpoint, debug, respectDoNotTrack, requireConsent]);

  const identify = (userId: string, properties?: Partial<UserProperties>) => {
    getAnalytics()?.identify(userId, properties);
  };

  const setUserProperties = (properties: Partial<UserProperties>) => {
    getAnalytics()?.setUserProperties(properties);
  };

  const reset = () => {
    getAnalytics()?.reset();
  };

  const track = (event: string, properties?: Record<string, unknown>) => {
    getAnalytics()?.track(event, properties ?? {});
  };

  const handleConsentChange = (consent: { analytics: boolean }) => {
    setIsConsentGiven(consent.analytics);
  };

  const contextValue: AnalyticsContextValue = {
    isInitialized,
    isConsentGiven,
    identify,
    setUserProperties,
    reset,
    track,
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
      {showConsentBanner && requireConsent && (
        <CookieConsentBanner
          privacyPolicyUrl={privacyPolicyUrl}
          cookiePolicyUrl={cookiePolicyUrl}
          onConsentChange={handleConsentChange}
        />
      )}
    </AnalyticsContext.Provider>
  );
}

/**
 * Hook to access the analytics context
 */
export function useAnalyticsContext() {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsContext must be used within an AnalyticsProvider');
  }
  return context;
}

export default AnalyticsProvider;
