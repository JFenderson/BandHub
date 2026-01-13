# Video Comments and Reactions System

A comprehensive comment and reaction system for HBCU Band Hub video content, featuring threaded comments, emoji reactions, moderation tools, and rich text editing.

## Features

### Core Functionality
- ✅ User registration/authentication integration
- ✅ Threaded comment replies with multiple nesting levels
- ✅ Rich text formatting (bold, italic, hyperlinks)
- ✅ XSS prevention through sanitization
- ✅ User mention functionality with @username autocomplete
- ✅ Timestamp-specific comments linked to video times
- ✅ Comment editing with edit history tracking
- ✅ Comment deletion (soft delete for moderation)
- ✅ Character limit enforcement with counter

### Reaction System
- ✅ Standard emoji reactions (👍 ❤️ 😂 😮 😢 🔥)
- ✅ Band-specific reactions (🎺 🥁 🎷 📯 🎵 🏈 🎉)
- ✅ Real-time reaction counters
- ✅ Reaction picker UI component
- ✅ View who reacted with what emoji

### Voting System
- ✅ Upvote/downvote functionality
- ✅ Vote count display
- ✅ Vote score calculation for sorting

### Sorting & Filtering
- ✅ Newest: Most recent comments first
- ✅ Oldest: Original comments first
- ✅ Most Liked: Highest upvote count
- ✅ Controversial: Mixed voting patterns
- ✅ Timestamp: Sort by video timestamp

### Moderation System
- ✅ Profanity filtering with customizable word list
- ✅ Spam detection (duplicate, rate limiting, link spam, caps)
- ✅ Comment reporting with categories
- ✅ Admin moderation panel
- ✅ Pin/unpin important comments
- ✅ Approve/reject pending comments

## Components

### VideoComments (Main Container)
The primary component that manages all comment functionality.

```tsx
import { VideoComments } from '@/components/social';

<VideoComments
  videoId="video-123"
  currentUserId="user-456"
  currentUserName="John Doe"
  currentUserAvatar="/avatar.jpg"
  isAdmin={false}
  videoCurrentTime={120} // seconds
/>
```

**Props:**
- `videoId` (string): Unique identifier for the video
- `currentUserId` (string): ID of the currently logged-in user
- `currentUserName` (string): Display name of current user
- `currentUserAvatar` (string, optional): Avatar URL for current user
- `isAdmin` (boolean, optional): Whether user has admin privileges
- `videoCurrentTime` (number, optional): Current playback time in seconds

### CommentForm
Form component for submitting new comments.

```tsx
import { CommentForm } from '@/components/social';

<CommentForm
  videoId="video-123"
  currentUserId="user-456"
  currentUserName="John Doe"
  onSubmit={(content, timestamp) => {
    // Handle comment submission
  }}
  videoCurrentTime={120}
  maxLength={1000}
/>
```

**Features:**
- Auto-expanding textarea
- Character counter
- Timestamp attachment option
- Spam and profanity detection
- Input validation

### CommentItem
Displays an individual comment with voting and actions.

```tsx
import { CommentItem } from '@/components/social';

<CommentItem
  comment={commentData}
  currentUserId="user-456"
  isAdmin={false}
  onReply={(commentId) => {}}
  onEdit={(commentId, newContent) => {}}
  onDelete={(commentId) => {}}
  onUpvote={(commentId) => {}}
  onDownvote={(commentId) => {}}
  onReact={(commentId, emoji) => {}}
  onRemoveReaction={(commentId, emoji) => {}}
  onReport={(commentId) => {}}
  reactions={[]}
/>
```

**Features:**
- Upvote/downvote buttons
- Edit/delete for own comments
- Reply functionality
- Reaction display
- Time elapsed display
- Pinned comment indicator

### ReactionPicker
Emoji/reaction selector with standard and band-specific reactions.

```tsx
import { ReactionPicker } from '@/components/social';

<ReactionPicker
  isOpen={true}
  onSelect={(emoji) => console.log('Selected:', emoji)}
  onClose={() => {}}
/>
```

**Features:**
- Standard reactions tab
- Band-specific reactions tab
- Click outside to close
- Keyboard navigation support

### ReactionDisplay
Shows reactions on a comment with counts and users.

```tsx
import { ReactionDisplay } from '@/components/social';

<ReactionDisplay
  reactions={[
    {
      emoji: '👍',
      count: 5,
      users: [{ id: '1', name: 'John' }],
      userReacted: true
    }
  ]}
  onReact={(emoji) => {}}
  onRemoveReaction={(emoji) => {}}
/>
```

**Features:**
- Grouped reaction counts
- Hover to see who reacted
- Toggle user's own reaction
- Responsive design

### ModerationPanel
Admin interface for moderating comments.

```tsx
import { ModerationPanel } from '@/components/social';

<ModerationPanel
  comments={allComments}
  reports={allReports}
  onApprove={(commentId) => {}}
  onReject={(commentId, reason) => {}}
  onDelete={(commentId, reason) => {}}
  onPin={(commentId) => {}}
  onUnpin={(commentId) => {}}
  onLock={(commentId) => {}}
  onBanUser={(userId, reason) => {}}
  onResolveReport={(reportId) => {}}
/>
```

**Features:**
- Pending comments review
- Flagged comments management
- Report handling
- Bulk actions
- Moderation history

