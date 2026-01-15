# HBCU Band Hub

A platform for managing and showcasing HBCU marching band videos and profiles.

## Features

- **Band Management**: Create and manage HBCU marching band profiles
- **Video Library**: Organize and filter band performance videos
- **Categories**: Categorize videos by performance type
- **Search**: Full-text search across bands and videos
- **Admin Panel**: Administrative tools for content management
- **JWT Authentication**: Secure authentication system for admin users

## Prerequisites

- Node.js >= 20.0.0
- PostgreSQL database
- Redis (for caching and queues)
- YouTube API key (optional, for video syncing)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/JFenderson/BandHub.git
cd BandHub
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Generate Prisma client
pnpm prisma generate --schema=./apps/api/prisma/schema.prisma

# Run migrations
pnpm db:migrate

# Seed database (optional)
pnpm db:seed
```

5. Build shared types:
```bash
pnpm build:shared
```

## Development

Start the development server:
```bash
# Start API only
pnpm dev:api

# Or start all services
pnpm dev
```

The API will be available at `http://localhost:3001`
Swagger documentation at `http://localhost:3001/api/docs`

## Authentication

The API uses JWT (JSON Web Token) for authentication. Admin users can register and login to access protected endpoints.

### Create/Reset Admin User

To create or reset an admin user with known credentials:

```bash
pnpm tsx apps/api/prisma/seed-admin.ts
```

Default credentials:
- Email: admin@bandhub.com  
- Password: SecurePass123!

### Register a New Admin User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bandhub.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bandhub.com",
    "password": "SecurePass123!"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx...",
    "email": "admin@bandhub.com",
    "name": "John Doe",
    "role": "MODERATOR"
  }
}
```

### Using the JWT Token

Include the token in the Authorization header for protected endpoints:

```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one symbol (for registration)

### Account Security

- Accounts are automatically locked after 5 failed login attempts
- Locked accounts remain locked for 15 minutes
- Failed login attempts are reset upon successful login

## Environment Variables

### Required
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing (change in production!)

### Optional
- `REDIS_HOST`: Redis server host (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)
- `YOUTUBE_API_KEY`: YouTube Data API v3 key for video syncing
- `PORT` or `API_PORT`: API server port (default: 3001)
- `NODE_ENV`: Environment (development|production)

## API Endpoints

**Base URL:** `http://localhost:3001/api`  
**Swagger Documentation:** `http://localhost:3001/api/docs`  
**Note:** All endpoints are prefixed with `/api` (e.g., `/api/auth/login`)

---

### 🔐 Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/auth/register` | Register a new admin user | ❌ No |
| `POST` | `/api/auth/login` | Login and get JWT token | ❌ No |
| `POST` | `/api/auth/logout` | Logout current session | ✅ Yes |
| `POST` | `/api/auth/logout-all` | Logout from all devices | ✅ Yes |
| `POST` | `/api/auth/refresh` | Refresh access token using refresh token | ❌ No |

---

### 🎺 Bands (`/api/bands`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/bands` | Get all bands with pagination | ❌ No |
| `GET` | `/api/bands/:id` | Get band by ID | ❌ No |
| `GET` | `/api/bands/slug/:slug` | Get band by slug | ❌ No |
| `POST` | `/api/bands` | Create a new band | ✅ Yes (MODERATOR) |
| `PUT` | `/api/bands/:id` | Update a band | ✅ Yes (MODERATOR) |
| `DELETE` | `/api/bands/:id` | Delete a band | ✅ Yes (SUPER_ADMIN) |

---

### 🎥 Videos (`/api/videos`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/videos` | Get all videos with filtering and pagination | ❌ No |
| `GET` | `/api/videos/:id` | Get video by ID | ❌ No |
| `PUT` | `/api/videos/:id/hide` | Hide a video from public view | ✅ Yes (MODERATOR) |
| `PUT` | `/api/videos/:id/unhide` | Unhide a video | ✅ Yes (MODERATOR) |
| `PUT` | `/api/videos/:id/category` | Update video category | ✅ Yes (MODERATOR) |
| `PUT` | `/api/videos/:id/quality` | Update video quality metadata | ✅ Yes (MODERATOR) |
| `DELETE` | `/api/videos/:id` | Delete a video permanently | ✅ Yes (SUPER_ADMIN) |

---

