import { VerificationApplication, ApplicationStatus, ApplicationType } from '../types';
import { simulateNetworkDelay, getStoredData, setStoredData } from './client';
import { INITIAL_INSTRUMENTS } from './instruments.api';

export const INITIAL_APPLICATIONS: VerificationApplication[] = [
  {
    id: 'app-001',
    application_number: 'APP-LM-2026-00142',
    applicant_id: 'u-101-owner-001',
    applicant_name: 'Rajesh Sharma',
    applicant_organization: 'Sharma Agro & Logistics Pvt Ltd',
    instrument_id: 'inst-001-wb',
    instrument_name: 'Main Freight Weighbridge - 60T',
    instrument_serial: 'SN-AV-2024-88910',
    instrument_type_name: 'Weighbridge (Pitless / Pit Type Electronic Road Weighbridge)',
    application_type: 'RE_VERIFICATION',
    status: 'SCHEDULED',
    purpose: 'Periodic annual re-verification and stamped seal renewal for commercial trading licence under Legal Metrology Act, 2009.',
    remarks: 'Pre-inspection calibration test weights (20 tonnes) staged on site. Request morning slot.',
    submitted_at: '2026-02-18T10:30:00Z',
    created_at: '2026-02-18T09:15:00Z',
    updated_at: '2026-02-20T14:00:00Z',
    assignment: {
      id: 'asgn-001',
      application_id: 'app-001',
      assigned_to_id: 'u-201-lmo-001',
      assigned_to_name: 'Vikram Malhotra (LMO - Zone 4)',
      assigned_to_role: 'LMO',
      status: 'ACCEPTED',
      assigned_at: '2026-02-19T11:00:00Z',
    },
    schedule: {
      id: 'sch-001',
      application_id: 'app-001',
      assignment_id: 'asgn-001',
      scheduled_date: '2026-03-02',
      time_slot: '10:30 AM - 01:00 PM',
      status: 'SCHEDULED',
      created_at: '2026-02-20T14:00:00Z',
      notes: 'Field officer to carry calibrated heavy test weights vehicle to APMC Yard Gate 1.',
    },
    verification_id: 'ver-001',
  },
  {
    id: 'app-002',
    application_number: 'APP-LM-2026-00189',
    applicant_id: 'u-101-owner-001',
    applicant_name: 'Rajesh Sharma',
    applicant_organization: 'Sharma Agro & Logistics Pvt Ltd',
    instrument_id: 'inst-002-ps',
    instrument_name: 'Grain Loading Dock Scale #2',
    instrument_serial: 'SN-ESS-2023-44129',
    instrument_type_name: 'Non-Automatic Weighing Instrument (NAWI - Electronic Platform Scale)',
    application_type: 'RE_VERIFICATION',
    status: 'COMPLETED',
    purpose: 'Mandatory statutory re-verification for grain procurement loading dock scale.',
    remarks: 'All test weights certified by RRSL.',
    submitted_at: '2026-01-05T11:20:00Z',
    created_at: '2026-01-05T10:00:00Z',
    updated_at: '2026-01-12T16:45:00Z',
    assignment: {
      id: 'asgn-002',
      application_id: 'app-002',
      assigned_to_id: 'u-201-lmo-001',
      assigned_to_name: 'Vikram Malhotra (LMO - Zone 4)',
      assigned_to_role: 'LMO',
      status: 'COMPLETED',
      assigned_at: '2026-01-06T09:00:00Z',
    },
    schedule: {
      id: 'sch-002',
      application_id: 'app-002',
      assignment_id: 'asgn-002',
      scheduled_date: '2026-01-12',
      time_slot: '02:00 PM - 03:30 PM',
      status: 'COMPLETED',
      created_at: '2026-01-07T12:00:00Z',
    },
    verification_id: 'ver-002',
    certificate_id: 'cert-002',
  },
  {
    id: 'app-003',
    application_number: 'APP-LM-2026-00244',
    applicant_id: 'u-101-owner-001',
    applicant_name: 'Rajesh Sharma',
    applicant_organization: 'Sharma Agro & Logistics Pvt Ltd',
    instrument_id: 'inst-003-pb',
    instrument_name: 'Lab QA Precision Balance - 0.1mg',
    instrument_serial: 'SN-MT-2025-00192',
    instrument_type_name: 'Electronic Precision Analytical Balance (High Precision)',
    application_type: 'VERIFICATION',
    status: 'UNDER_REVIEW',
    purpose: 'Initial commissioning verification and Class I certification for newly procured analytical balance.',
    remarks: 'Manufacturer test protocol attached.',
    submitted_at: '2026-02-22T14:10:00Z',
    created_at: '2026-02-22T12:00:00Z',
    updated_at: '2026-02-23T09:30:00Z',
    assignment: {
      id: 'asgn-003',
      application_id: 'app-003',
      assigned_to_id: 'u-301-gatc-001',
      assigned_to_name: 'Dr. Sunil Verma (GATC Testing Lab)',
      assigned_to_role: 'GATC',
      status: 'ASSIGNED',
      assigned_at: '2026-02-23T09:30:00Z',
    },
  },
  {
    id: 'app-004',
    application_number: 'APP-LM-2026-00095',
    applicant_id: 'u-101-owner-001',
    applicant_name: 'Rajesh Sharma',
    applicant_organization: 'Sharma Agro & Logistics Pvt Ltd',
    instrument_id: 'inst-004-mpd',
    instrument_name: 'Diesel Commercial Dispenser Bay 1',
    instrument_serial: 'SN-TKH-2024-77182',
    instrument_type_name: 'Fuel Dispensing Unit (Multi-Product Dispenser MPD)',
    application_type: 'VERIFICATION',
    status: 'SUBMITTED',
    purpose: 'Verification before putting dispenser into commercial operation.',
    submitted_at: '2026-02-25T08:45:00Z',
    created_at: '2026-02-25T08:00:00Z',
    updated_at: '2026-02-25T08:45:00Z',
  },
];

