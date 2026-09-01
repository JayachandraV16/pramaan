import { VerificationApplication, ApplicationStatus, ApplicationType } from '../types';
import { apiClient } from './client';

export interface CreateApplicationPayload {
  instrument_id: string;
  application_type: ApplicationType;
  purpose: string;
  remarks?: string;
  applicant_id?: string;
  applicant_name?: string;
  applicant_organization?: string;
}

/**
 * Data Mapper: Maps backend verification application response to frontend VerificationApplication interface
 */
export function mapBackendApplicationToFrontend(item: any): VerificationApplication {
  return {
    id: item.id,
    application_number: item.application_number || item.applicationNumber || `APP-${item.id}`,
    applicant_id: item.applicant_id || item.applicantId || '',
    applicant_name: item.applicant_name || item.applicantName || 'Registered Applicant',
    applicant_phone: item.applicant_phone || item.applicantPhone || undefined,
    applicant_email: item.applicant_email || item.applicantEmail || undefined,
    applicant_organization: item.applicant_organization || item.applicantOrganization || undefined,
    owner_name: item.owner_name || item.ownerName || undefined,
    owner_phone: item.owner_phone || item.ownerPhone || undefined,
    owner_email: item.owner_email || item.ownerEmail || undefined,
    owner_organization: item.owner_organization || item.ownerOrganization || undefined,
    instrument_id: item.instrument_id || item.instrumentId || '',
    instrument_name: item.instrument_name || item.instrumentName || 'Instrument',
    instrument_serial: item.serial_number || item.instrument_serial || item.serialNumber || '',
    instrument_type_name: item.instrument_type_name || item.instrumentTypeName || undefined,
    manufacturer: item.manufacturer || undefined,
    model: item.model || undefined,
    capacity: item.capacity ? Number(item.capacity) : undefined,
    capacity_unit: item.capacity_unit || item.capacityUnit || undefined,
    accuracy_class: item.accuracy_class || item.accuracyClass || undefined,
    location_address: item.location_address || item.locationAddress || undefined,
    location_lat: item.location_lat ? Number(item.location_lat) : undefined,
    location_lng: item.location_lng ? Number(item.location_lng) : undefined,
    application_type: (item.application_type || item.applicationType || 'RE_VERIFICATION') as ApplicationType,
    status: (item.status as ApplicationStatus) || 'SUBMITTED',
    purpose: item.purpose || 'Verification for commercial use under Legal Metrology Act, 2009.',
    remarks: item.remarks || undefined,
    submitted_at: item.submitted_at || item.submittedAt || item.created_at || new Date().toISOString(),
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
    updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
    assignment: item.assignment || undefined,
    schedule: item.schedule || undefined,
    verification_id: item.verification_id || item.verificationId || undefined,
    certificate_id: item.certificate_id || item.certificateId || undefined,
  };
}

export const applicationsApi = {
  /**
   * List applications with filtering from backend GET /api/applications
   */
  async listApplications(params?: {
    applicantId?: string;
    status?: ApplicationStatus;
    search?: string;
  }): Promise<VerificationApplication[]> {
    try {
      const response = await apiClient.get<any[]>('/applications');
      if (!Array.isArray(response)) {
        return [];
      }

      let list = response.map(mapBackendApplicationToFrontend);

      if (params?.applicantId) {
        list = list.filter((a) => a.applicant_id === params.applicantId);
      }
      if (params?.status) {
        list = list.filter((a) => a.status === params.status);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        list = list.filter(
          (a) =>
            a.application_number.toLowerCase().includes(q) ||
            (a.instrument_name && a.instrument_name.toLowerCase().includes(q)) ||
            (a.instrument_serial && a.instrument_serial.toLowerCase().includes(q)) ||
            a.purpose.toLowerCase().includes(q)
        );
      }

      return list;
    } catch (err: any) {
      // If user's role is not authorized (e.g. LMO role is restricted on /applications), return empty list
      if (err.statusCode === 403) {
        return [];
      }
      throw err;
    }
  },

  /**
   * Get single application by ID from backend GET /api/applications/:id
   */
  async getApplicationById(id: string): Promise<VerificationApplication | null> {
    const response = await apiClient.get<any>(`/applications/${id}`);
    if (response && response.id) {
      return mapBackendApplicationToFrontend(response);
    }
    return null;
  },

  /**
   * Create new verification application via backend POST /api/applications
   */
  async createApplication(payload: CreateApplicationPayload): Promise<VerificationApplication> {
    const body = {
      instrumentId: payload.instrument_id,
      applicationType: payload.application_type,
      division: 'HQ',
      purpose: payload.purpose || 'Annual re-verification for trade compliance',
      remarks: payload.remarks || undefined,
    };

    const response = await apiClient.post<any>('/applications', body);
    if (!response || !response.id) {
      throw new Error('Failed to create application. Invalid response from server.');
    }

    return mapBackendApplicationToFrontend(response);
  },

  /**
   * Update application status (for GATC/Admin workflow)
   */
  async updateApplicationStatus(id: string, status: ApplicationStatus, remarks?: string): Promise<VerificationApplication> {
    const response = await apiClient.patch<any>(`/applications/${id}/status`, { status, remarks });
    if (!response || !response.id) {
      throw new Error(`Failed to update application ${id}.`);
    }
    return mapBackendApplicationToFrontend(response);
  },
};
