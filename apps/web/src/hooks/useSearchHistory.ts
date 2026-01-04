'use client';

import { VideoSearchQuery } from '@/types/search';
import { useState, useEffect, useCallback } from 'react';
import { SearchHistoryItem } from '@/types/search';

const STORAGE_KEY = 'hbcu_search_history';
const MAX_HISTORY_ITEMS = 10;


export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        setHistory(parsed);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    } finally {
      setIsLoaded(true);
    }
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

  // FIX: Added default values for filters and resultCount
  const addSearch = useCallback((
    query: string,
    filters: VideoSearchQuery = {}, 
    resultCount: number = 0
  ) => {
    const newItem: SearchHistoryItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query,
      filters,
      timestamp: Date.now(),
      resultCount,
    };

    setHistory(prev => {
      // Remove duplicate searches (same query and filters)
      const filtered = prev.filter(item => 
        item.query !== query || 
        JSON.stringify(item.filters) !== JSON.stringify(filters)
      );

      // Add new item at the beginning
      const updated = [newItem, ...filtered];

      // Keep only the most recent items
      return updated.slice(0, MAX_HISTORY_ITEMS);
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

    /**
   * Get a specific search by ID
   */
  const getSearch = useCallback((id: string): SearchHistoryItem | undefined => {
    return history.find(item => item.id === id);
  }, [history]);

  return {
    history,
    isLoaded,
    addSearch,
    removeSearch,
    clearHistory,
    getSearch,
  };
}
