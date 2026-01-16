'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import AvatarEditor from 'react-avatar-editor';
import { Upload, X, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
}

export function AvatarUpload({ currentAvatarUrl, onUpload }: AvatarUploadProps) {
  const [image, setImage] = useState<File | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<AvatarEditor>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('File is too large. Maximum size is 5MB.');
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Invalid file type. Please upload a JPG, PNG, or WebP image.');
      } else {
        setError('Failed to upload file. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setImage(acceptedFiles[0]);
      setScale(1);
      setRotation(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
  });

  const handleUpload = async () => {
    if (!editorRef.current || !image) return;

    setIsUploading(true);
    setError(null);

    try {
      const canvas = editorRef.current.getImageScaledToCanvas();
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9);
      });

      const file = new File([blob], image.name, { type: 'image/jpeg' });
      await onUpload(file);
      setImage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setImage(null);
    setScale(1);
    setRotation(0);
    setError(null);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        {!image ? (
          <div
            {...getRootProps()}
            className={`relative w-48 h-48 rounded-full border-4 cursor-pointer transition-all ${
              isDragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
            }`}
            role="button"
            aria-label="Upload avatar"
            tabIndex={0}
          >
            <input {...getInputProps()} aria-label="Avatar file input" />
            
            {currentAvatarUrl ? (
              <>
                <img
                  src={currentAvatarUrl}
                  alt="Current avatar"
                  className="w-full h-full rounded-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                  <Upload className="w-8 h-8 text-white" aria-hidden="true" />
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" aria-hidden="true" />
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center px-4">
                  {isDragActive ? 'Drop image here' : 'Click or drag to upload'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <AvatarEditor
                ref={editorRef}
                image={image}
                width={200}
                height={200}
                border={24}
                borderRadius={100}
                color={[0, 0, 0, 0.6]}
                scale={scale}
                rotate={rotation}
                className="rounded-full"
              />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleZoomOut}
                disabled={scale <= 0.5}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Zoom out"
                type="button"
              >
                <ZoomOut className="w-5 h-5" aria-hidden="true" />
              </button>

              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <ZoomOut className="w-4 h-4 text-gray-500" aria-hidden="true" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1"
                  aria-label="Zoom level"
                />
                <ZoomIn className="w-4 h-4 text-gray-500" aria-hidden="true" />
              </div>

              <button
                onClick={handleZoomIn}
                disabled={scale >= 3}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Zoom in"
                type="button"
              >
                <ZoomIn className="w-5 h-5" aria-hidden="true" />
              </button>

              <button
                onClick={handleRotate}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                aria-label="Rotate 90 degrees"
                type="button"
              >
                <RotateCw className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleCancel}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                type="button"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                type="button"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* File requirements */}
      {!image && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          JPG, PNG, or WebP • Max 5MB
        </p>
      )}

      {/* Error message */}
      {error && (
        <div
          className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
