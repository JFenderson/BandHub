'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/contexts/UserContext';
import { userApiClient } from '@/lib/api/users';
import { SettingsSection } from './SettingsSection';
import { Loader2, AlertCircle, Smartphone, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { UserSession } from '@/types/user';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export function SecuritySettings() {
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    loadSessions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const sessionsData = await userApiClient.getSessions();
      setSessions(sessionsData);
    } catch (error) {
      showToast('error', 'Failed to load sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const onChangePassword = async (data: PasswordFormData) => {
    try {
      await userApiClient.changePassword(data.currentPassword, data.newPassword);
      passwordForm.reset();
      showToast('success', 'Password changed successfully');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to change password');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await userApiClient.deleteSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      showToast('success', 'Session terminated successfully');
    } catch (error) {
      showToast('error', 'Failed to terminate session');
    }
  };

  const handleLogoutAll = async () => {
    try {
      await userApiClient.logoutAll();
      showToast('success', 'All sessions terminated. Redirecting...');
      setTimeout(() => window.location.href = '/login', 2000);
    } catch (error) {
      showToast('error', 'Failed to terminate all sessions');
    }
  };

  const handleToggleTwoFactor = () => {
    if (twoFactorEnabled) {
      // Disable 2FA
      setTwoFactorEnabled(false);
      showToast('success', 'Two-factor authentication disabled');
    } else {
      // Show 2FA setup
      setShowTwoFactorSetup(true);
    }
  };

  const handleSetupTwoFactor = () => {
    // This would integrate with the actual 2FA setup flow
    setTwoFactorEnabled(true);
    setShowTwoFactorSetup(false);
    showToast('success', 'Two-factor authentication enabled');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white flex items-center gap-2`}>
          <AlertCircle className="w-5 h-5" />
          {toast.message}
        </div>
      )}

      {/* Change Password */}
      <SettingsSection 
        title="Change Password" 
        description="Update your password regularly to keep your account secure"
      >
        <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Password
            </label>
            <input
              type="password"
              {...passwordForm.register('currentPassword')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {passwordForm.formState.errors.currentPassword && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {passwordForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <input
              type="password"
              {...passwordForm.register('newPassword')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {passwordForm.formState.errors.newPassword && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {passwordForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              {...passwordForm.register('confirmPassword')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {passwordForm.formState.errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {passwordForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={passwordForm.formState.isSubmitting}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {passwordForm.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Change Password
          </button>
        </form>
      </SettingsSection>

      {/* Two-Factor Authentication */}
      <SettingsSection 
        title="Two-Factor Authentication" 
        description="Add an extra layer of security to your account"
      >
        {!showTwoFactorSetup ? (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 p-4 rounded-lg ${
              twoFactorEnabled 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            }`}>
              {twoFactorEnabled ? (
                <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              ) : (
                <ShieldAlert className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              )}
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {twoFactorEnabled ? 'Two-factor authentication is enabled' : 'Two-factor authentication is disabled'}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {twoFactorEnabled 
                    ? 'Your account is protected with 2FA' 
                    : 'Protect your account with an extra layer of security'
                  }
                </div>
              </div>
              <button
                onClick={handleToggleTwoFactor}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  twoFactorEnabled
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {twoFactorEnabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
                Set up Two-Factor Authentication
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                Scan the QR code with your authenticator app or enter the setup key manually.
              </p>
              <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center mb-4">
                <div className="text-gray-400 text-sm text-center">
                  QR Code<br />Placeholder
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Setup Key
                </label>
                <code className="block p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm">
                  ABCD EFGH IJKL MNOP QRST UVWX
                </code>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Verify Code
                </label>
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSetupTwoFactor}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Complete Setup
              </button>
              <button
                onClick={() => setShowTwoFactorSetup(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* Active Sessions */}
      <SettingsSection 
        title="Active Sessions" 
        description="Manage devices and browsers where you're currently logged in"
      >
        {loadingSessions ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">No active sessions</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div 
                key={session.id}
                className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <Smartphone className="w-6 h-6 text-gray-600 dark:text-gray-400 mt-1" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {session.browser || 'Unknown Browser'} on {session.deviceType || 'Unknown Device'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    IP: {session.ipAddress || 'Unknown'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Last active: {formatDate(session.lastActiveAt)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Expires: {formatDate(session.expiresAt)}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Terminate session"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            {sessions.length > 1 && (
              <button
                onClick={handleLogoutAll}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Terminate All Sessions
              </button>
            )}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
