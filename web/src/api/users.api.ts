import { apiClient } from './client';

export type ManagedUserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_APPROVAL';

export interface ManagedUser {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: ManagedUserStatus;
  organization_name: string | null;
  address: string | null;
  created_at: string;
}

export interface ManagedUserPage {
  items: ManagedUser[];
  total: number;
  page: number;
  limit: number;
}

export const usersApi = {
  /** ADMIN: list accounts, optionally filtered by status / role / free text. */
  async listUsers(params: { status?: ManagedUserStatus; role?: string; search?: string; page?: number; limit?: number } = {}): Promise<ManagedUserPage> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiClient.get<ManagedUserPage>(`/users${suffix}`);
  },

  /** ADMIN: approve a pending officer, suspend or reactivate an account. */
  async updateStatus(id: string, status: Exclude<ManagedUserStatus, 'PENDING_APPROVAL'>): Promise<ManagedUser> {
    return apiClient.patch<ManagedUser>(`/users/${id}/status`, { status });
  },
};
