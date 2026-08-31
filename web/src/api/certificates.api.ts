import { 
  VerificationCertificate, 
  CertificateStatus, 
  PublicVerificationLookupResult,
} from '../types';
import { apiClient } from './client';

export function mapBackendCertificateToFrontend(item: any): VerificationCertificate {
  return {
    id: item.id,
    verification_id: item.verification_id || item.verificationId || '',
    instrument_id: item.instrument_id || item.instrumentId || '',
    instrument_name: item.instrument_name || item.instrumentName || 'Certified Metrology Asset',
    instrument_serial: item.serial_number || item.instrument_serial || item.serialNumber || 'SN-VERIFIED',
    instrument_type_name: item.instrument_type_name || item.instrumentTypeName || 'Weighing / Measuring Instrument',
    owner_name: item.owner_name || item.ownerName || 'Instrument Custodian',
    owner_organization: item.owner_organization || item.ownerOrganization || undefined,
    certificate_number: item.certificate_number || item.certificateNumber || `CERT-${item.id}`,
    issue_date: item.issue_date || item.issueDate || (item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    valid_from: item.valid_from || item.validFrom || (item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
    valid_until: item.valid_until || item.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: (item.status as CertificateStatus) || 'ACTIVE',
    qr_token: item.qr_token || item.qrToken || `PRM-QR-${item.id}`,
    verification_decision: item.verification_decision || item.verificationDecision || 'PASS',
    issued_by_name: item.issued_by_name || item.issuedByName || 'Legal Metrology Officer',
    issued_by_designation: item.issued_by_designation || item.issuedByDesignation || 'Inspector / Metrologist',
    jurisdiction_zone: item.jurisdiction_zone || item.jurisdictionZone || 'Jurisdiction Zone',
    accuracy_class: item.accuracy_class || item.accuracyClass || 'Class III (Medium Accuracy)',
    capacity: Number(item.capacity ?? 0),
    capacity_unit: item.capacity_unit || item.capacityUnit || 'kg',
    location_address: item.location_address || item.locationAddress || 'Premises',
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
      if (!Array.isArray(response)) {
        return [];
      }

      let list = response.map(mapBackendCertificateToFrontend);

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
    } catch (err: any) {
      // If role is unauthorized on /certificates (e.g. LMO or INSTRUMENT_OWNER), return empty list
      if (err.statusCode === 403) {
        return [];
      }
      throw err;
    }
  },

  /**
   * Get single certificate by ID from backend GET /api/certificates/:id
   */
  async getCertificateById(id: string): Promise<VerificationCertificate | null> {
    const response = await apiClient.get<any>(`/certificates/${id}`);
    if (response && response.id) {
      return mapBackendCertificateToFrontend(response);
    }
    return null;
  },

  /**
   * Public QR / Certificate lookup via GET /api/certificates/verify/:qrToken
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

    try {
      const response = await apiClient.get<any>(`/certificates/verify/${encodeURIComponent(trimmed)}`);
      if (response && (response.certificate || response.id)) {
        const certData = response.certificate || response;
        const cert = mapBackendCertificateToFrontend(certData);

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
      // Not found on server
    }

    return {
      authenticated: false,
      result: 'INVALID',
      remarks: 'No certificate found matching the provided identifier or QR token in national records.',
    };
  },
};
