import { apiRequest } from './api';

export async function loginUser(
  email: string,
  password: string
) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

export async function registerUser(
  fullName: string,
  email: string,
  phone: string,
  password: string,
  role: string = 'INSTRUMENT_OWNER',
  organizationName?: string,
  address?: string
) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      fullName,
      email,
      phone,
      password,
      role,
      organizationName,
      address,
    }),
  });
}

export async function getCurrentUser() {
  return apiRequest('/auth/me', {
    requiresAuth: true,
  });
}