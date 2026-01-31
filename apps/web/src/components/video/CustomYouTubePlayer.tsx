'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// YouTube IFrame API types
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getVolume(): number;
  setPlaybackRate(rate: number): void;
  getPlaybackRate(): number;
  getAvailablePlaybackRates(): number[];
  getAvailableQualityLevels(): string[];
  setPlaybackQuality(quality: string): void;
  getPlaybackQuality(): string;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getIframe(): HTMLIFrameElement;
  destroy(): void;
}

interface YTPlayerEvent {
  target: YTPlayer;
  data: number;
}

declare namespace YT {
  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };

  class Player {
    constructor(
      elementId: string | HTMLElement,
      options: {
        videoId: string;
        playerVars?: {
          autoplay?: 0 | 1;
          controls?: 0 | 1;
          rel?: 0 | 1;
          modestbranding?: 0 | 1;
          enablejsapi?: 0 | 1;
          origin?: string;
          playsinline?: 0 | 1;
        };
        events?: {
          onReady?: (event: YTPlayerEvent) => void;
          onStateChange?: (event: YTPlayerEvent) => void;
          onError?: (event: YTPlayerEvent) => void;
          onPlaybackQualityChange?: (event: YTPlayerEvent) => void;
        };
      }
    );
  }
}

interface CustomYouTubePlayerProps {
  videoId: string;
  title: string;
  videoDbId?: string; // Database ID for tracking watch history
  onProgress?: (progress: number, duration: number) => void;
  onEnded?: () => void;
  autoplay?: boolean;
  className?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const QUALITY_LABELS: Record<string, string> = {
  hd2160: '4K',
  hd1440: '1440p',
  hd1080: '1080p',
  hd720: '720p',
  large: '480p',
  medium: '360p',
  small: '240p',
  tiny: '144p',
  auto: 'Auto',
};

// Track progress save interval (save every 10 seconds)
const PROGRESS_SAVE_INTERVAL = 10000;
// Minimum watch percentage to save (5%)
const MIN_WATCH_PERCENTAGE = 0.05;

export function CustomYouTubePlayer({
  videoId,
  title,
  videoDbId,
  onProgress,
  onEnded,
  autoplay = false,
  className = '',
}: CustomYouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedProgressRef = useRef<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const [isInPiP, setIsInPiP] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load YouTube IFrame API
  useEffect(() => {
    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        initializePlayer();
        return;
      }

      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );

      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        document.head.appendChild(script);
      }

