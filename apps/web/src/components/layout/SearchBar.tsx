'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // "/" key to focus search (when not in an input)
      if (
        event.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        event.preventDefault();
        const searchInput = document.getElementById('header-search-input');
        searchInput?.focus();
      }
      // Cmd/Ctrl + K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.getElementById('header-search-input');
        searchInput?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    startTransition(() => {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="relative" role="search" aria-label="Site search">
      <label htmlFor="header-search-input" className="sr-only">
        Search bands and videos
      </label>
      <input
        id="header-search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bands and videos..."
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-describedby="search-shortcut-hint"
      />
      <button
        type="submit"
        disabled={isPending}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600 disabled:opacity-50"
        aria-label={isPending ? 'Searching...' : 'Submit search'}
      >
        {isPending ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" aria-hidden="true" />
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        )}
      </button>
      {/* Keyboard shortcut hint */}
      <span id="search-shortcut-hint" className="absolute right-10 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 text-xs text-gray-400">
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-500" aria-label="Press forward slash to focus search">/</kbd>
      </span>
    </form>
  );
}