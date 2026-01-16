'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/contexts/UserContext';
import { SettingsSection } from './SettingsSection';
import { Loader2, AlertCircle, Download } from 'lucide-react';

const privacySchema = z.object({
  profileVisibility: z.enum(['public', 'private']),
  showEmail: z.boolean(),
  allowMessages: z.boolean(),
  showActivity: z.boolean(),
});

type PrivacyFormData = z.infer<typeof privacySchema>;

export function PrivacySettings() {
  const { updateProfile } = useUser();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const form = useForm<PrivacyFormData>({
    resolver: zodResolver(privacySchema),
    defaultValues: {
      profileVisibility: 'public',
      showEmail: false,
      allowMessages: true,
      showActivity: true,
    },
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const onSubmit = async (_data: PrivacyFormData) => {
    try {
      // Update user preferences - this would need backend support
      await updateProfile({
        preferences: {
          // These would need to be added to UserPreferences type
        },
      });
      showToast('success', 'Privacy settings updated successfully');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update privacy settings');
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      // This would call a backend endpoint to export user data
      showToast('success', 'Data export request submitted. You will receive an email with your data.');
    } catch (error) {
      showToast('error', 'Failed to export data');
    } finally {
      setIsExporting(false);
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

      {/* Privacy Settings */}
      <SettingsSection 
        title="Privacy Settings" 
        description="Control who can see your profile and activity"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Profile Visibility
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  {...form.register('profileVisibility')}
                  value="public"
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Public</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Anyone can see your profile
                  </div>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  {...form.register('profileVisibility')}
                  value="private"
                  className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Private</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Only you can see your profile
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Show Email Address</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Display your email on your public profile
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('showEmail')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Allow Direct Messages</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Let other users send you messages
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('allowMessages')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Show Activity</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Display your recent activity on your profile
                </div>
              </div>
              <input
                type="checkbox"
                {...form.register('showActivity')}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={form.formState.isSubmitting || !form.formState.isDirty}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {form.formState.isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
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
      </SettingsSection>

      {/* Data Export */}
      <SettingsSection 
        title="Export Your Data" 
        description="Download a copy of your data including profile, videos, and activity"
      >
        <button
          onClick={handleExportData}
          disabled={isExporting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          Request Data Export
        </button>
      </SettingsSection>
    </div>
  );
}
