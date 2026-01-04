'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchHistory } from '@/hooks/useSearchHistory';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Suggestion {
  type: 'band' | 'video' | 'event';
  text: string;
  slug?: string;
  id?: string;
}

interface AdvancedSearchBarProps {
  initialQuery?: string;
  onSearch?: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showVoiceSearch?: boolean;
  className?: string;
}

export function AdvancedSearchBar({
  initialQuery = '',
  onSearch,
  placeholder = 'Search videos, bands, events...',
  autoFocus = false,
  showVoiceSearch = true,
  className = '',
}: AdvancedSearchBarProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isListening, setIsListening] = useState(false);
  
  const { history, addSearch, removeSearch } = useSearchHistory();

  // Fetch suggestions when query changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (query.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/search/suggestions?q=${encodeURIComponent(query)}&limit=8`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard shortcuts globally
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // "/" key to focus search (when not in an input)
      if (
        event.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      // Cmd/Ctrl + K to focus search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;

      addSearch(query.trim());
      setShowDropdown(false);

      if (onSearch) {
        onSearch(query.trim());
      } else {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    },
    [query, addSearch, onSearch, router]
  );

  const handleSuggestionClick = (suggestion: Suggestion) => {
    if (suggestion.type === 'band' && suggestion.slug) {
      router.push(`/bands/${suggestion.slug}`);
    } else if (suggestion.type === 'video' && suggestion.id) {
      router.push(`/videos/${suggestion.id}`);
    } else {
      setQuery(suggestion.text);
      addSearch(suggestion.text);
      setShowDropdown(false);
      if (onSearch) {
        onSearch(suggestion.text);
      } else {
        router.push(`/search?q=${encodeURIComponent(suggestion.text)}`);
      }
    }
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    addSearch(historyQuery);
    setShowDropdown(false);
    if (onSearch) {
      onSearch(historyQuery);
    } else {
      router.push(`/search?q=${encodeURIComponent(historyQuery)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = [...history.slice(0, 3), ...suggestions];
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      if (selectedIndex < history.slice(0, 3).length) {
        handleHistoryClick(history[selectedIndex].query);
      } else {
        handleSuggestionClick(suggestions[selectedIndex - history.slice(0, 3).length]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const handleVoiceSearch = useCallback(() => {
    // Check for browser support
    const SpeechRecognitionAPI = 
      (window as Window & { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown })
        .webkitSpeechRecognition ||
      (window as Window & { SpeechRecognition?: unknown }).SpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      alert('Voice search is not supported in your browser');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognitionAPI as any)();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsListening(false);
      
      // Auto-submit after voice input
      setTimeout(() => {
        addSearch(transcript);
        if (onSearch) {
          onSearch(transcript);
        } else {
          router.push(`/search?q=${encodeURIComponent(transcript)}`);
        }
      }, 500);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [addSearch, onSearch, router]);

  const clearSearch = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        {/* Search Icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-gray-300 bg-white pl-12 pr-24 py-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
        />

        {/* Right side buttons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {/* Loading indicator */}
          {isLoading && (
            <div className="w-5 h-5 border-2 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
          )}

          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Voice search button */}
          {showVoiceSearch && (
            <button
              type="button"
              onClick={handleVoiceSearch}
              className={`p-1 ${isListening ? 'text-primary-600 animate-pulse' : 'text-gray-400 hover:text-gray-600'}`}
              title="Voice search"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>
          )}

          {/* Search button */}
          <button
            type="submit"
            className="px-4 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Keyboard shortcut hint */}
      <div className="absolute right-48 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 text-xs text-gray-400">
        <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded text-gray-500">/</kbd>
      </div>

      {/* Dropdown */}
      {showDropdown && (query.length > 0 || history.length > 0) && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg z-50 overflow-hidden max-h-96 overflow-y-auto"
        >
          {/* Recent Searches */}
          {history.length > 0 && query.length === 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                Recent Searches
              </div>
              {history.slice(0, 3).map((item, index) => (
                <div
                  key={item.query}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer rounded-lg ${
                    selectedIndex === index ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleHistoryClick(item.query)}
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-700">{item.query}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSearch(item.query);
                    }}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2 border-t border-gray-100">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => {
                const adjustedIndex = history.length > 0 && query.length === 0 
                  ? index + Math.min(history.length, 3) 
                  : index;
                return (
                  <div
                    key={`${suggestion.type}-${suggestion.text}`}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg ${
                      selectedIndex === adjustedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion.type === 'band' && (
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                        Band
                      </span>
                    )}
                    {suggestion.type === 'video' && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        Video
                      </span>
                    )}
                    {suggestion.type === 'event' && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                        Event
                      </span>
                    )}
                    <span className="text-gray-700">{suggestion.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* No suggestions */}
          {query.length >= 2 && suggestions.length === 0 && !isLoading && (
            <div className="p-4 text-center text-gray-500">
              No suggestions found. Press Enter to search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
