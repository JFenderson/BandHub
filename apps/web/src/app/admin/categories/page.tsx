/**
 * Admin Categories Management Page
 * 
 * This page will handle CRUD operations for video categories.
 * 
 * TODO - Future Implementation:
 * - List all categories with usage statistics
 * - Add new categories
 * - Edit category names, slugs, and descriptions
 * - Reorder categories (sort order)
 * - Delete unused categories
 * - View videos in each category
 * - Merge duplicate categories
 */

export default function AdminCategoriesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Categories</h2>
          <p className="text-gray-600 mt-1">
            Organize video categories for better content discovery
          </p>
        </div>
        <button
          type="button"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add New Category</span>
        </button>
      </div>

      {/* Placeholder Content */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Categories Management Interface
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This section will manage video categories like Fifth Quarter, Field Show, 
            Stand Battle, and more. Integration with the categories API is pending.
          </p>
          
          {/* Current Categories Preview */}
          <div className="bg-gray-50 rounded-lg p-6 text-left max-w-2xl mx-auto mb-6">
            <h4 className="font-semibold text-gray-900 mb-3">Example Categories:</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                'Fifth Quarter',
                'Field Show',
                'Stand Battle',
                'Parade',
                'Practice',
                'Concert Band',
              ].map((category) => (
                <div
                  key={category}
                  className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <span className="font-medium text-gray-900">{category}</span>
                  <span className="text-xs text-gray-500">-- videos</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Feature List */}
          <div className="bg-gray-50 rounded-lg p-6 text-left max-w-2xl mx-auto">
            <h4 className="font-semibold text-gray-900 mb-3">Planned Features:</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>View all categories with video counts</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Create new categories with name, slug, and description</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Edit existing category details</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Reorder categories with drag-and-drop or sort order field</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Delete or archive unused categories</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Merge duplicate or similar categories</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>View and manage videos within each category</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
