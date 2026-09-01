import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { applicationsApi } from "../../api/applications.api";
import { assignmentsApi, AvailableOfficer } from "../../api/assignments.api";
import { VerificationApplication } from "../../types";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorMessage } from "../../components/common/ErrorMessage";
import { EmptyState } from "../../components/common/EmptyState";

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAuthorized =
    user?.role_id === "INSTRUMENT_OWNER" ||
    user?.role_id === "GATC" ||
    user?.role_id === "ADMIN";

  const [app, setApp] = useState<VerificationApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Admin assignment form state ---
  const isAdmin = user?.role_id === "ADMIN";
  const [availableOfficers, setAvailableOfficers] = useState<AvailableOfficer[]>([]);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [assignedToId, setAssignedToId] = useState("");
  const [assignRemarks, setAssignRemarks] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && isAuthorized && id) {
      loadApp(id);
      if (isAdmin) {
        loadOfficers();
      }
    } else if (!isAuthLoading && !isAuthorized) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthorized, id, isAdmin]);

  const loadOfficers = async () => {
    try {
      const list = await assignmentsApi.getAvailableOfficers();
      setAvailableOfficers(list);
      if (list.length > 0 && !assignedToId) {
        setAssignedToId(list[0].id);
      }
    } catch {
      // Fallback to manual entry
    }
  };

  const loadApp = async (appId: string) => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await applicationsApi.getApplicationById(appId);
      if (!data) {
        setError("Verification application record not found.");
      } else {
        setApp(data);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to retrieve application details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app || !assignedToId.trim()) return;

    setIsAssigning(true);
    setAssignError(null);
    setAssignSuccess(false);
    try {
      await assignmentsApi.createAssignment({
        application_id: app.id,
        assigned_to_id: assignedToId.trim(),
        remarks: assignRemarks.trim() || undefined,
      });
      setAssignSuccess(true);
      setAssignedToId("");
      setAssignRemarks("");
      // Backend auto-transitions application status to UNDER_REVIEW on assignment — reload to reflect it
      await loadApp(app.id);
    } catch (err: any) {
      setAssignError(err?.message || "Failed to create assignment.");
    } finally {
      setIsAssigning(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner label="Loading application lifecycle tracking..." />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          title="Section Not Available for Your Role"
          description="Verification Applications are available to Instrument Owners, GATC Test Centres, and Administrators."
          actionText="Return to Dashboard"
          onAction={() => navigate("/dashboard")}
        />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorMessage
          message={error || "Application not found"}
          onRetry={() => id && loadApp(id)}
        />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate("/applications")}>
            ← Back to Applications
          </Button>
        </div>
      </div>
    );
  }

  // Calculate timeline steps
  const statusSteps = [
    {
      title: "Application Submitted",
      date: app.submitted_at
        ? new Date(app.submitted_at).toLocaleString()
        : "Pending",
      done: true,
      desc: "Owner submitted statutory verification request with instrument details.",
    },
    {
      title: "Jurisdiction Assignment",
      date: app.assignment?.assigned_at
        ? new Date(app.assignment.assigned_at).toLocaleString()
        : "Pending",
      done: ["UNDER_REVIEW", "SCHEDULED", "COMPLETED"].includes(app.status),
      desc: app.assignment?.assigned_to_name
        ? `Allocated to ${app.assignment.assigned_to_name}`
        : "Awaiting allocation by Legal Metrology Directorate",
    },
    {
      title: "Inspection Scheduled",
      date: app.schedule?.scheduled_date || "Pending Schedule",
      done: ["SCHEDULED", "COMPLETED"].includes(app.status),
      desc: app.schedule?.scheduled_date
        ? `Scheduled date: ${app.schedule.scheduled_date} (${app.schedule.time_slot || "Standard Slot"})`
        : "Officer/Lab will confirm appointment date",
    },
    {
      title: "Field Verification & Testing",
      date: app.status === "COMPLETED" ? "Completed" : "Pending inspection",
      done: app.status === "COMPLETED",
      desc: "Physical test weight measurements, tolerance checks, and official seal application.",
    },
    {
      title: "Digital Certificate Issuance",
      date: app.status === "COMPLETED" ? "Certified" : "Pending PASS decision",
      done: app.status === "COMPLETED",
      desc: "Digital Stamped Certificate with encrypted QR code generated.",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/applications"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
        >
          ← Back to Applications List
        </Link>
        <Badge status={app.status} size="md" />
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-gov flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono font-bold text-pramaan-gold-700 uppercase tracking-wider">
            {app.application_type === "RE_VERIFICATION"
              ? "Statutory Annual Re-Verification"
              : "Initial Stamping Verification"}
          </span>
          <h1 className="text-2xl font-mono font-bold text-slate-900 mt-0.5">
            {app.application_number}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Applicant: <strong>{app.applicant_name}</strong> (
            {app.applicant_organization})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {app.verification_id && (
            <Link to={`/verifications/${app.verification_id}`}>
              <Button variant="primary" size="md">
                View Inspection Log →
              </Button>
            </Link>
          )}
          {app.certificate_id && (
            <Link to={`/certificates/${app.certificate_id}`}>
              <Button variant="accent" size="md">
                View Digital Certificate 📜
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Lifecycle Status Timeline Card */}
      <Card
        title="Statutory Verification Progress Timeline"
        subtitle="End-to-end processing milestones"
      >
        <div className="py-4">
          <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pl-6">
            {statusSteps.map((step, idx) => (
              <div key={idx} className="relative">
                {/* Dot */}
                <div
                  className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 ${
                    step.done
                      ? "bg-emerald-500 border-emerald-200 text-white"
                      : "bg-white border-slate-300"
                  }`}
                />
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4
                      className={`text-sm font-semibold ${step.done ? "text-slate-900" : "text-slate-400"}`}
                    >
                      {step.title}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-500">
                      {step.date}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Instrument Card */}
        <Card
          title="Target Instrument Under Test"
          subtitle="Declared device specifications"
        >
          <dl className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Instrument Name:</dt>
              <dd className="font-semibold text-slate-900">
                {app.instrument_name}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Serial Number:</dt>
              <dd className="font-mono font-bold text-slate-800">
                {app.instrument_serial}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Classification Type:</dt>
              <dd className="text-slate-800 text-right">
                {app.instrument_type_name}
              </dd>
            </div>
            <div className="pt-2">
              <Link
                to={`/instruments/${app.instrument_id}`}
                className="text-xs font-semibold text-pramaan-navy-800 hover:underline"
              >
                View Full Instrument Dossier →
              </Link>
            </div>
          </dl>
        </Card>

        {/* Application Details */}
        <Card
          title="Statutory Remarks & Purpose"
          subtitle="Applicant submission notes"
        >
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-slate-500 font-semibold block mb-1">
                Declared Purpose:
              </span>
              <p className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
                {app.purpose}
              </p>
            </div>
            {app.remarks && (
              <div>
                <span className="text-slate-500 font-semibold block mb-1">
                  Additional Remarks:
                </span>
                <p className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/60 text-amber-900 leading-relaxed">
                  {app.remarks}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Admin: Assign to LMO/GATC */}
      {isAdmin &&
        !["COMPLETED", "REJECTED", "CANCELLED"].includes(app.status) && (
          <Card
            title="Assign to LMO / GATC Officer"
            subtitle="Allocates this application for field verification. Application status will move to UNDER_REVIEW."
          >
            <form onSubmit={handleAssign} className="space-y-4">
              {assignError && (
                <ErrorMessage message={assignError} title="Assignment Failed" />
              )}
              {assignSuccess && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                  Assignment created successfully.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Assigned Officer (LMO / GATC)
                    </label>
                    {availableOfficers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsManualEntry(!isManualEntry)}
                        className="text-[10px] text-pramaan-navy-800 hover:underline font-medium"
                      >
                        {isManualEntry ? "← Choose auto-detected" : "Manual UUID"}
                      </button>
                    )}
                  </div>

                  {!isManualEntry && availableOfficers.length > 0 ? (
                    <select
                      value={assignedToId}
                      onChange={(e) => {
                        if (e.target.value === "__manual__") {
                          setIsManualEntry(true);
                          setAssignedToId("");
                        } else {
                          setAssignedToId(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 bg-white"
                    >
                      {availableOfficers.map((off) => (
                        <option key={off.id} value={off.id}>
                          {off.name} ({off.role}){off.organization ? ` — ${off.organization}` : ''}
                        </option>
                      ))}
                      <option value="__manual__">+ Enter custom officer ID...</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={assignedToId}
                      onChange={(e) => setAssignedToId(e.target.value)}
                      placeholder="Paste officer's UUID"
                      required
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
                    />
                  )}

                  {assignedToId && !isManualEntry && (
                    <p className="text-[10px] text-emerald-700 mt-1 font-mono">
                      ✓ Auto-selected Officer ID: {assignedToId}
                    </p>
                  )}
                  {availableOfficers.length === 0 && !isManualEntry && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Auto-detects registered and active LMO/GATC officers.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Remarks (optional)
                  </label>
                  <input
                    type="text"
                    value={assignRemarks}
                    onChange={(e) => setAssignRemarks(e.target.value)}
                    placeholder="Any instructions for the officer"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isAssigning}
                disabled={!assignedToId.trim()}
              >
                Create Assignment
              </Button>
            </form>
          </Card>
        )}
    </div>
  );
};
