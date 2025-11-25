'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Band } from '@/types/api';
import type { CreateBandDto, UpdateBandDto } from '@hbcu-band-hub/shared-types';
import BandFormModal from '@/components/admin/BandFormModal';
import BandTable from '@/components/admin/BandTable';
import SyncProgressModal from '@/components/admin/SyncProgressModal';
import FeaturedBandManager from '@/components/admin/FeaturedBandManager';
import FeaturedBandAnalytics from '@/components/admin/FeaturedBandAnalytics';
import FeaturedRecommendations from '@/components/admin/FeaturedRecommendations';

export default function AdminBandsPage() {
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBand, setEditingBand] = useState<Band | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [conferenceFilter, setConferenceFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBands, setTotalBands] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'featured' | 'analytics' | 'recommendations'>('all');
  
  // Sync modal state
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncJobId, setSyncJobId] = useState<string | null>(null);
  const [syncBandName, setSyncBandName] = useState<string>('');

  const fetchBands = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiClient.getBands({
        search: searchQuery || undefined,
        state: stateFilter || undefined,
        page: currentPage,
        limit: 20,
      });
      setBands(response.data);
      setTotalPages(response.meta.totalPages);
      setTotalBands(response.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bands');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, stateFilter]);

  useEffect(() => {
    fetchBands();
  }, [fetchBands]);

  const handleAddBand = () => {
    setEditingBand(null);
    setIsModalOpen(true);
  };

  const handleEditBand = (band: Band) => {
    setEditingBand(band);
    setIsModalOpen(true);
  };

  const handleSubmit = async (
    data: CreateBandDto | UpdateBandDto,
    logoFile?: File | null,
    bannerFile?: File | null
  ) => {
    try {
      setIsSubmitting(true);
      let savedBand: Band;

      if (editingBand) {
        // Update existing band
        savedBand = await apiClient.updateBand(editingBand.id, data as UpdateBandDto);
      } else {
        // Create new band
        savedBand = await apiClient.createBand(data as CreateBandDto);
      }

      // Upload logo if provided
      if (logoFile) {
        await apiClient.uploadBandLogo(savedBand.id, logoFile);
      }

      // Upload banner if provided
      if (bannerFile) {
        await apiClient.uploadBandBanner(savedBand.id, bannerFile);
      }

      // Refresh the list
      await fetchBands();
      setIsModalOpen(false);
      setEditingBand(null);
    } catch (err) {
      throw err; // Let the modal handle the error display
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBand = async (band: Band) => {
    if (!confirm(`Are you sure you want to delete "${band.name}"?`)) {
      return;
    }

    try {
      await apiClient.deleteBand(band.id);
      await fetchBands();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete band');
    }
  };

  const handleSyncBand = async (band: Band) => {
    try {
      const response = await apiClient.triggerBandSync(band.id);
      setSyncJobId(response.jobId);
      setSyncBandName(band.name);
      setIsSyncModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sync');
    }
  };

  const handleCloseSyncModal = () => {
    setIsSyncModalOpen(false);
    setSyncJobId(null);
    setSyncBandName('');
    // Refresh bands to get updated video counts
    fetchBands();
  };

  const handleExportCSV = () => {
    const csv = [
      ['Name', 'School', 'City', 'State', 'Conference', 'Founded', 'YouTube Channel', 'Videos', 'Active', 'Featured'].join(','),
      ...bands.map(band =>
        [
          `"${band.name}"`,
          `"${band.school}"`,
          `"${band.city || ''}"`,
          `"${band.state || ''}"`,
          `"${band.conference || ''}"`,
          band.foundedYear || band.founded || '',
          `"${band.youtubeChannelId || ''}"`,
          band._count?.videos || 0,
          band.isActive ? 'Yes' : 'No',
          band.isFeatured ? 'Yes' : 'No',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bands-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleFeatured = async (band: Band) => {
    try {
      await apiClient.toggleBandFeatured(band.id);
      await fetchBands();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle featured status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Bands</h2>
          <p className="text-gray-600 mt-1">
            {totalBands} {totalBands === 1 ? 'band' : 'bands'} total
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="bg-white text-gray-700 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleAddBand}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Band</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Bands
          </button>
          <button
            onClick={() => setActiveTab('featured')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'featured'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Featured Bands
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </button>
          <button
            onClick={() => setActiveTab('recommendations')}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'recommendations'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Recommendations
          </button>
        </nav>
      </div>

      {activeTab === 'featured' ? (
        <FeaturedBandManager />
      ) : activeTab === 'analytics' ? (
        <FeaturedBandAnalytics />
      ) : activeTab === 'recommendations' ? (
        <FeaturedRecommendations />
      ) : (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  id="search"
                  type="text"
                  placeholder="Search by name or school..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
              State
            </label>
            <select
              id="state"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All States</option>
              <option value="AL">Alabama</option>
              <option value="FL">Florida</option>
              <option value="GA">Georgia</option>
              <option value="MS">Mississippi</option>
              <option value="NC">North Carolina</option>
              <option value="SC">South Carolina</option>
              <option value="TN">Tennessee</option>
              <option value="TX">Texas</option>
              <option value="VA">Virginia</option>
            </select>
          </div>
          <div>
            <label htmlFor="conference" className="block text-sm font-medium text-gray-700 mb-1">
              Conference
            </label>
            <select
              id="conference"
              value={conferenceFilter}
              onChange={(e) => {
                setConferenceFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Conferences</option>
              <option value="SWAC">SWAC</option>
              <option value="MEAC">MEAC</option>
              <option value="SIAC">SIAC</option>
              <option value="CIAA">CIAA</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Bands Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <BandTable
          bands={bands}
          onEdit={handleEditBand}
          onDelete={handleDeleteBand}
          onSync={handleSyncBand}
          loading={loading}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <BandFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBand(null);
        }}
        onSubmit={handleSubmit}
        band={editingBand}
        isLoading={isSubmitting}
      />

      <SyncProgressModal
        isOpen={isSyncModalOpen}
        onClose={handleCloseSyncModal}
        jobId={syncJobId}
        bandName={syncBandName}
      />
        </>
      )}
    </div>
  );
}
