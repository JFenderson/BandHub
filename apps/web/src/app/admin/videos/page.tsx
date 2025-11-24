'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { VideoDetail, AdminVideoFilters } from '@/types/api';
import { VideoModerationTable } from '@/components/admin/VideoModerationTable';
import { VideoDetailModal } from '@/components/admin/VideoDetailModal';
import { BulkActionsBar } from '@/components/admin/BulkActionsBar';

type TabType = 'all' | 'pending' | 'hidden';

export default function AdminVideosPage() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [videos, setVideos] = useState<VideoDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<AdminVideoFilters>({
    page: 1,
    limit: 20,
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  });

  // Filter inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBandId, setSelectedBandId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Data for dropdowns
  const [bands, setBands] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  // Selection state
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoDetail | null>(null);

  // Fetch bands and categories
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [bandsData, categoriesData] = await Promise.all([
          apiClient.getBands({ limit: 100 }),
          apiClient.getCategories(),
        ]);
        setBands(
          bandsData.data.map((b: any) => ({ id: b.id, name: b.name }))
        );
        setCategories(
          categoriesData.map((c: any) => ({ id: c.id, name: c.name }))
        );
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filterParams: AdminVideoFilters = { ...filters };

      // Apply tab-specific filters
      if (activeTab === 'pending') {
        filterParams.categorizationStatus = 'uncategorized';
      } else if (activeTab === 'hidden') {
        filterParams.hiddenStatus = 'hidden';
      }

      const response = await apiClient.getAdminVideos(filterParams);
      setVideos(response.data);
      setTotal(response.total);
      setPage(response.page);
      setTotalPages(response.totalPages);
    } catch (err) {
      console.error('Failed to fetch videos:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch videos');
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeTab]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    setFilters((prev) => ({ ...prev, page: 1 }));
    setSelectedVideoIds(new Set());
  };

  // Handle filter changes
  const applyFilters = () => {
    const newFilters: AdminVideoFilters = {
      page: 1,
      limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };

    if (searchQuery) newFilters.search = searchQuery;
    if (selectedBandId) newFilters.bandId = selectedBandId;
    if (selectedCategoryId) newFilters.categoryId = selectedCategoryId;
    if (selectedYear) newFilters.eventYear = parseInt(selectedYear, 10);
    if (dateFrom) newFilters.dateFrom = dateFrom;
    if (dateTo) newFilters.dateTo = dateTo;

    setFilters(newFilters);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedBandId('');
    setSelectedCategoryId('');
    setSelectedYear('');
    setDateFrom('');
    setDateTo('');
    setFilters({
      page: 1,
      limit,
      sortBy: 'publishedAt',
      sortOrder: 'desc',
    });
  };

  // Handle sorting
  const handleSortChange = (sortBy: string) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: sortBy as any,
      page: 1,
    }));
    setPage(1);
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    setPage(newPage);
  };

  // Selection handlers
  const handleSelectVideo = (videoId: string) => {
    setSelectedVideoIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedVideoIds(new Set(videos.map((v) => v.id)));
  };

  const handleDeselectAll = () => {
    setSelectedVideoIds(new Set());
  };

  // Video modal handlers
  const handleVideoClick = (video: VideoDetail) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleSaveVideo = async (
    videoId: string,
    updates: any
  ) => {
    try {
      await apiClient.updateAdminVideo(videoId, updates);
      // Refresh videos
      await fetchVideos();
      setIsModalOpen(false);
      setSelectedVideo(null);
    } catch (err) {
      console.error('Failed to update video:', err);
      alert(err instanceof Error ? err.message : 'Failed to update video');
    }
  };

  // Bulk action handlers
  const handleBulkCategorize = async () => {
    const categoryId = prompt('Enter category ID to assign:');
    if (!categoryId) return;

    try {
      await apiClient.bulkUpdateVideos({
        videoIds: Array.from(selectedVideoIds),
        action: 'categorize',
        categoryId,
      });
      await fetchVideos();
      setSelectedVideoIds(new Set());
      alert('Videos categorized successfully');
    } catch (err) {
      console.error('Failed to categorize videos:', err);
      alert(err instanceof Error ? err.message : 'Failed to categorize videos');
    }
  };

  const handleBulkHide = async () => {
    const reason = prompt('Enter reason for hiding videos:');
    if (!reason) return;

    try {
      await apiClient.bulkUpdateVideos({
        videoIds: Array.from(selectedVideoIds),
        action: 'hide',
        hideReason: reason,
      });
      await fetchVideos();
      setSelectedVideoIds(new Set());
      alert('Videos hidden successfully');
    } catch (err) {
      console.error('Failed to hide videos:', err);
      alert(err instanceof Error ? err.message : 'Failed to hide videos');
    }
  };

  const handleBulkUnhide = async () => {
    if (!confirm(`Unhide ${selectedVideoIds.size} videos?`)) return;

    try {
      await apiClient.bulkUpdateVideos({
        videoIds: Array.from(selectedVideoIds),
        action: 'unhide',
      });
      await fetchVideos();
      setSelectedVideoIds(new Set());
      alert('Videos unhidden successfully');
    } catch (err) {
      console.error('Failed to unhide videos:', err);
      alert(err instanceof Error ? err.message : 'Failed to unhide videos');
    }
  };

  const handleBulkDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedVideoIds.size} videos? This cannot be undone.`
      )
    )
      return;

    try {
      await apiClient.bulkUpdateVideos({
        videoIds: Array.from(selectedVideoIds),
        action: 'delete',
      });
      await fetchVideos();
      setSelectedVideoIds(new Set());
      alert('Videos deleted successfully');
    } catch (err) {
      console.error('Failed to delete videos:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete videos');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Video Moderation</h2>
          <p className="text-gray-600 mt-1">
            Manage and moderate band performance videos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => handleTabChange('all')}
            className={`${
              activeTab === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            All Videos
            {activeTab === 'all' && total > 0 && (
              <span className="ml-2 py-0.5 px-2 rounded-full bg-primary-100 text-primary-600 text-xs">
                {total}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('pending')}
            className={`${
              activeTab === 'pending'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Pending Review
            {activeTab === 'pending' && total > 0 && (
              <span className="ml-2 py-0.5 px-2 rounded-full bg-yellow-100 text-yellow-800 text-xs">
                {total}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('hidden')}
            className={`${
              activeTab === 'hidden'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Hidden
            {activeTab === 'hidden' && total > 0 && (
              <span className="ml-2 py-0.5 px-2 rounded-full bg-red-100 text-red-800 text-xs">
                {total}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Band Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Band
            </label>
            <select
              value={selectedBandId}
              onChange={(e) => setSelectedBandId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Bands</option>
              {bands.map((band) => (
                <option key={band.id} value={band.id}>
                  {band.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Event Year
            </label>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              placeholder="e.g., 2024"
              min="1990"
              max={new Date().getFullYear() + 1}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={filters.sortBy || 'publishedAt'}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="publishedAt">Published Date</option>
              <option value="createdAt">Added Date</option>
              <option value="viewCount">View Count</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={clearFilters}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Clear filters
          </button>
          <button
            onClick={applyFilters}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Videos Table */}
      <VideoModerationTable
        videos={videos}
        selectedIds={selectedVideoIds}
        onSelectVideo={handleSelectVideo}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onVideoClick={handleVideoClick}
        isLoading={isLoading}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow px-6 py-4">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of{' '}
            {total} videos
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {[...Array(Math.min(totalPages, 5))].map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-1 border rounded ${
                    page === pageNum
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedVideoIds.size}
        onClearSelection={handleDeselectAll}
        onCategorize={handleBulkCategorize}
        onHide={handleBulkHide}
        onUnhide={handleBulkUnhide}
        onDelete={handleBulkDelete}
      />

      {/* Video Detail Modal */}
      <VideoDetailModal
        isOpen={isModalOpen}
        video={selectedVideo}
        bands={bands}
        categories={categories}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVideo(null);
        }}
        onSave={handleSaveVideo}
      />
    </div>
  );
}
