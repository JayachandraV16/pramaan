import { apiRequest, apiUploadRequest } from './api';
import { Platform } from 'react-native';

export async function uploadAttachment(data: {
  applicationId: string;
  category?: string;
  fileAsset?: {
    uri: string;
    name: string;
    mimeType?: string;
    file?: any;
  };
  fileName?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  description?: string;
}) {
  if (data.fileAsset) {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      if (data.fileAsset.file) {
        formData.append('file', data.fileAsset.file);
      } else {
        const fetchRes = await fetch(data.fileAsset.uri);
        const blob = await fetchRes.blob();
        formData.append('file', blob, data.fileAsset.name);
      }
    } else {
      formData.append('file', {
        uri: data.fileAsset.uri,
        name: data.fileAsset.name,
        type: data.fileAsset.mimeType || 'application/octet-stream',
      } as any);
    }

    formData.append('applicationId', data.applicationId);
    formData.append('category', data.category || 'DOCUMENT');
    if (data.description) {
      formData.append('description', data.description);
    }

    const response = await apiUploadRequest('/attachments', formData, true);
    return response.data;
  }

  const response = await apiRequest('/attachments', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
  return response.data;
}

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

export async function createApplication(applicationData: Record<string, unknown>) {
  const response = await apiRequest('/applications', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(applicationData),
  });
  return response.data;
}

export async function requestApplicationInfo(id: string, data: { requestType: 'DOCUMENT' | 'CLARIFICATION'; details: string }) {
  const response = await apiRequest(`/applications/${id}/request-info`, {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function respondApplicationInfo(id: string, data: { responseText: string; attachmentId?: string }) {
  const response = await apiRequest(`/applications/${id}/respond-info`, {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
  return response.data;
}



export async function returnApplicationForCorrection(id: string, data: { remarks: string }) {
  const response = await apiRequest(`/applications/${id}/return-correction`, {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function resubmitApplication(id: string, data: { purpose?: string; remarks?: string }) {
  const response = await apiRequest(`/applications/${id}/resubmit`, {
    method: 'PUT',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function rejectApplication(id: string, data: { rejectionReason: string; remarks?: string }) {
  const response = await apiRequest(`/applications/${id}/reject`, {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function trackApplicationPublic(applicationNumber: string) {
  const response = await apiRequest(`/applications/track/${encodeURIComponent(applicationNumber.trim())}`, {
    method: 'GET',
    requiresAuth: false,
  });
  return response.data;
}