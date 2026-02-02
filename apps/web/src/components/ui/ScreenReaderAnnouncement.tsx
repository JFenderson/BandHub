'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface Announcement {
  id: string;
  message: string;
  priority: 'polite' | 'assertive';
}

interface AnnouncementContextType {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  announcePolite: (message: string) => void;
  announceAssertive: (message: string) => void;
}

const AnnouncementContext = createContext<AnnouncementContextType | null>(null);

/**
 * Hook to access screen reader announcement functionality
 * Use this to announce dynamic content changes to screen reader users
 *
 * @example
 * const { announce, announcePolite, announceAssertive } = useAnnouncement();
 *
 * // For non-urgent updates (loading complete, etc.)
 * announcePolite('Videos loaded successfully');
 *
 * // For urgent updates (errors, important alerts)
 * announceAssertive('Error: Failed to save changes');
 */
export function useAnnouncement(): AnnouncementContextType {
  const context = useContext(AnnouncementContext);
  if (!context) {
    throw new Error('useAnnouncement must be used within a ScreenReaderAnnouncementProvider');
  }
  return context;
}

interface ScreenReaderAnnouncementProviderProps {
  children: ReactNode;
}

/**
 * Provider component that enables screen reader announcements throughout the app
 * Renders hidden live regions that screen readers can detect
 */
export function ScreenReaderAnnouncementProvider({ children }: ScreenReaderAnnouncementProviderProps) {
  const [politeAnnouncements, setPoliteAnnouncements] = useState<Announcement[]>([]);
  const [assertiveAnnouncements, setAssertiveAnnouncements] = useState<Announcement[]>([]);
  const announcementIdRef = useRef(0);

  // Clear announcements after they've been read (3 seconds for polite, 5 for assertive)
  useEffect(() => {
    if (politeAnnouncements.length > 0) {
      const timer = setTimeout(() => {
        setPoliteAnnouncements([]);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [politeAnnouncements]);

  useEffect(() => {
    if (assertiveAnnouncements.length > 0) {
      const timer = setTimeout(() => {
        setAssertiveAnnouncements([]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [assertiveAnnouncements]);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const id = `announcement-${++announcementIdRef.current}`;
    const announcement: Announcement = { id, message, priority };

    if (priority === 'assertive') {
      setAssertiveAnnouncements(prev => [...prev, announcement]);
    } else {
      setPoliteAnnouncements(prev => [...prev, announcement]);
    }
  }, []);

  const announcePolite = useCallback((message: string) => {
    announce(message, 'polite');
  }, [announce]);

  const announceAssertive = useCallback((message: string) => {
    announce(message, 'assertive');
  }, [announce]);

  return (
    <AnnouncementContext.Provider value={{ announce, announcePolite, announceAssertive }}>
      {children}

      {/* Polite live region - for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeAnnouncements.map(a => (
          <p key={a.id}>{a.message}</p>
        ))}
      </div>

      {/* Assertive live region - for urgent updates/errors */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveAnnouncements.map(a => (
          <p key={a.id}>{a.message}</p>
        ))}
      </div>
    </AnnouncementContext.Provider>
  );
}

/**
 * Standalone component for displaying status messages
 * Use this for loading states, success messages, and errors
 */
interface StatusMessageProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'loading';
  className?: string;
}

export function StatusMessage({ message, type = 'info', className = '' }: StatusMessageProps) {
  const role = type === 'error' || type === 'warning' ? 'alert' : 'status';
  const ariaLive = type === 'error' ? 'assertive' : 'polite';

  return (
    <div
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
      className={className}
    >
      {type === 'loading' && (
        <span className="sr-only">Loading: </span>
      )}
      {message}
    </div>
  );
}

/**
 * Component that announces page navigation to screen readers
 * Place this in your layout to announce route changes
 */
interface RouteAnnouncerProps {
  title: string;
}

export function RouteAnnouncer({ title }: RouteAnnouncerProps) {
  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    // Small delay to ensure the page has rendered
    const timer = setTimeout(() => {
      setAnnounced(`Navigated to ${title}`);
    }, 100);
    return () => clearTimeout(timer);
  }, [title]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announced}
    </div>
  );
}
