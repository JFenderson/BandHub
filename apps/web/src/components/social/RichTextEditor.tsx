/**
 * RichTextEditor component - Rich text formatting toolbar for comments
 */
'use client';

import React, { useRef, useState } from 'react';

/**
 * Escape text for safe insertion in HTML
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write your comment...',
  maxLength = 1000,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const insertFormatting = (startTag: string, endTag: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const newValue = 
      value.substring(0, start) +
      startTag +
      selectedText +
      endTag +
      value.substring(end);

    onChange(newValue);

    // Reset cursor position
    setTimeout(() => {
      if (selectedText) {
        textarea.setSelectionRange(start + startTag.length, end + startTag.length);
      } else {
        textarea.setSelectionRange(start + startTag.length, start + startTag.length);
      }
      textarea.focus();
    }, 0);
  };

  const insertLink = () => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    setLinkText(selectedText || '');
    setShowLinkInput(true);
  };

  const handleInsertLink = () => {
    if (!linkUrl || !textareaRef.current) return;

    setError(null);

    // Validate URL to prevent XSS
    try {
      const url = new URL(linkUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        setError('Only HTTP and HTTPS URLs are allowed');
        return;
      }
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Escape both URL and text to prevent XSS
    const safeUrl = escapeHtml(linkUrl);
    const safeText = escapeHtml(linkText || 'link text');
    
    const newValue = 
      value.substring(0, start) +
      `<a href="${safeUrl}">${safeText}</a>` +
      value.substring(end);

    onChange(newValue);
    setShowLinkInput(false);
    setLinkUrl('');
    setLinkText('');
  };

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Toolbar */}
      {showToolbar && (
        <div className="bg-gray-50 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 p-2 flex gap-2">
          <button
            type="button"
            onClick={() => insertFormatting('<b>', '</b>')}
            className="px-3 py-1 text-sm font-bold bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-100 dark:hover:bg-gray-500"
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('<i>', '</i>')}
            className="px-3 py-1 text-sm italic bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-100 dark:hover:bg-gray-500"
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={insertLink}
            className="px-3 py-1 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-100 dark:hover:bg-gray-500"
            title="Insert Link"
          >
            🔗
          </button>
        </div>
      )}

      {/* Link input modal */}
      {showLinkInput && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 p-3 space-y-2">
          {error && (
            <div className="text-sm text-red-500 mb-2" role="alert">
              {error}
            </div>
          )}
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <input
            type="text"
            value={linkText}
            onChange={(e) => setLinkText(e.target.value)}
            placeholder="Link text (optional)"
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInsertLink}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLinkInput(false);
                setLinkUrl('');
                setLinkText('');
                setError(null);
              }}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Text area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowToolbar(true)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none"
        rows={4}
      />

      {/* Character counter */}
      <div className="bg-gray-50 dark:bg-gray-700 px-3 py-1 text-xs text-gray-500 text-right">
        {value.length} / {maxLength}
      </div>
    </div>
  );
};