const APPLICATIONS_KEY = 'applications_list';

export interface CreateApplicationPayload {
  instrument_id: string;
  application_type: ApplicationType;
  purpose: string;
  remarks?: string;
  applicant_id?: string;
  applicant_name?: string;
  applicant_organization?: string;
}

export const applicationsApi = {
  /**
   * List applications with filtering
   */
  async listApplications(params?: {
    applicantId?: string;
    status?: ApplicationStatus;
    search?: string;
  }): Promise<VerificationApplication[]> {
    await simulateNetworkDelay(200, 400);
    // TODO: Replace with real fetch('/api/v1/verification-applications?' + new URLSearchParams(params as any))
    let list = getStoredData<VerificationApplication[]>(APPLICATIONS_KEY, INITIAL_APPLICATIONS);

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
  },

  /**
   * Get single application by ID
   */
  async getApplicationById(id: string): Promise<VerificationApplication | null> {
    await simulateNetworkDelay(150, 300);
    // TODO: Replace with real fetch(`/api/v1/verification-applications/${id}`)
    const list = getStoredData<VerificationApplication[]>(APPLICATIONS_KEY, INITIAL_APPLICATIONS);
    return list.find((a) => a.id === id) || null;
  },

  /**
   * Create new verification application
   */
  async createApplication(payload: CreateApplicationPayload): Promise<VerificationApplication> {
    await simulateNetworkDelay(300, 550);
    // TODO: Replace with real fetch('/api/v1/verification-applications', { method: 'POST', body: JSON.stringify(payload) })

    const instruments = getStoredData(
      'instruments_list',
      INITIAL_INSTRUMENTS
    );
    const instrument = instruments.find((i) => i.id === payload.instrument_id);

    const newAppNumber = `APP-LM-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newApp: VerificationApplication = {
      id: `app-${Date.now()}`,
      application_number: newAppNumber,
      applicant_id: payload.applicant_id || 'u-101-owner-001',
      applicant_name: payload.applicant_name || 'Rajesh Sharma',
      applicant_organization: payload.applicant_organization || 'Sharma Agro & Logistics Pvt Ltd',
      instrument_id: payload.instrument_id,
      instrument_name: instrument?.instrument_name || 'Registered Instrument',
      instrument_serial: instrument?.serial_number || 'SN-UNKNOWN',
      instrument_type_name: instrument?.instrument_type_name || 'Weighing Instrument',
      application_type: payload.application_type,
      status: 'SUBMITTED',
      purpose: payload.purpose,
      remarks: payload.remarks || '',
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      assignment: {
        id: `asgn-${Date.now()}`,
        application_id: `app-${Date.now()}`,
        assigned_to_id: 'u-201-lmo-001',
        assigned_to_name: 'Vikram Malhotra (LMO - Assigned)',
        assigned_to_role: 'LMO',
        status: 'ASSIGNED',
        assigned_at: new Date().toISOString(),
      }
    };

    const list = getStoredData<VerificationApplication[]>(APPLICATIONS_KEY, INITIAL_APPLICATIONS);
    const updatedList = [newApp, ...list];
    setStoredData(APPLICATIONS_KEY, updatedList);

    return newApp;
  },

  /**
   * Update application status (for LMO/Admin workflow)
   */
  async updateApplicationStatus(id: string, status: ApplicationStatus, remarks?: string): Promise<VerificationApplication> {
    await simulateNetworkDelay(200, 400);
    // TODO: Replace with real fetch(`/api/v1/verification-applications/${id}/status`, { method: 'PATCH', body: ... })
    const list = getStoredData<VerificationApplication[]>(APPLICATIONS_KEY, INITIAL_APPLICATIONS);
    const index = list.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error(`Application with ID ${id} not found.`);
    }

    const updated = {
      ...list[index],
      status,
      remarks: remarks || list[index].remarks,
      updated_at: new Date().toISOString(),
    };

    list[index] = updated;
    setStoredData(APPLICATIONS_KEY, list);
    return updated;
  },
};
