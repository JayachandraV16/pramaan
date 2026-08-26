import { apiRequest } from './api';

export async function getCertificates() {
  return apiRequest('/certificates');
}

export async function getCertificateById(
  id: string
) {
  return apiRequest(`/certificates/${id}`);
}