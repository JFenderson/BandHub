/**
 * Loading skeleton components for lazy-loaded content
 * All skeletons include proper ARIA attributes for screen readers
 */

export function AdminDashboardSkeleton() {
  return (
    <div className="p-8 animate-pulse" role="status" aria-label="Loading admin dashboard">
      <span className="sr-only">Loading admin dashboard...</span>
      <div className="mb-8" aria-hidden="true">
        <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-96"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
                <div className="h-8 bg-gray-200 rounded w-16"></div>
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-hidden="true">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoPlayerSkeleton() {
  return (
    <div
      className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden animate-pulse"
      role="status"
      aria-label="Loading video player"
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-12 w-12 border-4 border-gray-600 border-t-white rounded-full animate-spin mb-4" aria-hidden="true"></div>
          <p className="text-white text-sm">Loading video player...</p>
        </div>
      </div>
    </div>
  );
}

export function ModalSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="status" aria-label="Loading dialog">
      <span className="sr-only">Loading dialog content...</span>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-pulse" aria-hidden="true">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
        <div className="space-y-3">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <div className="h-10 bg-gray-200 rounded w-20"></div>
          <div className="h-10 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    </div>
  );
}
