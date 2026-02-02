'use client';

export type ViewMode = 'grid' | 'list' | 'compact';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ currentView, onViewChange, className = '' }: ViewToggleProps) {
  return (
    <div className={`inline-flex rounded-lg border border-gray-200 ${className}`} role="group" aria-label="View options">
      <button
        onClick={() => onViewChange('grid')}
        className={`px-3 py-2 flex items-center gap-2 text-sm font-medium rounded-l-lg transition-colors ${
          currentView === 'grid'
            ? 'bg-primary-600 text-white'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
        title="Grid view"
        aria-label="Grid view"
        aria-pressed={currentView === 'grid'}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        onClick={() => onViewChange('list')}
        className={`px-3 py-2 flex items-center gap-2 text-sm font-medium border-x border-gray-200 transition-colors ${
          currentView === 'list'
            ? 'bg-primary-600 text-white border-primary-600'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
        title="List view"
        aria-label="List view"
        aria-pressed={currentView === 'list'}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
        <span className="hidden sm:inline">List</span>
      </button>
      <button
        onClick={() => onViewChange('compact')}
        className={`px-3 py-2 flex items-center gap-2 text-sm font-medium rounded-r-lg transition-colors ${
          currentView === 'compact'
            ? 'bg-primary-600 text-white'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
        title="Compact view"
        aria-label="Compact view"
        aria-pressed={currentView === 'compact'}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
        <span className="hidden sm:inline">Compact</span>
      </button>
    </div>
  );
}
