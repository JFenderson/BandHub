'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';

interface LogoUploadProps {
  currentLogoUrl?: string | null;
  bandName: string;
  onFileSelect: (file: File | null) => void;
  error?: string;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function LogoUpload({
  currentLogoUrl,
  bandName,
  onFileSelect,
  error,
  disabled = false,
}: LogoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (!file) {
      setPreviewUrl(null);
      onFileSelect(null);
      return;
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('Invalid file type. Please upload a JPEG, PNG, WEBP, or GIF image.');
      onFileSelect(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setValidationError(`File size exceeds 5MB. Please choose a smaller file. (Current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      onFileSelect(null);
      return;
    }

    setValidationError('');
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onFileSelect(file);
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setValidationError('');
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const displayUrl = previewUrl || currentLogoUrl;
  
  const getFullImageUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${process.env.NEXT_PUBLIC_API_URL}${url}`;
  };
  
  const fullImageUrl = getFullImageUrl(displayUrl);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        Band Logo
      </label>
      
      <div className="flex items-start space-x-4">
        {/* Preview */}
        <div className="flex-shrink-0">
          {fullImageUrl ? (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-gray-200">
              <Image
                src={fullImageUrl}
                alt={`${bandName} logo preview`}
                fill
                className="object-contain"
                sizes="96px"
              />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Upload Controls */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {currentLogoUrl || previewUrl ? 'Change Logo' : 'Upload Logo'}
            </button>
            
            {(currentLogoUrl || previewUrl) && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="px-4 py-2 bg-white border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Remove
              </button>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />
          
          <p className="text-xs text-gray-500">
            JPEG, PNG, WEBP, or GIF. Max 5MB.
          </p>
          
          {(validationError || error) && (
            <p className="text-sm text-red-600">
              {validationError || error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