      window.onYouTubeIframeAPIReady = initializePlayer;
    };

    loadYouTubeAPI();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [videoId]);

  // Initialize the YouTube player
  const initializePlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return;

    const playerId = `youtube-player-${videoId}`;
    const playerDiv = document.createElement('div');
    playerDiv.id = playerId;
    containerRef.current.appendChild(playerDiv);

    playerRef.current = new YT.Player(playerId, {
      videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        playsinline: 1,
        origin: typeof window !== 'undefined' ? window.location.origin : '',
      },
      events: {
        onReady: handlePlayerReady,
        onStateChange: handleStateChange,
        onError: handleError,
        onPlaybackQualityChange: handleQualityChange,
      },
    }) as unknown as YTPlayer;
  }, [videoId, autoplay]);

  const handlePlayerReady = (event: YTPlayerEvent) => {
    setIsLoading(false);
    setDuration(event.target.getDuration());

    // Get available qualities
    const qualities = event.target.getAvailableQualityLevels();
    setAvailableQualities(qualities.length > 0 ? qualities : ['auto']);
    setCurrentQuality(event.target.getPlaybackQuality() || 'auto');

    // Check PiP support
    const iframe = event.target.getIframe();
    setIsPiPSupported(
      document.pictureInPictureEnabled &&
        !iframe.hasAttribute('disablePictureInPicture')
    );

    // Start progress tracking
    startProgressTracking();
  };

  const handleStateChange = (event: YTPlayerEvent) => {
    const state = event.data;

    if (state === YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      startProgressTracking();
    } else if (state === YT.PlayerState.PAUSED) {
      setIsPlaying(false);
    } else if (state === YT.PlayerState.ENDED) {
      setIsPlaying(false);
      saveWatchProgress(true);
      onEnded?.();
    }
  };

  const handleError = (event: YTPlayerEvent) => {
    const errorCodes: Record<number, string> = {
      2: 'Invalid video ID',
      5: 'HTML5 player error',
      100: 'Video not found',
      101: 'Video not embeddable',
      150: 'Video not embeddable',
    };
    setError(errorCodes[event.data] || 'An error occurred');
    setIsLoading(false);
  };

  const handleQualityChange = (event: YTPlayerEvent) => {
    if (playerRef.current) {
      setCurrentQuality(playerRef.current.getPlaybackQuality() || 'auto');
    }
  };

  // Progress tracking
  const startProgressTracking = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current) {
        const time = playerRef.current.getCurrentTime();
        const totalDuration = playerRef.current.getDuration();

        setCurrentTime(time);
        onProgress?.(time, totalDuration);

        // Save progress periodically
        if (time - lastSavedProgressRef.current >= PROGRESS_SAVE_INTERVAL / 1000) {
          saveWatchProgress();
          lastSavedProgressRef.current = time;
        }
      }
    }, 1000);
  };

  // Save watch progress to user history
  const saveWatchProgress = async (completed = false) => {
    if (!videoDbId || !playerRef.current) return;

    const time = playerRef.current.getCurrentTime();
    const totalDuration = playerRef.current.getDuration();
    const watchPercentage = time / totalDuration;

    // Only save if user has watched at least MIN_WATCH_PERCENTAGE
    if (watchPercentage < MIN_WATCH_PERCENTAGE && !completed) return;

    try {
      await apiClient.trackWatchHistory({
        videoId: videoDbId,
        watchDuration: Math.floor(time),
        completed: completed || watchPercentage >= 0.9,
      });
    } catch {
      // Silently fail - watch history is not critical
      console.debug('Failed to save watch progress');
    }
  };

  // Player controls
  const togglePlay = () => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;

    if (isMuted) {
      playerRef.current.unMute();
    } else {
      playerRef.current.mute();
    }
    setIsMuted(!isMuted);
  };

  const seekTo = (seconds: number) => {
    if (!playerRef.current) return;
    playerRef.current.seekTo(seconds, true);
    setCurrentTime(seconds);
  };

  const seekRelative = (delta: number) => {
    if (!playerRef.current) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + delta));
    seekTo(newTime);
  };

  const changeSpeed = (speed: number) => {
    if (!playerRef.current) return;
    playerRef.current.setPlaybackRate(speed);
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const changeQuality = (quality: string) => {
    if (!playerRef.current) return;
    playerRef.current.setPlaybackQuality(quality);
    setCurrentQuality(quality);
    setShowQualityMenu(false);
  };

  const togglePictureInPicture = async () => {
    if (!playerRef.current || !isPiPSupported) return;

    const iframe = playerRef.current.getIframe();

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsInPiP(false);
      } else {
        // PiP for iframes requires the video element inside
        // This is a workaround using the iframe's contentWindow
        const video = iframe.contentDocument?.querySelector('video');
        if (video && 'requestPictureInPicture' in video) {
          await (video as HTMLVideoElement).requestPictureInPicture();
          setIsInPiP(true);
        }
      }
    } catch {
      console.debug('PiP not available for this video');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Only handle when player container is focused or no specific element is focused
      const isPlayerFocused =
        containerRef.current?.contains(document.activeElement) ||
        document.activeElement === document.body;

      if (!isPlayerFocused) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (playerRef.current) {
            const volume = Math.min(100, playerRef.current.getVolume() + 10);
            playerRef.current.setVolume(volume);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (playerRef.current) {
            const volume = Math.max(0, playerRef.current.getVolume() - 10);
            playerRef.current.setVolume(volume);
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'j':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'l':
          e.preventDefault();
          seekRelative(10);
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          seekTo(duration * (parseInt(e.key) / 10));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration, isMuted]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div
        className={`relative aspect-video bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center ${className}`}
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center text-white p-4">
          <svg
            className="w-12 h-12 mx-auto mb-2 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-lg font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video bg-gray-900 rounded-lg overflow-hidden group ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      tabIndex={0}
      role="application"
      aria-label={`Video player: ${title}`}
      aria-describedby="player-keyboard-help"
    >
      {/* Screen reader instructions */}
      <div id="player-keyboard-help" className="sr-only">
        Press Space or K to play/pause. Arrow left/right to seek 5 seconds.
        Arrow up/down to adjust volume. M to mute/unmute. F for fullscreen.
        Number keys 0-9 to seek to percentage of video.
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          role="status"
          aria-label="Loading video player"
        >
          <div className="absolute inset-0 bg-gray-800 animate-pulse" />
          <div className="relative flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-gray-600 border-t-primary-500 rounded-full animate-spin" />
            <p className="mt-4 text-gray-400 text-sm">Loading player...</p>
          </div>
          {/* Skeleton control bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="h-1 bg-gray-700 rounded mb-3" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full" />
                <div className="w-10 h-10 bg-gray-700 rounded-full" />
                <div className="w-20 h-4 bg-gray-700 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-16 h-8 bg-gray-700 rounded" />
                <div className="w-16 h-8 bg-gray-700 rounded" />
                <div className="w-10 h-10 bg-gray-700 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Controls Overlay */}
      <div
        className={`absolute inset-0 z-20 flex flex-col justify-end transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"
          aria-hidden="true"
        />

        {/* Center play button */}
        <button
          onClick={togglePlay}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 flex items-center justify-center bg-black/50 hover:bg-black/70 rounded-full transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-transparent"
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          {isPlaying ? (
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Bottom controls */}
        <div className="relative p-4 pt-8">
          {/* Progress bar */}
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500 hover:h-2 transition-all"
              aria-label="Video progress"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            />
            <div
              className="h-1 bg-primary-500 rounded-lg pointer-events-none -mt-1"
              style={{ width: `${progressPercentage}%` }}
              aria-hidden="true"
            />
          </div>

          <div className="flex items-center justify-between">
            {/* Left controls */}
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Mute */}
              <button
                onClick={toggleMute}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4a1 1 0 00-1 1v4a1 1 0 001 1h3l3.29 3.29a1 1 0 001.71-.7v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91a.998.998 0 00.62 1.9c.87-.28 1.68-.72 2.4-1.28l1.77 1.77a.996.996 0 101.41-1.41L5.05 3.63a.996.996 0 00-1.42 0zM19 12c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zm-7-8l-1.88 1.88L12 7.76zm4.5 8A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>

              {/* Time display */}
              <span className="text-white text-sm font-medium" aria-live="off">
                <span aria-label="Current time">{formatTime(currentTime)}</span>
                {' / '}
                <span aria-label="Duration">{formatTime(duration)}</span>
              </span>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {/* Speed selector */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSpeedMenu(!showSpeedMenu);
                    setShowQualityMenu(false);
                  }}
                  className="px-3 py-1 text-white text-sm font-medium hover:bg-white/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label={`Playback speed: ${playbackSpeed}x`}
                  aria-expanded={showSpeedMenu}
                  aria-haspopup="listbox"
                >
                  {playbackSpeed}x
                </button>
                {showSpeedMenu && (
                  <div
                    className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg shadow-lg overflow-hidden"
                    role="listbox"
                    aria-label="Playback speed options"
                  >
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => changeSpeed(speed)}
                        className={`block w-full px-4 py-2 text-left text-sm transition-colors focus:outline-none focus:bg-primary-600 ${
                          playbackSpeed === speed
                            ? 'bg-primary-600 text-white'
                            : 'text-gray-300 hover:bg-gray-800'
                        }`}
                        role="option"
                        aria-selected={playbackSpeed === speed}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quality selector */}
              {availableQualities.length > 1 && (
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowQualityMenu(!showQualityMenu);
                      setShowSpeedMenu(false);
                    }}
                    className="px-3 py-1 text-white text-sm font-medium hover:bg-white/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-label={`Video quality: ${QUALITY_LABELS[currentQuality] || currentQuality}`}
                    aria-expanded={showQualityMenu}
                    aria-haspopup="listbox"
                  >
                    {QUALITY_LABELS[currentQuality] || currentQuality}
                  </button>
                  {showQualityMenu && (
                    <div
                      className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto"
                      role="listbox"
                      aria-label="Video quality options"
                    >
                      {availableQualities.map((quality) => (
                        <button
                          key={quality}
                          onClick={() => changeQuality(quality)}
                          className={`block w-full px-4 py-2 text-left text-sm transition-colors focus:outline-none focus:bg-primary-600 ${
                            currentQuality === quality
                              ? 'bg-primary-600 text-white'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                          role="option"
                          aria-selected={currentQuality === quality}
                        >
                          {QUALITY_LABELS[quality] || quality}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Picture-in-Picture */}
              {isPiPSupported && (
                <button
                  onClick={togglePictureInPicture}
                  className={`p-2 text-white hover:bg-white/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    isInPiP ? 'bg-primary-600' : ''
                  }`}
                  aria-label={isInPiP ? 'Exit picture-in-picture' : 'Enter picture-in-picture'}
                  aria-pressed={isInPiP}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" />
                  </svg>
                </button>
              )}

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Toggle fullscreen"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Click overlay to toggle play/pause */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={togglePlay}
        aria-hidden="true"
      />
    </div>
  );
}

export default CustomYouTubePlayer;
