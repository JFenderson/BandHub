'use client';

import React, { useState, useEffect } from 'react';
import type { UserPreferences } from '@/types/user';

interface PreferencesFormProps {
  preferences: UserPreferences;
  onUpdate: (prefs: Partial<UserPreferences>) => Promise<void>;
}

const defaultPreferences: UserPreferences = {
  theme: 'auto',
  defaultVideoSort: 'recent',
  preferredCategories: [],
  emailNotifications: {
    newContent: true,
    favorites: true,
    newsletter: true,
  },
  favoriteBands: [],
};

export function PreferencesForm({ preferences, onUpdate }: PreferencesFormProps) {
  const [prefs, setPrefs] = useState<UserPreferences>({
    ...defaultPreferences,
    ...preferences,
    emailNotifications: {
      ...defaultPreferences.emailNotifications,
      ...(preferences?.emailNotifications || {}),
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccess(false);
    setError('');

    try {
      await onUpdate(prefs);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleThemeChange = (theme: UserPreferences['theme']) => {
    setPrefs(prev => ({ ...prev, theme }));
    setSuccess(false);
  };

  const handleSortChange = (sort: UserPreferences['defaultVideoSort']) => {
    setPrefs(prev => ({ ...prev, defaultVideoSort: sort }));
    setSuccess(false);
  };

  const handleNotificationChange = (key: keyof UserPreferences['emailNotifications'], value: boolean) => {
    setPrefs(prev => ({
      ...prev,
      emailNotifications: {
        ...prev.emailNotifications,
        [key]: value,
      },
    }));
    setSuccess(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
          <p className="text-sm text-green-700">Preferences saved successfully!</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Theme */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Theme</h4>
        <div className="flex space-x-4">
          {(['light', 'dark', 'auto'] as const).map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => handleThemeChange(theme)}
              className={`flex items-center px-4 py-2 rounded-lg border ${
                prefs.theme === theme
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {theme === 'light' && <SunIcon className="w-5 h-5 mr-2" />}
              {theme === 'dark' && <MoonIcon className="w-5 h-5 mr-2" />}
              {theme === 'auto' && <AutoIcon className="w-5 h-5 mr-2" />}
              <span className="capitalize">{theme}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Default Video Sort */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Default Video Sort</h4>
        <select
          value={prefs.defaultVideoSort}
          onChange={(e) => handleSortChange(e.target.value as UserPreferences['defaultVideoSort'])}
          className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value="recent">Most Recent</option>
          <option value="popular">Most Popular</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </div>

      {/* Email Notifications */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Email Notifications</h4>
        <div className="space-y-3">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={prefs.emailNotifications.newContent}
              onChange={(e) => handleNotificationChange('newContent', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="ml-3 text-sm text-gray-700">
              New content from favorite bands
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={prefs.emailNotifications.favorites}
              onChange={(e) => handleNotificationChange('favorites', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="ml-3 text-sm text-gray-700">
              Updates to favorited videos
            </span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={prefs.emailNotifications.newsletter}
              onChange={(e) => handleNotificationChange('newsletter', e.target.checked)}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span className="ml-3 text-sm text-gray-700">
              Newsletter and announcements
            </span>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </form>
  );
}

// Icons
function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function AutoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}
