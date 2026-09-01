import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { verificationsApi } from '../../api/verifications.api';
import { certificatesApi } from '../../api/certificates.api';
import { instrumentsApi } from '../../api/instruments.api';
import { Verification, VerificationCertificate, Instrument } from '../../types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { getFileUrl } from '../../api/client';

export const VerificationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAuthorized = user?.role_id === 'LMO' || user?.role_id === 'GATC' || user?.role_id === 'ADMIN';
  const isAdmin = user?.role_id === 'ADMIN';

  const [verification, setVerification] = useState<Verification | null>(null);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [certificate, setCertificate] = useState<VerificationCertificate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states for adding observation / reading / submitting final decision
  const [showObsModal, setShowObsModal] = useState(false);
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);

  // Form inputs
  const [obsType, setObsType] = useState('Lead & Wire Official Seal Integrity');
  const [obsDesc, setObsDesc] = useState('Inspect tamper protection seal');
  const [obsVal, setObsVal] = useState('Intact');
  const [obsRemarks, setObsRemarks] = useState('');

  const [rdgType, setRdgType] = useState('Standard Load Point Test');
  const [expectedVal, setExpectedVal] = useState('50.000');
  const [observedVal, setObservedVal] = useState('50.005');
  const [unit, setUnit] = useState('kg');
  const [tolerance, setTolerance] = useState('0.050');
  const [rdgRemarks, setRdgRemarks] = useState('Within permissible error');

  const [finalDecision, setFinalDecision] = useState<'PASS' | 'FAIL'>('PASS');
  const [decisionRemarks, setDecisionRemarks] = useState('All metrological error tolerances and qualitative seal verifications satisfied.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Certificate issuance state
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [isIssuingCert, setIsIssuingCert] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [certSuccess, setCertSuccess] = useState(false);

  useEffect(() => {
    if (!isAuthLoading && isAuthorized && id) {
      loadVerification(id);
    } else if (!isAuthLoading && !isAuthorized) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthorized, id]);

  const loadVerification = async (verId: string) => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await verificationsApi.getVerificationById(verId);
      if (!data) {
        setError('Verification record not found.');
      } else {
        setVerification(data);

        // Fetch authoritative instrument details
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

        // Look up if certificate already exists
        if (data.certificate) {
          setCertificate(data.certificate);
        } else {
          try {
            const allCerts = await certificatesApi.listCertificates();
            const found = allCerts.find(c => c.verification_id === verId || (data.instrument_id && c.instrument_id === data.instrument_id));
            if (found) setCertificate(found);
          } catch {
            // Ignore if certificates list fails
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load verification inspection record.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verification) return;
    setIsIssuingCert(true);
    setCertError(null);
    setCertSuccess(false);
    try {
      const newCert = await certificatesApi.createCertificate({
        verificationId: verification.id,
        instrumentId: verification.instrument_id,
        validFrom,
        validUntil,
      });
      setCertificate(newCert);
      setCertSuccess(true);
      await loadVerification(verification.id);
    } catch (err: any) {
      setCertError(err?.message || 'Failed to issue certificate.');
    } finally {
      setIsIssuingCert(false);
    }
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verification) return;
    setIsSubmitting(true);
    try {
      await verificationsApi.addObservation(verification.id, {
        observation_type: obsType,
        observation_description: obsDesc,
        observed_value: obsVal,
        remarks: obsRemarks,
      });
      setShowObsModal(false);
      loadVerification(verification.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to save observation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verification) return;
    setIsSubmitting(true);

    const exp = Number(expectedVal);
    const obs = Number(observedVal);
    const tol = Number(tolerance);
    const pass = Math.abs(obs - exp) <= tol;

    try {
      await verificationsApi.addReading(verification.id, {
        reading_type: rdgType,
        expected_value: exp,
        observed_value: obs,
        unit,
        tolerance: tol,
        result: pass ? 'PASS' : 'FAIL',
        remarks: rdgRemarks,
      });
      setShowReadingModal(false);
      loadVerification(verification.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to record measurement reading');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verification) return;
    setIsSubmitting(true);
    try {
      await verificationsApi.submitDecision(
        verification.id,
        finalDecision,
        decisionRemarks,
        {
          id: user?.id || '',
          name: user?.full_name || '',
        }
      );
      setShowDecisionModal(false);
      loadVerification(verification.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to sign decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner label="Loading verification inspection sheet..." />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          title="Section Not Available for Your Role"
          description="Field Verifications & Inspections are restricted to Legal Metrology Officers, Approved Test Centres (GATC), and Administrators."
          actionText="Return to Dashboard"
          onAction={() => navigate('/dashboard')}
        />
      </div>
    );
  }

  if (error || !verification) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorMessage message={error || 'Verification record not found'} onRetry={() => id && loadVerification(id)} />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/verifications')}>
            ← Back to Verifications
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Back */}
      <div className="flex items-center justify-between">
        <Link to="/verifications" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          ← Back to Verifications List
        </Link>
        <Badge status={verification.status} size="md" />
      </div>

      {/* Main Inspection Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-gov flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            Official Field Verification Dossier
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{verification.instrument_name}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Application: <strong className="font-mono text-slate-800">{verification.application_number}</strong> • Serial: <strong className="font-mono text-slate-800">{verification.instrument_serial}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {verification.status === 'IN_PROGRESS' && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowObsModal(true)}>
                + Add Qualitative Check
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowReadingModal(true)}>
                + Record Load Reading
              </Button>
              <Button variant="accent" size="sm" onClick={() => setShowDecisionModal(true)}>
                Finalize Decision (PASS/FAIL)
              </Button>
            </>
          )}

          {verification.result && (
            <div className="flex items-center gap-3 flex-wrap">
              <Badge status={verification.result.decision} size="lg">
                Decision: {verification.result.decision}
              </Badge>
              {verification.result.decision === 'PASS' && certificate && (
                <div className="flex items-center gap-2">
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
              )}
            </div>
          )}
        </div>
      </div>

      {/* Physical Inspection Dossier: Owner, Location & Specifications */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Owner / Trader Details */}
        <Card title="Custodian / Owner Profile" subtitle="Physical party present during inspection">
          {(() => {
            const resolvedOwner = [verification.owner_name, instrument?.owner_name]
              .find(name => name && name !== 'Registered Owner' && name !== 'Registered Applicant') ||
              verification.owner_name || instrument?.owner_name || '—';

            const resolvedOrg = verification.owner_organization || instrument?.owner_organization;
            const resolvedPhone = verification.owner_phone || instrument?.owner_phone;
            const resolvedEmail = verification.owner_email || instrument?.owner_email;

            return (
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-500">Legal Custodian / Trader:</span>
                  <p className="font-bold text-slate-900 mt-0.5">{resolvedOwner}</p>
                </div>
                {resolvedOrg && (
                  <div>
                    <span className="text-slate-500">Establishment / Mandi Firm:</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{resolvedOrg}</p>
                  </div>
                )}
                {resolvedPhone && (
                  <div>
                    <span className="text-slate-500">Registered Contact Number:</span>
                    <p className="font-mono font-bold text-emerald-700 mt-0.5">
                      <a href={`tel:${resolvedPhone}`} className="hover:underline">
                        {resolvedPhone}
                      </a>
                    </p>
                  </div>
                )}
                {resolvedEmail && (
                  <div>
                    <span className="text-slate-500">Official Email:</span>
                    <p className="font-mono text-slate-700 mt-0.5">{resolvedEmail}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </Card>

        {/* Card 2: Physical Location & Geo Coordinates */}
        <Card title="Inspection Site & Location" subtitle="Geo-tagged physical verification site">
          {(() => {
            const resolvedAddress = [instrument?.location_address, verification.location_address, verification.location, (instrument as any)?.owner_address]
              .find(addr => addr && addr !== 'Registered Location' && addr !== 'Operating Premises' && addr !== '—') ||
              instrument?.location_address || verification.location_address || verification.location || '—';

            const resolvedLat = instrument?.location_lat ?? verification.location_lat;
            const resolvedLng = instrument?.location_lng ?? verification.location_lng;

            return (
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-500">Premises Address:</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{resolvedAddress}</p>
                </div>
                {(resolvedLat || resolvedLng) ? (
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400">GPS Latitude</span>
                      <p className="font-mono text-slate-700">{resolvedLat?.toFixed(4)}° N</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">GPS Longitude</span>
                      <p className="font-mono text-slate-700">{resolvedLng?.toFixed(4)}° E</p>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span>Jurisdiction: Standard Operating District</span>
                  </div>
                )}
                <div className="pt-1">
                  <span className="text-[11px] text-slate-500">
                    Verification Date: <strong>{verification.verification_date}</strong>
                  </span>
                </div>
              </div>
            );
          })()}
        </Card>

        {/* Card 3: Instrument Technical Specs */}
        <Card title="Technical Specifications" subtitle="Legal metrology asset under test">
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Manufacturer:</span>
              <span className="font-semibold text-slate-900 text-right">{instrument?.manufacturer || verification.manufacturer || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Model:</span>
              <span className="font-mono font-bold text-slate-800">{instrument?.model || verification.model || '—'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Serial Number:</span>
              <span className="font-mono font-bold text-slate-900">{instrument?.serial_number || verification.instrument_serial}</span>
            </div>
            {(instrument?.capacity ?? verification.capacity) !== undefined && (
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Max Capacity:</span>
                <span className="font-bold text-slate-800">{instrument?.capacity ?? verification.capacity} {instrument?.capacity_unit || verification.capacity_unit || 'kg'}</span>
              </div>
            )}
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-500">Accuracy Class:</span>
              <span className="font-semibold text-emerald-700">{instrument?.accuracy_class || verification.accuracy_class || 'Class III'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Final Decision Banner if Completed */}
      {verification.result && (
        <div
          className={`rounded-2xl p-5 border ${
            verification.result.decision === 'PASS'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/80 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  {verification.result.decision === 'PASS' ? 'STATUTORY PASS DECISION' : 'FAILED TOLERANCE VERIFICATION'}
                </span>
                <span className="text-xs font-mono">
                  {new Date(verification.result.result_date).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs mt-1 leading-relaxed opacity-90">{verification.result.remarks}</p>
            </div>
            <div className="text-right text-xs shrink-0">
              <p className="font-semibold">{verification.result.decided_by_name || 'Legal Metrology Officer'}</p>
              <p className="text-[11px] opacity-75">Statutory Sign-Off Authority</p>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Section: Form only visible to ADMIN; Issued certificate visible to all */}
      {verification.result && verification.result.decision === 'PASS' && (certificate || isAdmin) && (
        <Card
          title={certificate ? "Official Verification Certificate Issued" : "Issue Digital Verification Certificate"}
          subtitle={certificate ? `Certificate ${certificate.certificate_number} registered in National Metrology Database` : "Generate tamper-proof digital certificate with encrypted QR token and PDF document"}
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

      {/* Section 1: Quantitative Measurement Readings Table */}
      <Card
        title="Quantitative Measurement & Error Tolerance Readings"
        subtitle="Standard test weight comparison against permissible limits (Schedule IX, Metrology Rules)"
        action={
          verification.status === 'IN_PROGRESS' && (
            <Button variant="outline" size="sm" onClick={() => setShowReadingModal(true)}>
              + Add Reading
            </Button>
          )
        }
      >
        {verification.readings.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 italic text-center">No measurement readings logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <th className="pb-3 pr-4">Test Step / Load Point</th>
                  <th className="pb-3 px-4">Standard Weight (Exp)</th>
                  <th className="pb-3 px-4">Observed Reading</th>
                  <th className="pb-3 px-4">Error vs Tolerance</th>
                  <th className="pb-3 px-4">Result</th>
                  <th className="pb-3 pl-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verification.readings.map((r) => {
                  const errorVal = Number((r.observed_value - (r.expected_value || 0)).toFixed(4));
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4 font-semibold text-slate-900">{r.reading_type}</td>
                      <td className="py-3 px-4 font-mono">{r.expected_value} {r.unit}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{r.observed_value} {r.unit}</td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className={errorVal > r.tolerance ? 'text-rose-600 font-bold' : 'text-slate-600'}>
                          {errorVal >= 0 ? `+${errorVal}` : errorVal} {r.unit}
                        </span>{' '}
                        <span className="text-slate-400">(±{r.tolerance})</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge status={r.result} size="sm">
                          {r.result}
                        </Badge>
                      </td>
                      <td className="py-3 pl-4 text-slate-500 text-[11px]">{r.remarks || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Section 2: Qualitative Inspection Observations Table */}
      <Card
        title="Qualitative Inspection & Tamper Seal Observations"
        subtitle="Visual, mechanical, and tamper-evident wire seal inspection checklist"
        action={
          verification.status === 'IN_PROGRESS' && (
            <Button variant="outline" size="sm" onClick={() => setShowObsModal(true)}>
              + Add Observation
            </Button>
          )
        }
      >
        {verification.observations.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 italic text-center">No qualitative observations logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
                  <th className="pb-3 pr-4">Checklist Category</th>
                  <th className="pb-3 px-4">Description</th>
                  <th className="pb-3 px-4">Observed State</th>
                  <th className="pb-3 pl-4">Officer Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {verification.observations.map((obs) => (
                  <tr key={obs.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{obs.observation_type}</td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">{obs.observation_description}</td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                        {obs.observed_value}
                      </span>
                    </td>
                    <td className="py-3 pl-4 text-slate-600 text-[11px]">{obs.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODAL 1: Add Reading */}
      <Modal
        isOpen={showReadingModal}
        onClose={() => setShowReadingModal(false)}
        title="Record Measurement Reading"
        subtitle="Log load point and tolerance check against calibrated test weight"
      >
        <form onSubmit={handleAddReading} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reading Type / Test Point *</label>
            <input
              type="text"
              value={rdgType}
              onChange={(e) => setRdgType(e.target.value)}
              placeholder="e.g. Zero Load, Half Max Load (50kg), Corner 1"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Standard Value *</label>
              <input
                type="number"
                step="0.0001"
                value={expectedVal}
                onChange={(e) => setExpectedVal(e.target.value)}
                required
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Observed Reading *</label>
              <input
                type="number"
                step="0.0001"
                value={observedVal}
                onChange={(e) => setObservedVal(e.target.value)}
                required
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Unit *</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tolerance (+- Limit) *</label>
              <input
                type="number"
                step="0.0001"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                required
                className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
            <input
              type="text"
              value={rdgRemarks}
              onChange={(e) => setRdgRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowReadingModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Reading
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Add Observation */}
      <Modal
        isOpen={showObsModal}
        onClose={() => setShowObsModal(false)}
        title="Add Qualitative Observation"
        subtitle="Record visual, mechanical, or seal inspection observation"
      >
        <form onSubmit={handleAddObservation} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observation Type *</label>
            <input
              type="text"
              value={obsType}
              onChange={(e) => setObsType(e.target.value)}
              placeholder="e.g. Lead & Wire Seal Integrity, Spirit Level"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observation Description</label>
            <input
              type="text"
              value={obsDesc}
              onChange={(e) => setObsDesc(e.target.value)}
              placeholder="Details of the physical check"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Observed State / Value *</label>
            <input
              type="text"
              value={obsVal}
              onChange={(e) => setObsVal(e.target.value)}
              placeholder="e.g. Intact, Good, No Distortion"
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Officer Notes</label>
            <input
              type="text"
              value={obsRemarks}
              onChange={(e) => setObsRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowObsModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Save Observation
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Submit Final Decision */}
      <Modal
        isOpen={showDecisionModal}
        onClose={() => setShowDecisionModal(false)}
        title="Finalize Metrological Verification Decision"
        subtitle="Sign off on legal stamping and certificate generation"
      >
        <form onSubmit={handleSubmitDecision} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Statutory Decision *</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border cursor-pointer text-center font-bold ${
                  finalDecision === 'PASS'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="finalDecision"
                  value="PASS"
                  checked={finalDecision === 'PASS'}
                  onChange={() => setFinalDecision('PASS')}
                  className="mr-1.5"
                />
                PASS (Issue Certificate)
              </label>

              <label
                className={`p-3 rounded-xl border cursor-pointer text-center font-bold ${
                  finalDecision === 'FAIL'
                    ? 'bg-rose-50 border-rose-500 text-rose-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="finalDecision"
                  value="FAIL"
                  checked={finalDecision === 'FAIL'}
                  onChange={() => setFinalDecision('FAIL')}
                  className="mr-1.5"
                />
                FAIL (Reject & Rectify)
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Official Findings & Sign-Off Remarks *</label>
            <textarea
              rows={3}
              value={decisionRemarks}
              onChange={(e) => setDecisionRemarks(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowDecisionModal(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={finalDecision === 'PASS' ? 'accent' : 'danger'}
              size="sm"
              isLoading={isSubmitting}
            >
              Sign & Stamp Decision
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
