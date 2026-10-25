import { apiClient, API_BASE_URL, ApiError, getAuthToken } from './client';

/* ---------- Command HQ (ADMIN only; the server enforces it) ---------- */

export interface HqDrillRow {
  id: string;
  entity: 'application' | 'certificate' | 'instrument' | 'verification' | 'enforcement' | 'query' | 'nameplate';
  reference: string;
  title: string;
  status: string;
  at: string | null;
  responsible: string | null;
  responsible_id: string | null;
  link: string;
}
export interface HqDrill { metric: string; title: string; entity: string; total: number; limit: number; offset: number; rows: HqDrillRow[] }
export interface HqMetric { id: string; title: string; entity: string; division: boolean }

export interface HqOverview {
  generatedAt: string;
  tiles: Record<string, number>;
  instrumentStates: Record<string, number>;
  pendency: { open: number; oldestOpenDays: number; ageBuckets: Record<string, number> };
  byDivision: Array<{ division: string; applications: number; completed: number; open: number; closed_without_result: number }>;
  officerWorkload: Array<{ officer_id: string; officer_name: string; role: string; open_assignments: number; completed_assignments: number; declined_assignments: number }>;
  expiryForecast: Array<{ month: string; expiring: number }>;
  monthlyTrends: Array<{ month: string; submitted: number; approved: number; rejected: number }>;
  publicScans: unknown;
  enforcement: { totals: { open_cases: number; compliant_spot_checks: number; penalties_total: string }; offenderFlags: Array<{ flag: string; count: number }> };
  attention: Array<{ metric: string; title: string; total: number; rows: HqDrillRow[] }>;
  metrics: HqMetric[];
}

export type MapState = 'NEVER_VERIFIED' | 'VALID' | 'DUE_SOON' | 'OVERDUE' | 'REVOKED';
export interface HqMapData {
  instruments: Array<{ id: string; instrument_name: string; serial_number: string; lat: number; lng: number; state: MapState; certificate_number: string | null; next_due_date: string | null; owner_name: string }>;
  cases: Array<{ id: string; case_number: string; offence_type: string; status: string; lat: number; lng: number; detected_on: string }>;
  truncated: boolean;
}

interface Person { id: string | null; name: string | null }
export interface HqPhoto { id: string; kind: string; fileName: string; file_url: string; sha256: string | null; capturedAt: string | null; uploadedAt: string; gps: { lat: number; lng: number } | null; uploadedBy: Person }
export interface HqCertificateEvidence {
  generatedAt: string;
  certificate: {
    id: string; number: string; status: string; issueDate: string; validFrom: string; validUntil: string; file_url: string | null;
    fingerprints: { recordSha256: string | null; pdfSha256: string | null; recordRecomputed: string; recordMatches: boolean };
    signature: { signed: boolean; subject: string | null; signedAt: string | null };
    issuedBy: { id: string | null; name: string | null; at: string } | null;
    revocation: { at: string; reason: string; by: Person } | null;
  };
  instrument: { id: string; name: string; serialNumber: string; manufacturer: string | null; model: string | null; owner: Person; location: { lat: number; lng: number } | null };
  application: { id: string; number: string };
  verification: { id: string; date: string; startedAt: string | null; endedAt: string | null; location: string | null; startGps: { lat: number; lng: number } | null; officer: Person; decision: string | null; resultSha256: string | null; decidedAt: string | null; decidedBy: Person | null };
  readings: Array<{ id: string; type: string; expected: string | null; observed: string; unit: string; tolerance: string | null; result: string; recordedAt: string }>;
  photos: HqPhoto[];
  nameplateChecks: Array<{ id: string; file_url: string; sha256: string | null; advisory: string; status: string; uploadedBy: string; at: string; reviewedBy: string | null; reviewedAt: string | null; note: string | null }>;
  auditTrail: Array<{ id: number; action: string; at: string; by: Person | null; hash: string; previousHash: string | null }>;
}

export const hqApi = {
  overview: () => apiClient.get<HqOverview>('/hq/overview'),
  map: (state?: MapState | '') => apiClient.get<HqMapData>(`/hq/map${state ? `?state=${state}` : ''}`),
  drill: (metric: string, opts: { division?: string; offset?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (opts.division) qs.set('division', opts.division);
    if (opts.offset) qs.set('offset', String(opts.offset));
    if (opts.limit) qs.set('limit', String(opts.limit));
    return apiClient.get<HqDrill>(`/hq/drill/${metric}${qs.toString() ? `?${qs}` : ''}`);
  },
  certificateEvidence: (id: string) => apiClient.get<HqCertificateEvidence>(`/hq/evidence/certificates/${id}`),

  /** Evidence report as CSV (an authenticated fetch: a plain link cannot send the token). */
  async downloadEvidenceCsv(filters: { status?: string; from?: string; to?: string } = {}): Promise<void> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) qs.set(k, v);
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/hq/evidence/certificates.csv${qs.toString() ? `?${qs}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      let message = `Export failed (${res.status})`;
      try {
        message = (await res.json()).message || message;
      } catch {
        /* not JSON */
      }
      throw new ApiError(message, res.status);
    }
    const match = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') || '');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = match ? match[1] : 'pramaan-evidence.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
