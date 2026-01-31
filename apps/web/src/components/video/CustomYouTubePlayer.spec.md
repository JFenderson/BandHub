# CustomYouTubePlayer Component Specification

## Overview

A custom YouTube video player component built on the YouTube IFrame Player API with advanced controls, accessibility features, and watch history tracking.

## Features

| Feature | Description |
|---------|-------------|
| YouTube IFrame API | Full integration with YouTube's JavaScript API for programmatic control |
| Custom Controls | Overlay controls replacing default YouTube UI |
| Playback Speed | Selectable speeds: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x |
| Quality Selector | Dynamic quality options based on video availability |
| Keyboard Shortcuts | Full keyboard navigation and control |
| Picture-in-Picture | PiP mode support (when browser supports it) |
| Watch History | Automatic progress tracking saved to user history |
| Loading Skeleton | Animated skeleton UI during initialization |
| Accessibility | ARIA labels, roles, and keyboard navigation |

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `videoId` | `string` | Yes | - | YouTube video ID (e.g., `dQw4w9WgXcQ`) |
| `title` | `string` | Yes | - | Video title for accessibility |
| `videoDbId` | `string` | No | - | Database ID for watch history tracking |
| `onProgress` | `(progress: number, duration: number) => void` | No | - | Callback fired every second with current time and duration |
| `onEnded` | `() => void` | No | - | Callback fired when video ends |
| `autoplay` | `boolean` | No | `false` | Auto-start video on load |
| `className` | `string` | No | `''` | Additional CSS classes |

---

## Usage

### Basic Usage

```tsx
import { CustomYouTubePlayer } from '@/components/video';

<CustomYouTubePlayer
  videoId="dQw4w9WgXcQ"
  title="Never Gonna Give You Up"
/>
```

### With Watch History Tracking

```tsx
<CustomYouTubePlayer
  videoId="dQw4w9WgXcQ"
  title="Never Gonna Give You Up"
  videoDbId="clx1234567890" // Database video ID
/>
```

### With Callbacks

```tsx
<CustomYouTubePlayer
  videoId="dQw4w9WgXcQ"
  title="Video Title"
  videoDbId="clx1234567890"
  autoplay={true}
  onProgress={(time, duration) => {
    console.log(`Progress: ${time}/${duration} seconds`);
  }}
  onEnded={() => {
    console.log('Video finished');
    // Navigate to next video, show recommendations, etc.
  }}
/>
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` or `K` | Play/Pause |
| `Arrow Left` | Seek backward 5 seconds |
| `Arrow Right` | Seek forward 5 seconds |
| `J` | Seek backward 10 seconds |
| `L` | Seek forward 10 seconds |
| `Arrow Up` | Increase volume 10% |
| `Arrow Down` | Decrease volume 10% |
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `0-9` | Seek to 0%-90% of video |

**Note:** Keyboard shortcuts are disabled when focus is on input fields.

---

## Watch History Integration

### Tracking Behavior

- Progress is saved every **10 seconds** while playing
- Minimum **5%** of video must be watched before saving
- Video marked as **completed** when ≥90% watched or video ends
- Tracking requires `videoDbId` prop to be set
- Tracking fails silently (non-critical feature)

### API Endpoint

```
POST /api/v1/watch-history/track
```

**Request Body:**
```json
{
  "videoId": "clx1234567890",
  "watchDuration": 125,
  "completed": false
}
```

**Response:**
```json
{
  "id": "wh_abc123",
  "userId": "user_xyz",
  "videoId": "clx1234567890",
  "watchedAt": "2025-01-25T12:00:00Z",
  "watchDuration": 125,
  "completed": false,
  "video": {
    "id": "clx1234567890",
    "title": "Video Title",
    "thumbnailUrl": "https://...",
    "band": { "id": "...", "name": "...", "slug": "..." },
    "category": { "id": "...", "name": "...", "slug": "..." }
  }
}
```

---

## Quality Levels

Available quality levels depend on the video. The component displays human-readable labels:

| API Value | Display Label |
|-----------|---------------|
| `hd2160` | 4K |
| `hd1440` | 1440p |
| `hd1080` | 1080p |
| `hd720` | 720p |
| `large` | 480p |
| `medium` | 360p |
| `small` | 240p |
| `tiny` | 144p |
| `auto` | Auto |

---

## Accessibility

