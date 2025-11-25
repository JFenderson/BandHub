'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { apiClient } from '@/lib/api-client';
import type { Band } from '@/types/api';
import { format } from 'date-fns';

interface FeaturedBand extends Band {
  featuredOrder?: number | null;
  featuredSince?: string | null;
}

interface SortableBandItemProps {
  band: FeaturedBand;
  onUnfeature: (id: string) => void;
  hasQualityWarning: boolean;
  warningReason?: string;
}

function SortableBandItem({ band, onUnfeature, hasQualityWarning, warningReason }: SortableBandItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: band.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-4 flex items-center gap-4 ${
        isDragging ? 'shadow-lg ring-2 ring-primary-500' : 'shadow-sm'
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2 text-gray-400 hover:text-gray-600 focus:outline-none"
        aria-label="Drag to reorder"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Order Number */}
      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
        {band.featuredOrder}
      </div>

      {/* Band Logo */}
      <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 relative">
        {band.logoUrl ? (
          <img 
            src={band.logoUrl} 
            alt={band.name} 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
            {band.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Band Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-gray-900 truncate">{band.name}</h4>
          {hasQualityWarning && (
            <span
              className="text-yellow-500 cursor-help"
              title={warningReason}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">{band.school}</p>
        <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
          <span>{band._count?.videos || 0} videos</span>
          {band.featuredSince && (
            <span>Featured since {format(new Date(band.featuredSince), 'MMM d, yyyy')}</span>
          )}
        </div>
      </div>

      {/* Unfeature Button */}
      <button
        onClick={() => onUnfeature(band.id)}
        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove from featured"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function FeaturedBandManager() {
  const [featuredBands, setFeaturedBands] = useState<FeaturedBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchFeaturedBands();
  }, []);

  const fetchFeaturedBands = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getFeaturedBands();
      setFeaturedBands(response.bands || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load featured bands');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFeaturedBands((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        // Update featuredOrder
        return newItems.map((item, index) => ({
          ...item,
          featuredOrder: index + 1,
        }));
      });
      setHasChanges(true);
    }
  };

  const handleUnfeature = async (bandId: string) => {
    try {
      await apiClient.toggleBandFeatured(bandId);
      setFeaturedBands((bands) => bands.filter((b) => b.id !== bandId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unfeature band');
    }
  };

  const handleSaveOrder = async () => {
    try {
      setSaving(true);
      await apiClient.updateFeaturedOrder(
        featuredBands.map((band) => ({
          id: band.id,
          featuredOrder: band.featuredOrder || 0,
        }))
      );
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const getQualityWarning = (band: FeaturedBand): { hasWarning: boolean; reason?: string } => {
    const videoCount = band._count?.videos || 0;
    const lastSync = band.lastSyncAt ? new Date(band.lastSyncAt) : null;
    const daysSinceSync = lastSync
      ? Math.floor((Date.now() - lastSync.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    if (videoCount === 0) {
      return { hasWarning: true, reason: 'No videos in database' };
    }
    if (daysSinceSync !== null && daysSinceSync > 30) {
      return { hasWarning: true, reason: `No sync in ${daysSinceSync} days` };
    }

    return { hasWarning: false };
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Featured Bands</h3>
            <p className="text-sm text-gray-500">
              Drag and drop to reorder. Maximum 8 featured bands.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {featuredBands.length}/8 featured
            </span>
            {hasChanges && (
              <button
                onClick={handleSaveOrder}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Order'
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Featured Bands List */}
      <div className="p-6">
        {featuredBands.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <p className="text-gray-500">No featured bands yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Use the toggle in the bands table to feature bands.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={featuredBands.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {featuredBands.map((band) => {
                  const warning = getQualityWarning(band);
                  return (
                    <SortableBandItem
                      key={band.id}
                      band={band}
                      onUnfeature={handleUnfeature}
                      hasQualityWarning={warning.hasWarning}
                      warningReason={warning.reason}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
