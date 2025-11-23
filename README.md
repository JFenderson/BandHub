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

### Register a New Admin User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bandhub.com",
    "password": "SecurePass123",
    "name": "John Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bandhub.com",
    "password": "SecurePass123"
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

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register new admin user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/logout` - Logout (for future token blacklisting)
- `GET /api/auth/me` - Get current user info (protected)

### Bands (`/api/bands`)
- `GET /api/bands` - List all bands
- `GET /api/bands/:id` - Get band details
- `POST /api/bands` - Create new band (protected)
- `PUT /api/bands/:id` - Update band (protected)
- `DELETE /api/bands/:id` - Delete band (protected)

### Videos (`/api/videos`)
- `GET /api/videos` - List videos with filters
- `GET /api/videos/:id` - Get video details
- `POST /api/videos` - Add new video (protected)
- `PUT /api/videos/:id` - Update video (protected)

### Categories (`/api/categories`)
- `GET /api/categories` - List all categories
- `GET /api/categories/:slug` - Get category details
- `POST /api/categories` - Create category (protected)

### Health Check
- `GET /health` - API health status

## Building for Production

```bash
pnpm build
```

## Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run e2e tests
pnpm test:e2e

# Generate coverage report
pnpm test:cov
```

## Linting

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
