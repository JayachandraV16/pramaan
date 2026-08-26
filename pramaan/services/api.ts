const API_BASE_URL = 'http://10.235.236.1:5000/api';

type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  requiresAuth?: boolean;
};

export async function apiRequest(
  endpoint: string,
  options: ApiOptions = {}
) {
  const {
    method = 'GET',
    headers = {},
    body,
  } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  try {
    const url = `${API_BASE_URL}${endpoint}`;

    console.log('API URL:', url);
    console.log('API METHOD:', method);
    console.log('API BODY:', body);

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body,
    });

    const text = await response.text();

    console.log('API STATUS:', response.status);
    console.log('API RESPONSE:', text);

    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error('Invalid response from server');
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        `Request failed with status ${response.status}`
      );
    }

    return data;
  } catch (error: any) {
    console.log('API REQUEST ERROR:', error.message);
    throw error;
  }
}