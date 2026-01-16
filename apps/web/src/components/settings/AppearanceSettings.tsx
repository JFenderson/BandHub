'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/contexts/UserContext';
import { SettingsSection } from './SettingsSection';
import { Loader2, AlertCircle, Sun, Moon, Monitor } from 'lucide-react';

const appearanceSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  fontSize: z.enum(['small', 'medium', 'large']),
  language: z.string(),
});

type AppearanceFormData = z.infer<typeof appearanceSchema>;

export function AppearanceSettings() {
  const { user, updateProfile } = useUser();
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const form = useForm<AppearanceFormData>({
    resolver: zodResolver(appearanceSchema),
    defaultValues: {
      theme: (user?.preferences?.theme === 'auto' ? 'system' : user?.preferences?.theme) || 'system',
      fontSize: 'medium',
      language: 'en',
    },
  });

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    localStorage.setItem('theme', theme);
    
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  };

  const onSubmit = async (data: AppearanceFormData) => {
    try {
      applyTheme(data.theme);
      
      await updateProfile({
        preferences: {
          theme: data.theme === 'system' ? 'auto' : data.theme,
        },
      });
      
      showToast('success', 'Appearance settings updated successfully');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to update appearance settings');
    }
  };

  const ThemeOption = ({ 
    value, 
    label, 
    icon: Icon, 
    description 
  }: { 
    value: 'light' | 'dark' | 'system'; 
    label: string; 
    icon: React.ElementType;
    description: string;
  }) => {
    const isSelected = form.watch('theme') === value;
    
    return (
      <label
        className={`
          relative flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all
          ${isSelected 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }
        `}
      >
        <input
          type="radio"
          {...form.register('theme')}
          value={value}
          className="sr-only"
        />
        <Icon className={`w-8 h-8 mb-2 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
        <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">{label}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400 text-center">{description}</div>
      </label>
    );
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
        {/* Theme Selection */}
        <SettingsSection 
          title="Theme" 
          description="Choose your preferred color scheme"
        >
          <div className="grid grid-cols-3 gap-4">
            <ThemeOption
              value="light"
              label="Light"
              icon={Sun}
              description="Always use light theme"
            />
            <ThemeOption
              value="dark"
              label="Dark"
              icon={Moon}
              description="Always use dark theme"
            />
            <ThemeOption
              value="system"
              label="System"
              icon={Monitor}
              description="Match system preference"
            />
          </div>
        </SettingsSection>

        {/* Font Size */}
        <SettingsSection 
          title="Font Size" 
          description="Adjust the text size across the application"
        >
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                {...form.register('fontSize')}
                value="small"
                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">Small</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Compact view</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                {...form.register('fontSize')}
                value="medium"
                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <div className="text-base font-medium text-gray-900 dark:text-white">Medium</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Default size</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                {...form.register('fontSize')}
                value="large"
                className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <div className="text-lg font-medium text-gray-900 dark:text-white">Large</div>
                <div className="text-base text-gray-600 dark:text-gray-400">Easier to read</div>
              </div>
            </label>
          </div>
        </SettingsSection>

        {/* Language */}
        <SettingsSection 
          title="Language" 
          description="Select your preferred language (currently English only)"
        >
          <select
            {...form.register('language')}
            disabled
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="en">English</option>
          </select>
        </SettingsSection>

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
    </div>
  );
}
