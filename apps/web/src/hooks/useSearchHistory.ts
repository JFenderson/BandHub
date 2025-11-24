'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'hbcu-search-history';
const MAX_HISTORY_ITEMS = 5;

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
      } catch (error) {
        console.error('Failed to save search history:', error);
      }
    }
  }, [history, isLoaded]);

  const addSearch = useCallback((query: string) => {
    if (!query || query.trim().length === 0) return;

    const trimmedQuery = query.trim();

    setHistory((prev) => {
      // Remove any existing entry with the same query
      const filtered = prev.filter(
        (item) => item.query.toLowerCase() !== trimmedQuery.toLowerCase()
      );

      // Add new entry at the beginning
      const newHistory = [
        { query: trimmedQuery, timestamp: Date.now() },
        ...filtered,
      ].slice(0, MAX_HISTORY_ITEMS);

      return newHistory;
    });
  }, []);

  const removeSearch = useCallback((query: string) => {
    setHistory((prev) =>
      prev.filter((item) => item.query.toLowerCase() !== query.toLowerCase())
    );
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    history,
    addSearch,
    removeSearch,
    clearHistory,
    isLoaded,
  };
}
