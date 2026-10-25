import { 
  VerificationCertificate, 
  CertificateStatus, 
} from '../types';
import { apiClient, apiFetch } from './client';

export function mapBackendCertificateToFrontend(item: any): VerificationCertificate {
  return {
    id: item.id,
    verification_id: item.verification_id || item.verificationId || '',
    instrument_id: item.instrument_id || item.instrumentId || '',
    instrument_name: item.instrument_name || item.instrumentName || '',
    instrument_serial: item.serial_number || item.instrument_serial || item.serialNumber || '',
    instrument_type_name: item.instrument_type_name || item.instrumentTypeName || '',
    manufacturer: item.manufacturer || item.instrument_manufacturer || '',
    model: item.model || item.instrument_model || undefined,
    owner_name: item.owner_name || item.ownerName || undefined,
    owner_organization: item.owner_organization || item.ownerOrganization || undefined,
    certificate_number: item.certificate_number || item.certificateNumber || '',
    issue_date: item.issue_date || item.issueDate || '',
    valid_from: item.valid_from || item.validFrom || '',
    valid_until: item.valid_until || item.validUntil || '',
    status: (item.status as CertificateStatus) || 'ACTIVE',
    certificate_file_url: item.certificate_file_url || item.certificateFileUrl || undefined,
    record_sha256: item.record_sha256 || item.recordSha256 || null,
    pdf_sha256: item.pdf_sha256 || item.pdfSha256 || null,
    pdf_signed: !!(item.pdf_signed ?? item.pdfSigned),
    qr_token: item.qr_token || item.qrToken || '',
    verification_decision: item.verification_decision || item.verificationDecision || item.decision || 'PASS',
    issued_by_name: item.issued_by_name || item.issuedByName || item.performed_by_name || '',
    issued_by_designation: item.issued_by_designation || item.issuedByDesignation || '',
    jurisdiction_zone: item.jurisdiction_zone || item.jurisdictionZone || '',
    accuracy_class: item.accuracy_class || item.accuracyClass || '',
    capacity: Number(item.capacity ?? 0),
    capacity_unit: item.capacity_unit || item.capacityUnit || 'kg',
    location_address: item.location_address || item.locationAddress || '',
    generated_at: item.generated_at || item.generatedAt || item.created_at || new Date().toISOString(),
    created_at: item.created_at || item.createdAt || new Date().toISOString(),
    updated_at: item.updated_at || item.updatedAt || new Date().toISOString(),
  };
}

export interface PublicVerificationResponse {
  result: 'VALID' | 'INVALID' | 'EXPIRED' | 'REVOKED';
  valid: boolean;
  tampered: boolean;
  reason: string | null;
  certificate: {
    certificateNumber: string;
    issueDate: string;
    validFrom: string;
    validUntil: string;
    status: string;
    revokedAt?: string | null;
    verificationDate?: string | null;
    instrumentName: string;
    manufacturer?: string | null;
    model?: string | null;
    serialNumber?: string | null;
    capacity?: number | string | null;
    capacityUnit?: string | null;
    accuracyClass?: string | null;
    location?: string | null;
    ownerName?: string | null;
    ownerOrganization?: string | null;
    officerName?: string | null;
  } | null;
  integrity: {
    signature: 'VALID' | 'INVALID' | 'NOT_PROVIDED';
    recordHash: 'MATCH' | 'MISMATCH' | 'UNAVAILABLE';
    pdfSha256: string | null;
    pdfSigned?: boolean;
    signerSubject?: string | null;
    signedAt?: string | null;
    recordFingerprint: string | null;
  } | null;
  verifiedAt: string;
}

export interface DocumentCheckResponse {
  matches: boolean;
  sha256: string;
  certificateNumber?: string;
  status?: string;
  validUntil?: string;
  message: string;
  /** The PDF's own embedded digital signature, checked independently of the registry. */
  signature?: {
    signed: boolean;
    valid?: boolean;
    digestMatches?: boolean;
    coversWholeFile?: boolean;
    subject?: string;
    selfSigned?: boolean;
    reason?: string;
  };
}

function applyFilters(list: VerificationCertificate[], params?: { status?: CertificateStatus; search?: string }) {
  let result = list;
  if (params?.status) {
    result = result.filter((c) => c.status === params.status);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.certificate_number.toLowerCase().includes(q) ||
        c.instrument_name.toLowerCase().includes(q) ||
        c.instrument_serial.toLowerCase().includes(q) ||
        (c.owner_name || '').toLowerCase().includes(q) ||
        c.qr_token.toLowerCase().includes(q)
    );
  }
  return result;
}

export const certificatesApi = {
  /**
   * List certificates from backend GET /api/certificates.
   * Errors are propagated: the UI must never show certificates the server did not return.
   */
  async listCertificates(params?: {
    status?: CertificateStatus;
    search?: string;
  }): Promise<VerificationCertificate[]> {
    const response = await apiClient.get<any[]>('/certificates');
    const list = Array.isArray(response) ? response.map(mapBackendCertificateToFrontend) : [];
    return applyFilters(list, params);
  },

  /**
   * Get single certificate by ID from backend GET /api/certificates/:id
   */
  async getCertificateById(id: string): Promise<VerificationCertificate | null> {
    const response = await apiClient.get<any>(`/certificates/${id}`);
    return response && response.id ? mapBackendCertificateToFrontend(response) : null;
  },

  /**
   * Issue new certificate via POST /api/certificates.
   * instrumentId is derived by the server from the verification; validity
   * dates are optional (server applies the instrument type's default).
   */
  async createCertificate(data: {
    verificationId: string;
    instrumentId?: string;
    validFrom?: string;
    validUntil?: string;
  }): Promise<VerificationCertificate> {
    const response = await apiClient.post<any>('/certificates', data);
    return mapBackendCertificateToFrontend(response);
  },

  /**
   * Revoke a certificate (ADMIN). A reason of at least 10 characters is required.
   */
  async revokeCertificate(id: string, reason: string): Promise<VerificationCertificate> {
    const response = await apiClient.patch<any>(`/certificates/${id}/status`, { status: 'REVOKED', reason });
    return mapBackendCertificateToFrontend(response);
  },

  /**
   * Public verification: GET /api/qr-auth/:identifier (QR token or certificate
   * number). `signature` is the optional `s` value carried by the QR link.
   */
  async verifyPublic(identifier: string, signature?: string): Promise<PublicVerificationResponse> {
    const qs = signature ? `?s=${encodeURIComponent(signature)}` : '';
    return apiClient.get<PublicVerificationResponse>(
      `/qr-auth/${encodeURIComponent(identifier.trim())}${qs}`,
      { headers: { 'X-Access-Source': 'PUBLIC_PORTAL' } }
    );
  },

  /**
   * Public: upload a certificate PDF; the server compares its SHA-256 with the registry.
   */
  async checkDocument(file: File): Promise<DocumentCheckResponse> {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<DocumentCheckResponse>('/qr-auth/check-document', { method: 'POST', body: form });
  },
};
