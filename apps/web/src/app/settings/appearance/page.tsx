import { AppearanceSettings } from '@/components/settings';

export default function AppearancePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Appearance Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Customize the look and feel of the application
        </p>
      </div>
      <AppearanceSettings />
    </div>
  );
}
