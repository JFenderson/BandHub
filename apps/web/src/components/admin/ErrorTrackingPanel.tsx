'use client';

import React, { useState, useEffect } from 'react';

interface ErrorTrackingPanelProps {
  apiUrl: string;
  getAuthToken: () => string | null;
}

interface ErrorStat {
  errorMessage: string;
  count: number;
  affectedBands: string[];
  lastOccurred: string;
}

export function ErrorTrackingPanel({ apiUrl, getAuthToken }: ErrorTrackingPanelProps) {
  const [errors, setErrors] = useState<ErrorStat[]>([]);
  const [totalErrors, setTotalErrors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchErrors = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/api/admin/sync/errors`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch errors');
      }

      const data = await response.json();
      setErrors(data.errors);
      setTotalErrors(data.totalErrors);
    } catch (err) {
      console.error('Error fetching error stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
    const interval = setInterval(fetchErrors, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (errors.length === 0) {
    return null; // Don't show panel if no errors
  }

  const displayedErrors = expanded ? errors : errors.slice(0, 3);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recent Errors</h3>
            <p className="text-sm text-gray-500">{totalErrors} total errors from sync jobs</p>
          </div>
        </div>
        {errors.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {expanded ? 'Show Less' : `Show All (${errors.length})`}
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-200">
        {displayedErrors.map((error, index) => (
          <div key={index} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{error.errorMessage}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {error.affectedBands.slice(0, 3).map((band, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {band}
                    </span>
                  ))}
                  {error.affectedBands.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      +{error.affectedBands.length - 3} more
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Last occurred: {new Date(error.lastOccurred).toLocaleString()}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  {error.count} {error.count === 1 ? 'occurrence' : 'occurrences'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