### 📂 Categories (`/api/categories`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/categories` | Get all categories | ❌ No |
| `GET` | `/api/categories/:id` | Get category by ID | ❌ No |
| `POST` | `/api/categories` | Create a new category | ✅ Yes (SUPER_ADMIN) |
| `PUT` | `/api/categories/:id` | Update a category | ✅ Yes (SUPER_ADMIN) |
| `DELETE` | `/api/categories/:id` | Delete a category | ✅ Yes (SUPER_ADMIN) |

---

### 🔑 API Keys (`/api/api-keys`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/api-keys` | Create a new API key | ✅ Yes (SUPER_ADMIN) |
| `GET` | `/api/api-keys` | List all API keys | ✅ Yes (MODERATOR) |
| `DELETE` | `/api/api-keys/:id/revoke` | Revoke an API key | ✅ Yes (SUPER_ADMIN) |
| `DELETE` | `/api/api-keys/:id` | Delete an API key permanently | ✅ Yes (SUPER_ADMIN) |

---

### 🏥 Health Check (`/api/health`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/health` | Check API, database, and cache health | ❌ No |
| `GET` | `/api/health/database` | Check database connection | ❌ No |
| `GET` | `/api/health/cache` | Check cache (Redis) connection | ❌ No |

---

### 👥 Admin (`/api/admin`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin` | Admin dashboard | 🚧 Coming Soon |

---

### 🔍 Search (`/api/search`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/search` | Search across bands and videos | 🚧 Coming Soon |

---

### Query Parameters

#### `GET /api/bands`
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Results per page (default: 20)
- `search` (string): Search bands by name

**Example:**
```bash
GET /api/bands?page=1&limit=10&search=grambling
```

#### `GET /api/videos`
- `bandId` (string): Filter videos by band ID
- `categoryId` (string): Filter videos by category ID
- `year` (number): Filter videos by event year
- `search` (string): Search videos by title
- `page` (number): Page number for pagination (default: 1)
- `limit` (number): Results per page (default: 20)
- `sortBy` (string): Sort field - `publishedAt`, `viewCount`, `title`, or `createdAt` (default: `publishedAt`)
- `sortOrder` (string): Sort order - `asc` or `desc` (default: `desc`)

**Example:**
```bash
GET /api/videos?bandId=clx...&categoryId=clx...&year=2024&page=1&limit=20&sortBy=viewCount&sortOrder=desc
```

---

### Authentication & Authorization

The API uses **JWT (JSON Web Token)** for authentication with three role levels:

- **`SUPER_ADMIN`**: Full access to all endpoints, including delete operations and API key management
- **`MODERATOR`**: Can create and update bands, videos, and manage content (hide/unhide videos)
- **`VIEWER`**: Read-only access to public endpoints

**Example: Using JWT Token**
```bash
# Get your JWT token from login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@bandhub.com", "password": "SecurePass123"}'

# Use the token in Authorization header
curl -X POST http://localhost:3001/api/bands \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"name": "Grambling State University", "slug": "grambling"}'
```

---

### CORS Configuration

The API is configured with CORS to allow cross-origin requests from the frontend:

- **Allowed Origins:** `http://localhost:3000` (configurable via `FRONTEND_URL` environment variable)
- **Credentials:** Enabled (`true`)
- **Allowed Methods:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`
- **Allowed Headers:** `Content-Type`, `Authorization`, `x-session-token`

## Building for Production

```bash
pnpm build
```

## Testing

The project uses **Jest** for unit and integration tests, with comprehensive coverage requirements.

### Prerequisites
- Node.js 20+
- PostgreSQL database (for integration tests)
- Redis (for caching tests)

### Running Tests

**Unit Tests Only**
```bash
cd apps/api
npx jest --config jest.config.ts --testMatch='**/test/unit/**/*.spec.ts'
```

**Integration Tests Only**
```bash
cd apps/api
npx jest --config jest.config.ts --testMatch='**/test/integration/**/*.spec.ts'
```

**All Tests**
```bash
pnpm test
# Or with coverage
pnpm test:cov
```

**Watch Mode** (re-run tests on file changes)
```bash
pnpm test:watch
```

**E2E Tests**
```bash
pnpm test:e2e
```

### Coverage Reports

After running tests with `--coverage` flag:

- **HTML Report**: Open `apps/api/test/coverage/index.html` in your browser
- **Terminal Summary**: Displayed automatically after test run
- **LCOV Report**: Available at `apps/api/test/coverage/lcov.info`

### Coverage Thresholds

The project enforces **minimum 80% coverage** across all metrics:

| Metric       | Threshold |
|--------------|-----------|
| **Branches** | 80%       |
| **Functions**| 80%       |
| **Lines**    | 80%       |
| **Statements**| 80%      |

⚠️ **CI will fail** if coverage drops below these thresholds.

### Test Organization

Tests are organized by type:

- **`test/unit/`**: Unit tests with mocked dependencies
  - Mock all external services (database, cache, APIs)
  - Fast execution
  - Test individual methods and logic

- **`test/integration/`**: Integration tests with real dependencies
  - Use test database (configure via `DATABASE_URL_TEST`)
  - Test full request/response cycles
  - Test controller endpoints with authentication

- **`test/e2e/`**: End-to-end tests
  - Test complete user flows
  - Use Playwright for browser automation

### Test Helpers

Test utilities are available in `apps/api/test/helpers/`:

- **`factories.ts`**: Build test data (bands, videos, categories, etc.)
- **`youtube-mocks.ts`**: Mock YouTube API responses
- **`auth-helpers.ts`**: Authentication utilities for tests

**Example: Using Test Factories**
```typescript
import { buildBand, buildVideo, createMockPagination } from '../helpers/factories';

