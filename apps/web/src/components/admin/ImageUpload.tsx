'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface ImageUploadProps {
  label: string;
  currentImageUrl?: string | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  accept?: string;
}

export default function ImageUpload({
  label,
  currentImageUrl,
  onFileSelect,
  disabled = false,
  width = 300,
  height = 300,
  accept = 'image/jpeg,image/png,image/webp',
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        onFileSelect(file);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    disabled,
  } as any);

  const displayImage = preview || currentImageUrl;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      
      <div
        {...(getRootProps() as any)}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...(getInputProps() as any)} />
        
        {displayImage ? (
          <div className="space-y-2">
            <div className="flex justify-center">
              <img
                src={displayImage}
                alt="Preview"
                className="max-h-48 rounded"
                style={{ maxWidth: `${width}px` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {isDragActive
                ? 'Drop to replace image'
                : 'Click or drag to replace image'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-sm text-gray-600">
              <p>
                {isDragActive
                  ? 'Drop the image here'
                  : 'Drag and drop an image, or click to select'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, WEBP up to 5MB ({width}x{height}px recommended)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
