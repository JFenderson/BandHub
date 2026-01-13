/**
 * ModerationPanel component - Admin interface for moderating comments
 */
'use client';

import React, { useState } from 'react';
import type { Comment, CommentReport } from '../../types/comments';

interface ModerationPanelProps {
  comments: Comment[];
  reports: CommentReport[];
  onApprove: (commentId: string) => void;
  onReject: (commentId: string, reason?: string) => void;
  onDelete: (commentId: string, reason?: string) => void;
  onPin: (commentId: string) => void;
  onUnpin: (commentId: string) => void;
  onLock: (commentId: string) => void;
  onBanUser: (userId: string, reason: string) => void;
  onResolveReport: (reportId: string) => void;
}

export const ModerationPanel: React.FC<ModerationPanelProps> = ({
  comments,
  reports,
  onApprove,
  onReject,
  onDelete,
  onPin,
  onUnpin,
  onLock,
  onBanUser,
  onResolveReport,
}) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'flagged' | 'reports'>('pending');
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [actionReason, setActionReason] = useState('');

  // Filter comments based on status
  const pendingComments = comments.filter(c => !c.isApproved && !c.isFlagged);
  const flaggedComments = comments.filter(c => c.isFlagged);
  const pendingReports = reports.filter(r => r.status === 'pending');

  const handleAction = (action: string, commentId: string) => {
    switch (action) {
      case 'approve':
        onApprove(commentId);
        break;
      case 'reject':
        onReject(commentId, actionReason);
        break;
      case 'delete':
        onDelete(commentId, actionReason);
        break;
      case 'pin':
        onPin(commentId);
        break;
      case 'unpin':
        onUnpin(commentId);
        break;
      case 'lock':
        onLock(commentId);
        break;
    }
    setSelectedComment(null);
    setActionReason('');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
        Moderation Panel
      </h2>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2 px-4 ${
            activeTab === 'pending'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Pending Approval ({pendingComments.length})
        </button>
        <button
          onClick={() => setActiveTab('flagged')}
          className={`pb-2 px-4 ${
            activeTab === 'flagged'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Flagged ({flaggedComments.length})
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-2 px-4 ${
            activeTab === 'reports'
              ? 'border-b-2 border-blue-500 text-blue-500'
              : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          Reports ({pendingReports.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Pending Comments */}
        {activeTab === 'pending' && (
          <div>
            {pendingComments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No pending comments
              </p>
            ) : (
              <div className="space-y-4">
                {pendingComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {comment.userName}
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">
                          {comment.content}
                        </p>
                        <div className="text-sm text-gray-500 mt-1">
                          {new Date(comment.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction('approve', comment.id)}
                        className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setSelectedComment(comment)}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Flagged Comments */}
        {activeTab === 'flagged' && (
          <div>
            {flaggedComments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No flagged comments
              </p>
            ) : (
              <div className="space-y-4">
                {flaggedComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {comment.userName}
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">
                          {comment.content}
                        </p>
                        <div className="text-sm text-gray-500 mt-1">
                          {new Date(comment.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction('approve', comment.id)}
                        className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction('delete', comment.id)}
                        className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reports */}
        {activeTab === 'reports' && (
          <div>
            {pendingReports.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No pending reports
              </p>
            ) : (
              <div className="space-y-4">
                {pendingReports.map((report) => {
                  const comment = comments.find(c => c.id === report.commentId);
                  return (
                    <div
                      key={report.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
                            {report.category}
                          </span>
                          <span className="text-sm text-gray-500">
                            Reported {new Date(report.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {report.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {report.description}
                          </p>
                        )}
                        {comment && (
                          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded mt-2">
                            <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                              {comment.userName}
                            </div>
                            <p className="text-gray-800 dark:text-gray-200 text-sm mt-1">
                              {comment.content}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onResolveReport(report.id)}
                          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Resolve
                        </button>
                        {comment && (
                          <>
                            <button
                              onClick={() => handleAction('delete', comment.id)}
                              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              Delete Comment
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action modal for reject/delete */}
      {selectedComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
              Reject Comment
            </h3>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setSelectedComment(null);
                  setActionReason('');
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('reject', selectedComment.id)}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
