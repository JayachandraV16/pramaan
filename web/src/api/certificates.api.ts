import { 
  VerificationCertificate, 
  CertificateStatus, 
  PublicVerificationLookupResult,
  QrAuthenticationLog 
} from '../types';
import { simulateNetworkDelay, getStoredData, setStoredData } from './client';

export const INITIAL_CERTIFICATES: VerificationCertificate[] = [
  {
    id: 'cert-002',
    verification_id: 'ver-002',
    instrument_id: 'inst-002-ps',
    instrument_name: 'Grain Loading Dock Scale #2',
    instrument_serial: 'SN-ESS-2023-44129',
    instrument_type_name: 'Non-Automatic Weighing Instrument (Platform Scale)',
    owner_name: 'Rajesh Sharma',
    owner_organization: 'Sharma Agro & Logistics Pvt Ltd',
    certificate_number: 'CERT-LM-MH-2026-098124',
    issue_date: '2026-01-12',
    valid_from: '2026-01-12',
    valid_until: '2027-01-11',
    status: 'ACTIVE',
    qr_token: 'PRM-QR-98124-MH-AUTH-VALID',
    verification_decision: 'PASS',
    issued_by_name: 'Vikram Malhotra',
    issued_by_designation: 'Legal Metrology Officer (Zone 4)',
    jurisdiction_zone: 'Konkan Division, Maharashtra State',
    accuracy_class: 'Class III (Medium Accuracy)',
    capacity: 500,
    capacity_unit: 'kg',
    location_address: 'Loading Shed B, APMC Market Yard, Navi Mumbai 400705',
    generated_at: '2026-01-12T16:00:00Z',
    created_at: '2026-01-12T16:00:00Z',
    updated_at: '2026-01-12T16:00:00Z',
  },
  {
    id: 'cert-001-past',
    verification_id: 'ver-prev-001',
    instrument_id: 'inst-001-wb',
    instrument_name: 'Main Freight Weighbridge - 60T',
    instrument_serial: 'SN-AV-2024-88910',
    instrument_type_name: 'Weighbridge (Pitless Road Weighbridge)',
    owner_name: 'Rajesh Sharma',
    owner_organization: 'Sharma Agro & Logistics Pvt Ltd',
    certificate_number: 'CERT-LM-MH-2025-044182',
    issue_date: '2025-02-28',
    valid_from: '2025-02-28',
    valid_until: '2026-02-27',
    status: 'EXPIRED',
    qr_token: 'PRM-QR-44182-MH-AUTH-EXPIRED',
    verification_decision: 'PASS',
    issued_by_name: 'Vikram Malhotra',
    issued_by_designation: 'Legal Metrology Officer (Zone 4)',
    jurisdiction_zone: 'Konkan Division, Maharashtra State',
    accuracy_class: 'Class III (Medium Accuracy)',
    capacity: 60,
    capacity_unit: 'tonne',
    location_address: 'Warehouse Gate 1, APMC Yard, Navi Mumbai, Maharashtra 400705',
    generated_at: '2025-02-28T14:30:00Z',
    created_at: '2025-02-28T14:30:00Z',
    updated_at: '2026-02-28T00:00:00Z',
  },
  {
    id: 'cert-003',
    verification_id: 'ver-prev-003',
    instrument_id: 'inst-003-pb',
    instrument_name: 'Lab QA Precision Balance - 0.1mg',
    instrument_serial: 'SN-MT-2025-00192',
    instrument_type_name: 'Electronic Precision Analytical Balance (High Precision)',
    owner_name: 'Rajesh Sharma',
    owner_organization: 'Sharma Agro & Logistics Pvt Ltd',
    certificate_number: 'CERT-LM-MH-2025-077123',
    issue_date: '2025-01-20',
    valid_from: '2025-01-20',
    valid_until: '2027-01-19',
    status: 'ACTIVE',
    qr_token: 'PRM-QR-77123-MH-AUTH-VALID',
    verification_decision: 'PASS',
    issued_by_name: 'Dr. Sunil Verma',
    issued_by_designation: 'Senior Testing Metrologist (RRSL / GATC)',
    jurisdiction_zone: 'Western Region Standards Laboratory',
    accuracy_class: 'Class I (Special Accuracy)',
    capacity: 220,
    capacity_unit: 'g',
    location_address: 'Quality Testing Laboratory Room 302, Navi Mumbai 400705',
    generated_at: '2025-01-20T12:00:00Z',
    created_at: '2025-01-20T12:00:00Z',
    updated_at: '2025-01-20T12:00:00Z',
  },
];

