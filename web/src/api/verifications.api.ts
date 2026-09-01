import { 
  Verification, 
  VerificationStatus, 
  InspectionObservation, 
  VerificationReading, 
  VerificationResult 
} from '../types';
import { apiClient } from './client';

export interface CreateVerificationPayload {
  application_id: string;
  assignment_id: string;
  schedule_id?: string;
  location?: string;
  remarks?: string;
}

export function mapBackendObservationToFrontend(item: any): InspectionObservation {
  return {
    id: item.id,
    verification_id: item.verification_id || item.verificationId || '',
    observation_type: item.observation_type || item.observationType || 'General Observation',
    observation_description: item.observation_description || item.observationDescription || undefined,
    observed_value: item.observed_value || item.observedValue || 'PASSED',
    remarks: item.remarks || undefined,
    observed_at: item.observed_at || item.observedAt || item.created_at || new Date().toISOString(),
  };
}

export function mapBackendReadingToFrontend(item: any): VerificationReading {
  return {
    id: item.id,
    verification_id: item.verification_id || item.verificationId || '',
    reading_type: item.reading_type || item.readingType || 'Standard Load Test',
    expected_value: Number(item.expected_value ?? item.expectedValue ?? 0),
    observed_value: Number(item.observed_value ?? item.observedValue ?? 0),
    unit: item.unit || 'kg',
    tolerance: Number(item.tolerance ?? 0.01),
    result: (item.result || 'PASS') as 'PASS' | 'FAIL',
    remarks: item.remarks || undefined,
    recorded_at: item.recorded_at || item.recordedAt || item.created_at || new Date().toISOString(),
  };
}

export function mapBackendResultToFrontend(item: any): VerificationResult {
  return {
    id: item.id,
    verification_id: item.verification_id || item.verificationId || '',
    decision: (item.decision || 'PASS') as 'PASS' | 'FAIL',
    decided_by_id: item.decided_by_id || item.decidedById || '',
    decided_by_name: item.decided_by_name || item.decidedByName || 'Legal Metrology Officer',
    result_date: item.result_date || item.resultDate || item.created_at || new Date().toISOString(),
    remarks: item.remarks || undefined,
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
  };
}