const band = buildBand({ name: 'Test Band', slug: 'test-band' });
const video = buildVideo({ title: 'Test Video' });
const response = createMockPagination([band], 1);
```

### Writing Tests

**Unit Test Example**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BandsService } from './bands.service';

describe('BandsService', () => {
  let service: BandsService;
  let mockRepository: jest.Mocked<any>;

  beforeEach(async () => {
    mockRepository = { findMany: jest.fn() };
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BandsService,
        { provide: 'BandsRepository', useValue: mockRepository },
      ],
    }).compile();

    service = module.get<BandsService>(BandsService);
  });

  it('should find all bands', async () => {
    const bands = [{ id: '1', name: 'Test Band' }];
    mockRepository.findMany.mockResolvedValue(bands);

    const result = await service.findAll({});
    expect(result).toEqual(bands);
  });
});
```

**Integration Test Example**
```typescript
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { generateJwtToken } from '../helpers/auth-helpers';

describe('BandsController (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Setup test app
  });

  it('GET /bands should return paginated bands', async () => {
    const response = await request(app.getHttpServer())
      .get('/bands')
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('meta');
  });

  it('POST /bands should require authentication', async () => {
    await request(app.getHttpServer())
      .post('/bands')
      .send({ name: 'New Band' })
      .expect(401);
  });
});
```

### Continuous Integration

Tests run automatically on:
- Every push to `main` branch
- Every pull request

**GitHub Actions Workflow** (`.github/workflows/tests.yml`):
- Installs dependencies
- Builds shared packages
- Runs all tests with coverage
- Uploads coverage reports
- Comments PR with coverage changes
- **Fails if coverage drops below 80%**

### Coverage Reports in PRs

Coverage reports are automatically posted as PR comments, showing:
- Coverage % for each file changed
- Overall coverage change (increase/decrease)
- Link to detailed coverage report

## Building for Production

```bash
pnpm lint
```

## Project Structure

```
BandHub/
├── apps/
│   ├── api/              # NestJS backend API
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/      # Authentication module
│   │   │   │   ├── bands/     # Bands module
│   │   │   │   ├── videos/    # Videos module
│   │   │   │   ├── categories/# Categories module
│   │   │   │   ├── search/    # Search module
│   │   │   │   ├── admin/     # Admin module
│   │   │   │   └── sync/      # YouTube sync module
│   │   │   ├── database/      # Database config & seeds
│   │   │   ├── cache/         # Redis cache
│   │   │   ├── queue/         # BullMQ queues
│   │   │   └── main.ts
│   │   └── prisma/       # Prisma schema
│   ├── web/              # Frontend app
│   └── worker/           # Background workers
├── libs/
│   ├── prisma/           # Shared Prisma module
│   └── shared/           # Shared types & utilities
└── package.json
```

## Security

- Passwords are hashed using bcrypt with 10 salt rounds
- JWT tokens expire after 7 days
- Input validation using class-validator
- SQL injection protection via Prisma ORM
- CORS enabled for specified frontend origin

⚠️ **Important**: Change the `JWT_SECRET` in your `.env` file before deploying to production!

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
