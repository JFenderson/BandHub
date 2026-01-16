'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/contexts/UserContext';
import { SettingsSection } from './SettingsSection';
import { Loader2, AlertCircle } from 'lucide-react';

const notificationSchema = z.object({
  emailNotifications: z.object({
    newContent: z.boolean(),
    favorites: z.boolean(),
    newsletter: z.boolean(),
    comments: z.boolean(),
    mentions: z.boolean(),
    followers: z.boolean(),
  }),
  pushNotifications: z.object({
    enabled: z.boolean(),
    comments: z.boolean(),
    mentions: z.boolean(),
    followers: z.boolean(),
  }),
});

type NotificationFormData = z.infer<typeof notificationSchema>;

export function NotificationSettings() {
  const { user, updateProfile } = useUser();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: {
        newContent: user?.preferences?.emailNotifications?.newContent ?? true,
        favorites: user?.preferences?.emailNotifications?.favorites ?? true,
        newsletter: user?.preferences?.emailNotifications?.newsletter ?? false,
        comments: true,
        mentions: true,
        followers: true,
      },
      pushNotifications: {
        enabled: false,
        comments: true,
        mentions: true,
        followers: true,
      },
    },
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const onSubmit = async (data: NotificationFormData) => {
    try {
      await updateProfile({
        preferences: {
          emailNotifications: data.emailNotifications,
        },
      });
      showToast('success', 'Notification preferences updated successfully');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update notification preferences');
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

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Notifications */}
        <SettingsSection 
          title="Email Notifications" 
          description="Choose what updates you want to receive via email"
        >
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">New Content</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified when bands you follow upload new videos
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('emailNotifications.newContent')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Favorites</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Updates about your favorited videos and bands
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('emailNotifications.favorites')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Comments</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  When someone comments on your videos
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('emailNotifications.comments')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Mentions</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  When someone mentions you in a comment
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('emailNotifications.mentions')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">New Followers</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  When someone starts following you
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('emailNotifications.followers')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Newsletter</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Weekly digest of featured content and updates
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('emailNotifications.newsletter')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
        </SettingsSection>

        {/* Push Notifications */}
        <SettingsSection 
          title="Push Notifications" 
          description="Receive real-time notifications in your browser (coming soon)"
        >
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Enable Push Notifications</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Allow browser notifications for important updates
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('pushNotifications.enabled')}
                disabled
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
            </label>

            <div className="ml-6 space-y-4 opacity-50">
              <label className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Comments</div>
                </div>
                <input
                  type="checkbox"
                  {...form.register('pushNotifications.comments')}
                  disabled
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Mentions</div>
                </div>
                <input
                  type="checkbox"
                  {...form.register('pushNotifications.mentions')}
                  disabled
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </label>

              <label className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">New Followers</div>
                </div>
                <input
                  type="checkbox"
                  {...form.register('pushNotifications.followers')}
                  disabled
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </label>
            </div>
          </div>
        </SettingsSection>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            {form.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Preferences
          </button>
          <button
            type="button"
            onClick={() => form.reset()}
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 text-gray-900 dark:text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
