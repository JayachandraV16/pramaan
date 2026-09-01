import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { applicationsApi } from "../../api/applications.api";
import { instrumentsApi } from "../../api/instruments.api";
import { assignmentsApi, AvailableOfficer } from "../../api/assignments.api";
import { verificationsApi } from "../../api/verifications.api";
import { certificatesApi } from "../../api/certificates.api";
import { VerificationApplication, VerificationCertificate, Instrument } from "../../types";
import { Card } from "../../components/common/Card";
import { Badge } from "../../components/common/Badge";
import { Button } from "../../components/common/Button";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { ErrorMessage } from "../../components/common/ErrorMessage";
import { EmptyState } from "../../components/common/EmptyState";
import { getFileUrl } from "../../api/client";

export const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAuthorized =
    user?.role_id === "INSTRUMENT_OWNER" ||
    user?.role_id === "GATC" ||
    user?.role_id === "ADMIN" ||
    user?.role_id === "LMO";

  const [app, setApp] = useState<VerificationApplication | null>(null);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [certificate, setCertificate] = useState<VerificationCertificate | null>(null);
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

  // --- Certificate issuance state ---
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [isIssuingCert, setIsIssuingCert] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certSuccess, setCertSuccess] = useState(false);

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
      const [data, allVers] = await Promise.all([
        applicationsApi.getApplicationById(appId),
        verificationsApi.listVerifications().catch(() => []),
      ]);
      if (!data) {
        setError("Verification application record not found.");
      } else {
        const matchingVer = allVers.find(
          (v) => v.application_id === appId || (data.instrument_id && v.instrument_id === data.instrument_id)
        );
        if (matchingVer) {
          data.verification_id = matchingVer.id;
        }
        setApp(data);

        // Fetch authoritative instrument specifications from database
        if (data.instrument_id) {
          try {
            const inst = await instrumentsApi.getInstrumentById(data.instrument_id);
            if (inst) {
              setInstrument(inst);
            }
          } catch {
            // ignore
          }
        }

        if (data.certificate_id) {
          try {
            const cert = await certificatesApi.getCertificateById(data.certificate_id);
            if (cert) setCertificate(cert);
          } catch {
            // ignore
          }
        } else if (data.status === "COMPLETED") {
          try {
            const allCerts = await certificatesApi.listCertificates();
            const found = allCerts.find(
              (c) =>
                (data.verification_id && c.verification_id === data.verification_id) ||
                (data.instrument_id && c.instrument_id === data.instrument_id)
            );
            if (found) setCertificate(found);
          } catch {
            // ignore
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to retrieve application details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setIsIssuingCert(true);
    setCertError(null);
    setCertSuccess(false);
    try {
      let targetVerId = app.verification_id;
      if (!targetVerId) {
        const allVers = await verificationsApi.listVerifications();
        const matchingVer = allVers.find(
          (v) => v.application_id === app.id || (app.instrument_id && v.instrument_id === app.instrument_id)
        );
        targetVerId = matchingVer?.id;
      }

      if (!targetVerId) {
        throw new Error("No completed inspection verification record found for this application. Please ensure the inspection was performed.");
      }

      const newCert = await certificatesApi.createCertificate({
        verificationId: targetVerId,
        instrumentId: app.instrument_id,
        validFrom,
        validUntil,
      });
      setCertificate(newCert);
      setCertSuccess(true);
      await loadApp(app.id);
    } catch (err: any) {
      setCertError(err?.message || "Failed to issue digital certificate.");
    } finally {
      setIsIssuingCert(false);
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
      date: certificate || app.certificate_id ? "Certified" : app.status === "COMPLETED" ? "Awaiting Directorate Sign-off" : "Pending PASS decision",
      done: Boolean(certificate || app.certificate_id),
      desc: certificate || app.certificate_id
        ? "Digital Stamped Certificate with encrypted QR code generated."
        : app.status === "COMPLETED"
        ? "Verification passed. Awaiting Admin to issue official stamped certificate."
        : "Pending physical inspection completion.",
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
                View Digital Certificate
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
                {instrument?.instrument_name || app.instrument_name}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Serial Number:</dt>
              <dd className="font-mono font-bold text-slate-800">
                {instrument?.serial_number || app.instrument_serial}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Manufacturer & Model:</dt>
              <dd className="font-medium text-slate-800 text-right">
                {[instrument?.manufacturer || app.manufacturer, instrument?.model || app.model].filter(Boolean).join(' — ') || '—'}
              </dd>
            </div>
            {((instrument?.capacity ?? app.capacity) !== undefined) && (
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt className="text-slate-500">Max Capacity & Class:</dt>
                <dd className="font-bold text-emerald-800">
                  {instrument?.capacity ?? app.capacity} {instrument?.capacity_unit || app.capacity_unit || ''}{' '}
                  {(instrument?.accuracy_class || app.accuracy_class) ? `(${instrument?.accuracy_class || app.accuracy_class})` : ''}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <dt className="text-slate-500">Classification Type:</dt>
              <dd className="text-slate-800 text-right">
                {instrument?.instrument_type_name || app.instrument_type_name || 'Standard Measuring Instrument'}
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

        {/* Owner / Custodian Card */}
        <Card
          title="Instrument Custodian / Owner"
          subtitle="Registered trader details"
        >
          <dl className="space-y-3 text-xs">
            {(() => {
              const resolvedOwner = [app.owner_name, instrument?.owner_name, app.applicant_name]
                .find(name => name && name !== 'Registered Owner' && name !== 'Registered Applicant') ||
                app.owner_name || instrument?.owner_name || app.applicant_name || '—';

              const resolvedOrg = (app.owner_organization || instrument?.owner_organization || app.applicant_organization);
              const resolvedPhone = (app.owner_phone || instrument?.owner_phone || app.applicant_phone);
              const resolvedEmail = (app.owner_email || instrument?.owner_email || app.applicant_email);
              const resolvedAddress = [instrument?.location_address, app.location_address, (app as any).owner_address, (instrument as any)?.owner_address]
                .find(addr => addr && addr !== 'Registered Location' && addr !== 'Operating Premises' && addr !== '—') ||
                instrument?.location_address || app.location_address || '—';

              const resolvedLat = instrument?.location_lat ?? app.location_lat;
              const resolvedLng = instrument?.location_lng ?? app.location_lng;

              return (
                <>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <dt className="text-slate-500">Owner Name:</dt>
                    <dd className="font-bold text-slate-900">
                      {resolvedOwner}
                    </dd>
                  </div>
                  {resolvedOrg && (
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Firm / Establishment:</dt>
                      <dd className="font-semibold text-slate-800">
                        {resolvedOrg}
                      </dd>
                    </div>
                  )}
                  {resolvedPhone && (
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Contact Number:</dt>
                      <dd className="font-mono font-bold text-emerald-700">
                        <a href={`tel:${resolvedPhone}`} className="hover:underline">
                          {resolvedPhone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {resolvedEmail && (
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <dt className="text-slate-500">Email Address:</dt>
                      <dd className="font-mono text-slate-700">
                        {resolvedEmail}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between pb-1">
                    <dt className="text-slate-500">Physical Site Address:</dt>
                    <dd className="text-slate-800 font-medium text-right max-w-[240px]">
                      {resolvedAddress}
                      {(resolvedLat || resolvedLng) ? (
                        <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                          ({resolvedLat?.toFixed(4)}° N, {resolvedLng?.toFixed(4)}° E)
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </>
              );
            })()}
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

        {/* Verification & Officer Context */}
        <Card
          title="Verification & Field Inspection"
          subtitle="Execution workflow details"
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Application Status:</span>
                <Badge status={app.status} size="sm" />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Submission Date:</span>
                <span className="font-mono text-slate-800">{new Date(app.submitted_at || app.created_at).toLocaleDateString()}</span>
              </div>
              {app.schedule && (
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="text-slate-500">Scheduled Inspection:</span>
                  <span className="font-bold text-slate-900">{app.schedule.scheduled_date}</span>
                </div>
              )}
            </div>

            {app.verification_id ? (
              <Link to={`/verifications/${app.verification_id}`}>
                <Button variant="primary" size="sm" className="w-full">
                  Open Inspection Dossier →
                </Button>
              </Link>
            ) : (
              <p className="text-[11px] text-slate-500 italic text-center pt-2">
                Physical field inspection will be conducted once assigned to the LMO.
              </p>
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
                    <p className="text-[10px] text-slate-600 mt-1 font-mono">
                      Officer ID: {assignedToId}
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

      {/* Certificate Section when Completed */}
      {app.status === "COMPLETED" && (certificate || isAdmin) && (
        <Card
          title={certificate ? "Official Verification Certificate Issued" : "Issue Digital Verification Certificate"}
          subtitle={certificate ? `Certificate ${certificate.certificate_number} registered in National Metrology Database` : "Finalize and generate tamper-proof digital certificate with encrypted QR token and PDF document"}
        >
          {certificate ? (
            <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-950 text-sm">{certificate.certificate_number}</span>
                  <Badge status={certificate.status} size="sm" />
                </div>
                <p className="text-slate-600">
                  Validity Window: <strong>{certificate.valid_from}</strong> to <strong>{certificate.valid_until}</strong>
                </p>
                <p className="text-[11px] text-slate-500 font-mono">QR Token: {certificate.qr_token}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/certificates/${certificate.id}`}>
                  <Button variant="primary" size="sm">
                    View Certificate
                  </Button>
                </Link>
                <a
                  href={getFileUrl(certificate.certificate_file_url || `/uploads/certificates/${certificate.certificate_number}.pdf`)}
                  target="_blank"
                  rel="noreferrer"
                  download={`${certificate.certificate_number}.pdf`}
                >
                  <Button variant="accent" size="sm">
                    Download PDF
                  </Button>
                </a>
              </div>
            </div>
          ) : isAdmin ? (
            <form onSubmit={handleIssueCertificate} className="space-y-4">
              {certError && <ErrorMessage message={certError} title="Issuance Failed" />}
              {certSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium">
                  Digital Certificate generated successfully!
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Validity Start Date (Valid From)</label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pramaan-navy-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Validity Expiry Date (Valid Until)</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pramaan-navy-800 focus:outline-none"
                  />
                </div>
              </div>
              <Button
                type="submit"
                variant="accent"
                size="md"
                isLoading={isIssuingCert}
              >
                Issue & Generate Official Certificate
              </Button>
            </form>
          ) : null}
        </Card>
      )}
    </div>
  );
};