### RichTextEditor
Rich text formatting toolbar for enhanced comments.

```tsx
import { RichTextEditor } from '@/components/social';

<RichTextEditor
  value={content}
  onChange={(newContent) => setContent(newContent)}
  placeholder="Write your comment..."
  maxLength={1000}
/>
```

**Features:**
- Bold text formatting
- Italic text formatting
- Hyperlink insertion
- Character counter
- Collapsible toolbar

### MentionInput
Input component with @mention autocomplete.

```tsx
import { MentionInput } from '@/components/social';

<MentionInput
  value={content}
  onChange={(newContent) => setContent(newContent)}
  onMention={(username) => console.log('Mentioned:', username)}
  users={[
    { id: '1', name: 'john', avatar: '/avatar.jpg' }
  ]}
/>
```

**Features:**
- Autocomplete on @ character
- Arrow key navigation
- Enter to select
- Avatar display in suggestions

### TimestampPicker
Video timestamp selector for timestamp comments.

```tsx
import { TimestampPicker } from '@/components/social';

<TimestampPicker
  currentTime={120}
  duration={300}
  onSelect={(timestamp) => console.log('Selected:', timestamp)}
  selectedTimestamp={120}
/>
```

**Features:**
- Manual time input (hours:minutes:seconds)
- Use current time button
- Validation against video duration
- Formatted display

## Data Types

### Comment
```typescript
interface Comment {
  id: string;
  videoId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  content: string;
  parentCommentId?: string;
  timestamp?: number;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;
  isDeleted: boolean;
  isPinned: boolean;
  isApproved: boolean;
  isFlagged: boolean;
  upvotes: number;
  downvotes: number;
  replyCount: number;
  replies?: Comment[];
}
```

### Reaction
```typescript
interface Reaction {
  id: string;
  commentId: string;
  userId: string;
  userName: string;
  emoji: string;
  createdAt: Date;
}
```

### CommentReport
```typescript
interface CommentReport {
  id: string;
  commentId: string;
  reporterId: string;
  category: 'spam' | 'harassment' | 'inappropriate' | 'off-topic' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
}
```

## API Integration

The components are designed to work with REST APIs. You'll need to implement the following endpoints:

### Comments
- `GET /api/videos/:videoId/comments` - Fetch comments for a video
- `POST /api/videos/:videoId/comments` - Create a new comment
- `PUT /api/comments/:id` - Update a comment
- `DELETE /api/comments/:id` - Delete a comment
- `POST /api/comments/:id/upvote` - Upvote a comment
- `POST /api/comments/:id/downvote` - Downvote a comment

### Reactions
- `GET /api/comments/:commentId/reactions` - Get reactions for a comment
- `POST /api/comments/:commentId/reactions` - Add a reaction
- `DELETE /api/comments/:commentId/reactions/:emoji` - Remove a reaction

### Reports
- `POST /api/comments/:id/report` - Report a comment
- `GET /api/moderation/reports` - Get all reports (admin)
- `PUT /api/moderation/reports/:id` - Update report status (admin)

### Moderation
- `PUT /api/moderation/comments/:id/approve` - Approve a comment (admin)
- `PUT /api/moderation/comments/:id/reject` - Reject a comment (admin)
- `PUT /api/moderation/comments/:id/pin` - Pin/unpin a comment (admin)

## Security

### XSS Prevention
All user input is sanitized using the `sanitize.ts` utility functions:
- HTML entities are escaped
- Only safe HTML tags are allowed (<b>, <i>, <a>)
- URL validation for links
- Content Security Policy recommended

### Spam Detection
The system includes automatic spam detection for:
- Excessive capitalization (>70% caps in long text)
- Multiple links (>3 URLs)
- Repeated characters (>10 in a row)
- Profanity filtering (customizable word list)

### Rate Limiting
Implement server-side rate limiting:
- Comments per user per minute
- Reactions per user per minute
- Report submissions per user per hour

## Styling

Components use Tailwind CSS classes with dark mode support. Key classes:
- `bg-white dark:bg-gray-800` - Backgrounds
- `text-gray-900 dark:text-gray-100` - Text
- `border-gray-300 dark:border-gray-600` - Borders

### Customization
Override classes or create wrapper components for custom styling.

## Accessibility

All components follow WCAG 2.1 AA guidelines:
- Keyboard navigation support
- ARIA labels and roles
- Screen reader friendly
- Focus indicators
- Semantic HTML

## Performance

### Optimizations
- Lazy loading of nested replies
- Debounced search and filter
- Optimistic UI updates
- Virtual scrolling for long lists (recommended)
- React.memo for expensive components

### Recommendations
- Implement pagination for large comment sections
- Use React Query or SWR for data fetching
- Add service workers for offline support
- Compress images and avatars

## Future Enhancements

Potential additions not yet implemented:
- Real-time updates via WebSockets
- Live chat mode for events
- Push notifications
- Email digests
- Comment search
- Export moderation reports
- Multi-language support (i18n)
- Comment voting analytics
- User reputation system
- Advanced markdown support

## Contributing

When adding new features:
1. Follow existing TypeScript patterns
2. Add appropriate prop types
3. Include tests for new functionality
4. Update this documentation
5. Ensure accessibility compliance

## License

Part of the HBCU Band Hub project.
