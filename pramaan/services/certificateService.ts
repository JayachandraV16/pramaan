import { apiRequest } from './api';

export async function getCertificates() {
  const response = await apiRequest('/certificates', {
    method: 'GET',
    requiresAuth: true,
  });

  return response.data;
}

export async function getCertificateById(
  id: string
) {
  const response = await apiRequest(`/certificates/${id}`, {
    method: 'GET',
    requiresAuth: true,
  });

  return response.data;
}