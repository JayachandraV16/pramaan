import { 
  Verification, 
  VerificationStatus, 
  InspectionObservation, 
  VerificationReading, 
  VerificationResult 
} from '../types';
import { simulateNetworkDelay, getStoredData, setStoredData } from './client';

export const INITIAL_VERIFICATIONS: Verification[] = [
  {
    id: 'ver-001',
    application_id: 'app-001',
    application_number: 'APP-LM-2026-00142',
    assignment_id: 'asgn-001',
    schedule_id: 'sch-001',
    instrument_id: 'inst-001-wb',
    instrument_name: 'Main Freight Weighbridge - 60T',
    instrument_serial: 'SN-AV-2024-88910',
    performed_by_id: 'u-201-lmo-001',
    performed_by_name: 'Vikram Malhotra (LMO Grade I)',
    verification_date: '2026-03-02',
    start_time: '2026-03-02T10:30:00Z',
    end_time: '2026-03-02T12:45:00Z',
    location: 'Warehouse Gate 1, APMC Yard, Navi Mumbai',
    status: 'IN_PROGRESS',
    remarks: 'Field inspection in progress. Initial zero-point stability and corner load tests conducted.',
    created_at: '2026-02-20T14:00:00Z',
    updated_at: '2026-03-02T10:30:00Z',
    observations: [
      {
        id: 'obs-101',
        verification_id: 'ver-001',
        observation_type: 'Physical Structure & Platform Condition',
        observation_description: 'Check for deck plate distortion, rust, clearance from pit walls, drainage.',
        observed_value: 'Good - No obstruction or pit debris detected',
        remarks: 'Platform alignment satisfactory.',
        observed_at: '2026-03-02T10:45:00Z',
      },
      {
        id: 'obs-102',
        verification_id: 'ver-001',
        observation_type: 'Lead & Wire Official Seal Integrity',
        observation_description: 'Verification of previous metrological seal and tamper-evident wire.',
        observed_value: 'Intact - Stamped seal #LM-2024-9981 verified',
        remarks: 'No unauthorized access to calibration jumper or digital junction box.',
        observed_at: '2026-03-02T10:50:00Z',
      },
      {
        id: 'obs-103',
        verification_id: 'ver-001',
        observation_type: 'Weight Indicator & Remote Display',
        observation_description: 'Digital display clarity, zero-tracking device, tare device functionality.',
        observed_value: 'Normal - 7-segment LED display clear with no dead segments',
        remarks: 'Zero return accurate within 0.25e.',
        observed_at: '2026-03-02T11:00:00Z',
      },
    ],
    readings: [
      {
        id: 'rdg-101',
        verification_id: 'ver-001',
        reading_type: 'Zero Load Test (0 tonne)',
        expected_value: 0.000,
        observed_value: 0.000,
        unit: 'tonne',
        tolerance: 0.005,
        result: 'PASS',
        remarks: 'Exact center of zero.',
        recorded_at: '2026-03-02T11:15:00Z',
      },
      {
        id: 'rdg-102',
        verification_id: 'ver-001',
        reading_type: 'Eccentricity Test (Corner 1 - 15 tonne standard weight)',
        expected_value: 15.000,
        observed_value: 15.004,
        unit: 'tonne',
        tolerance: 0.020,
        result: 'PASS',
        remarks: 'Within permissible error limit.',
        recorded_at: '2026-03-02T11:30:00Z',
      },
      {
        id: 'rdg-103',
        reading_type: 'Eccentricity Test (Corner 2 - 15 tonne standard weight)',
        verification_id: 'ver-001',
        expected_value: 15.000,
        observed_value: 15.006,
        unit: 'tonne',
        tolerance: 0.020,
        result: 'PASS',
        remarks: 'Within permissible error limit.',
        recorded_at: '2026-03-02T11:40:00Z',
      },
      {
        id: 'rdg-104',
        verification_id: 'ver-001',
        reading_type: 'Half Load Weighing Test (30 tonne)',
        expected_value: 30.000,
        observed_value: 30.008,
        unit: 'tonne',
        tolerance: 0.040,
        result: 'PASS',
        remarks: 'Linearity confirmed.',
        recorded_at: '2026-03-02T12:00:00Z',
      },
    ],
  },
  {
    id: 'ver-002',
    application_id: 'app-002',
    application_number: 'APP-LM-2026-00189',
    assignment_id: 'asgn-002',
    schedule_id: 'sch-002',
    instrument_id: 'inst-002-ps',
    instrument_name: 'Grain Loading Dock Scale #2',
    instrument_serial: 'SN-ESS-2023-44129',
    performed_by_id: 'u-201-lmo-001',
    performed_by_name: 'Vikram Malhotra (LMO Grade I)',
    verification_date: '2026-01-12',
    start_time: '2026-01-12T14:00:00Z',
    end_time: '2026-01-12T15:30:00Z',
    location: 'Loading Shed B, APMC Market Yard, Navi Mumbai',
    status: 'COMPLETED',
    remarks: 'Scale verified in compliance with Legal Metrology (General) Rules, 2011. Verification Certificate issued.',
    created_at: '2026-01-07T12:00:00Z',
    updated_at: '2026-01-12T16:00:00Z',
    observations: [
      {
        id: 'obs-201',
        verification_id: 'ver-002',
        observation_type: 'Physical & Mechanical Housing',
        observation_description: 'Check load cell mounts, spirit bubble level, stainless steel platter.',
        observed_value: 'Good - Level bubble centered, firm footing',
        remarks: 'No corrosion or physical damage.',
        observed_at: '2026-01-12T14:10:00Z',
      },
      {
        id: 'obs-202',
        verification_id: 'ver-002',
        observation_type: 'Tamper Protection & Verification Plugs',
        observation_description: 'Physical lead seal affixed to calibration screws.',
        observed_value: 'Intact - Fresh tamper-proof seal applied #PRM-2026-7812',
        remarks: 'Department seal stamped.',
        observed_at: '2026-01-12T14:20:00Z',
      },
    ],
    readings: [
      {
        id: 'rdg-201',
        verification_id: 'ver-002',
        reading_type: 'Zero Load Check (0.00 kg)',
        expected_value: 0.000,
        observed_value: 0.000,
        unit: 'kg',
        tolerance: 0.020,
        result: 'PASS',
        remarks: 'Zero stable.',
        recorded_at: '2026-01-12T14:30:00Z',
      },
      {
        id: 'rdg-202',
        verification_id: 'ver-002',
        reading_type: '1/3 Max Capacity (150.00 kg Test Load)',
        expected_value: 150.000,
        observed_value: 150.010,
        unit: 'kg',
        tolerance: 0.050,
        result: 'PASS',
        remarks: 'Error +10g well within tolerance (+-50g).',
        recorded_at: '2026-01-12T14:45:00Z',
      },
      {
        id: 'rdg-203',
        verification_id: 'ver-002',
        reading_type: 'Full Capacity (500.00 kg Test Load)',
        expected_value: 500.000,
        observed_value: 500.020,
        unit: 'kg',
        tolerance: 0.100,
        result: 'PASS',
        remarks: 'Error +20g within tolerance (+-100g).',
        recorded_at: '2026-01-12T15:00:00Z',
      },
      {
        id: 'rdg-204',
        verification_id: 'ver-002',
        reading_type: 'Repeatability Test 3 Consecutive Runs (500 kg)',
        expected_value: 500.000,
        observed_value: 500.015,
        unit: 'kg',
        tolerance: 0.100,
        result: 'PASS',
        remarks: 'Repeatability error <= 0.015 kg.',
        recorded_at: '2026-01-12T15:15:00Z',
      },
    ],
    result: {
      id: 'res-002',
      verification_id: 'ver-002',
      decision: 'PASS',
      decided_by_id: 'u-201-lmo-001',
      decided_by_name: 'Vikram Malhotra (LMO Grade I)',
      result_date: '2026-01-12T15:30:00Z',
      remarks: 'All qualitative checks and metrological tolerance limits satisfied. Digital certificate issued for 12 months validity.',
      created_at: '2026-01-12T15:30:00Z',
    },
  },
];

