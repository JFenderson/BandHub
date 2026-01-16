'use client';

import React, { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { AlertCircle } from 'lucide-react';

interface TwoFactorVerificationInputProps {
  length?: number;
  value?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  errorMessage?: string;
  autoFocus?: boolean;
  className?: string;
}

export function TwoFactorVerificationInput({
  length = 6,
  value = '',
  onChange,
  onComplete,
  disabled = false,
  loading = false,
  error = false,
  errorMessage,
  autoFocus = true,
  className = '',
}: TwoFactorVerificationInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync internal state with external value
  useEffect(() => {
    if (value !== digits.join('')) {
      const newDigits = value.split('').slice(0, length);
      setDigits([...newDigits, ...Array(length - newDigits.length).fill('')]);
    }
  }, [value, length]);

  // Auto-focus first input
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const handleChange = (index: number, inputValue: string) => {
    if (disabled || loading) return;

    // Only allow digits
    const sanitized = inputValue.replace(/[^0-9]/g, '');
    if (sanitized.length === 0 && inputValue.length > 0) return;

    const newDigits = [...digits];
    
    if (sanitized.length === 1) {
      newDigits[index] = sanitized;
      setDigits(newDigits);
      
      const newValue = newDigits.join('');
      onChange?.(newValue);
      
      // Auto-advance to next input
      if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
      
      // Check if complete
      if (newDigits.every(d => d !== '')) {
        onComplete?.(newValue);
      }
    } else if (sanitized.length > 1) {
      // Handle paste or multiple digits
      handlePaste(index, sanitized);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled || loading) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      
      if (digits[index]) {
        // Clear current digit
        newDigits[index] = '';
        setDigits(newDigits);
        onChange?.(newDigits.join(''));
      } else if (index > 0) {
        // Move to previous and clear
        newDigits[index - 1] = '';
        setDigits(newDigits);
        onChange?.(newDigits.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
      onChange?.(newDigits.join(''));
    }
  };

  const handlePaste = (startIndex: number, pastedText: string) => {
    const sanitized = pastedText.replace(/[^0-9]/g, '').slice(0, length);
    const newDigits = [...digits];
    
    for (let i = 0; i < sanitized.length && startIndex + i < length; i++) {
      newDigits[startIndex + i] = sanitized[i];
    }
    
    setDigits(newDigits);
    const newValue = newDigits.join('');
    onChange?.(newValue);
    
    // Focus last filled input or next empty
    const lastFilledIndex = Math.min(startIndex + sanitized.length - 1, length - 1);
    const nextEmptyIndex = newDigits.findIndex((d, i) => i > lastFilledIndex && d === '');
    const focusIndex = nextEmptyIndex !== -1 ? nextEmptyIndex : lastFilledIndex;
    inputRefs.current[focusIndex]?.focus();
    
    // Check if complete
    if (newDigits.every(d => d !== '')) {
      onComplete?.(newValue);
    }
  };

  const handlePasteEvent = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    handlePaste(index, pastedText);
  };

  const handleFocus = (index: number) => {
    inputRefs.current[index]?.select();
  };

  return (
    <div className={className}>
      <div className="flex gap-2 justify-center">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={el => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleChange(index, e.target.value)}
            onKeyDown={e => handleKeyDown(index, e)}
            onPaste={e => handlePasteEvent(index, e)}
            onFocus={() => handleFocus(index)}
            disabled={disabled || loading}
            className={`
              w-12 h-14 text-center text-2xl font-semibold
              border-2 rounded-lg
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2
              ${error 
                ? 'border-red-500 focus:ring-red-500 dark:border-red-400 dark:focus:ring-red-400' 
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:focus:border-blue-400 dark:focus:ring-blue-400'
              }
              ${disabled || loading 
                ? 'bg-gray-100 cursor-not-allowed dark:bg-gray-800' 
                : 'bg-white dark:bg-gray-900'
              }
              ${digit ? 'border-blue-500 dark:border-blue-400' : ''}
              text-gray-900 dark:text-gray-100
              placeholder-gray-400 dark:placeholder-gray-500
            `}
            aria-label={`Digit ${index + 1}`}
            aria-invalid={error}
          />
        ))}
      </div>
      
      {error && errorMessage && (
        <div className="flex items-center gap-2 mt-3 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      
      {loading && (
        <div className="flex justify-center mt-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin dark:border-blue-400" />
        </div>
      )}
    </div>
  );
}
