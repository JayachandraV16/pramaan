import { apiRequest } from './api';

export type Officer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: 'LMO' | 'GATC';
  status: string;
};

export type AdminApplication = {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  purpose?: string | null;
  remarks?: string | null;
  applicant_name?: string;
  applicant_id?: string;
  instrument_id?: string;
  instrument_name?: string;
  serial_number?: string;
  location_address?: string | null;
};

export type AdminAssignment = {
  id: string;
  application_id: string;
  assigned_to_id: string;
  application_number?: string;
  application_status?: string;
  applicant_name?: string;
  instrument_name?: string;
  serial_number?: string;
  status: string;
};

export type AdminVerification = {
  id: string;
  application_id: string;
  assignment_id: string;
  application_number?: string;
  performed_by_name?: string;
  assigned_to_name?: string;
  instrument_name?: string;
  status: string;
  decision?: string | null;
};

export type AdminCertificate = {
  id: string;
  certificate_number: string;
  instrument_name?: string;
  application_number?: string;
  issue_date: string;
  valid_from: string;
  valid_until: string;
  status: string;
  certificate_file_url?: string | null;
};

async function getData<T>(endpoint: string): Promise<T> {
  const response = await apiRequest(endpoint, { requiresAuth: true });
  return response.data;
}

export const getAdminApplications = () => getData<AdminApplication[]>('/applications');
export const getAdminAssignments = () => getData<AdminAssignment[]>('/assignments');
export const getAdminSchedules = () => getData<any[]>('/schedules');
export const getAdminVerifications = () => getData<AdminVerification[]>('/verifications');
export const getAdminCertificates = () => getData<AdminCertificate[]>('/certificates');
export const getOfficers = () => getData<Officer[]>('/admin/officers');

export async function createAdminAssignment(applicationId: string, assignedToId: string, remarks?: string) {
  const response = await apiRequest('/assignments', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify({ applicationId, assignedToId, remarks }),
  });
  return response.data;
}

export async function createAdminSchedule(data: Record<string, unknown>) {
  const response = await apiRequest('/schedules', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
  return response.data;
}

export async function issueAdminCertificate(data: Record<string, unknown>) {
  const response = await apiRequest('/certificates', {
    method: 'POST',
    requiresAuth: true,
    body: JSON.stringify(data),
  });
  return response.data;
}