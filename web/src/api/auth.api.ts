import { User, RoleName } from '../types';
import { simulateNetworkDelay, getStoredData, setStoredData } from './client';

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

export const MOCK_USERS: Record<RoleName, User> = {
  INSTRUMENT_OWNER: {
    id: 'u-101-owner-001',
    role_id: 'INSTRUMENT_OWNER',
    full_name: 'Rajesh Sharma',
    email: 'rajesh.sharma@sharmaagro.in',
    phone: '+91 98201 44552',
    organization_name: 'Sharma Agro & Logistics Pvt Ltd',
    address: 'Plot 42, APMC Market Yard, Navi Mumbai, Maharashtra 400705',
    status: 'ACTIVE',
    created_at: '2025-04-12T10:00:00Z',
  },
  LMO: {
    id: 'u-201-lmo-001',
    role_id: 'LMO',
    full_name: 'Vikram Malhotra',
    email: 'v.malhotra@legalmetrology.gov.in',
    phone: '+91 94220 11993',
    organization_name: 'Directorate of Legal Metrology - Zone 4',
    address: 'Metrology Bhavan, Bandra Kurla Complex, Mumbai 400051',
    status: 'ACTIVE',
    created_at: '2024-01-15T09:30:00Z',
  },
  GATC: {
    id: 'u-301-gatc-001',
    role_id: 'GATC',
    full_name: 'Dr. Sunil Verma',
    email: 's.verma@rrsl-testing.gov.in',
    phone: '+91 98110 33221',
    organization_name: 'Regional Reference Standard Laboratory (RRSL / GATC)',
    address: 'NABL Accredited Lab #4, Electronic City, Pune 411057',
    status: 'ACTIVE',
    created_at: '2024-02-20T11:15:00Z',
  },
  ADMIN: {
    id: 'u-401-admin-001',
    role_id: 'ADMIN',
    full_name: 'Priya Deshmukh',
    email: 'admin.directorate@pramaan.gov.in',
    phone: '+91 91100 88776',
    organization_name: 'Director General of Legal Metrology, Ministry of Consumer Affairs',
    address: 'Krishi Bhavan, New Delhi 110001',
    status: 'ACTIVE',
    created_at: '2023-11-01T08:00:00Z',
  },
  PUBLIC_USER: {
    id: 'u-501-public-001',
    role_id: 'PUBLIC_USER',
    full_name: 'Aarav Patel',
    email: 'aarav.patel@gmail.com',
    phone: '+91 99887 76655',
    organization_name: 'General Citizen / Consumer',
    address: 'Andheri West, Mumbai 400053',
    status: 'ACTIVE',
    created_at: '2026-01-10T14:20:00Z',
  },
};

const AUTH_STORAGE_KEY = 'current_user';

export const authApi = {
  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    await simulateNetworkDelay(100, 200);
    // TODO: Replace with real fetch('/api/v1/auth/me')
    const stored = getStoredData<User | null>(AUTH_STORAGE_KEY, MOCK_USERS.INSTRUMENT_OWNER);
    return stored;
  },

  /**
   * Log in user with credentials or select a role
   */
  async login(credentials: LoginCredentials): Promise<User> {
    await simulateNetworkDelay(250, 450);
    // TODO: Replace with real fetch('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(credentials) })
    
    // Choose mock user based on role or email
    const targetRole = credentials.role || 'INSTRUMENT_OWNER';
    const user = MOCK_USERS[targetRole];
    
    const loggedInUser: User = {
      ...user,
      email: credentials.email || user.email,
    };

    setStoredData(AUTH_STORAGE_KEY, loggedInUser);
    return loggedInUser;
  },

  /**
   * Register a new user
   */
  async register(payload: RegisterPayload): Promise<User> {
    await simulateNetworkDelay(300, 500);
    // TODO: Replace with real fetch('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(payload) })

    const newUser: User = {
      id: `u-${Date.now()}`,
      role_id: payload.role_id,
      full_name: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      organization_name: payload.organization_name || '',
      address: payload.address || '',
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
    };

    setStoredData(AUTH_STORAGE_KEY, newUser);
    return newUser;
  },

  /**
   * Switch role during testing / demo mode
   */
  async switchRole(role: RoleName): Promise<User> {
    await simulateNetworkDelay(100, 200);
    const user = MOCK_USERS[role];
    setStoredData(AUTH_STORAGE_KEY, user);
    return user;
  },

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await simulateNetworkDelay(100, 200);
    // TODO: Replace with real fetch('/api/v1/auth/logout', { method: 'POST' })
    localStorage.removeItem(`pramaan_${AUTH_STORAGE_KEY}`);
  },
};
