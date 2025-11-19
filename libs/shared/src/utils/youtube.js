"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractYouTubeVideoId = extractYouTubeVideoId;
exports.extractYouTubeChannelId = extractYouTubeChannelId;
exports.buildYouTubeThumbnailUrl = buildYouTubeThumbnailUrl;
exports.buildYouTubeEmbedUrl = buildYouTubeEmbedUrl;
exports.buildYouTubeWatchUrl = buildYouTubeWatchUrl;
exports.parseDuration = parseDuration;
exports.formatDuration = formatDuration;
function extractYouTubeVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}
function extractYouTubeChannelId(url) {
    const patterns = [
        /youtube\.com\/channel\/([^/?]+)/,
        /youtube\.com\/@([^/?]+)/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}
function buildYouTubeThumbnailUrl(videoId, quality = 'high') {
    const qualityMap = {
        default: 'default',
        medium: 'mqdefault',
        high: 'hqdefault',
        maxres: 'maxresdefault',
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}
function buildYouTubeEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
}
function buildYouTubeWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
}
function parseDuration(isoDuration) {
    // Parse ISO 8601 duration (e.g., "PT4M13S" -> 253 seconds)
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) {
        return 0;
    }
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
}
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
