# User Accounts System

This document describes the user accounts system for HBCU Band Hub.

## Overview

The user accounts system provides public user registration, authentication, and profile management capabilities separate from the admin system.

## Architecture

### Backend (NestJS)

- **Module**: `apps/api/src/modules/users/`
- **Email Service**: `apps/api/src/modules/email/`

### Frontend (Next.js)

- **Pages**: `apps/web/src/app/` (register, login, profile, forgot-password, reset-password, verify-email)
- **Context**: `apps/web/src/contexts/UserContext.tsx`
- **Components**: `apps/web/src/components/auth/` and `apps/web/src/components/profile/`

## Database Models

### User

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String
  avatar        String?
  bio           String?
  emailVerified Boolean   @default(false)
  preferences   Json      @default("{}")
  lastSeenAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

### Related Models

- **EmailVerificationToken**: For email verification flow
- **PasswordResetToken**: For password reset flow
- **UserSession**: For tracking active sessions

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/api/users/register` | Create new account | 5/15min |
| POST | `/api/users/login` | Login user | 5/15min |
| POST | `/api/users/forgot-password` | Request password reset | 3/15min |
| POST | `/api/users/reset-password` | Reset password with token | 5/15min |
| POST | `/api/users/verify-email` | Verify email with token | 10/15min |

### Protected Endpoints (require authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| PATCH | `/api/users/me` | Update user profile |
| DELETE | `/api/users/me` | Delete account |
| POST | `/api/users/logout` | Logout current session |
| POST | `/api/users/logout-all` | Logout all sessions |
| POST | `/api/users/change-password` | Change password |
| POST | `/api/users/resend-verification` | Resend verification email |
| GET | `/api/users/sessions` | Get all user sessions |
| DELETE | `/api/users/sessions/:id` | Delete specific session |

## Authentication Flow

### Registration

1. User submits registration form
2. Server validates input and checks for existing email
3. Password is hashed with bcrypt (12 rounds)
4. User record created with `emailVerified: false`
5. Verification token created (expires in 24 hours)
6. Welcome and verification emails sent
7. User redirected to check email page

### Login

1. User submits login credentials
2. Server validates email and password
3. JWT access token generated (15 min expiry)
4. Session token created (7 or 30 days based on "remember me")
5. Tokens returned to client and stored in cookies
6. User redirected to profile or previous page

### Password Reset

1. User requests password reset with email
2. Server generates reset token (1 hour expiry)
3. Reset email sent (no error if email doesn't exist - prevents enumeration)
4. User clicks link and enters new password
5. Password updated, all sessions invalidated
6. Confirmation email sent

### Email Verification

1. User clicks verification link from email
2. Server validates token and expiry
3. User's `emailVerified` set to `true`
4. Token deleted
5. User can now access all features

## User Preferences

```typescript
interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  defaultVideoSort: 'recent' | 'popular' | 'alphabetical';
  preferredCategories: string[];
  emailNotifications: {
    newContent: boolean;
    favorites: boolean;
    newsletter: boolean;
  };
  favoriteBands: string[];
}
```

## Security Features

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Token Security

- Passwords hashed with bcrypt (12 rounds)
- Tokens hashed with SHA-256 before storage
- Access tokens: 15 minute expiry
- Session tokens: 7 or 30 days
- Verification tokens: 24 hours
- Reset tokens: 1 hour

### Rate Limiting

- Login: 5 attempts per 15 minutes
- Registration: 5 attempts per 15 minutes
- Password reset request: 3 per 15 minutes
- All other endpoints: 100 per minute (global limit)

### Session Management

- Sessions tracked with device type and browser
- Users can view and revoke sessions
- All sessions invalidated on password change
- Session activity tracking

## Frontend Pages

### /register

- Registration form with validation
- Password strength indicator
- Terms of service acceptance
- Redirect to email verification notice

### /login

- Login form with remember me option
- Forgot password link
- Redirect to previous page after login

### /profile

Tabbed interface with:
- **Profile**: Edit name, avatar, bio
- **Preferences**: Theme, video sort, notifications
- **Sessions**: View and manage active sessions
- **Security**: Change password, delete account

### /forgot-password

- Email input form
- Success message (doesn't reveal if email exists)

### /reset-password/[token]

- New password form with strength indicator
- Auto-redirect to login on success

### /verify-email/[token]

- Auto-verifies on page load
- Success/error message
- Resend option if authenticated

## Environment Variables

Add these to your `.env` file:

```env
# JWT Secret (required - use a strong random string)
JWT_SECRET=your-secure-jwt-secret-here

# Email Configuration (optional - logs to console if not set)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@hbcubandhub.com

# Frontend URL for email links
APP_URL=http://localhost:3000
```

## Database Migration

After adding the models to your schema, run:

```bash
npm run db:migrate
```

This will create the following tables:
- `users`
- `email_verification_tokens`
- `password_reset_tokens`
- `user_sessions`

## Testing

Run the tests with:

```bash
cd apps/api
npm run test
```

Example test file: `apps/api/src/modules/users/users.service.spec.ts`

## Usage Example

### Frontend: Using UserContext

```tsx
import { useUser } from '@/contexts/UserContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useUser();
  
  if (!isAuthenticated) {
    return <LoginPrompt />;
  }
  
  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Frontend: Protected Routes

```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function PrivatePage() {
  return (
    <ProtectedRoute requireVerified={true}>
      <div>This content requires email verification</div>
    </ProtectedRoute>
  );
}
```

### Backend: Using Guards

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserAuthGuard } from './guards/user-auth.guard';
import { CurrentUser, CurrentUserData } from './decorators/current-user.decorator';

@Controller('api/my-feature')
export class MyController {
  @Get()
  @UseGuards(UserAuthGuard)
  async getProtectedData(@CurrentUser() user: CurrentUserData) {
    return { userId: user.userId, email: user.email };
  }
}
```

## Troubleshooting

### "Invalid or expired token" errors

- Check that `JWT_SECRET` is set in environment
- Verify token hasn't expired
- Ensure user hasn't changed password (invalidates all tokens)

### Email not sending

- Check `RESEND_API_KEY` is set correctly
- Check API logs for email service errors
- In development, emails are logged to console

### Session management issues

- Clear browser cookies and try again
- Check that `user_access_token` and `user_session_token` cookies are set
- Verify backend is returning tokens correctly
