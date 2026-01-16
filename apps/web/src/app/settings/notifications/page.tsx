import { NotificationSettings } from '@/components/settings';

export default function NotificationsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notification Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage how you receive updates and notifications
        </p>
      </div>
      <NotificationSettings />
    </div>
  );
}
