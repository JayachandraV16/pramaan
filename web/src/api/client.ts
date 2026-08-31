/**
 * Pramaan Typed API Client Layer
 * Communicates with the backend API at http://localhost:5000/api
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export interface ApiResponseEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  statusCode?: number;
  errors?: Record<string, string[]> | any[];
}

export class ApiError extends Error {
  statusCode: number;
  errors?: any;

  constructor(message: string, statusCode: number = 500, errors?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

/**
 * Get the current JWT token from storage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('pramaan_auth_token') || localStorage.getItem('auth_token');
}

/**
 * Core fetch wrapper with auth header injection, error unwrapping, and timeout
 */
export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const result = isJson ? await response.json() : null;

    if (!response.ok) {
      const errorMessage = result?.message || result?.error || `Request failed with status ${response.status}: ${response.statusText}`;
      throw new ApiError(errorMessage, response.status, result?.errors);
    }

    // If backend wrapped response in ApiResponse envelope { success, data, message }
    if (result && typeof result === 'object' && 'data' in result && 'success' in result) {
      return result.data as T;
    }

    return result as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network / offline error
    const msg =
      err?.message === 'Failed to fetch' || err?.name === 'TypeError'
        ? 'Could not connect to backend server (http://localhost:5000). Please ensure the backend API server is running.'
        : err?.message || 'Failed to connect to Pramaan backend server.';
    throw new ApiError(msg, 0);
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    }),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { method: 'DELETE', ...options }),
};

// Simulate realistic network latency with slight jitter (used by still-mocked modules)
export async function simulateNetworkDelay(minMs: number = 150, maxMs: number = 350): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Storage helpers for persistent mock data state across user actions
export function getStoredData<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`pramaan_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return defaultValue;
  }
}

export function setStoredData<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`pramaan_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error(`Error saving ${key} to storage:`, e);
  }
}
