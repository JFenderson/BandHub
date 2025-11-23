'use client';

import { useState, useEffect } from 'react';
import type { Band } from '@/types/api';
import type { CreateBandDto, UpdateBandDto } from '@hbcu-band-hub/shared-types';
import LogoUpload from './LogoUpload';

interface BandFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBandDto | UpdateBandDto, logoFile?: File | null) => Promise<void>;
  band?: Band | null;
  isLoading?: boolean;
}

export default function BandFormModal({
  isOpen,
  onClose,
  onSubmit,
  band,
  isLoading = false,
}: BandFormModalProps) {
  const [formData, setFormData] = useState<CreateBandDto>({
    name: '',
    school: '',
    nickname: '',
    city: '',
    state: '',
    conference: '',
    division: '',
    founded: undefined,
    colors: '',
    website: '',
    isActive: true,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (band) {
      setFormData({
        name: band.name,
        school: band.school,
        nickname: band.nickname || '',
        city: band.city || '',
        state: band.state || '',
        conference: band.conference || '',
        division: band.division || '',
        founded: band.founded || undefined,
        colors: band.colors || '',
        website: band.website || '',
        isActive: band.isActive,
      });
    } else {
      // Reset form for new band
      setFormData({
        name: '',
        school: '',
        nickname: '',
        city: '',
        state: '',
        conference: '',
        division: '',
        founded: undefined,
        colors: '',
        website: '',
        isActive: true,
      });
    }
    setLogoFile(null);
    setError('');
  }, [band, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name || !formData.school) {
      setError('Band name and school are required');
      return;
    }

    try {
      await onSubmit(formData, logoFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save band');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let parsedValue: string | number | undefined = value;
    if (type === 'number') {
      parsedValue = value ? parseInt(value, 10) : undefined;
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {band ? 'Edit Band' : 'Add New Band'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Logo Upload */}
            <LogoUpload
              currentLogoUrl={band?.logoUrl}
              bandName={formData.name || 'Band'}
              onFileSelect={setLogoFile}
              disabled={isLoading}
            />

            {/* Required Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Band Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="school" className="block text-sm font-medium text-gray-700">
                  School <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="school"
                  name="school"
                  value={formData.school}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Optional Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700">
                  Nickname
                </label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="colors" className="block text-sm font-medium text-gray-700">
                  Colors
                </label>
                <input
                  type="text"
                  id="colors"
                  name="colors"
                  value={formData.colors}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="e.g., Blue and Gold"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                  City
                </label>
                <input
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                  State
                </label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="e.g., AL"
                  maxLength={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="conference" className="block text-sm font-medium text-gray-700">
                  Conference
                </label>
                <input
                  type="text"
                  id="conference"
                  name="conference"
                  value={formData.conference}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="e.g., SWAC"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="division" className="block text-sm font-medium text-gray-700">
                  Division
                </label>
                <input
                  type="text"
                  id="division"
                  name="division"
                  value={formData.division}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="e.g., FCS"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="founded" className="block text-sm font-medium text-gray-700">
                  Founded Year
                </label>
                <input
                  type="number"
                  id="founded"
                  name="founded"
                  value={formData.founded || ''}
                  onChange={handleChange}
                  disabled={isLoading}
                  min={1800}
                  max={new Date().getFullYear()}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                  Website
                </label>
                <input
                  type="url"
                  id="website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  disabled={isLoading}
                  placeholder="https://..."
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-primary-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {isLoading && (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>{band ? 'Update Band' : 'Create Band'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
