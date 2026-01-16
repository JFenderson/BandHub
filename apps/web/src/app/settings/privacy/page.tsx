import { PrivacySettings } from '@/components/settings';

export default function PrivacyPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Control your privacy and data management preferences
        </p>
      </div>
      <PrivacySettings />
    </div>
  );
}
