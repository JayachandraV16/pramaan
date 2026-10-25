import { apiRequest } from './api';

export async function getAssignments() {
  const response = await apiRequest('/assignments', {
    requiresAuth: true,
  });

  return response.data;
}

export async function getAssignmentById(id: string) {
  const response = await apiRequest(`/assignments/${id}`, {
    requiresAuth: true,
  });

  return response.data;
}

export async function updateAssignmentStatus(
  id: string,
  status: string,
  remarks?: string
) {
  return apiRequest(`/assignments/${id}/status`, {
    method: 'PATCH',
    requiresAuth: true,
    body: JSON.stringify({
      status,
      ...(remarks ? { remarks } : {}),
    }),
  });
}
