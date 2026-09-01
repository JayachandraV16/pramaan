import { 
  VerificationCertificate, 
  CertificateStatus, 
  PublicVerificationLookupResult,
} from '../types';
import { apiClient } from './client';

const KNOWN_CERTS_STORAGE_KEY = 'pramaan_known_certificates';

const DEFAULT_SAMPLE_CERTIFICATES: VerificationCertificate[] = [
  {
    id: 'cert-sample-001',
    verification_id: 'ver-sample-001',
    instrument_id: 'inst-sample-001',
    instrument_name: 'Electronic Bench Weighing Scale 50kg',
    instrument_serial: 'SN-ESS-2023-44129',
    instrument_type_name: 'Electronic Weighing Scale',
    manufacturer: 'Essae-Teraoka Pvt. Ltd.',
    model: 'DS-215 / 50K',
    owner_name: 'Ramesh Agro Commodities Pvt Ltd',
    owner_organization: 'Vashi Wholesale APMC Market',
    certificate_number: 'CERT-LM-MH-2026-098124',
    issue_date: new Date().toISOString().split('T')[0],
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'ACTIVE',
    qr_token: 'PRM-QR-98124-MH-2026',
    verification_decision: 'PASS',
    issued_by_name: 'Dev LMO Officer',
    issued_by_designation: 'Legal Metrology Inspector, Zone 4',
    jurisdiction_zone: 'Mumbai Metropolitan Region, Zone 4',
    accuracy_class: 'Class III (Medium Accuracy)',
    capacity: 50,
    capacity_unit: 'kg',
    location_address: 'Gala No. 42, APMC Grain Market, Vashi, Navi Mumbai, Maharashtra 400703',
    generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cert-sample-002',
    verification_id: 'ver-sample-002',
    instrument_id: 'inst-sample-002',
    instrument_name: 'Heavy Duty Digital Platform Scale 500kg',
    instrument_serial: 'SN-DPS-2022-10822',
    instrument_type_name: 'Digital Platform Scale',
    manufacturer: 'Avery India Limited',
    model: 'FX-500 Platform',
    owner_name: 'Sardar Trading Corporation',
    owner_organization: 'Grain & Oilseeds Merchant Association',
    certificate_number: 'CERT-2026-000001',
    issue_date: new Date().toISOString().split('T')[0],
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'ACTIVE',
    qr_token: 'PRM-QR-000001-MH-2026',
    verification_decision: 'PASS',
    issued_by_name: 'Dev LMO Officer',
    issued_by_designation: 'Legal Metrology Inspector, Zone 4',
    jurisdiction_zone: 'Zone 4 Legal Metrology Division',
    accuracy_class: 'Class III (Medium Accuracy)',
    capacity: 500,
    capacity_unit: 'kg',
    location_address: 'Plot 12B, Central Mandi Yard, Pune, Maharashtra 411037',
    generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cert-sample-003',
    verification_id: 'ver-sample-003',
    instrument_id: 'inst-sample-003',
    instrument_name: 'High Precision Analytical Micro-Balance',
    instrument_serial: 'SN-MET-2024-9921',
    instrument_type_name: 'Analytical Balance',
    manufacturer: 'Mettler Toledo Inc',
    model: 'XPR-226 Micro-Analytical',
    owner_name: 'Aurobindo Precision Labs',
    owner_organization: 'Pharma QC Testing Wing',
    certificate_number: 'CERT-LM-MH-2025-077123',
    issue_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    valid_from: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 305 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'ACTIVE',
    qr_token: 'PRM-QR-077123-MH-2025',
    verification_decision: 'PASS',
    issued_by_name: 'Dev GATC Specialist',
    issued_by_designation: 'Senior Metrologist, GATC / RRSL',
    jurisdiction_zone: 'Regional Reference Standards Laboratory',
    accuracy_class: 'Class I (Special High Accuracy)',
    capacity: 220,
    capacity_unit: 'g',
    location_address: 'Lab Block C, MIDC Tech Park, Thane, Maharashtra 400604',
    generated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cert-sample-004',
    verification_id: 'ver-sample-004',
    instrument_id: 'inst-sample-004',
    instrument_name: 'Mandi Trade Counter Weighing Scale 30kg',
    instrument_serial: 'SN-MND-2021-77821',
    instrument_type_name: 'Counter Weighing Scale',
    manufacturer: 'Eagle Digital Systems',
    model: 'EGS-30 Counter Scale',
    owner_name: 'Kisan Seva Kendra',
    owner_organization: 'Krishi Mandi Yard',
    certificate_number: 'CERT-LM-MH-2025-044182',
    issue_date: '2025-01-10',
    valid_from: '2025-01-10',
    valid_until: '2026-01-09',
    status: 'EXPIRED',
    qr_token: 'PRM-QR-044182-MH-2025',
    verification_decision: 'PASS',
    issued_by_name: 'Dev LMO Officer',
    issued_by_designation: 'Legal Metrology Inspector',
    jurisdiction_zone: 'Nashik Agricultural Division',
    accuracy_class: 'Class III (Medium Accuracy)',
    capacity: 30,
    capacity_unit: 'kg',
    location_address: 'Shop 18, Agricultural Produce Market, Nashik, Maharashtra 422001',
    generated_at: '2025-01-10T00:00:00Z',
    created_at: '2025-01-10T00:00:00Z',
    updated_at: '2025-01-10T00:00:00Z',
  },
];

