import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { assignmentsApi } from "../../api/assignments.api";
import { verificationsApi } from "../../api/verifications.api";
import { VerificationAssignment, AssignmentStatus } from "../../types";
import { Card } from "../../components/common/Card";
import { Button } from "../../components/common/Button";
import { Badge } from "../../components/common/Badge";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorMessage } from "../../components/common/ErrorMessage";
import { EmptyState } from "../../components/common/EmptyState";

export const AssignmentsListPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const isAuthorized =
    user?.role_id === "LMO" ||
    user?.role_id === "GATC" ||
    user?.role_id === "ADMIN";
  const isAdmin = user?.role_id === "ADMIN";

  const [assignments, setAssignments] = useState<VerificationAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tracks the assignment id currently being mutated (status update or verification start)
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && isAuthorized) {
      loadAssignments();
    } else if (!isAuthLoading && !isAuthorized) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthorized]);

  const loadAssignments = async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      // Backend GET /api/assignments auto-scopes: ADMIN sees all, LMO/GATC see only their own
      const list = await assignmentsApi.listAssignments();
      setAssignments(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load assignment queue.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (
    assignment: VerificationAssignment,
    status: AssignmentStatus,
  ) => {
    setActioningId(assignment.id);
    setActionError(null);
    try {
      const updated = await assignmentsApi.updateAssignmentStatus(
        assignment.id,
        status,
      );
      setAssignments((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
    } catch (err: any) {
      setActionError(
        err?.message || `Failed to update assignment ${assignment.id}.`,
      );
    } finally {
      setActioningId(null);
    }
  };

  const handleStartVerification = async (
    assignment: VerificationAssignment,
  ) => {
    setActioningId(assignment.id);
    setActionError(null);
    try {
      const verification = await verificationsApi.createVerification({
        application_id: assignment.application_id,
        assignment_id: assignment.id,
      });
      navigate(`/verifications/${verification.id}`);
    } catch (err: any) {
      setActionError(err?.message || "Failed to start field verification.");
      setActioningId(null);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <LoadingSpinner label="Authenticating permissions..." />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <EmptyState
          title="Section Not Available for Your Role"
          description="Assignment queues are available to Legal Metrology Officers, Approved Test Centres (GATC), and Administrators."
          actionText="Return to Dashboard"
          onAction={() => navigate("/dashboard")}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isAdmin ? "All Assignments" : "My Assignment Queue"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? "Every application assigned to an LMO/GATC officer, across the directorate."
              : "Applications assigned to you by the Legal Metrology Directorate. Accept to begin work."}
          </p>
        </div>
      </div>

      {actionError && (
        <ErrorMessage
          message={actionError}
          onRetry={() => setActionError(null)}
          title="Action Failed"
        />
      )}

      {/* Assignments Table */}
      {isLoading ? (
        <LoadingSpinner label="Fetching assignment records..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadAssignments} />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No Assignments Found"
          description={
            isAdmin
              ? "No applications have been assigned to LMO/GATC officers yet."
              : "You have no assignments right now. Check back after Admin allocates a pending application to you."
          }
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Application</th>
                  {isAdmin && <th className="py-3.5 px-4">Assigned To</th>}
                  <th className="py-3.5 px-4">Assigned By</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned At</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a) => {
                  const isActioning = actioningId === a.id;
                  const canAct = isAdmin || a.assigned_to_id === user?.id;

                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <Link
                          to={`/applications/${a.application_id}`}
                          className="font-mono font-semibold text-slate-900 hover:underline"
                        >
                          {a.application_number || a.application_id}
                        </Link>
                        {a.application_status && (
                          <div className="mt-1">
                            <Badge status={a.application_status} size="sm" />
                          </div>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="py-4 px-4">
                          <p className="font-medium text-slate-900">
                            {a.assigned_to_name || a.assigned_to_id}
                          </p>
                          {a.assigned_to_role && (
                            <p className="text-[10px] text-slate-500">
                              {a.assigned_to_role}
                            </p>
                          )}
                        </td>
                      )}
                      <td className="py-4 px-4 text-slate-700">
                        {a.assigned_by_name || "—"}
                      </td>
                      <td className="py-4 px-4">
                        <Badge status={a.status} size="md" />
                      </td>
                      <td className="py-4 px-4 font-mono text-[11px] text-slate-600">
                        {a.assigned_at
                          ? new Date(a.assigned_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {canAct && a.status === "ASSIGNED" && (
                            <>
                              <Button
                                variant="primary"
                                size="sm"
                                isLoading={isActioning}
                                onClick={() =>
                                  handleStatusUpdate(a, "ACCEPTED")
                                }
                              >
                                Accept
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                isLoading={isActioning}
                                onClick={() =>
                                  handleStatusUpdate(a, "DECLINED")
                                }
                              >
                                Decline
                              </Button>
                            </>
                          )}
                          {canAct && a.status === "ACCEPTED" && (
                            <>
                              <Button
                                variant="accent"
                                size="sm"
                                isLoading={isActioning}
                                onClick={() => handleStartVerification(a)}
                              >
                                Start Verification →
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                isLoading={isActioning}
                                onClick={() =>
                                  handleStatusUpdate(a, "COMPLETED")
                                }
                              >
                                Mark Completed
                              </Button>
                            </>
                          )}
                          {(!canAct ||
                            a.status === "DECLINED" ||
                            a.status === "COMPLETED" ||
                            a.status === "REASSIGNED") && (
                            <Link to={`/applications/${a.application_id}`}>
                              <Button variant="outline" size="sm">
                                View Application →
                              </Button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