const CERTIFICATES_KEY = 'certificates_list';
const QR_LOGS_KEY = 'qr_auth_logs';

export const certificatesApi = {
  /**
   * List certificates
   */
  async listCertificates(params?: {
    status?: CertificateStatus;
    search?: string;
  }): Promise<VerificationCertificate[]> {
    await simulateNetworkDelay(200, 400);
    // TODO: Replace with real fetch('/api/v1/verification-certificates?' + new URLSearchParams(params as any))
    let list = getStoredData<VerificationCertificate[]>(CERTIFICATES_KEY, INITIAL_CERTIFICATES);

    if (params?.status) {
      list = list.filter((c) => c.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.certificate_number.toLowerCase().includes(q) ||
          c.instrument_name.toLowerCase().includes(q) ||
          c.instrument_serial.toLowerCase().includes(q) ||
          c.owner_name.toLowerCase().includes(q) ||
          c.qr_token.toLowerCase().includes(q)
      );
    }

    return list;
  },

  /**
   * Get single certificate by ID
   */
  async getCertificateById(id: string): Promise<VerificationCertificate | null> {
    await simulateNetworkDelay(150, 300);
    // TODO: Replace with real fetch(`/api/v1/verification-certificates/${id}`)
    const list = getStoredData<VerificationCertificate[]>(CERTIFICATES_KEY, INITIAL_CERTIFICATES);
    return list.find((c) => c.id === id) || null;
  },

  /**
   * Public QR / Certificate lookup (no authentication required)
   * Matches Migration 015 qr_authentications logic
   */
  async lookupCertificateByNumberOrQr(query: string): Promise<PublicVerificationLookupResult> {
    await simulateNetworkDelay(300, 600);
    // TODO: Replace with real fetch('/api/v1/public/verify-certificate?q=' + encodeURIComponent(query))
    const trimmed = query.trim().toUpperCase();
    const list = getStoredData<VerificationCertificate[]>(CERTIFICATES_KEY, INITIAL_CERTIFICATES);

    const match = list.find(
      (c) =>
        c.certificate_number.toUpperCase() === trimmed ||
        c.qr_token.toUpperCase() === trimmed ||
        c.instrument_serial.toUpperCase() === trimmed
    );

    if (!match) {
      return {
        authenticated: false,
        result: 'INVALID',
        remarks: 'No certificate found matching the provided identifier or QR token in national records.',
      };
    }

    // Check expiration date
    const today = new Date().toISOString().split('T')[0];
    let calculatedResult = match.status === 'REVOKED' ? 'REVOKED' : match.status === 'EXPIRED' ? 'EXPIRED' : 'VALID';
    if (match.status === 'ACTIVE' && today > match.valid_until) {
      calculatedResult = 'EXPIRED';
    }

    // Record QR log (matches migration 015 qr_authentications table)
    const logs = getStoredData<QrAuthenticationLog[]>(QR_LOGS_KEY, []);
    const newLog: QrAuthenticationLog = {
      id: `qr-log-${Date.now()}`,
      certificate_id: match.id,
      result: calculatedResult as any,
      access_source: 'WEB_PUBLIC_PORTAL',
      ip_address: '127.0.0.1',
      user_agent: navigator.userAgent,
      authenticated_at: new Date().toISOString(),
    };
    setStoredData(QR_LOGS_KEY, [newLog, ...logs]);

    return {
      authenticated: true,
      result: calculatedResult as any,
      certificate: match,
      instrument: {
        instrument_name: match.instrument_name,
        serial_number: match.instrument_serial,
        manufacturer: 'Certified OEM',
        model: 'Standard Model',
        capacity: match.capacity,
        capacity_unit: match.capacity_unit,
        accuracy_class: match.accuracy_class,
        location_address: match.location_address,
      },
      owner_name: match.owner_name,
      owner_organization: match.owner_organization,
      verification_date: match.issue_date,
      officer_name: match.issued_by_name,
      remarks: calculatedResult === 'VALID' 
        ? 'Certificate is valid and officially registered under the Legal Metrology Act, 2009.'
        : calculatedResult === 'EXPIRED'
        ? 'Certificate has expired. Re-verification required immediately for commercial use.'
        : 'Certificate has been revoked by the Metrology Authority.',
    };
  },
};
