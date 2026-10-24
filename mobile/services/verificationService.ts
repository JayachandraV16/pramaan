import { apiRequest } from './api';

export async function getVerifications() {
  const response = await apiRequest('/verifications', {
    requiresAuth: true,
  });

  return response.data;
}

export async function getVerificationById(id: string) {
  const response = await apiRequest(`/verifications/${id}`, {
    requiresAuth: true,
  });

  return response.data;
}

export async function createVerification(data: {
  applicationId: string;
  assignmentId: string;
  scheduleId?: string;
  location?: string;
  remarks?: string;
}) {
  return apiRequest('/verifications', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
}

export async function addObservation(
  verificationId: string,
  data: {
    observationType: string;
    observationDescription?: string;
    observedValue?: string;
    remarks?: string;
  }
) {
  return apiRequest(
    `/verifications/${verificationId}/observations`,
    {
      method: 'POST',
      requiresAuth: true,
      body: JSON.stringify(data),
    }
  );
}

export async function addReading(
  verificationId: string,
  data: {
    readingType: string;
    expectedValue?: number;
    observedValue: number;
    unit: string;
    tolerance?: number;
    result: 'PASS' | 'FAIL';
    remarks?: string;
  }
) {
  return apiRequest(
    `/verifications/${verificationId}/readings`,
    {
      method: 'POST',
      requiresAuth: true,
      body: JSON.stringify(data),
    }
  );
}

export async function submitVerificationResult(
  verificationId: string,
  decision: 'PASS' | 'FAIL',
  remarks?: string
) {
  return apiRequest(
    `/verifications/${verificationId}/result`,
    {
      method: 'POST',
      requiresAuth: true,
      body: JSON.stringify({
        decision,
        ...(remarks ? { remarks } : {}),
      }),
    }
  );
}

export async function getVerificationResult(
  verificationId: string
) {
  const response = await apiRequest(
    `/verifications/${verificationId}/result`,
    { requiresAuth: true }
  );

  return response.data;
}