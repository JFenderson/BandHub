/**
 * User-related TypeScript types
 */

export interface UserPreferences {
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

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  emailVerified: boolean;
  preferences: UserPreferences;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserLoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface UserRegistrationData {
  email: string;
  password: string;
  name: string;
}

export interface UserLoginResponse {
  accessToken: string;
  sessionToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
    emailVerified: boolean;
  };
}

export interface UserSession {
  id: string;
  deviceType: string | null;
  browser: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
}

export interface UpdateUserProfile {
  name?: string;
  avatar?: string | null;
  bio?: string | null;
  preferences?: Partial<UserPreferences>;
}

export interface UserContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: UserLoginCredentials) => Promise<void>;
  register: (data: UserRegistrationData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateUserProfile) => Promise<void>;
  refreshUser: () => Promise<void>;
}