export function mapBackendVerificationToFrontend(item: any): Verification {
  return {
    id: item.id,
    application_id: item.application_id || item.applicationId || '',
    application_number: item.application_number || item.applicationNumber || `APP-${item.application_id || item.id}`,
    application_type: item.application_type || item.applicationType || 'RE_VERIFICATION',
    assignment_id: item.assignment_id || item.assignmentId || '',
    schedule_id: item.schedule_id || item.scheduleId || undefined,
    instrument_id: item.instrument_id || item.instrumentId || '',
    instrument_name: item.instrument_name || item.instrumentName || 'Instrument',
    instrument_serial: item.instrument_serial || item.serial_number || item.serialNumber || '',
    manufacturer: item.manufacturer || undefined,
    model: item.model || undefined,
    capacity: item.capacity ? Number(item.capacity) : undefined,
    capacity_unit: item.capacity_unit || item.capacityUnit || undefined,
    accuracy_class: item.accuracy_class || item.accuracyClass || undefined,
    location_address: item.location_address || item.locationAddress || item.location || undefined,
    location_lat: item.location_lat ? Number(item.location_lat) : undefined,
    location_lng: item.location_lng ? Number(item.location_lng) : undefined,
    owner_name: item.owner_name || item.ownerName || undefined,
    owner_phone: item.owner_phone || item.ownerPhone || undefined,
    owner_email: item.owner_email || item.ownerEmail || undefined,
    owner_organization: item.owner_organization || item.ownerOrganization || undefined,
    purpose: item.purpose || undefined,
    performed_by_id: item.performed_by_id || item.performedById || '',
    performed_by_name: item.performed_by_name || item.performedByName || 'Legal Metrology Officer',
    verification_date: item.verification_date || item.verificationDate || (item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    start_time: item.start_time || item.startTime || undefined,
    end_time: item.end_time || item.endTime || undefined,
    location: item.location || item.location_address || 'Inspection Premises',
    status: (item.status as VerificationStatus) || 'IN_PROGRESS',
    remarks: item.remarks || undefined,
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
    updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
    observations: Array.isArray(item.observations) ? item.observations.map(mapBackendObservationToFrontend) : [],
    readings: Array.isArray(item.readings) ? item.readings.map(mapBackendReadingToFrontend) : [],
    result: item.result ? mapBackendResultToFrontend(item.result) : undefined,
  };
}

export const verificationsApi = {
  /**
   * List verifications from backend GET /api/verifications
   */
  async listVerifications(params?: {
    performedById?: string;
    status?: VerificationStatus;
    search?: string;
  }): Promise<Verification[]> {
    try {
      const response = await apiClient.get<any[]>('/verifications');
      if (!Array.isArray(response)) {
        return [];
      }

      let list = response.map(mapBackendVerificationToFrontend);

      if (params?.performedById) {
        list = list.filter((v) => v.performed_by_id === params.performedById);
      }
      if (params?.status) {
        list = list.filter((v) => v.status === params.status);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        list = list.filter(
          (v) =>
            (v.application_number && v.application_number.toLowerCase().includes(q)) ||
            (v.instrument_name && v.instrument_name.toLowerCase().includes(q)) ||
            (v.instrument_serial && v.instrument_serial.toLowerCase().includes(q)) ||
            (v.location && v.location.toLowerCase().includes(q))
        );
      }

      return list;
    } catch (err: any) {
      // If role is unauthorized on /verifications (e.g. INSTRUMENT_OWNER), return empty list
      if (err.statusCode === 403) {
        return [];
      }
      throw err;
    }
  },

  /**
   * Get single verification by ID from backend GET /api/verifications/:id
   */
  async getVerificationById(id: string): Promise<Verification | null> {
    const response = await apiClient.get<any>(`/verifications/${id}`);
    if (response && response.id) {
      return mapBackendVerificationToFrontend(response);
    }
    return null;
  },

  /**
   * Start a new verification via backend POST /api/verifications
   */
  async createVerification(payload: CreateVerificationPayload): Promise<Verification> {
    const body = {
      applicationId: payload.application_id,
      assignmentId: payload.assignment_id,
      scheduleId: payload.schedule_id || undefined,
      location: payload.location || undefined,
      remarks: payload.remarks || undefined,
    };

    const response = await apiClient.post<any>('/verifications', body);
    if (!response || !response.id) {
      throw new Error('Failed to start verification.');
    }
    return mapBackendVerificationToFrontend(response);
  },

  /**
   * Add a quantitative measurement reading via backend POST /api/verifications/:id/readings
   */
  async addReading(verificationId: string, reading: Omit<VerificationReading, 'id' | 'verification_id' | 'recorded_at'>): Promise<VerificationReading> {
    const body = {
      readingType: reading.reading_type,
      expectedValue: reading.expected_value,
      observedValue: reading.observed_value,
      unit: reading.unit,
      tolerance: reading.tolerance,
      result: reading.result,
      remarks: reading.remarks || undefined,
    };

    const response = await apiClient.post<any>(`/verifications/${verificationId}/readings`, body);
    if (!response || !response.id) {
      throw new Error('Failed to add verification reading.');
    }
    return mapBackendReadingToFrontend(response);
  },

  /**
   * Add a qualitative observation via backend POST /api/verifications/:id/observations
   */
  async addObservation(verificationId: string, observation: Omit<InspectionObservation, 'id' | 'verification_id' | 'observed_at'>): Promise<InspectionObservation> {
    const body = {
      observationType: observation.observation_type,
      observationDescription: observation.observation_description || undefined,
      observedValue: observation.observed_value || undefined,
      remarks: observation.remarks || undefined,
    };

    const response = await apiClient.post<any>(`/verifications/${verificationId}/observations`, body);
    if (!response || !response.id) {
      throw new Error('Failed to add verification observation.');
    }
    return mapBackendObservationToFrontend(response);
  },

  /**
   * Finalize verification with PASS / FAIL decision via backend POST /api/verifications/:id/result
   */
  async submitDecision(verificationId: string, decision: 'PASS' | 'FAIL', remarks: string, _decidedBy?: { id: string; name: string }): Promise<VerificationResult> {
    const body = {
      decision,
      remarks,
    };

    const response = await apiClient.post<any>(`/verifications/${verificationId}/result`, body);
    if (!response || !response.id) {
      throw new Error('Failed to submit verification result.');
    }
    return mapBackendResultToFrontend(response);
  },
};
