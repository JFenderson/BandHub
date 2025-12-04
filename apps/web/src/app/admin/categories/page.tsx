'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { Category, CreateCategoryDto, UpdateCategoryDto } from '@/types/api';
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

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
  show: boolean;
}

// Sortable Category Item Component
function SortableCategoryItem({
  category,
  onEdit,
  onDelete,
  onMerge,
}: {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onMerge: (category: Category) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between ${
        isDragging ? 'shadow-lg' : 'shadow-sm hover:shadow-md'
      } transition-shadow`}
    >
      <div className="flex items-center space-x-4">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>
        
        <div>
          <h4 className="font-semibold text-gray-900">{category.name}</h4>
          <p className="text-sm text-gray-500">
            {category.slug} • {category._count?.videos || 0} videos
          </p>
          {category.description && (
            <p className="text-sm text-gray-400 mt-1">{category.description}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-400 mr-2">Order: {category.sortOrder}</span>
        <button
          onClick={() => onEdit(category)}
          className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => onMerge(category)}
          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
          title="Merge into another"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(category.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ message: '', type: 'info', show: false });
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergingCategory, setMergingCategory] = useState<Category | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState<CreateCategoryDto>({
    name: '',
    slug: '',
    description: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', slug: '', description: '' });
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
    });
    setShowModal(true);
  };

  const openMergeModal = (category: Category) => {
    setMergingCategory(category);
    setTargetCategoryId('');
    setShowMergeModal(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      showToast('Please enter a category name', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        ...formData,
        slug: formData.slug || generateSlug(formData.name),
      };

      if (editingCategory) {
        await apiClient.updateCategory(editingCategory.id, dataToSave);
        showToast('Category updated successfully', 'success');
      } else {
        await apiClient.createCategory(dataToSave);
        showToast('Category created successfully', 'success');
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      console.error('Failed to save category:', err);
      showToast(err instanceof Error ? err.message : 'Failed to save category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategoryId) return;
    
    try {
      await apiClient.deleteCategory(deletingCategoryId);
      showToast('Category deleted successfully', 'success');
      setShowDeleteConfirm(false);
      setDeletingCategoryId(null);
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
      showToast(err instanceof Error ? err.message : 'Failed to delete category', 'error');
    }
  };

  const handleMerge = async () => {
    if (!mergingCategory || !targetCategoryId) {
      showToast('Please select a target category', 'error');
      return;
    }

    try {
      const result = await apiClient.mergeCategories(mergingCategory.id, targetCategoryId);
      showToast(`Merged "${result.deletedCategory}" into "${result.targetCategory}". ${result.videosMoved} videos moved.`, 'success');
      setShowMergeModal(false);
      setMergingCategory(null);
      setTargetCategoryId('');
      fetchCategories();
    } catch (err) {
      console.error('Failed to merge categories:', err);
      showToast(err instanceof Error ? err.message : 'Failed to merge categories', 'error');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(c => c.id === active.id);
      const newIndex = categories.findIndex(c => c.id === over.id);
      
      const reorderedCategories = arrayMove(categories, oldIndex, newIndex);
      setCategories(reorderedCategories);

      try {
        await apiClient.reorderCategories(reorderedCategories.map(c => c.id));
        showToast('Categories reordered successfully', 'success');
      } catch (err) {
        console.error('Failed to reorder categories:', err);
        showToast(err instanceof Error ? err.message : 'Failed to reorder categories', 'error');
        // Revert on error
        fetchCategories();
      }
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingCategoryId(id);
    setShowDeleteConfirm(true);
  };

  // Calculate total videos
  const totalVideos = categories.reduce((sum, cat) => sum + (cat._count?.videos || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Categories</h2>
          <p className="text-gray-600 mt-1">
            Organize video categories for better content discovery
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add New Category</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Categories</div>
          <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Videos</div>
          <div className="text-2xl font-bold text-gray-900">{totalVideos}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Avg Videos/Category</div>
          <div className="text-2xl font-bold text-gray-900">
            {categories.length > 0 ? Math.round(totalVideos / categories.length) : 0}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-900 font-medium">Drag and drop to reorder categories</p>
            <p className="text-sm text-blue-700">The order here determines how categories appear in the UI.</p>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && categories.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No categories found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first category.</p>
          <button
            onClick={openCreateModal}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Create Category
          </button>
        </div>
      )}

      {/* Categories List with Drag and Drop */}
      {!isLoading && categories.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={categories.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {categories.map(category => (
                <SortableCategoryItem
                  key={category.id}
                  category={category}
                  onEdit={openEditModal}
                  onDelete={confirmDelete}
                  onMerge={openMergeModal}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      name: e.target.value,
                      slug: formData.slug || generateSlug(e.target.value),
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., Fifth Quarter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., fifth-quarter"
                />
                <p className="text-xs text-gray-500 mt-1">URL-friendly identifier (auto-generated if empty)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Optional description..."
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Category</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this category? Videos in this category will become uncategorized.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingCategoryId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && mergingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Merge Categories</h3>
            <p className="text-gray-600 mb-4">
              Merge &quot;{mergingCategory.name}&quot; ({mergingCategory._count?.videos || 0} videos) into another category.
              All videos will be moved to the target category and &quot;{mergingCategory.name}&quot; will be deleted.
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Category
              </label>
              <select
                value={targetCategoryId}
                onChange={(e) => setTargetCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select a category...</option>
                {categories
                  .filter(c => c.id !== mergingCategory.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c._count?.videos || 0} videos)
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMergeModal(false);
                  setMergingCategory(null);
                  setTargetCategoryId('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={!targetCategoryId}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
            toast.type === 'success' ? 'bg-green-600 text-white' :
            toast.type === 'error' ? 'bg-red-600 text-white' :
            'bg-blue-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
