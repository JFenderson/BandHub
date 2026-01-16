import { ProfileSettings } from '@/components/settings';

export default function ProfilePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Customize your public profile information
        </p>
      </div>
      <ProfileSettings />
    </div>
  );
}
