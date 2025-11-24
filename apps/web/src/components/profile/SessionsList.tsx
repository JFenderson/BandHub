'use client';

import React from 'react';
import type { UserSession } from '@/types/user';

interface SessionsListProps {
  sessions: UserSession[];
  loading: boolean;
  onDelete: (sessionId: string) => void;
  onLogoutAll: () => void;
}

export function SessionsList({ sessions, loading, onDelete, onLogoutAll }: SessionsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Active Sessions</h3>
          <p className="text-sm text-gray-500">
            Manage your active sessions across devices
          </p>
        </div>
        {sessions.length > 1 && (
          <button
            onClick={onLogoutAll}
            className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          >
            Logout All Devices
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-gray-500 py-4">No active sessions found.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              onDelete={() => onDelete(session.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SessionItemProps {
  session: UserSession;
  onDelete: () => void;
}

function SessionItem({ session, onDelete }: SessionItemProps) {
  const lastActive = new Date(session.lastActiveAt);
  const isRecent = (Date.now() - lastActive.getTime()) < 5 * 60 * 1000; // Within 5 minutes

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
          {session.deviceType === 'Mobile' ? (
            <MobileIcon className="w-5 h-5 text-gray-600" />
          ) : session.deviceType === 'Tablet' ? (
            <TabletIcon className="w-5 h-5 text-gray-600" />
          ) : (
            <DesktopIcon className="w-5 h-5 text-gray-600" />
          )}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <p className="font-medium text-gray-900">
              {session.browser || 'Unknown browser'} on {session.deviceType || 'Unknown device'}
            </p>
            {isRecent && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                Active now
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3 text-sm text-gray-500">
            {session.ipAddress && <span>{session.ipAddress}</span>}
            <span>•</span>
            <span>
              Last active: {lastActive.toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Expires: {new Date(session.expiresAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <button
        onClick={onDelete}
        className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
      >
        Revoke
      </button>
    </div>
  );
}

// Icons
function DesktopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function MobileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function TabletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}
