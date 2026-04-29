'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface ActionResult {
  success: boolean;
  message: string;
  detail?: string;
}

interface UnmatchedSummary {
  reason: string | null;
  count: number;
}

interface PipelineActionsPanelProps {
  onActionComplete?: () => void;
}

const ACTIONS = [
  {
    id: 'rematch',
    label: 'Re-match Unmatched Videos',
    description: 'Assigns bands to YouTubeVideos that currently have no band. Does not touch already-matched videos.',
    color: 'blue',
    confirmText: 'This will queue a background re-match job for all unmatched videos. Continue?',
  },
  {
    id: 'promote',
    label: 'Promote Matched Videos',
    description: 'Pushes all newly matched YouTubeVideos into the public Video table. Safe to run multiple times.',
    color: 'green',
    confirmText: 'This will queue a promote job to upsert matched videos into the Video table. Continue?',
  },
  {
    id: 'categorize',
    label: 'Categorize Videos',
    description: 'Runs keyword-based category detection on promoted videos with no category assigned. No AI quota used.',
    color: 'purple',
    confirmText: 'This will queue a categorization job for all uncategorized videos. Continue?',
  },
  {
    id: 'recategorize',
    label: 'Re-categorize "Other" Videos',
    description: 'Re-runs category detection on promoted videos stuck in the "Other" catch-all. No AI quota used.',
    color: 'yellow',
    confirmText: 'This will re-run category detection on all videos currently in the "Other" category. Continue?',
  },
  {
    id: 'hide-excluded',
    label: 'Hide AI-Excluded Videos',
    description: 'Hides promoted videos that were flagged by AI as non-HBCU content (high school, drum corps, etc.).',
    color: 'red',
    confirmText: 'This will hide all promoted videos that AI flagged as non-HBCU content. This is reversible. Continue?',
  },
  {
    id: 'hide-greek-life',
    label: 'Hide Greek Life Videos',
    description: 'Hides promoted videos whose titles match Greek life content (probates, step shows, stroll offs, fraternity/sorority org names).',
    color: 'red',
    confirmText: 'This will hide all videos identified as Greek life content by title keyword matching. This is reversible. Continue?',
  },
] as const;

type ActionId = typeof ACTIONS[number]['id'];

