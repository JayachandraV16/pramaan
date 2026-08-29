import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://localhost:5000/api';
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
    const response = await fetch(
      `${API_BASE_URL}${endpoint}`,
      {
        method,
        headers: requestHeaders,
        body,
      }
    );

    const text = await response.text();

    console.log('API URL:', `${API_BASE_URL}${endpoint}`);
    console.log('API METHOD:', method);
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