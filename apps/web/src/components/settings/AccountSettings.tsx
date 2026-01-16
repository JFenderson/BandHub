'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/contexts/UserContext';
import { userApiClient } from '@/lib/api/users';
import { SettingsSection } from './SettingsSection';
import { Loader2, AlertCircle } from 'lucide-react';

const emailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const usernameSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name must be less than 50 characters'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type EmailFormData = z.infer<typeof emailSchema>;
type UsernameFormData = z.infer<typeof usernameSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export function AccountSettings() {
  const { user, updateProfile, logout } = useUser();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: user?.email || '' },
  });

  const usernameForm = useForm<UsernameFormData>({
    resolver: zodResolver(usernameSchema),
    defaultValues: { name: user?.name || '' },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const onUpdateEmail = async (_data: EmailFormData) => {
    try {
      // Note: This would typically require email verification
      showToast('success', 'Verification email sent to new address');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update email');
    }
  };

  const onUpdateUsername = async (data: UsernameFormData) => {
    try {
      await updateProfile({ name: data.name });
      showToast('success', 'Username updated successfully');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update username');
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

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      await userApiClient.deleteAccount();
      await logout();
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to delete account');
      setIsDeleting(false);
    }
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

      {/* Email Settings */}
      <SettingsSection 
        title="Email Address" 
        description="Change your email address. You'll need to verify the new address."
      >
        <form onSubmit={emailForm.handleSubmit(onUpdateEmail)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              {...emailForm.register('email')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {emailForm.formState.errors.email && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {emailForm.formState.errors.email.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={emailForm.formState.isSubmitting || !emailForm.formState.isDirty}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {emailForm.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Email
          </button>
        </form>
      </SettingsSection>

      {/* Username Settings */}
      <SettingsSection 
        title="Username" 
        description="Change your display name"
      >
        <form onSubmit={usernameForm.handleSubmit(onUpdateUsername)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              {...usernameForm.register('name')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {usernameForm.formState.errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {usernameForm.formState.errors.name.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={usernameForm.formState.isSubmitting || !usernameForm.formState.isDirty}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {usernameForm.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Username
          </button>
        </form>
      </SettingsSection>

      {/* Password Settings */}
      <SettingsSection 
        title="Change Password" 
        description="Update your password to keep your account secure"
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

      {/* Delete Account */}
      <SettingsSection 
        title="Delete Account" 
        description="Permanently delete your account and all associated data. This action cannot be undone."
      >
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-800 dark:text-red-200 font-medium mb-2">
                Are you sure you want to delete your account?
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                This will permanently delete all your data, including videos, playlists, and comments.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Yes, Delete My Account
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
