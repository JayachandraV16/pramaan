import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { assignmentsApi } from "../../api/assignments.api";
import { applicationsApi } from "../../api/applications.api";
import { instrumentsApi } from "../../api/instruments.api";
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
  const [filterTab, setFilterTab] = useState<'PENDING' | 'ALL' | 'COMPLETED'>('PENDING');
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
      const [list, apps, insts] = await Promise.all([
        assignmentsApi.listAssignments(),
        applicationsApi.listApplications().catch(() => []),
        instrumentsApi.listInstruments().catch(() => []),
      ]);

      const enriched = list.map((a) => {
        const matchingApp = apps.find(app => app.id === a.application_id);
        const matchingInst = insts.find(i => (matchingApp && i.id === matchingApp.instrument_id) || (a.instrument_serial && i.serial_number === a.instrument_serial));

        const resolvedOwner = [
          a.owner_name,
          matchingApp?.owner_name,
          matchingApp?.applicant_name,
          matchingInst?.owner_name,
        ].find(n => n && n !== '—' && n !== 'Registered Owner' && n !== 'Instrument Custodian');

        const resolvedOrg = a.owner_organization || matchingApp?.owner_organization || matchingApp?.applicant_organization || matchingInst?.owner_organization;
        const resolvedPhone = a.owner_phone || matchingApp?.owner_phone || matchingApp?.applicant_phone || matchingInst?.owner_phone;
        const resolvedAddress = [
          a.location_address,
          matchingApp?.location_address,
          matchingInst?.location_address,
          matchingInst?.owner_address,
        ].find(loc => loc && loc !== '—' && loc !== 'Registered Location');

        const resolvedInstName = a.instrument_name || matchingApp?.instrument_name || matchingInst?.instrument_name;
        const resolvedInstSerial = a.instrument_serial || matchingApp?.instrument_serial || matchingInst?.serial_number;

        return {
          ...a,
          owner_name: resolvedOwner || a.owner_name || '—',
          owner_organization: resolvedOrg,
          owner_phone: resolvedPhone,
          location_address: resolvedAddress || a.location_address,
          instrument_name: resolvedInstName || a.instrument_name,
          instrument_serial: resolvedInstSerial || a.instrument_serial,
          assigned_by_name: a.assigned_by_name || 'Admin Directorate',
        };
      });

      setAssignments(enriched);
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

      {/* Tab Filter Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-semibold">
        <button
          onClick={() => setFilterTab('PENDING')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors ${
            filterTab === 'PENDING'
              ? 'bg-pramaan-navy-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Pending / Active ({assignments.filter(a => a.status !== 'COMPLETED' && a.application_status !== 'COMPLETED' && a.status !== 'DECLINED').length})
        </button>
        <button
          onClick={() => setFilterTab('ALL')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors ${
            filterTab === 'ALL'
              ? 'bg-pramaan-navy-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All ({assignments.length})
        </button>
        <button
          onClick={() => setFilterTab('COMPLETED')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors ${
            filterTab === 'COMPLETED'
              ? 'bg-pramaan-navy-900 text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Completed ({assignments.filter(a => a.status === 'COMPLETED' || a.application_status === 'COMPLETED').length})
        </button>
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
      ) : assignments.filter((a) => {
          const isFinished = a.status === 'COMPLETED' || a.application_status === 'COMPLETED' || a.status === 'DECLINED';
          if (filterTab === 'PENDING') return !isFinished;
          if (filterTab === 'COMPLETED') return isFinished;
          return true;
        }).length === 0 ? (
        <EmptyState
          title={filterTab === 'PENDING' ? "No Pending Assignments" : "No Assignments Found"}
          description={
            filterTab === 'PENDING'
              ? "All allocated verification tasks are completed or no new tasks have been assigned."
              : isAdmin
              ? "No applications have been assigned to LMO/GATC officers yet."
              : "You have no assignments matching this filter."
          }
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Application & Instrument</th>
                  <th className="py-3.5 px-4">Owner / Trader & Location</th>
                  {isAdmin && <th className="py-3.5 px-4">Assigned To</th>}
                  <th className="py-3.5 px-4">Assigned By</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assigned At</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments
                  .filter((a) => {
                    const isFinished = a.status === 'COMPLETED' || a.application_status === 'COMPLETED' || a.status === 'DECLINED';
                    if (filterTab === 'PENDING') return !isFinished;
                    if (filterTab === 'COMPLETED') return isFinished;
                    return true;
                  })
                  .map((a) => {
                    const isActioning = actioningId === a.id;
                    const canAct = isAdmin || a.assigned_to_id === user?.id;
                    const isFinished = a.status === 'COMPLETED' || a.application_status === 'COMPLETED' || a.status === 'DECLINED';

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
                          {a.instrument_name && (
                            <p className="font-semibold text-slate-800 text-xs mt-0.5">
                              {a.instrument_name}
                            </p>
                          )}
                          {a.instrument_serial && (
                            <p className="font-mono text-[10px] text-slate-500">
                              SN: {a.instrument_serial}
                            </p>
                          )}
                          {a.application_status && (
                            <div className="mt-1">
                              <Badge status={a.application_status} size="sm" />
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-semibold text-slate-900">
                            {a.owner_name || "—"}
                          </p>
                          {a.owner_organization && (
                            <p className="text-[11px] text-slate-600">
                              {a.owner_organization}
                            </p>
                          )}
                          {a.owner_phone && (
                            <p className="text-[11px] font-mono text-emerald-700">
                              {a.owner_phone}
                            </p>
                          )}
                          {a.location_address && (
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              {a.location_address}
                            </p>
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
                            {isFinished ? (
                              <Link to={`/applications/${a.application_id}`}>
                                <Button variant="outline" size="sm">
                                  View Record →
                                </Button>
                              </Link>
                            ) : canAct && a.status === "ASSIGNED" ? (
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
                            ) : canAct && a.status === "ACCEPTED" ? (
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
                            ) : (
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
