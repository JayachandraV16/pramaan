import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// API address. Set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:5000/api) in
// mobile/.env when testing on a physical phone; the Android emulator reaches
// the host machine at 10.0.2.2.
const DEFAULT_API_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

export function getFileUrl(fileUrl: string): string {
  if (!fileUrl) return '';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  const cleanPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  return `${API_ORIGIN}${cleanPath}`;
}

const TOKEN_KEY = 'pramaan_auth_token';

type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  requiresAuth?: boolean;
};

/** The server answered with an error status. */
export class ApiHttpError extends Error {
  status: number;
  offline = false;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

/** The server could not be reached (no connection, wrong address, timeout). */
export class NetworkError extends Error {
  offline = true;
  constructor(message = 'Cannot reach the server. Check your connection.') {
    super(message);
    this.name = 'NetworkError';
  }
}

async function getStoredToken() {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }

  return await SecureStore.getItemAsync(TOKEN_KEY);
}

async function send(endpoint: string, init: RequestInit, fallbackMessage: string) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, init);
  } catch {
    throw new NetworkError();
  }

  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new ApiHttpError('Invalid response from server', response.status);
    }
  }

  if (!response.ok) {
    throw new ApiHttpError(data?.message || `${fallbackMessage} ${response.status}`, response.status);
  }
  return data;
}

export async function apiRequest(endpoint: string, options: ApiOptions = {}) {
  const { method = 'GET', headers = {}, body, requiresAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (requiresAuth) {
    const token = await getStoredToken();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
  }

  return send(endpoint, { method, headers: requestHeaders, body }, 'Request failed with status');
}

export async function apiUploadRequest(
  endpoint: string,
  formData: FormData,
  requiresAuth: boolean = true
) {
  const requestHeaders: Record<string, string> = {};

  if (requiresAuth) {
    const token = await getStoredToken();
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
  }

  return send(endpoint, { method: 'POST', headers: requestHeaders, body: formData }, 'Upload failed with status');
}
