import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { applicationsApi } from '../../api/applications.api';
import { instrumentsApi } from '../../api/instruments.api';
import { Instrument, ApplicationType } from '../../types';
import { Button } from '../../components/common/Button';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

export const NewApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAuthorized = user?.role_id === 'INSTRUMENT_OWNER' || user?.role_id === 'ADMIN';

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(searchParams.get('instrumentId') || '');
  const [appType, setAppType] = useState<ApplicationType>((searchParams.get('type') as ApplicationType) || 'RE_VERIFICATION');
  const [purpose, setPurpose] = useState(
    'Periodic statutory annual re-verification and stamped seal renewal for commercial trading licence under Legal Metrology Act, 2009.'
  );
  const [remarks, setRemarks] = useState('Standard test weights staged on site. Request morning slot for field inspection.');
  const [isLoadingInstruments, setIsLoadingInstruments] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUserInstruments() {
      if (!isAuthorized) {
        setIsLoadingInstruments(false);
        return;
      }
      try {
        const list = await instrumentsApi.listInstruments();
        setInstruments(list);
        if (!selectedInstrumentId && list.length > 0) {
          setSelectedInstrumentId(list[0].id);
        }
      } catch (err: any) {
        setError('Failed to load registered instruments.');
      } finally {
        setIsLoadingInstruments(false);
      }
    }
    if (!isAuthLoading) {
      loadUserInstruments();
    }
  }, [isAuthLoading, isAuthorized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstrumentId) {
      setError('Please select an instrument to verify.');
      return;
    }
    if (!purpose.trim()) {
      setError('Please provide the purpose of verification.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await applicationsApi.createApplication({
        instrument_id: selectedInstrumentId,
        application_type: appType,
        purpose,
        remarks,
        applicant_id: user?.id,
        applicant_name: user?.full_name,
        applicant_organization: user?.organization_name,
      });
      navigate(`/applications/${created.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit verification application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <LoadingSpinner label="Authenticating permissions..." />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <EmptyState
          title="Section Not Available for Your Role"
          description="Submitting new verification applications is restricted to Instrument Owners and Administrators."
          actionText="Return to Dashboard"
          onAction={() => navigate('/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/applications" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          ← Cancel & Back to Applications
        </Link>
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
          Form 2: Verification Request
        </span>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-gov space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Submit Verification Application</h1>
          <p className="text-xs text-slate-500 mt-1">
            Request an official calibration test, lead seal stamping, and digital certificate from the Legal Metrology Department.
          </p>
        </div>

        {error && <ErrorMessage message={error} />}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Select Instrument */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Registered Weighing / Measuring Instrument *
            </label>
            {instruments.length === 0 && !isLoadingInstruments ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                <p>You have no registered instruments yet.</p>
                <Link to="/instruments/new">
                  <Button variant="accent" size="sm">
                    + Register an Instrument First
                  </Button>
                </Link>
              </div>
            ) : (
              <select
                value={selectedInstrumentId}
                onChange={(e) => setSelectedInstrumentId(e.target.value)}
                disabled={isLoadingInstruments}
                className="w-full px-3 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 focus:bg-white"
              >
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.instrument_name} — Serial: {inst.serial_number} ({inst.capacity} {inst.capacity_unit}, {inst.accuracy_class})
                  </option>
                ))}
              </select>
            )}

            {/* Selected Instrument & Owner Info Box */}
            {(() => {
              const selected = instruments.find((i) => i.id === selectedInstrumentId);
              if (!selected) return null;
              return (
                <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-200/60 pb-1.5">
                    <span className="font-semibold text-slate-700">Custodian / Owner:</span>
                    <span className="font-bold text-slate-900">{selected.owner_name || user?.full_name}</span>
                  </div>
                  <div className="flex justify-between items-start pt-0.5">
                    <span className="text-slate-500 shrink-0">Physical Inspection Address:</span>
                    <span className="font-medium text-slate-800 text-right max-w-[280px]">
                      {selected.location_address || 'Registered Location'}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Verification Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Application Type *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  appType === 'RE_VERIFICATION'
                    ? 'bg-pramaan-navy-50/50 border-pramaan-navy-800 text-pramaan-navy-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="appType"
                  value="RE_VERIFICATION"
                  checked={appType === 'RE_VERIFICATION'}
                  onChange={() => setAppType('RE_VERIFICATION')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold">Annual Re-Verification</p>
                  <p className="text-[11px] text-slate-500">Periodic statutory renewal of stamped seal for already active instruments.</p>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                  appType === 'VERIFICATION'
                    ? 'bg-pramaan-navy-50/50 border-pramaan-navy-800 text-pramaan-navy-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="appType"
                  value="VERIFICATION"
                  checked={appType === 'VERIFICATION'}
                  onChange={() => setAppType('VERIFICATION')}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-xs font-bold">Fresh Initial Verification</p>
                  <p className="text-[11px] text-slate-500">First-time commissioning and stamping before putting newly procured scale to trade use.</p>
                </div>
              </label>
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purpose & Commercial Justification *
            </label>
            <textarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="State the purpose for verification under Legal Metrology Act..."
              required
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 resize-none"
            />
          </div>

          {/* Site Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Site Readiness & Testing Remarks (Optional)
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Notes on standard weights, power source, preferred timing, etc."
              className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800 resize-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link to="/applications">
              <Button type="button" variant="ghost" size="md">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="accent"
              size="md"
              isLoading={isSubmitting}
              disabled={instruments.length === 0}
            >
              Submit Application & Generate ID
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
