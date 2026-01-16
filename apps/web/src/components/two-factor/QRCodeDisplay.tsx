'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface QRCodeDisplayProps {
  qrCodeDataUrl: string;
  secret: string;
  className?: string;
}

export function QRCodeDisplay({
  qrCodeDataUrl,
  secret,
  className = '',
}: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy secret:', err);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* QR Code */}
      <div className="flex justify-center">
        <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          {qrCodeDataUrl ? (
            <img
              src={qrCodeDataUrl}
              alt="Two-Factor Authentication QR Code"
              className="w-64 h-64"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded">
              <span className="text-gray-500 dark:text-gray-400">Loading QR Code...</span>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Scan with your authenticator app
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Use Google Authenticator, Authy, or any TOTP-compatible app
        </p>
      </div>

      {/* Manual Entry */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Can&apos;t scan? Enter this code manually:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={secret}
              readOnly
              className="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 border border-gray-300 rounded-lg text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              aria-label="Secret key for manual entry"
            />
            <button
              onClick={handleCopySecret}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600"
              aria-label="Copy secret key"
              title="Copy secret key"
            >
              {copied ? (
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter this code in your authenticator app if you can&apos;t scan the QR code
          </p>
        </div>
      </div>
    </div>
  );
}
