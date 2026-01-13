/**
 * RichTextEditor component - Rich text formatting toolbar for comments
 */
'use client';

import React, { useRef, useState } from 'react';

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
    const url = prompt('Enter URL:');
    if (!url) return;

    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    const linkText = selectedText || 'link text';
    const newValue = 
      value.substring(0, start) +
      `<a href="${url}">${linkText}</a>` +
      value.substring(end);

    onChange(newValue);
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
