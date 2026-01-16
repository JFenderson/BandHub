'use client';

import React, { useState } from 'react';
import { Copy, Download, Printer, Check, AlertCircle } from 'lucide-react';

interface BackupCodesDisplayProps {
  codes: string[];
  onConfirmSaved?: () => void;
  requireConfirmation?: boolean;
  className?: string;
}

export function BackupCodesDisplay({
  codes,
  onConfirmSaved,
  requireConfirmation = true,
  className = '',
}: BackupCodesDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [printed, setPrinted] = useState(false);
  const [confirmChecks, setConfirmChecks] = useState({
    saved: false,
    understand: false,
  });

  const handleCopy = async () => {
    try {
      const text = codes.join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy codes:', err);
    }
  };

  const handleDownload = () => {
    const text = [
      'Two-Factor Authentication Backup Codes',
      '========================================',
      '',
      'Save these codes in a secure location.',
      'Each code can only be used once.',
      '',
      ...codes,
      '',
      `Generated: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-codes-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=600,height=800');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Two-Factor Authentication Backup Codes</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 40px;
                max-width: 600px;
                margin: 0 auto;
              }
              h1 {
                font-size: 24px;
                margin-bottom: 10px;
              }
              .warning {
                background: #fff3cd;
                border: 1px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .codes {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin: 20px 0;
              }
              .code {
                font-family: monospace;
                font-size: 16px;
                padding: 10px;
                background: #f5f5f5;
                border: 1px solid #ddd;
                border-radius: 4px;
              }
              .footer {
                margin-top: 30px;
                font-size: 12px;
                color: #666;
              }
              @media print {
                body { padding: 20px; }
              }
            </style>
          </head>
          <body>
            <h1>Two-Factor Authentication Backup Codes</h1>
            <div class="warning">
              <strong>⚠️ Important:</strong> Keep these codes secure. Each code can only be used once.
            </div>
            <div class="codes">
              ${codes.map(code => `<div class="code">${code}</div>`).join('')}
            </div>
            <div class="footer">
              Generated: ${new Date().toLocaleString()}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
        setPrinted(true);
      }, 250);
    }
  };

  const handleCheckChange = (key: 'saved' | 'understand') => {
    const newChecks = { ...confirmChecks, [key]: !confirmChecks[key] };
    setConfirmChecks(newChecks);
    
    if (newChecks.saved && newChecks.understand) {
      onConfirmSaved?.();
    }
  };

  const allChecked = confirmChecks.saved && confirmChecks.understand;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Warning Message */}
      <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-800">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Save these backup codes securely
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Each code can only be used once. If you lose access to your authenticator app, 
            you&apos;ll need these codes to log in.
          </p>
        </div>
      </div>

      {/* Backup Codes Grid */}
      <div className="grid grid-cols-2 gap-3">
        {codes.map((code, index) => (
          <div
            key={index}
            className="px-4 py-3 font-mono text-sm text-center bg-gray-50 border border-gray-200 rounded-lg dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          >
            {code}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Copied!
              </span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Copy All
              </span>
            </>
          )}
        </button>

        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {downloaded ? (
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : (
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Download
          </span>
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          {printed ? (
            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : (
            <Printer className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Print
          </span>
        </button>
      </div>

      {/* Confirmation Checkboxes */}
      {requireConfirmation && (
        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmChecks.saved}
              onChange={() => handleCheckChange('saved')}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:focus:ring-blue-400"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I have saved these backup codes in a secure location
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmChecks.understand}
              onChange={() => handleCheckChange('understand')}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:focus:ring-blue-400"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I understand that each code can only be used once and I should keep them secure
            </span>
          </label>

          {!allChecked && (
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Please confirm you&apos;ve saved the codes before continuing
            </p>
          )}
        </div>
      )}
    </div>
  );
}
