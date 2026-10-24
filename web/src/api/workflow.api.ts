import { apiClient, API_BASE_URL, ApiError, getAuthToken } from './client';

/* ---------- application history / admin actions ---------- */

export interface StatusHistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  changed_at: string;
  changed_by_name: string | null;
}

export const applicationActionsApi = {
  history: (id: string) => apiClient.get<StatusHistoryEntry[]>(`/applications/${id}/history`),
  reject: (id: string, reason: string) => apiClient.post<unknown>(`/applications/${id}/reject`, { reason }),
  verifyPayment: (id: string) => apiClient.post<unknown>(`/applications/${id}/payment-verified`, {}),
};

/* ---------- queries (officer <-> owner threads) ---------- */

export interface QueryThread {
  id: string;
  application_id: string;
  application_number?: string;
  subject: string;
  status: 'OPEN' | 'CLOSED';
  awaiting: 'APPLICANT' | 'DEPARTMENT' | null;
  message_count?: number;
  last_message?: string | null;
  created_at: string;
  messages?: QueryMessage[];
}

export interface QueryMessage {
  id: string;
  author_id: string;
  author_name: string;
  author_role: string;
  body: string;
  created_at: string;
}

export const queriesApi = {
  list: (applicationId: string) => apiClient.get<QueryThread[]>(`/queries?applicationId=${applicationId}`),
  get: (id: string) => apiClient.get<QueryThread>(`/queries/${id}`),
  create: (applicationId: string, subject: string, message: string) =>
    apiClient.post<QueryThread>('/queries', { applicationId, subject, message }),
  reply: (id: string, body: string) => apiClient.post<unknown>(`/queries/${id}/messages`, { body }),
  close: (id: string) => apiClient.patch<unknown>(`/queries/${id}/close`, {}),
};

/* ---------- fee rules ---------- */

export type FeeKind = 'VERIFICATION' | 'CONVEYANCE' | 'QUARTER_JUMP';

export interface FeeRule {
  id: string;
  fee_kind: FeeKind;
  amount: string | number;
  instrument_type_id: string | null;
  instrument_type_name: string | null;
  application_type: string | null;
  min_capacity: string | number | null;
  max_capacity: string | number | null;
  effective_from: string;
  effective_to: string | null;
  description: string | null;
  is_active: boolean;
}

export interface InstrumentTypeRow {
  id: string;
  name: string;
  default_unit: string | null;
  default_validity_months: number | null;
  is_active: boolean;
}

export const feesApi = {
  rules: () => apiClient.get<FeeRule[]>('/fees/rules'),
  createRule: (body: Record<string, unknown>) => apiClient.post<FeeRule>('/fees/rules', body),
  updateRule: (id: string, body: Record<string, unknown>) => apiClient.patch<FeeRule>(`/fees/rules/${id}`, body),
  types: () => apiClient.get<InstrumentTypeRow[]>('/instruments/types'),
  setValidity: (id: string, defaultValidityMonths: number) =>
    apiClient.patch<InstrumentTypeRow>(`/instruments/types/${id}`, { defaultValidityMonths }),
};

/* ---------- reports ---------- */

export interface ReportSummary {
  generatedAt: string;
  applicationsByStatus: Record<string, number>;
  pendency: { open: number; oldestOpenDays: number | null; ageBuckets: Record<string, number> };
  byDivision: Array<{ division: string; applications: number; completed: number; open: number; closed_without_result: number }>;
  officerWorkload: Array<{ officer_id: string; officer_name: string; role: string; open_assignments: number; completed_assignments: number; declined_assignments: number }>;
  expiryForecast: Array<{ month: string; expiring: number }>;
  instrumentStates: Record<string, number>;
  publicScans: { scans_30d: number; invalid_30d: number; revoked_30d: number } | null;
}

export type ExportDataset = 'applications' | 'certificates' | 'verifications' | 'instruments-due';

export const reportsExtraApi = {
  summary: () => apiClient.get<ReportSummary>('/reports/summary'),

  /** Downloads a CSV export through an authenticated fetch (a plain link cannot send the token). */
  async downloadCsv(dataset: ExportDataset, from?: string, to?: string): Promise<void> {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const token = getAuthToken();
    const res = await fetch(`${API_BASE_URL}/reports/export/${dataset}${qs.toString() ? `?${qs}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
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
    a.download = match ? match[1] : `pramaan-${dataset}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

/* ---------- due list ---------- */

export type DueState = 'NEVER_VERIFIED' | 'VALID' | 'DUE_SOON' | 'OVERDUE' | 'REVOKED';

export interface DueInstrument {
  instrument_id: string;
  instrument_name: string;
  serial_number?: string;
  owner_name: string | null;
  owner_organization: string | null;
  certificate_number: string | null;
  next_due_date: string | null;
  days_until_due: number | null;
  verification_state: DueState;
}

export const dueApi = {
  list: (state?: DueState) => apiClient.get<DueInstrument[]>(`/instruments/due${state ? `?state=${state}` : ''}`),
};

/* ---------- profile ---------- */

export const profileApi = {
  update: (body: { fullName?: string; phone?: string; organizationName?: string; address?: string }) =>
    apiClient.patch<unknown>('/users/me', body),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<unknown>('/users/me/password', { currentPassword, newPassword }),
};


/* ---------- notifications ---------- */

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_application_id: string | null;
  related_certificate_id: string | null;
  created_at: string;
  read_at: string | null;
}

export const notificationsApi = {
  list: () => apiClient.get<AppNotification[]>('/notifications'),
  markRead: (id: string) => apiClient.patch<unknown>(`/notifications/${id}/read`, {}),
  markAllRead: () => apiClient.patch<unknown>('/notifications/read-all', {}),
};
