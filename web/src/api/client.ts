/**
 * Pramaan Typed API Client Layer
 * 
 * NOTE: Currently all endpoints use in-memory and localStorage fixtures matching the
 * PostgreSQL database schema. When backend endpoints in `api/src/modules/*` become live,
 * replace the simulated delay and mock return with the typed `fetch()` calls marked
 * with `// TODO: Replace with real fetch()`.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

// Simulate realistic network latency with slight jitter
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
