/**
 * Admin Events Management Page
 * 
 * This page will handle CRUD operations for events.
 * 
 * TODO - Future Implementation:
 * - List all events with timeline view
 * - Add new events (Bayou Classic, SWAC Championship, etc.)
 * - Edit event details and dates
 * - Associate videos with events
 * - Manage event metadata and participants
 * - Calendar view of events
 * 
 * Note: Events are not yet fully defined in the Prisma schema.
 * Consider creating an Event model with fields like:
 * - name, slug, description
 * - eventDate, location, venue
 * - participating bands
 * - event type (Classic, Championship, Homecoming, etc.)
 */

export default function AdminEventsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Events</h2>
          <p className="text-gray-600 mt-1">
            Create and manage HBCU band events and competitions
          </p>
        </div>
        <button
          type="button"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add New Event</span>
        </button>
      </div>

      {/* Placeholder Content */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Events Management Interface
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            This section will manage major HBCU band events like the Bayou Classic, 
            SWAC Championship, and other competitions. Event model integration is pending.
          </p>
          
          {/* Feature List */}
          <div className="bg-gray-50 rounded-lg p-6 text-left max-w-2xl mx-auto">
            <h4 className="font-semibold text-gray-900 mb-3">Planned Features:</h4>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>View all events in calendar and list views</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Create events with name, date, location, and description</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Link participating bands to events</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Associate videos with specific events</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Categorize events by type (Classic, Championship, Homecoming, etc.)</span>
              </li>
              <li className="flex items-start">
                <svg className="w-5 h-5 text-primary-500 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Track event metadata: venue, attendance, weather, etc.</span>
              </li>
            </ul>
            
            {/* Schema Note */}
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 font-medium mb-1">Database Schema Note</p>
              <p className="text-xs text-blue-800">
                An Event model needs to be added to the Prisma schema to fully implement this feature.
                Consider adding relationships to Band and Video models.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
