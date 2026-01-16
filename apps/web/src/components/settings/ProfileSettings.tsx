'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/contexts/UserContext';
import { SettingsSection } from './SettingsSection';
import { Loader2, AlertCircle, Upload } from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  website: z.string().url('Invalid URL').or(z.literal('')).optional(),
  location: z.string().max(100, 'Location must be less than 100 characters').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfileSettings() {
  const { user, updateProfile } = useUser();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      bio: user?.bio || '',
      website: '',
      location: '',
    },
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const onSubmit = async (data: ProfileFormData) => {
    try {
      await updateProfile({
        name: data.name,
        bio: data.bio || null,
      });
      showToast('success', 'Profile updated successfully');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update profile');
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For now, just show preview. Actual upload would be implemented later
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      showToast('success', 'Avatar upload will be implemented soon');
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

      {/* Avatar */}
      <SettingsSection 
        title="Profile Picture" 
        description="Upload a profile picture (feature coming soon)"
      >
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <Upload className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
              id="avatar-upload"
            />
            <label
              htmlFor="avatar-upload"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer inline-block"
            >
              Upload Photo
            </label>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              JPG, PNG or GIF. Max size 5MB.
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Profile Info */}
      <SettingsSection 
        title="Profile Information" 
        description="Update your public profile information"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              {...form.register('name')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {form.formState.errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              {...form.register('bio')}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Tell us about yourself..."
            />
            {form.formState.errors.bio && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {form.formState.errors.bio.message}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {form.watch('bio')?.length || 0}/500 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Website
            </label>
            <input
              type="url"
              {...form.register('website')}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {form.formState.errors.website && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {form.formState.errors.website.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Location
            </label>
            <input
              type="text"
              {...form.register('location')}
              placeholder="City, State"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {form.formState.errors.location && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {form.formState.errors.location.message}
              </p>
            )}
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
    </div>
  );
}
