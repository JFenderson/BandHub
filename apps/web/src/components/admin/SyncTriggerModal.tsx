'use client';

import React, { useState, useEffect } from 'react';

interface SyncTriggerModalProps {
  apiUrl: string;
  getAuthToken: () => string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface Band {
  id: string;
  name: string;
}

export function SyncTriggerModal({ apiUrl, getAuthToken, onClose, onSuccess }: SyncTriggerModalProps) {
  const [bands, setBands] = useState<Band[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string>('');
  const [syncType, setSyncType] = useState<'INCREMENTAL' | 'FULL'>('INCREMENTAL');
  const [forceSync, setForceSync] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingBands, setLoadingBands] = useState(true);

  useEffect(() => {
    fetchBands();
  }, []);

  const fetchBands = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`${apiUrl}/api/bands`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBands(data.data || data);
      }
    } catch (err) {
      console.error('Error fetching bands:', err);
    } finally {
      setLoadingBands(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = getAuthToken();
      if (!token) {
        alert('Not authenticated');
        return;
      }

      const response = await fetch(`${apiUrl}/api/admin/sync-jobs/trigger`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bandId: selectedBandId || undefined,
          syncType,
          forceSync,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to trigger sync');
      }

      const data = await response.json();
      alert(`Sync job queued successfully! Job ID: ${data.jobId}`);
      onSuccess();
    } catch (err) {
      console.error('Error triggering sync:', err);
      alert('Failed to trigger sync job');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">Trigger Sync Job</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Band Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Band
            </label>
            {loadingBands ? (
              <div className="text-sm text-gray-500">Loading bands...</div>
            ) : (
              <select
                value={selectedBandId}
                onChange={(e) => setSelectedBandId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Bands</option>
                {bands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.name}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Leave empty to sync all bands
            </p>
          </div>

          {/* Sync Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sync Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="INCREMENTAL"
                  checked={syncType === 'INCREMENTAL'}
                  onChange={(e) => setSyncType(e.target.value as 'INCREMENTAL' | 'FULL')}
                  className="mr-2"
                />
                <div>
                  <div className="font-medium">Incremental Sync</div>
                  <div className="text-sm text-gray-500">Only sync new videos since last sync</div>
                </div>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="FULL"
                  checked={syncType === 'FULL'}
                  onChange={(e) => setSyncType(e.target.value as 'INCREMENTAL' | 'FULL')}
                  className="mr-2"
                />
                <div>
                  <div className="font-medium">Full Sync</div>
                  <div className="text-sm text-gray-500">Sync all videos from the beginning</div>
                </div>
              </label>
            </div>
          </div>

          {/* Force Sync */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={forceSync}
                onChange={(e) => setForceSync(e.target.checked)}
                className="mr-2"
              />
              <div>
                <div className="font-medium text-sm">Force Sync</div>
                <div className="text-sm text-gray-500">Ignore last sync time and sync anyway</div>
              </div>
            </label>
          </div>

          {/* Estimated Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Estimated Impact</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Time: {syncType === 'FULL' ? '5-30 minutes' : '1-5 minutes'}</li>
              <li>• API Quota: {syncType === 'FULL' ? 'High usage' : 'Moderate usage'}</li>
              <li>• Scope: {selectedBandId ? '1 band' : 'All active bands'}</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Triggering...</span>
                </>
              ) : (
                <span>Trigger Sync</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
