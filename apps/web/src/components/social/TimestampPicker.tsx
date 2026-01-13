/**
 * TimestampPicker component - Video timestamp selector for comments
 */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { formatTimestamp } from '../../utils/sanitize';

/**
 * Special value used to indicate timestamp removal
 * When this value is passed to onSelect, it means the user wants to remove the timestamp
 * Consumer of this component should check for this value:
 * if (timestamp === REMOVE_TIMESTAMP) { removeTimestamp(); }
 */
export const REMOVE_TIMESTAMP = -1;

interface TimestampPickerProps {
  currentTime: number;
  duration: number;
  /**
   * Called when user selects a timestamp
   * @param timestamp - The selected timestamp in seconds, or REMOVE_TIMESTAMP to remove
   */
  onSelect: (timestamp: number) => void;
  selectedTimestamp?: number;
}

export const TimestampPicker: React.FC<TimestampPickerProps> = ({
  currentTime,
  duration,
  onSelect,
  selectedTimestamp,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedTimestamp !== undefined) {
      const h = Math.floor(selectedTimestamp / 3600);
      const m = Math.floor((selectedTimestamp % 3600) / 60);
      const s = Math.floor(selectedTimestamp % 60);
      setHours(h);
      setMinutes(m);
      setSeconds(s);
    } else {
      const h = Math.floor(currentTime / 3600);
      const m = Math.floor((currentTime % 3600) / 60);
      const s = Math.floor(currentTime % 60);
      setHours(h);
      setMinutes(m);
      setSeconds(s);
    }
  }, [currentTime, selectedTimestamp]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showPicker]);

  const handleUseCurrentTime = () => {
    const h = Math.floor(currentTime / 3600);
    const m = Math.floor((currentTime % 3600) / 60);
    const s = Math.floor(currentTime % 60);
    setHours(h);
    setMinutes(m);
    setSeconds(s);
  };

  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    
    if (totalSeconds > duration) {
      setError('Timestamp exceeds video duration');
      return;
    }
    
    setError(null);
    onSelect(totalSeconds);
    setShowPicker(false);
  };

  const timestamp = hours * 3600 + minutes * 60 + seconds;
  const maxHours = Math.floor(duration / 3600);
  const maxMinutes = Math.floor((duration % 3600) / 60);
  const maxSeconds = Math.floor(duration % 60);

  return (
    <div className="relative inline-block" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
        {selectedTimestamp !== undefined ? formatTimestamp(selectedTimestamp) : 'Add timestamp'}
      </button>

      {showPicker && (
        <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50 min-w-[280px]">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Select Timestamp
            </h3>
            <p className="text-xs text-gray-500">
              Current video time: {formatTimestamp(currentTime)}
            </p>
          </div>

          {/* Time inputs */}
          <div className="flex items-center gap-2 mb-3">
            {/* Hours */}
            <div className="flex-1">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Hours
              </label>
              <input
                type="number"
                min="0"
                max={maxHours}
                value={hours}
                onChange={(e) => setHours(Math.max(0, Math.min(maxHours, parseInt(e.target.value) || 0)))}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <span className="text-gray-500 mt-5">:</span>

            {/* Minutes */}
            <div className="flex-1">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Minutes
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <span className="text-gray-500 mt-5">:</span>

            {/* Seconds */}
            <div className="flex-1">
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                Seconds
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={seconds}
                onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="text-center mb-3 text-lg font-mono text-gray-900 dark:text-gray-100">
            {formatTimestamp(timestamp)}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-3 text-sm text-red-500 text-center" role="alert">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUseCurrentTime}
              className="flex-1 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Use Current
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Apply
            </button>
          </div>

          {/* Clear button */}
          {selectedTimestamp !== undefined && (
            <button
              type="button"
              onClick={() => {
                onSelect(REMOVE_TIMESTAMP);
                setShowPicker(false);
              }}
              className="w-full mt-2 px-3 py-1 text-xs text-red-500 hover:text-red-600"
            >
              Remove timestamp
            </button>
          )}
        </div>
      )}
    </div>
  );
};
