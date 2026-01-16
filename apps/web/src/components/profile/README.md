# Profile Components

This directory contains user profile-related components for BandHub.

## Components

### AvatarUpload

A full-featured avatar upload component with cropping and editing capabilities.

**Features:**
- Drag-and-drop file selection using `react-dropzone`
- Image cropping and zooming using `react-avatar-editor`
- Image rotation (90° increments)
- File validation (JPG, PNG, WebP, max 5MB)
- Loading and error states
- Dark mode support
- Full accessibility (ARIA labels, keyboard navigation)

**Usage:**
```tsx
import { AvatarUpload } from '@/components/profile';

function ProfilePage() {
  const handleUpload = async (file: File) => {
    // Upload the cropped image file
    await uploadAvatar(file);
  };

  return (
    <AvatarUpload
      currentAvatarUrl="/path/to/current/avatar.jpg"
      onUpload={handleUpload}
    />
  );
}
```

**Props:**
- `currentAvatarUrl?: string | null` - URL of the current avatar to display
- `onUpload: (file: File) => Promise<void>` - Callback when user uploads a new avatar

---

### UserStatsDisplay

Displays user statistics in a responsive grid layout.

**Features:**
- Shows 5 stats: followers, following, favorites, watch later, playlists
- Responsive layout (2 columns on mobile, 5 columns on desktop)
- Optional click handlers for each stat
- Loading skeleton state
- Dark mode support
- Full accessibility

**Usage:**
```tsx
import { UserStatsDisplay } from '@/components/profile';

function ProfilePage() {
  const stats = {
    followers: 150,
    following: 75,
    favorites: 42,
    watchLater: 15,
    playlists: 8,
  };

  const handleStatClick = (stat: keyof typeof stats) => {
    // Navigate to the relevant page
    router.push(`/profile/${stat}`);
  };

  return (
    <UserStatsDisplay
      stats={stats}
      onStatClick={handleStatClick}
      isLoading={false}
    />
  );
}
```

**Props:**
- `stats: UserStats` - Object containing the stat counts
- `onStatClick?: (stat: keyof UserStats) => void` - Optional callback when a stat is clicked
- `isLoading?: boolean` - Show loading skeleton state

**UserStats Type:**
```tsx
interface UserStats {
  followers: number;
  following: number;
  favorites: number;
  watchLater: number;
  playlists: number;
}
```

---

### FollowButton

A button component for following/unfollowing users.

**Features:**
- Shows "Follow" or "Following" based on state
- Optimistic UI updates
- Authentication checks
- Toast notifications for success/error
- Loading states
- Multiple size variants (sm, md, lg)
- Dark mode support
- Full accessibility

**Usage:**
```tsx
import { FollowButton } from '@/components/profile';

function UserCard({ userId }: { userId: string }) {
  const handleFollowChange = (isFollowing: boolean) => {
    // Update UI or refresh data
    console.log(`User is now ${isFollowing ? 'followed' : 'unfollowed'}`);
  };

  return (
    <FollowButton
      userId={userId}
      initialIsFollowing={false}
      onFollowChange={handleFollowChange}
      size="md"
    />
  );
}
```

**Props:**
- `userId: string` - ID of the user to follow/unfollow
- `initialIsFollowing?: boolean` - Initial follow state (default: false)
- `onFollowChange?: (isFollowing: boolean) => void` - Callback when follow state changes
- `size?: 'sm' | 'md' | 'lg'` - Button size (default: 'md')
- `className?: string` - Additional CSS classes

---

## API Client

### Following API (`lib/api/following.ts`)

API client for user following functionality.

**Methods:**
- `followUser(userId: string)` - Follow a user
- `unfollowUser(userId: string)` - Unfollow a user
- `isFollowing(userId: string)` - Check if current user follows specified user
- `getFollowers(userId: string, params?)` - Get user's followers with pagination
- `getFollowing(userId: string, params?)` - Get users that user is following with pagination
- `getFollowCounts(userId: string)` - Get follower and following counts

**Usage:**
```tsx
import { followingApiClient } from '@/lib/api/following';
import { getAuthTokens } from '@/lib/utils/cookies';

// Set up token provider
followingApiClient.setTokenProvider(getAuthTokens);

// Follow a user
await followingApiClient.followUser('user-id');

// Get followers
const { data, meta } = await followingApiClient.getFollowers('user-id', {
  page: 1,
  limit: 20,
});
```

---

## Hook

### useFollowing (`hooks/useFollowing.ts`)

React hook that wraps the following API client.

**Features:**
- Automatic token provider setup
- Loading and error states
- Type-safe methods

**Usage:**
```tsx
import { useFollowing } from '@/hooks/useFollowing';

function FollowButton({ userId }: { userId: string }) {
  const { followUser, unfollowUser, isLoading, error } = useFollowing();

  const handleFollow = async () => {
    try {
      await followUser(userId);
      console.log('Followed successfully!');
    } catch (err) {
      console.error('Failed to follow:', err);
    }
  };

  return (
    <button onClick={handleFollow} disabled={isLoading}>
      {isLoading ? 'Loading...' : 'Follow'}
    </button>
  );
}
```

**Methods:**
- `followUser(userId: string): Promise<void>`
- `unfollowUser(userId: string): Promise<void>`
- `checkFollowStatus(userId: string): Promise<boolean>`
- `getFollowers(userId: string, page?: number, limit?: number): Promise<PaginatedFollowResponse>`
- `getFollowing(userId: string, page?: number, limit?: number): Promise<PaginatedFollowResponse>`
- `getFollowCounts(userId: string): Promise<FollowCounts>`

**State:**
- `isLoading: boolean` - Loading state for API calls
- `error: string | null` - Error message if API call fails

---

## Backend API Endpoints

The components use the following backend API endpoints:

- `POST /users/:id/follow` - Follow a user
- `DELETE /users/:id/follow` - Unfollow a user
- `GET /users/:id/follow-status` - Check follow status
- `GET /users/:id/followers` - Get followers list
- `GET /users/:id/following` - Get following list
- `GET /users/:id/follow-counts` - Get follower/following counts

All endpoints require authentication except for getting followers/following lists and counts.

---

## Dark Mode

All components support dark mode automatically using Tailwind's `dark:` variant. They respond to the user's system preference or the app's theme setting.

## Accessibility

All components follow accessibility best practices:
- Proper ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader friendly
- Semantic HTML elements
- Color contrast compliance

## Dependencies

- `react-dropzone` - File upload functionality
- `react-avatar-editor` - Image cropping and editing
- `lucide-react` - Icons
- Tailwind CSS - Styling