const colorClasses: Record<string, { button: string; badge: string }> = {
  blue:   { button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',   badge: 'bg-blue-100 text-blue-800' },
  green:  { button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500', badge: 'bg-green-100 text-green-800' },
  purple: { button: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500', badge: 'bg-purple-100 text-purple-800' },
  yellow: { button: 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400', badge: 'bg-yellow-100 text-yellow-800' },
  red:    { button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',       badge: 'bg-red-100 text-red-800' },
};

export function PipelineActionsPanel({ onActionComplete }: PipelineActionsPanelProps) {
  const [loading, setLoading] = useState<ActionId | null>(null);
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [confirmAction, setConfirmAction] = useState<ActionId | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const [unmatchedSummary, setUnmatchedSummary] = useState<UnmatchedSummary[] | null>(null);
  const [unmatchedTotal, setUnmatchedTotal] = useState<number | null>(null);
  const [loadingUnmatched, setLoadingUnmatched] = useState(false);

  const runAction = async (id: ActionId) => {
    setConfirmAction(null);
    setLoading(id);
    setResults((prev) => ({ ...prev, [id]: undefined as any }));

    try {
      let result: ActionResult;

      if (id === 'rematch') {
        const res = await apiClient.triggerRematch({ filter: 'unmatched' });
        result = { success: true, message: res.message, detail: `Job ID: ${res.jobId}` };
      } else if (id === 'promote') {
        const res = await apiClient.triggerPromote();
        result = { success: true, message: res.message, detail: `Job ID: ${res.jobId}` };
      } else if (id === 'categorize') {
        const res = await apiClient.categorizeVideos(true);
        result = { success: true, message: res.message, detail: `Job ID: ${res.jobId}` };
      } else if (id === 'recategorize') {
        const res = await apiClient.recategorizeOtherVideos();
        result = { success: true, message: res.message, detail: `Updated: ${res.updated} videos` };
      } else if (id === 'hide-excluded') {
        const res = await apiClient.hideExcludedVideos();
        result = { success: true, message: res.message, detail: `Hidden: ${res.hidden} videos` };
      } else if (id === 'hide-greek-life') {
        const res = await apiClient.hideGreekLifeVideos();
        result = { success: true, message: res.message, detail: `Hidden: ${res.hidden} videos` };
      } else {
        result = { success: false, message: 'Unknown action' };
      }

      setResults((prev) => ({ ...prev, [id]: result }));
      onActionComplete?.();
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [id]: {
          success: false,
          message: err instanceof Error ? err.message : 'Action failed',
        },
      }));
    } finally {
      setLoading(null);
    }
  };

  const loadUnmatchedSummary = async () => {
    setLoadingUnmatched(true);
    try {
      const res = await apiClient.getUnmatchedVideoReport(1, 1);
      setUnmatchedTotal(res.total);
      setUnmatchedSummary(
        res.summary.map((s) => ({
          reason: s.noMatchReason,
          count: s._count.id,
        }))
      );
      setShowUnmatched(true);
    } catch (err) {
      console.error('Failed to load unmatched summary:', err);
    } finally {
      setLoadingUnmatched(false);
    }
  };

  const reasonLabel: Record<string, string> = {
    no_alias_found: 'No alias found',
    low_confidence: 'Low confidence',
    ai_excluded: 'AI excluded (non-HBCU)',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Pipeline Actions</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Run background jobs to match, promote, and categorize videos
          </p>
        </div>
        <button
          onClick={showUnmatched ? () => setShowUnmatched(false) : loadUnmatchedSummary}
          disabled={loadingUnmatched}
          className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
        >
          {loadingUnmatched ? 'Loading...' : showUnmatched ? 'Hide unmatched summary' : 'View unmatched summary'}
        </button>
      </div>

      {/* Unmatched Summary */}
      {showUnmatched && unmatchedSummary && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Unmatched / excluded YouTubeVideos: <span className="text-gray-900">{unmatchedTotal?.toLocaleString()}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {unmatchedSummary.map((s) => (
              <span
                key={s.reason ?? 'unknown'}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-sm"
              >
                <span className="font-medium text-gray-800">
                  {s.reason ? (reasonLabel[s.reason] ?? s.reason) : 'Not yet attempted'}
                </span>
                <span className="text-gray-500">{s.count.toLocaleString()}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {ACTIONS.map((action) => {
          const colors = colorClasses[action.color];
          const result = results[action.id];
          const isRunning = loading === action.id;

          return (
            <div
              key={action.id}
              className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{action.label}</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{action.description}</p>
              </div>

              {/* Result badge */}
              {result && (
                <div
                  className={`text-xs rounded px-2 py-1.5 ${
                    result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  <p className="font-medium">{result.message}</p>
                  {result.detail && <p className="opacity-75 mt-0.5">{result.detail}</p>}
                </div>
              )}

              <button
                onClick={() => setConfirmAction(action.id)}
                disabled={isRunning || loading !== null}
                className={`w-full text-sm font-medium text-white px-3 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${colors.button}`}
              >
                {isRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running...
                  </span>
                ) : (
                  'Run'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h4 className="text-base font-semibold text-gray-900">
              {ACTIONS.find((a) => a.id === confirmAction)?.label}
            </h4>
            <p className="text-sm text-gray-600">
              {ACTIONS.find((a) => a.id === confirmAction)?.confirmText}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => runAction(confirmAction)}
                className={`px-4 py-2 text-sm text-white rounded-lg ${
                  colorClasses[ACTIONS.find((a) => a.id === confirmAction)?.color ?? 'blue'].button
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
