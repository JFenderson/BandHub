import { AccountSettings } from '@/components/settings';

export default function AccountPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your account information and credentials
        </p>
      </div>
      <AccountSettings />
    </div>
  );
}