### ARIA Attributes

| Element | Attributes |
|---------|------------|
| Container | `role="application"`, `aria-label`, `aria-describedby` |
| Play button | `aria-label="Play video"` / `"Pause video"` |
| Mute button | `aria-label="Mute"` / `"Unmute"` |
| Progress slider | `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext` |
| Speed menu | `aria-expanded`, `aria-haspopup="listbox"` |
| Quality menu | `aria-expanded`, `aria-haspopup="listbox"` |
| Menu options | `role="option"`, `aria-selected` |
| PiP button | `aria-label`, `aria-pressed` |
| Error state | `role="alert"`, `aria-live="assertive"` |

### Screen Reader Support

Hidden instructions are provided via `sr-only` class:

> "Press Space or K to play/pause. Arrow left/right to seek 5 seconds. Arrow up/down to adjust volume. M to mute/unmute. F for fullscreen. Number keys 0-9 to seek to percentage of video."

### Focus Management

- Container is focusable (`tabIndex={0}`)
- All buttons have visible focus rings (`focus:ring-2 focus:ring-primary-500`)
- Keyboard shortcuts only active when player or body is focused

---

## States

### Loading State

Displays animated skeleton with:
- Pulsing background
- Spinning loader with "Loading player..." text
- Skeleton control bar

### Error State

Displays error message with icon for:
- Invalid video ID (code 2)
- HTML5 player error (code 5)
- Video not found (code 100)
- Video not embeddable (codes 101, 150)

### Playing State

- Controls auto-hide after 3 seconds of inactivity
- Controls reappear on mouse movement
- Large center play/pause button
- Bottom control bar with all controls

---

## Component Structure

```
CustomYouTubePlayer
├── Container (ref, keyboard handlers, mouse handlers)
│   ├── Screen Reader Instructions (sr-only)
│   ├── Loading Skeleton (conditional)
│   │   ├── Pulse Background
│   │   ├── Spinner + Text
│   │   └── Skeleton Control Bar
│   ├── Error Display (conditional)
│   │   ├── Warning Icon
│   │   └── Error Message
│   ├── YouTube Player (injected div)
│   ├── Controls Overlay
│   │   ├── Gradient Background
│   │   ├── Center Play Button
│   │   └── Bottom Control Bar
│   │       ├── Progress Slider
│   │       ├── Left Controls
│   │       │   ├── Play/Pause
│   │       │   ├── Mute
│   │       │   └── Time Display
│   │       └── Right Controls
│   │           ├── Speed Selector
│   │           ├── Quality Selector
│   │           ├── PiP Button
│   │           └── Fullscreen Button
│   └── Click Overlay (play/pause on click)
```

---

## Dependencies

### External

- **YouTube IFrame Player API** - Loaded dynamically from `https://www.youtube.com/iframe_api`

### Internal

- `@/lib/api-client` - For watch history tracking

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Basic playback | ✅ | ✅ | ✅ | ✅ |
| Keyboard shortcuts | ✅ | ✅ | ✅ | ✅ |
| Picture-in-Picture | ✅ | ✅ | ✅* | ✅ |
| Quality selection | ✅ | ✅ | ✅ | ✅ |
| Fullscreen | ✅ | ✅ | ✅ | ✅ |

*Safari PiP may have limitations with iframe content.

---

## Styling

### Tailwind Classes Used

- **Container:** `aspect-video`, `bg-gray-900`, `rounded-lg`, `overflow-hidden`
- **Controls:** `bg-black/50`, `hover:bg-black/70`, `transition-all`
- **Buttons:** `rounded-full`, `focus:ring-2`, `focus:ring-primary-500`
- **Menus:** `bg-gray-900`, `rounded-lg`, `shadow-lg`
- **Animations:** `animate-spin`, `animate-pulse`, `transition-opacity`

### Customization

Pass additional classes via the `className` prop:

```tsx
<CustomYouTubePlayer
  videoId="..."
  title="..."
  className="max-w-4xl mx-auto shadow-2xl"
/>
```

---

## Future Enhancements

- [ ] Chapters support (if available in video metadata)
- [ ] Captions/subtitles toggle
- [ ] Playback speed keyboard shortcuts (< and >)
- [ ] Theater mode
- [ ] Mini player mode
- [ ] Share timestamp functionality
- [ ] Loop mode toggle
