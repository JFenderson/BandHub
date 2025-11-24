'use client';

import React, { useState } from 'react';
import type { UserProfile, UpdateUserProfile } from '@/types/user';

interface ProfileFormProps {
  user: UserProfile;
  onUpdate: (data: UpdateUserProfile) => Promise<void>;
}

export function ProfileForm({ user, onUpdate }: ProfileFormProps) {
  const [formData, setFormData] = useState({
    name: user.name,
    bio: user.bio || '',
    avatar: user.avatar || '',
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
      await onUpdate({
        name: formData.name,
        bio: formData.bio || null,
        avatar: formData.avatar || null,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setSuccess(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
          <p className="text-sm text-green-700">Profile updated successfully!</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Full Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={formData.name}
          onChange={handleChange}
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          value={user.email}
          disabled
          className="block w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
        />
        <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
      </div>

      <div>
        <label htmlFor="avatar" className="block text-sm font-medium text-gray-700 mb-1">
          Avatar URL
        </label>
        <input
          id="avatar"
          name="avatar"
          type="url"
          value={formData.avatar}
          onChange={handleChange}
          placeholder="https://example.com/avatar.jpg"
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {formData.avatar && (
          <div className="mt-2">
            <img
              src={formData.avatar}
              alt="Avatar preview"
              className="w-16 h-16 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
          Bio
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          value={formData.bio}
          onChange={handleChange}
          placeholder="Tell us about yourself..."
          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Account Info */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Account Information</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="w-32 text-gray-500">Member since:</dt>
            <dd className="text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</dd>
          </div>
          {user.lastSeenAt && (
            <div className="flex">
              <dt className="w-32 text-gray-500">Last active:</dt>
              <dd className="text-gray-900">{new Date(user.lastSeenAt).toLocaleString()}</dd>
            </div>
          )}
        </dl>
      </div>
    </form>
  );
}
