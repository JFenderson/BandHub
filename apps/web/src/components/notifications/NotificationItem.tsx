'use client';

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import type { Notification } from '@/lib/api/notifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'NEW_VIDEO':
        return (
          <div className="p-2 bg-primary-100 rounded-full">
            <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case 'UPCOMING_EVENT':
        return (
          <div className="p-2 bg-yellow-100 rounded-full">
            <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case 'WEEKLY_DIGEST':
        return (
          <div className="p-2 bg-blue-100 rounded-full">
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="p-2 bg-gray-100 rounded-full">
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        );
    }
  };

  const getNotificationLink = () => {
    const data = notification.data as Record<string, string> | undefined;
    if (notification.type === 'NEW_VIDEO' && data?.videoId) {
      return `/videos/${data.videoId}`;
    }
    return null;
  };

  const link = getNotificationLink();

  const content = (
    <div
      className={`
        flex items-start space-x-4 p-4 rounded-lg transition-colors
        ${notification.read ? 'bg-white' : 'bg-blue-50'}
        ${link ? 'hover:bg-gray-50 cursor-pointer' : ''}
      `}
      onClick={() => {
        if (!notification.read && onMarkAsRead) {
          onMarkAsRead(notification.id);
        }
      }}
    >
      {getNotificationIcon()}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
              {notification.title}
            </p>
            <p className={`mt-1 text-sm ${notification.read ? 'text-gray-500' : 'text-gray-600'}`}>
              {notification.message}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </p>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            {!notification.read && (
              <span className="w-2 h-2 bg-blue-500 rounded-full" aria-label="Unread" />
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                aria-label="Delete notification"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (link) {
    return <Link href={link}>{content}</Link>;
  }

  return content;
}
