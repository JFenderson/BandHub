'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { notificationsApiClient, type Notification, type NotificationPreferences, type NotificationType } from '@/lib/api/notifications';
import { NotificationItem } from '@/components/notifications/NotificationItem';

type FilterType = 'all' | 'unread' | 'read';

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [typeFilter, setTypeFilter] = useState<NotificationType | ''>('');
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Set up token provider
  useEffect(() => {
    const getCookie = (name: string): string | null => {
      if (typeof document === 'undefined') return null;
      const nameEQ = name + '=';
      const ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
      }
      return null;
    };

    notificationsApiClient.setTokenProvider(() => ({
      accessToken: getCookie('user_access_token'),
      sessionToken: getCookie('user_session_token'),
    }));
  }, []);

  const fetchNotifications = useCallback(async (page = 1) => {
    setIsLoading(true);
    try {
      const response = await notificationsApiClient.getNotifications({ 
        page, 
        filter, 
        type: typeFilter || undefined 
      });
      setNotifications(response.data);
      setMeta(response.meta);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filter, typeFilter]);

  const fetchPreferences = useCallback(async () => {
    try {
      const prefs = await notificationsApiClient.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, [fetchNotifications, fetchPreferences]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      await notificationsApiClient.markAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await notificationsApiClient.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await notificationsApiClient.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setMeta(prev => ({ ...prev, total: prev.total - 1 }));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }, []);

  const handleUpdatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!preferences) return;
    
    setSavingPreferences(true);
    try {
      const updated = await notificationsApiClient.updatePreferences(updates);
      setPreferences(updated);
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setSavingPreferences(false);
    }
  }, [preferences]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            <p className="text-gray-600 mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings ? 'bg-primary-100 text-primary-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title="Notification settings"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && preferences && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h2>
            
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Email for new videos from followed bands</span>
                <input
                  type="checkbox"
                  checked={preferences.emailNewVideo}
                  onChange={(e) => handleUpdatePreferences({ emailNewVideo: e.target.checked })}
                  disabled={savingPreferences}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Email for upcoming events</span>
                <input
                  type="checkbox"
                  checked={preferences.emailUpcoming}
                  onChange={(e) => handleUpdatePreferences({ emailUpcoming: e.target.checked })}
                  disabled={savingPreferences}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Weekly digest email</span>
                <input
                  type="checkbox"
                  checked={preferences.emailWeeklyDigest}
                  onChange={(e) => handleUpdatePreferences({ emailWeeklyDigest: e.target.checked })}
                  disabled={savingPreferences}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </label>
              
              <label className="flex items-center justify-between">
                <span className="text-gray-700">In-app notifications</span>
                <input
                  type="checkbox"
                  checked={preferences.inAppNotifications}
                  onChange={(e) => handleUpdatePreferences({ inAppNotifications: e.target.checked })}
                  disabled={savingPreferences}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
              </label>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-gray-300">
            {(['all', 'unread', 'read'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as NotificationType | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Types</option>
            <option value="NEW_VIDEO">New Videos</option>
            <option value="UPCOMING_EVENT">Upcoming Events</option>
            <option value="WEEKLY_DIGEST">Weekly Digest</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                <div className="flex space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg">
            <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No notifications</h2>
            <p className="text-gray-600 mb-6">
              {filter === 'unread' 
                ? 'All caught up! No unread notifications.' 
                : 'You don\'t have any notifications yet.'}
            </p>
            <Link
              href="/bands"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Follow some bands
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg overflow-hidden divide-y divide-gray-100">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
              <div className="flex justify-center mt-8 space-x-2">
                <button
                  onClick={() => fetchNotifications(meta.page - 1)}
                  disabled={meta.page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-gray-600">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => fetchNotifications(meta.page + 1)}
                  disabled={meta.page === meta.totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
