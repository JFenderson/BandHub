/**
 * Example usage page for VideoComments component
 * This demonstrates how to integrate the comment system into a video page
 */
'use client';

import React, { useState } from 'react';
import { VideoComments } from '@/components/social';

// Example: Mock video player component
const VideoPlayer: React.FC<{ 
  videoId: string; 
  onTimeUpdate: (time: number) => void;
}> = ({ videoId, onTimeUpdate }) => {
  return (
    <div className="w-full aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
      <div className="text-white text-center">
        <p className="text-2xl mb-2">🎥 Video Player</p>
        <p className="text-sm text-gray-400">Video ID: {videoId}</p>
        <p className="text-xs text-gray-500 mt-4">
          (This is a mock player. In production, integrate with your video player)
        </p>
      </div>
    </div>
  );
};

// Example: Video page with comments
export default function ExampleVideoPage() {
  const [currentTime, setCurrentTime] = useState(0);
  
  // Mock video data
  const videoData = {
    id: 'video-123',
    title: 'Southern University Band - Halftime Show 2024',
    description: 'Amazing performance by the Human Jukebox',
    duration: 600, // 10 minutes
  };

  // Mock user data (in production, get from auth context)
  const currentUser = {
    id: 'user-456',
    name: 'John Doe',
    avatar: '/avatars/john.jpg',
    isAdmin: false,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Video Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden mb-8">
          <VideoPlayer 
            videoId={videoData.id} 
            onTimeUpdate={setCurrentTime}
          />
          
          {/* Video Info */}
          <div className="p-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {videoData.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {videoData.description}
            </p>
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <VideoComments
            videoId={videoData.id}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            currentUserAvatar={currentUser.avatar}
            isAdmin={currentUser.isAdmin}
            videoCurrentTime={currentTime}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Integration Guide:
 * 
 * 1. Install required dependencies (already in package.json):
 *    - react
 *    - lucide-react (for icons)
 *    - tailwindcss (for styling)
 * 
 * 2. Set up authentication:
 *    - Ensure user authentication is working
 *    - Get currentUserId, currentUserName, and currentUserAvatar from auth context
 *    - Set isAdmin based on user role
 * 
 * 3. Connect to your video player:
 *    - Pass videoCurrentTime from your player's time update event
 *    - This enables timestamp comments
 * 
 * 4. Implement backend API endpoints:
 *    - See README.md for required endpoints
 *    - Update VideoComments.tsx to call your actual API
 * 
 * 5. Configure moderation:
 *    - Update profanity word list in sanitize.ts
 *    - Set up rate limiting on backend
 *    - Create admin users with moderation privileges
 * 
 * 6. Customize styling:
 *    - Modify Tailwind classes in components
 *    - Override with custom CSS if needed
 *    - Ensure dark mode colors match your theme
 * 
 * 7. Add real-time features (optional):
 *    - Implement WebSocket connection for live updates
 *    - Update comment state when new comments arrive
 *    - Show typing indicators
 * 
 * 8. Performance optimization:
 *    - Implement pagination for large comment lists
 *    - Use React Query for data fetching and caching
 *    - Add virtual scrolling for 1000+ comments
 * 
 * 9. Analytics (optional):
 *    - Track comment submissions
 *    - Monitor reaction usage
 *    - Analyze moderation metrics
 * 
 * 10. Testing:
 *     - Run unit tests: npm test
 *     - Test accessibility with screen readers
 *     - Verify mobile responsiveness
 *     - Load test with many comments
 */

/**
 * Example: Standalone ModerationPanel usage
 * For admin dashboard or moderation page
 */
export function ExampleModerationPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-100">
          Comment Moderation
        </h1>
        
        {/* Import and use ModerationPanel here */}
        <div className="text-gray-600 dark:text-gray-400">
          <p>To use the ModerationPanel:</p>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded mt-4 overflow-x-auto">
{`import { ModerationPanel } from '@/components/social';

<ModerationPanel
  comments={allComments}
  reports={allReports}
  onApprove={(commentId) => handleApprove(commentId)}
  onReject={(commentId, reason) => handleReject(commentId, reason)}
  onDelete={(commentId, reason) => handleDelete(commentId, reason)}
  onPin={(commentId) => handlePin(commentId)}
  onUnpin={(commentId) => handleUnpin(commentId)}
  onLock={(commentId) => handleLock(commentId)}
  onBanUser={(userId, reason) => handleBanUser(userId, reason)}
  onResolveReport={(reportId) => handleResolveReport(reportId)}
/>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
