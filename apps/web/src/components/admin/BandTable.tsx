'use client';

import { useState } from 'react';
import type { Band } from '@/types/api';
import BandLogo from '@/components/bands/BandLogo';
import { format } from 'date-fns';

interface BandTableProps {
  bands: Band[];
  onEdit: (band: Band) => void;
  onDelete: (band: Band) => void;
  onSync: (band: Band) => void;
  loading?: boolean;
}

export default function BandTable({
  bands,
  onEdit,
  onDelete,
  onSync,
  loading = false,
}: BandTableProps) {
  const [selectedBands, setSelectedBands] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const formatLocation = (city?: string | null, state?: string | null): string => {
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    return '-';
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedBands);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedBands(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedBands.size === bands.length) {
      setSelectedBands(new Set());
    } else {
      setSelectedBands(new Set(bands.map((b) => b.id)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (bands.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-16 h-16 text-gray-400 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No bands found</h3>
        <p className="text-gray-600">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedBands.size === bands.length && bands.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Band
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              School
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Location
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Conference
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Videos
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Sync
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {bands.map((band) => (
            <>
              <tr
                key={band.id}
                className={`hover:bg-gray-50 ${
                  expandedRows.has(band.id) ? 'bg-gray-50' : ''
                }`}
              >
                <td className="px-3 py-4">
                  <input
                    type="checkbox"
                    checked={selectedBands.has(band.id)}
                    onChange={() => toggleSelection(band.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <BandLogo
                      logoUrl={band.logoUrl}
                      bandName={band.name}
                      size="sm"
                      className="mr-3"
                    />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{band.name}</div>
                      {band.nickname && (
                        <div className="text-sm text-gray-500">{band.nickname}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{band.school}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {formatLocation(band.city, band.state)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{band.conference || '-'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {band._count?.videos ?? 0}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {band.lastSyncAt
                      ? format(new Date(band.lastSyncAt), 'MMM d, yyyy')
                      : 'Never'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        band.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {band.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {band.isFeatured && (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        Featured
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => toggleRow(band.id)}
                      className="text-gray-600 hover:text-gray-900"
                      title="Expand"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${
                          expandedRows.has(band.id) ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onSync(band)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Sync"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onEdit(band)}
                      className="text-primary-600 hover:text-primary-900"
                      title="Edit"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(band)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
              {expandedRows.has(band.id) && (
                <tr key={`${band.id}-details`}>
                  <td colSpan={9} className="px-6 py-4 bg-gray-50">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">Description:</span>
                        <p className="text-gray-600 mt-1">
                          {band.description || 'No description'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">YouTube Channel:</span>
                        <p className="text-gray-600 mt-1">
                          {band.youtubeChannelId || 'Not set'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Founded:</span>
                        <p className="text-gray-600 mt-1">
                          {band.foundedYear || band.founded || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Sync Status:</span>
                        <p className="text-gray-600 mt-1">
                          {band.syncStatus || 'PENDING'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>

      {/* Bulk Actions Bar */}
      {selectedBands.size > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border border-gray-200 px-6 py-3 flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">
            {selectedBands.size} selected
          </span>
          <button
            onClick={() => setSelectedBands(new Set())}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