const VERIFICATIONS_KEY = 'verifications_list';

export const verificationsApi = {
  /**
   * List verifications
   */
  async listVerifications(params?: {
    performedById?: string;
    status?: VerificationStatus;
    search?: string;
  }): Promise<Verification[]> {
    await simulateNetworkDelay(200, 400);
    // TODO: Replace with real fetch('/api/v1/verifications?' + new URLSearchParams(params as any))
    let list = getStoredData<Verification[]>(VERIFICATIONS_KEY, INITIAL_VERIFICATIONS);

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
  },

  /**
   * Get single verification by ID with readings and observations
   */
  async getVerificationById(id: string): Promise<Verification | null> {
    await simulateNetworkDelay(150, 300);
    // TODO: Replace with real fetch(`/api/v1/verifications/${id}`)
    const list = getStoredData<Verification[]>(VERIFICATIONS_KEY, INITIAL_VERIFICATIONS);
    return list.find((v) => v.id === id) || null;
  },

  /**
   * Add a quantitative measurement reading to a verification
   */
  async addReading(verificationId: string, reading: Omit<VerificationReading, 'id' | 'verification_id' | 'recorded_at'>): Promise<VerificationReading> {
    await simulateNetworkDelay(200, 350);
    // TODO: Replace with real fetch(`/api/v1/verifications/${verificationId}/readings`, { method: 'POST', body: ... })
    const list = getStoredData<Verification[]>(VERIFICATIONS_KEY, INITIAL_VERIFICATIONS);
    const ver = list.find((v) => v.id === verificationId);
    if (!ver) throw new Error('Verification not found');

    const newReading: VerificationReading = {
      id: `rdg-${Date.now()}`,
      verification_id: verificationId,
      ...reading,
      recorded_at: new Date().toISOString(),
    };

    ver.readings = [...ver.readings, newReading];
    ver.updated_at = new Date().toISOString();
    setStoredData(VERIFICATIONS_KEY, list);

    return newReading;
  },

  /**
   * Add a qualitative observation to a verification
   */
  async addObservation(verificationId: string, observation: Omit<InspectionObservation, 'id' | 'verification_id' | 'observed_at'>): Promise<InspectionObservation> {
    await simulateNetworkDelay(200, 350);
    // TODO: Replace with real fetch(`/api/v1/verifications/${verificationId}/observations`, { method: 'POST', body: ... })
    const list = getStoredData<Verification[]>(VERIFICATIONS_KEY, INITIAL_VERIFICATIONS);
    const ver = list.find((v) => v.id === verificationId);
    if (!ver) throw new Error('Verification not found');

    const newObs: InspectionObservation = {
      id: `obs-${Date.now()}`,
      verification_id: verificationId,
      ...observation,
      observed_at: new Date().toISOString(),
    };

    ver.observations = [...ver.observations, newObs];
    ver.updated_at = new Date().toISOString();
    setStoredData(VERIFICATIONS_KEY, list);

    return newObs;
  },

  /**
   * Finalize verification with PASS / FAIL decision
   */
  async submitDecision(verificationId: string, decision: 'PASS' | 'FAIL', remarks: string, decidedBy: { id: string; name: string }): Promise<Verification> {
    await simulateNetworkDelay(300, 600);
    // TODO: Replace with real fetch(`/api/v1/verifications/${verificationId}/results`, { method: 'POST', body: ... })
    const list = getStoredData<Verification[]>(VERIFICATIONS_KEY, INITIAL_VERIFICATIONS);
    const index = list.findIndex((v) => v.id === verificationId);
    if (index === -1) throw new Error('Verification not found');

    const result: VerificationResult = {
      id: `res-${Date.now()}`,
      verification_id: verificationId,
      decision,
      decided_by_id: decidedBy.id,
      decided_by_name: decidedBy.name,
      result_date: new Date().toISOString(),
      remarks,
      created_at: new Date().toISOString(),
    };

    list[index] = {
      ...list[index],
      status: 'COMPLETED',
      end_time: new Date().toISOString(),
      result,
      updated_at: new Date().toISOString(),
    };

    setStoredData(VERIFICATIONS_KEY, list);
    return list[index];
  },
};
