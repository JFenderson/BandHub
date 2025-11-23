/**
 * Admin Videos Management Page
 * 
 * This page will handle CRUD operations for videos.
 * 
 * TODO - Future Implementation:
 * - List all videos with filtering and search
 * - Edit video metadata (event name, year, tags)
 * - Assign videos to categories
 * - Link videos to opponent bands
 * - Hide/unhide videos with moderation reasons
 * - Bulk categorization and tagging
 * - View sync history and statistics
 */

export default function AdminVideosPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Videos</h2>
          <p className="text-gray-600 mt-1">
            Categorize, moderate, and manage band performance videos
          </p>
        </div>
        <button
          type="button"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Sync Videos</span>
        </button>
      </div>

      {/* Placeholder Content */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Videos Management Interface
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This section will display all synced videos with filtering, categorization, and moderation tools.
            Integration with the videos API endpoint is pending.
          </p>
          
          {/* Feature List */}
          <div className="bg-gray-50 rounded-lg p-6 text-left max-w-2xl mx-auto">
            <h4 className="font-semibold text-gray-900 mb-3">Planned Features:</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Browse all videos with thumbnail previews and metadata</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Filter by band, category, event, year, and visibility status</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Edit video metadata: event name, year, tags, and descriptions</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Assign videos to categories (Fifth Quarter, Field Show, etc.)</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Link opponent bands for battle and rivalry videos</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Hide/unhide videos with moderation controls and reasons</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Bulk operations: categorize, tag, or hide multiple videos</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