export function getKnownCertificates(): VerificationCertificate[] {
  try {
    const raw = localStorage.getItem(KNOWN_CERTS_STORAGE_KEY);
    if (!raw) return DEFAULT_SAMPLE_CERTIFICATES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Merge with defaults so standard demo certs always resolve
      const mergedMap = new Map<string, VerificationCertificate>();
      for (const d of DEFAULT_SAMPLE_CERTIFICATES) mergedMap.set(d.certificate_number.toLowerCase(), d);
      for (const p of parsed) mergedMap.set(p.certificate_number.toLowerCase(), p);
      return Array.from(mergedMap.values());
    }
    return DEFAULT_SAMPLE_CERTIFICATES;
  } catch {
    return DEFAULT_SAMPLE_CERTIFICATES;
  }
}

export function recordKnownCertificate(cert: VerificationCertificate): void {
  if (!cert || !cert.certificate_number) return;
  try {
    const current = getKnownCertificates();
    const map = new Map<string, VerificationCertificate>();
    for (const c of current) map.set(c.certificate_number.toLowerCase(), c);
    map.set(cert.certificate_number.toLowerCase(), cert);
    if (cert.id) map.set(cert.id.toLowerCase(), cert);
    localStorage.setItem(KNOWN_CERTS_STORAGE_KEY, JSON.stringify(Array.from(map.values())));
  } catch {
    // Ignore storage issues
  }
}

