import { apiRequest } from './api';

export async function getApplications() {
  const response = await apiRequest('/applications', {
    method: 'GET',
    requiresAuth: true,
  });

  return response.data;
}

export async function getApplicationById(
  id: string
) {
  const response = await apiRequest(`/applications/${id}`, {
    method: 'GET',
    requiresAuth: true,
  });

  return response.data;
}

export async function createApplication(
  applicationData: Record<string, unknown>
) {
  const response = await apiRequest('/applications', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(applicationData),
  });

  return response.data;
}