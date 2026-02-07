# HBCU Band Hub API Integration Guide

Complete documentation for integrating with the HBCU Band Hub API.

**Base URL:** `https://api.hbcubandhub.com/api` (Production)
**Sandbox URL:** `http://localhost:3001/api` (Development)
**API Version:** v1
**Interactive Docs:** `/api/docs` (Swagger UI)

---

## Table of Contents

1. [Getting Started](#getting-started)
   - [Authentication](#authentication)
   - [API Keys](#api-keys)
   - [Rate Limits](#rate-limits)
2. [Code Examples](#code-examples)
   - [JavaScript/TypeScript](#javascripttypescript)
   - [Python](#python)
   - [cURL](#curl)
3. [Common Use Cases](#common-use-cases)
   - [Fetch Latest Videos](#fetch-latest-videos)
   - [Search Bands](#search-bands)
   - [Get Trending Videos](#get-trending-videos)
   - [User Authentication Flow](#user-authentication-flow)
4. [Error Handling](#error-handling)
   - [Error Codes](#error-codes)
   - [Retry Logic](#retry-logic)
   - [Troubleshooting](#troubleshooting)
5. [Webhooks](#webhooks)
6. [SDK Documentation](#sdk-documentation)
7. [FAQ & Best Practices](#faq--best-practices)
8. [Postman Collection](#postman-collection)

---

## Getting Started

### Authentication

The HBCU Band Hub API supports two authentication methods:

#### 1. JWT Bearer Token (Recommended for User Sessions)

Obtain a JWT token by authenticating with user credentials:

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourSecurePassword123!"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "expiresIn": 900,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "USER"
  }
}
```

Use the token in subsequent requests:

```http
GET /api/users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Details:**
- **Access Token Expiry:** 15 minutes (900 seconds)
- **Algorithm:** HS256
- **Token Payload:** Contains `sub` (user ID), `email`, `role`, `userType`, `iat`, `exp`

#### 2. API Key (Recommended for Server-to-Server)

For machine-to-machine communication, use API keys:

```http
GET /api/videos
X-API-Key: your-api-key-here
```

**Note:** API keys are issued by administrators. Contact the admin team to request an API key for your application.

#### Token Refresh

When your access token expires, use the refresh token to obtain a new one:

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### API Keys

API keys provide secure, long-lived authentication for server applications.

#### Key Features

| Feature | Description |
|---------|-------------|
| **Format** | UUID-based keys |
| **Expiration** | Optional, configurable |
| **Rotation** | Supports grace periods for seamless rotation |
| **Usage Tracking** | Automatic request counting and last-used timestamps |
| **Revocation** | Immediate disable without deletion |

#### Requesting an API Key

1. Register for an account at the HBCU Band Hub portal
2. Contact the admin team via support@hbcubandhub.com
3. Provide your use case and expected request volume
4. Receive your API key via secure channel

#### Best Practices

- **Never expose API keys in client-side code**
- Store keys in environment variables or secrets managers
- Rotate keys periodically (recommended: every 90 days)
- Monitor usage statistics via the admin dashboard

### Rate Limits

The API implements distributed rate limiting to ensure fair usage.

#### Default Limits by Endpoint Type

| Endpoint Type | Limit | Window | Notes |
|--------------|-------|--------|-------|
| **Public Endpoints** | 100 requests | 1 hour | Per IP address |
| **Authentication** | 5 requests | 15 minutes | Per IP address |
| **Search** | 20 requests | 1 minute | Per IP or user |
| **Admin Endpoints** | 1,000 requests | 1 hour | For admin roles |
| **File Upload** | 10 requests | 1 hour | Per user |

#### Specific Endpoint Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/register` | 3 | 1 hour |
| `POST /auth/login` | 5 | 15 minutes |
| `POST /auth/forgot-password` | 3 | 1 hour |
| `GET /search` | 20 | 1 minute |
| `POST /reviews` | 10 | 1 hour |
| `POST /reviews/:id/vote` | 50 | 1 hour |

#### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699876543
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |

#### Rate Limit Exceeded Response

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please wait before making more requests.",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/search"
}
```

---

## Code Examples

### JavaScript/TypeScript

#### Setup with Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.hbcubandhub.com/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add authentication interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api.request(error.config);
        } catch (refreshError) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

#### Authentication

```javascript
// Login
async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data.user;
}

// Register
async function register(email, password, name) {
  const { data } = await api.post('/auth/register', { email, password, name });
  return data;
}

// Get current user
async function getCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data;
}

// Logout
async function logout() {
  await api.post('/auth/logout');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}
```

#### Fetching Videos

```javascript
// Get all videos with pagination
async function getVideos({ page = 1, limit = 20, bandId, category, sortBy } = {}) {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (bandId) params.set('bandId', bandId);
  if (category) params.set('category', category);
  if (sortBy) params.set('sortBy', sortBy);

  const { data } = await api.get(`/videos?${params}`);
  return data;
}

// Get single video
async function getVideo(videoId) {
  const { data } = await api.get(`/videos/${videoId}`);
  return data;
}

// Get trending videos
async function getTrendingVideos() {
  const { data } = await api.get('/videos/trending');
  return data;
}

// Get related videos
async function getRelatedVideos(videoId) {
  const { data } = await api.get(`/videos/${videoId}/related`);
  return data;
}
```

#### Search

```javascript
// Full-text search with filters
async function searchVideos({
  query,
  bandIds,
  categoryIds,
  dateFrom,
  dateTo,
  conferences,
  years,
  sortBy = 'relevance',
  page = 1,
  limit = 20,
} = {}) {
  const params = new URLSearchParams();

  if (query) params.set('query', query);
  if (bandIds?.length) params.set('bandIds', bandIds.join(','));
  if (categoryIds?.length) params.set('categoryIds', categoryIds.join(','));
  if (dateFrom) params.set('dateFrom', dateFrom.toISOString());
  if (dateTo) params.set('dateTo', dateTo.toISOString());
  if (conferences?.length) params.set('conferences', conferences.join(','));
  if (years?.length) params.set('years', years.join(','));
  params.set('sortBy', sortBy);
  params.set('page', page);
  params.set('limit', limit);

  const { data } = await api.get(`/search?${params}`);
  return data;
}

// Get autocomplete suggestions
async function getAutocomplete(query) {
  const { data } = await api.get(`/search/autocomplete?query=${encodeURIComponent(query)}`);
  return data;
}

// Get available filters
async function getSearchFilters() {
  const { data } = await api.get('/search/filters');
  return data;
}
```

#### Bands

```javascript
// Get all bands
async function getBands({ page = 1, limit = 20, conference } = {}) {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (conference) params.set('conference', conference);

  const { data } = await api.get(`/bands?${params}`);
  return data;
}

// Get featured bands
async function getFeaturedBands() {
  const { data } = await api.get('/bands/featured');
  return data;
}

// Get band by slug
async function getBandBySlug(slug) {
  const { data } = await api.get(`/bands/slug/${slug}`);
  return data;
}

// Get band by ID
async function getBand(bandId) {
  const { data } = await api.get(`/bands/${bandId}`);
  return data;
}
```

#### Favorites & Following

```javascript
// Add video to favorites
async function addFavorite(videoId) {
  await api.post(`/favorites/videos/${videoId}`);
}

// Remove from favorites
async function removeFavorite(videoId) {
  await api.delete(`/favorites/videos/${videoId}`);
}

// Get user's favorites
async function getFavorites() {
  const { data } = await api.get('/favorites/videos');
  return data;
}

// Follow a band
async function followBand(bandId) {
  await api.post(`/favorites/bands/${bandId}`);
}

// Unfollow a band
async function unfollowBand(bandId) {
  await api.delete(`/favorites/bands/${bandId}`);
}

// Get followed bands
async function getFollowedBands() {
  const { data } = await api.get('/favorites/bands');
  return data;
}
```

### Python

#### Setup with Requests

```python
import requests
from typing import Optional, Dict, Any, List
from datetime import datetime
import time


class BandHubAPI:
    """HBCU Band Hub API Client"""

    def __init__(
        self,
        base_url: str = "https://api.hbcubandhub.com/api",
        api_key: Optional[str] = None,
        timeout: int = 30,
    ):
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with authentication."""
        headers = {}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        elif self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        retry_count: int = 3,
    ) -> Dict[str, Any]:
        """Make an API request with automatic retry logic."""
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()

        for attempt in range(retry_count):
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    json=data,
                    params=params,
                    headers=headers,
                    timeout=self.timeout,
                )

                # Handle rate limiting
                if response.status_code == 429:
                    reset_time = int(response.headers.get("X-RateLimit-Reset", 0))
                    wait_time = max(reset_time - int(time.time()), 1)
                    if attempt < retry_count - 1:
                        time.sleep(min(wait_time, 60))
                        continue
                    raise RateLimitError(response.json())

                # Handle token refresh
                if response.status_code == 401 and self.refresh_token:
                    self._refresh_access_token()
                    headers = self._get_headers()
                    continue

                response.raise_for_status()
                return response.json() if response.text else {}

            except requests.exceptions.RequestException as e:
                if attempt == retry_count - 1:
                    raise APIError(f"Request failed: {str(e)}")
                time.sleep(2 ** attempt)  # Exponential backoff

        raise APIError("Max retries exceeded")

    def _refresh_access_token(self):
        """Refresh the access token using the refresh token."""
        response = self.session.post(
            f"{self.base_url}/auth/refresh",
            json={"refreshToken": self.refresh_token},
        )
        if response.status_code == 200:
            data = response.json()
            self.access_token = data["accessToken"]
        else:
            self.access_token = None
            self.refresh_token = None
            raise AuthenticationError("Token refresh failed")

    # Authentication Methods
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """Authenticate user and store tokens."""
        data = self._request("POST", "/auth/login", data={"email": email, "password": password})
        self.access_token = data["accessToken"]
        self.refresh_token = data["refreshToken"]
        return data["user"]

    def register(self, email: str, password: str, name: str) -> Dict[str, Any]:
        """Register a new user account."""
        return self._request(
            "POST", "/auth/register",
            data={"email": email, "password": password, "name": name}
        )

    def get_current_user(self) -> Dict[str, Any]:
        """Get the current authenticated user's profile."""
        return self._request("GET", "/auth/me")

    def logout(self):
        """Logout and clear tokens."""
        self._request("POST", "/auth/logout")
        self.access_token = None
        self.refresh_token = None

    # Video Methods
    def get_videos(
        self,
        page: int = 1,
        limit: int = 20,
        band_id: Optional[str] = None,
        category: Optional[str] = None,
        sort_by: str = "publishedAt",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        """Get paginated list of videos."""
        params = {
            "page": page,
            "limit": limit,
            "sortBy": sort_by,
            "sortOrder": sort_order,
        }
        if band_id:
            params["bandId"] = band_id
        if category:
            params["category"] = category
        return self._request("GET", "/videos", params=params)

    def get_video(self, video_id: str) -> Dict[str, Any]:
        """Get a single video by ID."""
        return self._request("GET", f"/videos/{video_id}")

    def get_trending_videos(self) -> List[Dict[str, Any]]:
        """Get trending videos."""
        return self._request("GET", "/videos/trending")

    def get_related_videos(self, video_id: str) -> List[Dict[str, Any]]:
        """Get videos related to a specific video."""
        return self._request("GET", f"/videos/{video_id}/related")

    # Search Methods
    def search(
        self,
        query: Optional[str] = None,
        band_ids: Optional[List[str]] = None,
        category_ids: Optional[List[str]] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        conferences: Optional[List[str]] = None,
        years: Optional[List[int]] = None,
        sort_by: str = "relevance",
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """Search videos with filters."""
        params = {"sortBy": sort_by, "page": page, "limit": limit}
        if query:
            params["query"] = query
        if band_ids:
            params["bandIds"] = ",".join(band_ids)
        if category_ids:
            params["categoryIds"] = ",".join(category_ids)
        if date_from:
            params["dateFrom"] = date_from.isoformat()
        if date_to:
            params["dateTo"] = date_to.isoformat()
        if conferences:
            params["conferences"] = ",".join(conferences)
        if years:
            params["years"] = ",".join(map(str, years))
        return self._request("GET", "/search", params=params)

    def get_autocomplete(self, query: str) -> List[Dict[str, Any]]:
        """Get autocomplete suggestions."""
        return self._request("GET", "/search/autocomplete", params={"query": query})

    # Band Methods
    def get_bands(
        self,
        page: int = 1,
        limit: int = 20,
        conference: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of bands."""
        params = {"page": page, "limit": limit}
        if conference:
            params["conference"] = conference
        return self._request("GET", "/bands", params=params)

    def get_featured_bands(self) -> List[Dict[str, Any]]:
        """Get featured bands."""
        return self._request("GET", "/bands/featured")

    def get_band_by_slug(self, slug: str) -> Dict[str, Any]:
        """Get a band by its URL slug."""
        return self._request("GET", f"/bands/slug/{slug}")

    def get_band(self, band_id: str) -> Dict[str, Any]:
        """Get a band by ID."""
        return self._request("GET", f"/bands/{band_id}")

    # Favorites Methods
    def add_favorite(self, video_id: str):
        """Add a video to favorites."""
        return self._request("POST", f"/favorites/videos/{video_id}")

    def remove_favorite(self, video_id: str):
        """Remove a video from favorites."""
        return self._request("DELETE", f"/favorites/videos/{video_id}")

    def get_favorites(self) -> List[Dict[str, Any]]:
        """Get user's favorite videos."""
        return self._request("GET", "/favorites/videos")

    def follow_band(self, band_id: str):
        """Follow a band."""
        return self._request("POST", f"/favorites/bands/{band_id}")

    def unfollow_band(self, band_id: str):
        """Unfollow a band."""
        return self._request("DELETE", f"/favorites/bands/{band_id}")

    def get_followed_bands(self) -> List[Dict[str, Any]]:
        """Get followed bands."""
        return self._request("GET", "/favorites/bands")


# Custom Exceptions
class APIError(Exception):
    """Base API error."""
    pass


class AuthenticationError(APIError):
    """Authentication failed."""
    pass


class RateLimitError(APIError):
    """Rate limit exceeded."""
    pass


# Usage Example
if __name__ == "__main__":
    # Initialize with API key (server-to-server)
    api = BandHubAPI(api_key="your-api-key")

    # Or initialize for user authentication
    api = BandHubAPI()
    user = api.login("user@example.com", "password123")
    print(f"Logged in as: {user['name']}")

    # Fetch trending videos
    trending = api.get_trending_videos()
    for video in trending[:5]:
        print(f"- {video['title']}")

    # Search for videos
    results = api.search(
        query="halftime show",
        conferences=["SWAC", "MEAC"],
        years=[2023, 2024],
    )
    print(f"Found {results['meta']['total']} videos")
```

### cURL

#### Authentication

```bash
# Register a new user
curl -X POST https://api.hbcubandhub.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }'

# Login
curl -X POST https://api.hbcubandhub.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'

# Get current user profile (with token)
curl https://api.hbcubandhub.com/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Refresh token
curl -X POST https://api.hbcubandhub.com/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'

# Logout
curl -X POST https://api.hbcubandhub.com/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Videos

```bash
# Get all videos (paginated)
curl "https://api.hbcubandhub.com/api/videos?page=1&limit=20"

# Get videos with filters
curl "https://api.hbcubandhub.com/api/videos?bandId=BAND_ID&category=HALFTIME&sortBy=publishedAt&sortOrder=desc"

# Get single video
curl https://api.hbcubandhub.com/api/videos/VIDEO_ID

# Get trending videos
curl https://api.hbcubandhub.com/api/videos/trending

# Get related videos
curl https://api.hbcubandhub.com/api/videos/VIDEO_ID/related
```

#### Search

```bash
# Basic search
curl "https://api.hbcubandhub.com/api/search?query=halftime%20show"

# Advanced search with filters
curl "https://api.hbcubandhub.com/api/search?query=battle&conferences=SWAC,MEAC&years=2023,2024&sortBy=relevance&limit=20"

# Get autocomplete suggestions
curl "https://api.hbcubandhub.com/api/search/autocomplete?query=south"

# Get search filters
curl https://api.hbcubandhub.com/api/search/filters

# Get popular searches
curl https://api.hbcubandhub.com/api/search/popular
```

#### Bands

```bash
# Get all bands
curl "https://api.hbcubandhub.com/api/bands?page=1&limit=20"

# Get featured bands
curl https://api.hbcubandhub.com/api/bands/featured

# Get band by slug
curl https://api.hbcubandhub.com/api/bands/slug/southern-university

# Get band by ID
curl https://api.hbcubandhub.com/api/bands/BAND_ID
```

#### Favorites (Requires Authentication)

```bash
# Add to favorites
curl -X POST https://api.hbcubandhub.com/api/favorites/videos/VIDEO_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Remove from favorites
curl -X DELETE https://api.hbcubandhub.com/api/favorites/videos/VIDEO_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Get favorites
curl https://api.hbcubandhub.com/api/favorites/videos \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Follow a band
curl -X POST https://api.hbcubandhub.com/api/favorites/bands/BAND_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Using API Key

```bash
# All requests can use API key authentication
curl https://api.hbcubandhub.com/api/videos \
  -H "X-API-Key: YOUR_API_KEY"

curl "https://api.hbcubandhub.com/api/search?query=grambling" \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## Common Use Cases

### Fetch Latest Videos

Get the most recently published videos across all bands:

```javascript
// JavaScript
const latestVideos = await api.get('/videos', {
  params: {
    sortBy: 'publishedAt',
    sortOrder: 'desc',
    limit: 10,
  },
});
```

```python
# Python
latest_videos = api.get_videos(sort_by="publishedAt", sort_order="desc", limit=10)
```

```bash
# cURL
curl "https://api.hbcubandhub.com/api/videos?sortBy=publishedAt&sortOrder=desc&limit=10"
```

**Response Structure:**
```json
{
  "data": [
    {
      "id": "video-uuid",
      "title": "Southern University Halftime Show 2024",
      "description": "Full halftime performance at the Bayou Classic",
      "youtubeId": "abc123xyz",
      "thumbnailUrl": "https://img.youtube.com/vi/abc123xyz/maxresdefault.jpg",
      "duration": 1245,
      "viewCount": 150000,
      "publishedAt": "2024-01-15T18:30:00.000Z",
      "band": {
        "id": "band-uuid",
        "name": "Southern University Human Jukebox",
        "slug": "southern-university"
      },
      "category": {
        "id": "category-uuid",
        "name": "Halftime Shows",
        "slug": "halftime"
      }
    }
  ],
  "meta": {
    "total": 2500,
    "page": 1,
    "limit": 10,
    "pages": 250,
    "hasMore": true
  }
}
```

### Search Bands

Find bands by name, conference, or location:

```javascript
// JavaScript - Search bands by conference
const swacBands = await api.get('/bands', {
  params: {
    conference: 'SWAC',
    page: 1,
    limit: 20,
  },
});

// Search for a specific band
const searchResults = await api.get('/search', {
  params: {
    query: 'grambling',
    sortBy: 'relevance',
  },
});
```

```python
# Python
swac_bands = api.get_bands(conference="SWAC")

# Get band details
grambling = api.get_band_by_slug("grambling-state")
```

**Available Conferences:**
- `SWAC` - Southwestern Athletic Conference
- `MEAC` - Mid-Eastern Athletic Conference
- `SIAC` - Southern Intercollegiate Athletic Conference
- `CIAA` - Central Intercollegiate Athletic Association

### Get Trending Videos

Retrieve videos with the highest engagement:

```javascript
// JavaScript
const trending = await api.get('/videos/trending');
```

```python
# Python
trending = api.get_trending_videos()
```

**Trending Algorithm:**
Videos are ranked using a weighted scoring system based on:
- Recent view count growth
- Engagement rate (likes, comments)
- Recency of publication
- Social sharing metrics

### User Authentication Flow

Complete authentication implementation:

```javascript
// JavaScript - Full authentication flow
class AuthService {
  constructor(api) {
    this.api = api;
    this.user = null;
  }

  async login(email, password) {
    try {
      const { data } = await this.api.post('/auth/login', { email, password });

      // Store tokens securely
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      this.user = data.user;
      return { success: true, user: this.user };
    } catch (error) {
      if (error.response?.status === 401) {
        return { success: false, error: 'Invalid credentials' };
      }
      if (error.response?.status === 429) {
        return { success: false, error: 'Too many attempts. Please wait.' };
      }
      throw error;
    }
  }

  async register(email, password, name) {
    const { data } = await this.api.post('/auth/register', { email, password, name });
    return data;
  }

  async verifyEmail(token) {
    const { data } = await this.api.get(`/auth/verify-email/${token}`);
    return data;
  }

  async forgotPassword(email) {
    await this.api.post('/auth/forgot-password', { email });
  }

  async resetPassword(token, newPassword) {
    await this.api.post('/auth/reset-password', { token, password: newPassword });
  }

  async refreshSession() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const { data } = await this.api.post('/auth/refresh', { refreshToken });
    localStorage.setItem('accessToken', data.accessToken);
    return data;
  }

  async logout() {
    await this.api.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.user = null;
  }

  async logoutAllDevices() {
    await this.api.post('/auth/logout-all');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    this.user = null;
  }
}
```

---

## Error Handling

### Error Codes

The API uses standard HTTP status codes with detailed error responses.

#### Client Errors (4xx)

| Code | Name | Description | Common Causes |
|------|------|-------------|---------------|
| 400 | Bad Request | Invalid request data | Validation errors, malformed JSON |
| 401 | Unauthorized | Authentication required | Missing/expired token, invalid API key |
| 403 | Forbidden | Insufficient permissions | Role-based access denial |
| 404 | Not Found | Resource doesn't exist | Invalid ID, deleted resource |
| 409 | Conflict | Resource conflict | Duplicate email, username taken |
| 422 | Unprocessable Entity | Semantic errors | Business logic validation failure |
| 429 | Too Many Requests | Rate limit exceeded | Too many requests in time window |

#### Server Errors (5xx)

| Code | Name | Description |
|------|------|-------------|
| 500 | Internal Server Error | Unexpected server error |
| 502 | Bad Gateway | Upstream service failure |
| 503 | Service Unavailable | Service temporarily down |
| 504 | Gateway Timeout | Upstream request timeout |

### Error Response Format

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    "email must be a valid email address",
    "password must be at least 8 characters"
  ],
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/auth/register",
  "correlationId": "abc123-def456-789xyz"
}
```

| Field | Description |
|-------|-------------|
| `statusCode` | HTTP status code |
| `error` | Error type name |
| `message` | Human-readable message |
| `details` | Array of specific validation errors (when applicable) |
| `timestamp` | ISO 8601 timestamp |
| `path` | Request path that caused the error |
| `correlationId` | Unique request ID for debugging |

### Retry Logic

Implement exponential backoff for transient errors:

```javascript
// JavaScript - Retry with exponential backoff
async function fetchWithRetry(requestFn, maxRetries = 3) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      const status = error.response?.status;

      // Don't retry client errors (except rate limits)
      if (status >= 400 && status < 500 && status !== 429) {
        throw error;
      }

      // Handle rate limiting
      if (status === 429) {
        const resetTime = error.response.headers['x-ratelimit-reset'];
        const waitMs = resetTime
          ? (parseInt(resetTime) * 1000) - Date.now()
          : 60000;
        await sleep(Math.min(waitMs, 60000));
        continue;
      }

      // Exponential backoff for server errors
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

```python
# Python - Retry decorator
import time
from functools import wraps

def retry_with_backoff(max_retries=3, base_delay=1):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_exception = None

            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    status = getattr(e, 'response', {}).get('status_code')

                    # Don't retry client errors (except rate limits)
                    if status and 400 <= status < 500 and status != 429:
                        raise

                    # Handle rate limiting
                    if status == 429:
                        reset_time = e.response.headers.get('X-RateLimit-Reset')
                        if reset_time:
                            wait_time = int(reset_time) - int(time.time())
                            time.sleep(min(max(wait_time, 1), 60))
                        else:
                            time.sleep(60)
                        continue

                    # Exponential backoff
                    delay = min(base_delay * (2 ** attempt), 30)
                    time.sleep(delay)

            raise last_exception
        return wrapper
    return decorator

@retry_with_backoff(max_retries=3)
def get_videos():
    return api.get_videos()
```

### Troubleshooting

#### Common Issues and Solutions

**401 Unauthorized**
```
Problem: "Invalid or expired token"
Solutions:
1. Check if token is included in Authorization header
2. Verify token format: "Bearer <token>"
3. Token may have expired - use refresh token
4. Ensure API key is valid and not revoked
```

**403 Forbidden**
```
Problem: "Insufficient permissions"
Solutions:
1. Verify user has required role (e.g., MODERATOR, ADMIN)
2. Check if endpoint requires specific permissions
3. Contact admin if role upgrade needed
```

**404 Not Found**
```
Problem: "Resource not found"
Solutions:
1. Verify the resource ID is correct
2. Resource may have been deleted
3. Check if using correct endpoint path
```

**429 Too Many Requests**
```
Problem: "Rate limit exceeded"
Solutions:
1. Check X-RateLimit-Remaining header before requests
2. Implement request queuing/throttling
3. Wait until X-RateLimit-Reset time
4. Consider upgrading to higher rate limit tier
```

**500 Internal Server Error**
```
Problem: "Unexpected server error"
Solutions:
1. Note the correlationId for support requests
2. Retry with exponential backoff
3. Check API status page
4. Contact support with correlationId
```

#### Debug Mode

Enable detailed logging for debugging:

```javascript
// JavaScript - Enable debug mode
const api = axios.create({
  baseURL: 'https://api.hbcubandhub.com/api',
});

api.interceptors.request.use((config) => {
  console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
  console.log('[Headers]', config.headers);
  if (config.data) console.log('[Body]', config.data);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log(`[API Response] ${response.status} ${response.config.url}`);
    console.log('[Rate Limit]', {
      limit: response.headers['x-ratelimit-limit'],
      remaining: response.headers['x-ratelimit-remaining'],
    });
    return response;
  },
  (error) => {
    console.error(`[API Error] ${error.response?.status}`, error.response?.data);
    return Promise.reject(error);
  }
);
```

---

## Webhooks

> **Note:** Webhook support is planned for future releases. This section documents the intended functionality.

### Overview

Webhooks allow your application to receive real-time notifications when events occur in HBCU Band Hub. Instead of polling the API, your server receives HTTP POST requests with event data.

### Planned Webhook Events

| Event | Description | Payload |
|-------|-------------|---------|
| `video.created` | New video added | Video object |
| `video.updated` | Video metadata updated | Video object with changes |
| `video.deleted` | Video removed | Video ID |
| `band.updated` | Band profile updated | Band object |
| `review.created` | New review posted | Review object |
| `user.followed_band` | User followed a band | User ID, Band ID |

### Webhook Payload Format

```json
{
  "id": "webhook-event-uuid",
  "type": "video.created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "id": "video-uuid",
    "title": "New Video Title",
    "bandId": "band-uuid"
  },
  "signature": "sha256=abc123..."
}
```

### Webhook Security

Webhooks will include a signature header for verification:

```javascript
// Verify webhook signature
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' +
    crypto.createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Registering Webhooks (Future)

```bash
# Create webhook subscription
curl -X POST https://api.hbcubandhub.com/api/webhooks \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhooks/bandhub",
    "events": ["video.created", "video.updated"],
    "secret": "your-webhook-secret"
  }'
```

---

## SDK Documentation

### Shared Type Definitions

The `@hbcu-band-hub/shared-types` package provides TypeScript type definitions for API responses.

#### Installation

```bash
npm install @hbcu-band-hub/shared-types
```

#### Usage

```typescript
import type {
  Video,
  Band,
  User,
  Category,
  PaginatedResponse,
  LoginResponse,
} from '@hbcu-band-hub/shared-types';

// Type-safe API responses
async function getVideos(): Promise<PaginatedResponse<Video>> {
  const response = await api.get<PaginatedResponse<Video>>('/videos');
  return response.data;
}

async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', { email, password });
  return response.data;
}
```

### Database Package

The `@bandhub/database` package provides Prisma ORM integration.

#### Installation (for internal services)

```bash
npm install @bandhub/database
```

#### Usage

```typescript
import { PrismaClient, Video, Band } from '@bandhub/database';

const prisma = new PrismaClient();

// Query videos
const videos = await prisma.video.findMany({
  where: { bandId: 'band-uuid' },
  include: { band: true, category: true },
  orderBy: { publishedAt: 'desc' },
  take: 20,
});
```

### Cache Package

The `@bandhub/cache` package provides Redis caching utilities.

```typescript
import { CacheService } from '@bandhub/cache';

const cache = new CacheService({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
});

// Cache video data
await cache.set(`video:${videoId}`, videoData, 3600); // 1 hour TTL
const cached = await cache.get(`video:${videoId}`);
```

---

## FAQ & Best Practices

### Frequently Asked Questions

**Q: How do I get an API key?**

A: API keys are issued by administrators for server-to-server integrations. Contact support@hbcubandhub.com with your use case and expected request volume.

**Q: What's the difference between JWT tokens and API keys?**

A:
- **JWT tokens** are short-lived (15 minutes) and tied to user sessions. Use them for user-facing applications.
- **API keys** are long-lived and ideal for backend services, data pipelines, or automated systems.

**Q: How can I increase my rate limits?**

A: Rate limits can be increased for verified partners and high-volume applications. Contact the admin team with your requirements.

**Q: Is there a sandbox environment?**

A: Yes, use `http://localhost:3001/api` for local development. A staging environment will be available at `https://staging-api.hbcubandhub.com/api`.

**Q: How do I report a bug or request a feature?**

A: Submit issues at [GitHub Issues](https://github.com/hbcu-band-hub/api/issues) or email api-support@hbcubandhub.com.

**Q: What video categories are available?**

A: Current categories include:
- `FIFTH_QUARTER` - Post-game celebrations
- `HALFTIME` - Halftime performances
- `PARADE` - Parade performances
- `BATTLE_OF_THE_BANDS` - Competition performances
- `STANDS` - Stadium/stands performances
- `OTHER` - Other band content

**Q: How is the trending score calculated?**

A: The trending algorithm considers:
- View count velocity (recent views)
- Engagement metrics
- Recency of publication
- Social sharing data

### Best Practices

#### Authentication

```javascript
// ✅ DO: Store tokens securely
// Browser: Use httpOnly cookies or secure storage
// Node.js: Use environment variables

// ❌ DON'T: Expose tokens in URLs or logs
// Never: https://api.example.com?token=abc123
```

#### Rate Limiting

```javascript
// ✅ DO: Check rate limit headers
const remaining = response.headers['x-ratelimit-remaining'];
if (remaining < 10) {
  console.warn('Approaching rate limit');
}

// ✅ DO: Implement request queuing
const queue = new RequestQueue({ maxConcurrent: 5 });

// ❌ DON'T: Ignore rate limits
// Never: while(true) { await api.get('/videos'); }
```

#### Error Handling

```javascript
// ✅ DO: Handle specific error codes
try {
  await api.get('/videos/invalid-id');
} catch (error) {
  switch (error.response?.status) {
    case 404:
      console.log('Video not found');
      break;
    case 401:
      await refreshToken();
      break;
    case 429:
      await waitForRateLimit(error.response.headers);
      break;
    default:
      throw error;
  }
}

// ❌ DON'T: Swallow errors silently
// Never: try { await api.get('/x'); } catch (e) { }
```

#### Caching

```javascript
// ✅ DO: Cache static/infrequently changing data
const bands = await cache.get('bands', async () => {
  return await api.get('/bands/featured');
}, 3600); // Cache for 1 hour

// ✅ DO: Use ETags for conditional requests
const response = await api.get('/videos', {
  headers: { 'If-None-Match': cachedETag },
});

// ❌ DON'T: Cache user-specific data without user context
```

#### Pagination

```javascript
// ✅ DO: Use cursor-based pagination for large datasets
async function* getAllVideos() {
  let cursor = null;
  while (true) {
    const { data, meta } = await api.get('/videos', {
      params: { cursor, limit: 100 },
    });
    yield* data;
    if (!meta.hasMore) break;
    cursor = meta.cursor;
  }
}

// ❌ DON'T: Fetch all pages at once
// Never: await Promise.all(pages.map(p => api.get(`/videos?page=${p}`)));
```

#### Performance

```javascript
// ✅ DO: Use field selection when available
await api.get('/videos', { params: { fields: 'id,title,thumbnailUrl' } });

// ✅ DO: Batch requests when possible
await api.get('/videos', { params: { ids: 'id1,id2,id3' } });

// ❌ DON'T: Make unnecessary requests
// Cache results and reuse them within reasonable TTLs
```

---

## Postman Collection

Import our Postman collection to quickly test and explore the API.

### Download Links

- **[HBCU Band Hub API Collection](https://www.postman.com/collections/hbcu-band-hub-api)** - Full API collection
- **[Environment Template](https://www.postman.com/environments/hbcu-band-hub)** - Pre-configured environments

### Quick Import

1. Open Postman
2. Click **Import** → **Link**
3. Enter: `https://api.hbcubandhub.com/postman/collection.json`
4. Configure environment variables:
   - `baseUrl`: `https://api.hbcubandhub.com/api`
   - `accessToken`: Your JWT token (after login)
   - `apiKey`: Your API key (if applicable)

### Collection Structure

```
HBCU Band Hub API
├── Authentication
│   ├── Register
│   ├── Login
│   ├── Refresh Token
│   ├── Get Current User
│   ├── Logout
│   └── Password Reset
├── Videos
│   ├── List Videos
│   ├── Get Video
│   ├── Get Trending
│   └── Get Related Videos
├── Bands
│   ├── List Bands
│   ├── Get Featured Bands
│   ├── Get Band by Slug
│   └── Get Band by ID
├── Search
│   ├── Full-Text Search
│   ├── Autocomplete
│   ├── Get Filters
│   └── Popular Searches
├── Favorites
│   ├── Add to Favorites
│   ├── Remove from Favorites
│   ├── List Favorites
│   ├── Follow Band
│   └── List Followed Bands
└── Health
    ├── Health Check
    ├── Database Status
    └── Ready Check
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `baseUrl` | API base URL | `https://api.hbcubandhub.com/api` |
| `accessToken` | JWT access token | Set after login |
| `refreshToken` | JWT refresh token | Set after login |
| `apiKey` | API key for server auth | Your API key |
| `testVideoId` | Sample video ID | Auto-populated |
| `testBandId` | Sample band ID | Auto-populated |

---

## Support & Resources

### Documentation

- **[Interactive API Docs (Swagger)](https://api.hbcubandhub.com/api/docs)** - Try endpoints in browser
- **[GitHub Repository](https://github.com/hbcu-band-hub/api)** - Source code and issues

### Contact

- **API Support:** api-support@hbcubandhub.com
- **General Inquiries:** support@hbcubandhub.com
- **Status Page:** https://status.hbcubandhub.com

### Changelog

Track API changes and deprecations:

- **[API Changelog](./CHANGELOG.md)** - Version history
- **[Migration Guides](./migrations/)** - Upgrade guides between versions

---

*Last updated: February 2024*
*API Version: v1*
