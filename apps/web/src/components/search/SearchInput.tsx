'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { getAutocomplete } from '@/lib/api/search';
import { AutocompleteResult } from '@/types/search';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = 'Search HBCU band videos...',
  autoFocus = false,
  className = '',
}: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const debouncedValue = useDebounce(value, 300);

  /**
   * Fetch autocomplete suggestions
   */
  useEffect(() => {
    const fetchSuggestions = async () => {
      // Don't fetch if query is too short
      if (!debouncedValue || debouncedValue.length < 2) {
        setSuggestions([]);
        return;
      }

      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      setIsLoadingSuggestions(true);

      try {
        const response = await getAutocomplete(
          debouncedValue,
          'all',
          abortControllerRef.current.signal
        );

        setSuggestions(response.suggestions);
        setShowAutocomplete(response.suggestions.length > 0 && isFocused);
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Autocomplete error:', error);
        }
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedValue, isFocused]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showAutocomplete || suggestions.length === 0) {
      if (e.key === 'Enter') {
        onSearch(value);
        setShowAutocomplete(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          const selected = suggestions[selectedIndex];
          onChange(selected.value);
          onSearch(selected.value);
        } else {
          onSearch(value);
        }
        setShowAutocomplete(false);
        setSelectedIndex(-1);
        break;

      case 'Escape':
        setShowAutocomplete(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showAutocomplete, suggestions, selectedIndex, value, onChange, onSearch]);

  /**
   * Handle suggestion click
   */
  const handleSuggestionClick = useCallback((suggestion: AutocompleteResult) => {
    onChange(suggestion.value);
    onSearch(suggestion.value);
    setShowAutocomplete(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  }, [onChange, onSearch]);

  /**
   * Handle clear button
   */
  const handleClear = useCallback(() => {
    onChange('');
    setSuggestions([]);
    setShowAutocomplete(false);
    inputRef.current?.focus();
  }, [onChange]);

  /**
   * Close autocomplete when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Get icon for suggestion type
   */
  const getSuggestionIcon = (type: AutocompleteResult['type']) => {
    switch (type) {
      case 'band':
        return '🎺';
      case 'event':
        return '📅';
      case 'category':
        return '🏷️';
      case 'location':
        return '📍';
      default:
        return '🔍';
    }
  };

  return (
    <div className={`relative w-full ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          {isLoadingSuggestions ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Search className="h-5 w-5" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) {
              setShowAutocomplete(true);
            }
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-12 pr-12 py-4 text-lg border-2 border-gray-200 rounded-xl 
                   focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100
                   transition-all duration-200"
          aria-label="Search videos"
          aria-autocomplete="list"
          aria-controls="autocomplete-list"
          aria-expanded={showAutocomplete}
        />

        {/* Clear button */}
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 
                     hover:text-gray-600 transition-colors p-1"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showAutocomplete && suggestions.length > 0 && (
        <div
          ref={autocompleteRef}
          id="autocomplete-list"
          role="listbox"
          className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl 
                   shadow-lg overflow-hidden animate-slide-down"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="option"
              aria-selected={selectedIndex === index}
              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 
                       transition-colors text-left ${
                selectedIndex === index ? 'bg-blue-50' : ''
              }`}
            >
              <span className="text-xl" aria-hidden="true">
                {suggestion.metadata?.logoUrl ? (
                  <img
                    src={suggestion.metadata.logoUrl}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  getSuggestionIcon(suggestion.type)
                )}
              </span>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {suggestion.value}
                </div>
                {suggestion.metadata?.count !== undefined && (
                  <div className="text-sm text-gray-500">
                    {suggestion.metadata.count.toLocaleString()} videos
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-400 capitalize">
                {suggestion.type}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}