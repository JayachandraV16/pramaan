import { VerificationAssignment, AssignmentStatus } from "../types";
import { apiClient } from "./client";

export interface CreateAssignmentPayload {
  application_id: string;
  assigned_to_id: string;
  remarks?: string;
}

/**
 * Data Mapper: Maps backend verification_assignments row (joined with
 * application + user names, see assignments.repository.js) to the
 * frontend VerificationAssignment interface.
 */
export function mapBackendAssignmentToFrontend(
  item: any,
): VerificationAssignment {
  return {
    id: item.id,
    application_id: item.application_id || item.applicationId || "",
    assigned_to_id: item.assigned_to_id || item.assignedToId || "",
    assigned_to_name: item.assigned_to_name || item.assignedToName || undefined,
    assigned_to_role: (item.assigned_to_role || item.assignedToRole) as
      | "LMO"
      | "GATC"
      | undefined,
    assigned_by_name: item.assigned_by_name || item.assignedByName || undefined,
    application_number:
      item.application_number || item.applicationNumber || undefined,
    application_type:
      ((item.application_type || item.applicationType) as any) || undefined,
    application_status:
      ((item.application_status || item.applicationStatus) as any) || undefined,
    status: (item.status as AssignmentStatus) || "ASSIGNED",
    assigned_at:
      item.assigned_at ||
      item.assignedAt ||
      item.created_at ||
      item.createdAt ||
      new Date().toISOString(),
    remarks: item.remarks || undefined,
  };
}

export interface AvailableOfficer {
  id: string;
  name: string;
  role: "LMO" | "GATC";
  organization?: string;
  email?: string;
}

export function recordKnownOfficer(user: {
  id: string;
  full_name: string;
  role_id?: string;
  role?: string;
  organization_name?: string;
  email?: string;
}) {
  const roleName = user.role_id || user.role;
  if (roleName === "LMO" || roleName === "GATC") {
    try {
      const stored = localStorage.getItem("pramaan_known_officers");
      const list: AvailableOfficer[] = stored ? JSON.parse(stored) : [];
      const filtered = list.filter((o) => o.id !== user.id);
      filtered.unshift({
        id: user.id,
        name: user.full_name,
        role: roleName as "LMO" | "GATC",
        organization: user.organization_name,
        email: user.email,
      });
      localStorage.setItem("pramaan_known_officers", JSON.stringify(filtered));
    } catch {}
  }
}

export const assignmentsApi = {
  /**
   * List assignments from backend GET /api/assignments.
   * Backend auto-scopes by role: ADMIN sees all, LMO/GATC see only their own
   * (see assignments.service.js getAssignments) — no client-side filtering needed.
   */
  async listAssignments(): Promise<VerificationAssignment[]> {
    const response = await apiClient.get<any[]>("/assignments");
    if (!Array.isArray(response)) {
      return [];
    }
    return response.map(mapBackendAssignmentToFrontend);
  },

  /**
   * Discovers available LMO/GATC officers across assignments, verifications, and active session registry.
   */
  async getAvailableOfficers(): Promise<AvailableOfficer[]> {
    const officersMap = new Map<string, AvailableOfficer>();

    // 1. Read from persistent known officers registry (populated on login/registration/switch)
    try {
      const stored = localStorage.getItem("pramaan_known_officers");
      if (stored) {
        const list: AvailableOfficer[] = JSON.parse(stored);
        for (const off of list) {
          if (
            off.id &&
            off.role &&
            (off.role === "LMO" || off.role === "GATC")
          ) {
            officersMap.set(off.id, off);
          }
        }
      }
    } catch {}

    // 2. Fetch past assignments (ADMIN sees all assignments with joined user names & roles)
    try {
      const assignments = await this.listAssignments();
      for (const a of assignments) {
        if (a.assigned_to_id && !officersMap.has(a.assigned_to_id)) {
          officersMap.set(a.assigned_to_id, {
            id: a.assigned_to_id,
            name:
              a.assigned_to_name ||
              `Officer (${a.assigned_to_role || "LMO"})`,
            role: a.assigned_to_role || "LMO",
          });
        }
      }
    } catch {}

    // 3. Fetch past verifications
    try {
      const response = await apiClient.get<any[]>("/verifications");
      if (Array.isArray(response)) {
        for (const v of response) {
          const performedId = v.performed_by_id || v.performedById;
          const performedName = v.performed_by_name || v.performedByName;
          if (performedId && !officersMap.has(performedId)) {
            officersMap.set(performedId, {
              id: performedId,
              name: performedName || "Legal Metrology Officer",
              role: "LMO",
            });
          }
        }
      }
    } catch {}

    const result = Array.from(officersMap.values());
    if (result.length > 0) {
      try {
        localStorage.setItem(
          "pramaan_known_officers",
          JSON.stringify(result),
        );
      } catch {}
    }
    return result;
  },

  /**
   * Get single assignment by ID from backend GET /api/assignments/:id
   */
  async getAssignmentById(id: string): Promise<VerificationAssignment | null> {
    const response = await apiClient.get<any>(`/assignments/${id}`);
    if (response && response.id) {
      return mapBackendAssignmentToFrontend(response);
    }
    return null;
  },

  /**
   * ADMIN-only: assign a pending application to an LMO/GATC user via
   * backend POST /api/assignments. Applies application_id/assigned_to_id
   * -> applicationId/assignedToId per assignments.validation.js createAssignmentRules.
   */
  async createAssignment(
    payload: CreateAssignmentPayload,
  ): Promise<VerificationAssignment> {
    const body = {
      applicationId: payload.application_id,
      assignedToId: payload.assigned_to_id,
      remarks: payload.remarks || undefined,
    };

    const response = await apiClient.post<any>("/assignments", body);
    if (!response || !response.id) {
      throw new Error(
        "Failed to create assignment. Invalid response from server.",
      );
    }
    return mapBackendAssignmentToFrontend(response);
  },

  /**
   * Update assignment status (ADMIN or the assigned LMO/GATC only) via
   * backend PATCH /api/assignments/:id/status. Valid statuses per
   * assignments.validation.js: ASSIGNED, ACCEPTED, DECLINED, REASSIGNED, COMPLETED.
   */
  async updateAssignmentStatus(
    id: string,
    status: AssignmentStatus,
    remarks?: string,
  ): Promise<VerificationAssignment> {
    const response = await apiClient.patch<any>(`/assignments/${id}/status`, {
      status,
      remarks,
    });
    if (!response || !response.id) {
      throw new Error(`Failed to update assignment ${id}.`);
    }
    return mapBackendAssignmentToFrontend(response);
  },
};
