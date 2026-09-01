import {
  User,
  RoleName,
  BackendUser,
  BackendAuthResponse,
  BackendLoginRequest,
  BackendRegisterRequest,
} from '../types';
import {
  apiClient,
} from './client';
import { recordKnownOfficer } from './assignments.api';

export interface LoginCredentials {
  email?: string;
  phone?: string;
  password?: string;
  role?: RoleName;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  phone: string;
  password?: string;
  role_id: RoleName;
  organization_name?: string;
  address?: string;
}

const AUTH_STORAGE_KEY = 'pramaan_current_user';
const TOKEN_STORAGE_KEY = 'pramaan_auth_token';

/**
 * Data Mapper: Maps BackendUser response to frontend User interface
 */
export function mapBackendUserToFrontend(backendUser: BackendUser): User {
  return {
    id: backendUser.id,
    role_id: backendUser.role,
    full_name: backendUser.full_name,
    email: backendUser.email || '',
    phone: backendUser.phone || '',
    organization_name: backendUser.organization_name || undefined,
    address: backendUser.address || undefined,
    status: backendUser.status || 'ACTIVE',
    created_at: backendUser.created_at || new Date().toISOString(),
  };
}

export const authApi = {
  /**
   * Get current authenticated user from backend GET /api/auth/me
   */
  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }

    try {
      const response = await apiClient.get<BackendUser>('/auth/me');
      if (response && response.id) {
        const mapped = mapBackendUserToFrontend(response);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mapped));
        recordKnownOfficer(mapped);
        return mapped;
      }
      return null;
    } catch (err: any) {
      // If unauthorized or token invalid, clean up local auth state
      if (err.statusCode === 401 || err.statusCode === 403) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem('auth_token');
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return null;
      }
      // Return cached user if offline, or null
      try {
        const cached = localStorage.getItem(AUTH_STORAGE_KEY);
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
  },

  /**
   * Log in user with credentials via backend POST /api/auth/login
   */
  async login(credentials: LoginCredentials): Promise<User> {
    const loginPayload: BackendLoginRequest = {
      email: credentials.email || '',
      password: credentials.password || '',
    };

    const response = await apiClient.post<BackendAuthResponse>('/auth/login', loginPayload);
    if (!response || !response.token || !response.user) {
      throw new Error('Invalid response received from authentication server.');
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    localStorage.setItem('auth_token', response.token);

    const mapped = mapBackendUserToFrontend(response.user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mapped));
    recordKnownOfficer(mapped);
    return mapped;
  },

  /**
   * Register a new user via backend POST /api/auth/register
   */
  async register(payload: RegisterPayload): Promise<User> {
    const registerPayload: BackendRegisterRequest = {
      fullName: payload.full_name,
      email: payload.email || undefined,
      phone: payload.phone || undefined,
      password: payload.password || '',
      role: payload.role_id,
      organizationName: payload.organization_name || undefined,
      address: payload.address || undefined,
    };

    const response = await apiClient.post<BackendAuthResponse>('/auth/register', registerPayload);
    if (!response || !response.token || !response.user) {
      throw new Error('Invalid response received from registration server.');
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, response.token);
    localStorage.setItem('auth_token', response.token);

    const mapped = mapBackendUserToFrontend(response.user);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(mapped));
    recordKnownOfficer(mapped);
    return mapped;
  },

  /**
   * Switch role during testing / demo mode
   */
  async switchRole(role: RoleName): Promise<User> {
    const cached = localStorage.getItem(AUTH_STORAGE_KEY);
    const current: User = cached
      ? JSON.parse(cached)
      : {
          id: `u-${Date.now()}`,
          role_id: role,
          full_name: 'Current User',
          email: 'user@pramaan.gov.in',
          phone: '+91 98000 00000',
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
        };

    const updated = { ...current, role_id: role };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('auth_token');
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem('pramaan_current_user');
  },
};
