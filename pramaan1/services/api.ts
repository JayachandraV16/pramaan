import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL =
  Platform.OS === 'web'
    ? 'http://localhost:5000/api'
    : 'http://10.10.12.60:5000/api';

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

async function getStoredToken() {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }

  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function apiRequest(
  endpoint: string,
  options: ApiOptions = {}
) {
  const {
    method = 'GET',
    headers = {},
    body,
    requiresAuth = false,
  } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (requiresAuth) {
    const token = await getStoredToken();

    console.log('AUTH REQUIRED:', requiresAuth);
    console.log('TOKEN EXISTS:', !!token);
    console.log(
      'TOKEN PREVIEW:',
      token ? `${token.substring(0, 20)}...` : 'NO TOKEN'
    );

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }

    console.log(
      'HAS AUTH HEADER:',
      !!requestHeaders.Authorization
    );
  }

  try {
    const apiUrl = `${API_BASE_URL}${endpoint}`;

    console.log('API URL:', apiUrl);
    console.log('API METHOD:', method);

    const response = await fetch(apiUrl, {
      method,
      headers: requestHeaders,
      body,
    });

    const text = await response.text();

    console.log('API STATUS:', response.status);

    let data: any = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server');
      }
    }

    console.log('API RESPONSE:', data);

    if (!response.ok) {
      throw new Error(
        data?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } catch (error: any) {
    console.log(
      'API REQUEST ERROR:',
      error?.message || error
    );

    throw error;
  }
}

export async function apiUploadRequest(
  endpoint: string,
  formData: FormData,
  requiresAuth: boolean = true
) {
  const requestHeaders: Record<string, string> = {};

  if (requiresAuth) {
    const token = await getStoredToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const apiUrl = `${API_BASE_URL}${endpoint}`;
    console.log('UPLOAD API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: formData,
    });

    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Invalid response from server');
      }
    }

    if (!response.ok) {
      throw new Error(data?.message || `Upload failed with status ${response.status}`);
    }

    return data;
  } catch (error: any) {
    console.log('API UPLOAD ERROR:', error?.message || error);
    throw error;
  }
}