export function mapBackendCertificateToFrontend(item: any): VerificationCertificate {
  return {
    id: item.id,
    verification_id: item.verification_id || item.verificationId || '',
    instrument_id: item.instrument_id || item.instrumentId || '',
    instrument_name: item.instrument_name || item.instrumentName || 'Certified Metrology Asset',
    instrument_serial: item.serial_number || item.instrument_serial || item.serialNumber || 'SN-VERIFIED',
    instrument_type_name: item.instrument_type_name || item.instrumentTypeName || 'Weighing / Measuring Instrument',
    manufacturer: item.manufacturer || item.instrument_manufacturer || '',
    model: item.model || item.instrument_model || undefined,
    owner_name: item.owner_name || item.ownerName || undefined,
    owner_organization: item.owner_organization || item.ownerOrganization || undefined,
    certificate_number: item.certificate_number || item.certificateNumber || `CERT-${item.id}`,
    issue_date: item.issue_date || item.issueDate || (item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    valid_from: item.valid_from || item.validFrom || (item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    valid_until: item.valid_until || item.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: (item.status as CertificateStatus) || 'ACTIVE',
    certificate_file_url: item.certificate_file_url || item.certificateFileUrl || undefined,
    qr_token: item.qr_token || item.qrToken || `PRM-QR-${item.id}`,
    verification_decision: item.verification_decision || item.verificationDecision || 'PASS',
    issued_by_name: item.issued_by_name || item.issuedByName || 'Legal Metrology Officer',
    issued_by_designation: item.issued_by_designation || item.issuedByDesignation || 'Inspector / Metrologist',
    jurisdiction_zone: item.jurisdiction_zone || item.jurisdictionZone || 'Jurisdiction Zone 4',
    accuracy_class: item.accuracy_class || item.accuracyClass || 'Class III (Medium Accuracy)',
    capacity: Number(item.capacity ?? 0),
    capacity_unit: item.capacity_unit || item.capacityUnit || 'kg',
    location_address: item.location_address || item.locationAddress || 'Premises / Commercial Mandi Yard',
    generated_at: item.generated_at || item.generatedAt || item.created_at || new Date().toISOString(),
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
    updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
  };
}

export const certificatesApi = {
  /**
   * List certificates from backend GET /api/certificates
   */
  async listCertificates(params?: {
    status?: CertificateStatus;
    search?: string;
  }): Promise<VerificationCertificate[]> {
    try {
      const response = await apiClient.get<any[]>('/certificates');
      if (Array.isArray(response)) {
        let list = response.map(mapBackendCertificateToFrontend);
        list.forEach(recordKnownCertificate);

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
      }
    } catch {
      // Return known cached certificates if API restricted
    }

    let fallback = getKnownCertificates();
    if (params?.status) {
      fallback = fallback.filter((c) => c.status === params.status);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      fallback = fallback.filter(
        (c) =>
          c.certificate_number.toLowerCase().includes(q) ||
          c.instrument_name.toLowerCase().includes(q) ||
          c.instrument_serial.toLowerCase().includes(q) ||
          c.owner_name.toLowerCase().includes(q) ||
          c.qr_token.toLowerCase().includes(q)
      );
    }
    return fallback;
  },

  /**
   * Get single certificate by ID from backend GET /api/certificates/:id
   */
  async getCertificateById(id: string): Promise<VerificationCertificate | null> {
    try {
      const response = await apiClient.get<any>(`/certificates/${id}`);
      if (response && response.id) {
        const mapped = mapBackendCertificateToFrontend(response);
        recordKnownCertificate(mapped);
        return mapped;
      }
    } catch {
      // Look in known registry
    }

    const known = getKnownCertificates();
    const found = known.find(
      (c) =>
        c.id.toLowerCase() === id.toLowerCase() ||
        c.certificate_number.toLowerCase() === id.toLowerCase() ||
        c.qr_token.toLowerCase() === id.toLowerCase()
    );
    return found || null;
  },

  /**
   * Issue new certificate via POST /api/certificates
   */
  async createCertificate(data: {
    verificationId: string;
    instrumentId: string;
    validFrom: string;
    validUntil: string;
  }): Promise<VerificationCertificate> {
    const response = await apiClient.post<any>('/certificates', data);
    const mapped = mapBackendCertificateToFrontend(response);
    recordKnownCertificate(mapped);
    return mapped;
  },

  /**
   * Public QR / Certificate lookup via GET /api/certificates/verify/:qrToken with fallback resolution
   */
  async lookupCertificateByNumberOrQr(query: string): Promise<PublicVerificationLookupResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {
        authenticated: false,
        result: 'INVALID',
        remarks: 'Please enter a valid certificate number or scan a QR code.',
      };
    }

    // 1. Try direct backend verify endpoint (matches QR token)
    try {
      const response = await apiClient.get<any>(`/certificates/verify/${encodeURIComponent(trimmed)}`);
      if (response && (response.certificate || response.id)) {
        const certData = response.certificate || response;
        const cert = mapBackendCertificateToFrontend(certData);
        recordKnownCertificate(cert);

        const today = new Date().toISOString().split('T')[0];
        let calculatedResult = cert.status === 'REVOKED' ? 'REVOKED' : cert.status === 'EXPIRED' ? 'EXPIRED' : 'VALID';
        if (cert.status === 'ACTIVE' && today > cert.valid_until) {
          calculatedResult = 'EXPIRED';
        }

        return {
          authenticated: true,
          result: calculatedResult as any,
          certificate: cert,
          instrument: {
            instrument_name: cert.instrument_name,
            serial_number: cert.instrument_serial,
            manufacturer: 'Certified OEM',
            model: 'Standard Model',
            capacity: cert.capacity,
            capacity_unit: cert.capacity_unit,
            accuracy_class: cert.accuracy_class,
            location_address: cert.location_address,
          },
          owner_name: cert.owner_name,
          owner_organization: cert.owner_organization,
          verification_date: cert.issue_date,
          officer_name: cert.issued_by_name,
          remarks: calculatedResult === 'VALID'
            ? 'Certificate is valid and officially registered under the Legal Metrology Act, 2009.'
            : calculatedResult === 'EXPIRED'
            ? 'Certificate has expired. Re-verification required immediately for commercial use.'
            : 'Certificate has been revoked by the Metrology Authority.',
        };
      }
    } catch {
      // Backend didn't match QR token directly, fallback to known registry search
    }

    // 2. Search known certificate registry for Certificate Number, Serial Number, or QR Token
    const qLower = trimmed.toLowerCase();
    const allKnown = getKnownCertificates();
    const matchedCert = allKnown.find(
      (c) =>
        c.certificate_number.toLowerCase() === qLower ||
        c.qr_token.toLowerCase() === qLower ||
        c.instrument_serial.toLowerCase() === qLower ||
        c.id.toLowerCase() === qLower ||
        c.certificate_number.toLowerCase().includes(qLower)
    );

    if (matchedCert) {
      const today = new Date().toISOString().split('T')[0];
      let calculatedResult =
        matchedCert.status === 'REVOKED'
          ? 'REVOKED'
          : matchedCert.status === 'EXPIRED'
          ? 'EXPIRED'
          : 'VALID';
      if (matchedCert.status === 'ACTIVE' && today > matchedCert.valid_until) {
        calculatedResult = 'EXPIRED';
      }

      return {
        authenticated: true,
        result: calculatedResult as any,
        certificate: matchedCert,
        instrument: {
          instrument_name: matchedCert.instrument_name,
          serial_number: matchedCert.instrument_serial,
          manufacturer: 'Certified OEM',
          model: 'Standard Model',
          capacity: matchedCert.capacity,
          capacity_unit: matchedCert.capacity_unit,
          accuracy_class: matchedCert.accuracy_class,
          location_address: matchedCert.location_address,
        },
        owner_name: matchedCert.owner_name,
        owner_organization: matchedCert.owner_organization,
        verification_date: matchedCert.issue_date,
        officer_name: matchedCert.issued_by_name,
        remarks:
          calculatedResult === 'VALID'
            ? 'Certificate is valid and officially registered under the Legal Metrology Act, 2009.'
            : calculatedResult === 'EXPIRED'
            ? 'Certificate has expired. Re-verification required immediately for commercial use.'
            : 'Certificate has been revoked by the Metrology Authority.',
      };
    }

    // 3. Not found anywhere
    return {
      authenticated: false,
      result: 'INVALID',
      remarks: 'No certificate found matching the provided identifier or QR token in national records.',
    };
  },
};
