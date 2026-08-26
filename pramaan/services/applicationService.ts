import { apiRequest } from './api';

export async function getApplications() {
  return apiRequest('/applications');
}

export async function getApplicationById(
  id: string
) {
  return apiRequest(`/applications/${id}`);
}

export async function createApplication(
  applicationData: Record<string, unknown>
) {
  return apiRequest('/applications', {
    method: 'POST',

    body: JSON.stringify(applicationData),
  });
}