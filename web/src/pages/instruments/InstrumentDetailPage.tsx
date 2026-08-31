import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { instrumentsApi } from '../../api/instruments.api';
import { Instrument } from '../../types';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

export const InstrumentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAuthorized = user?.role_id === 'INSTRUMENT_OWNER' || user?.role_id === 'ADMIN';

  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && isAuthorized && id) {
      loadInstrument(id);
    } else if (!isAuthLoading && !isAuthorized) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthorized, id]);

  const loadInstrument = async (instId: string) => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await instrumentsApi.getInstrumentById(instId);
      if (!data) {
        setError('Instrument not found in registration database.');
      } else {
        setInstrument(data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch instrument details.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <LoadingSpinner label="Loading technical specifications..." />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <EmptyState
          title="Section Not Available for Your Role"
          description="Weighing & Measuring Instruments are managed exclusively by Instrument Owners and Directorate Administrators."
          actionText="Return to Dashboard"
          onAction={() => navigate('/dashboard')}
        />
      </div>
    );
  }

  if (error || !instrument) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <ErrorMessage message={error || 'Instrument not found'} onRetry={() => id && loadInstrument(id)} />
        <div className="mt-4">
          <Button variant="secondary" onClick={() => navigate('/instruments')}>
            ← Back to Instruments List
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Breadcrumb / Nav */}
      <div className="flex items-center justify-between">
        <Link to="/instruments" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
          ← Back to Instruments
        </Link>
        <Badge status={instrument.status} size="md" />
      </div>

      {/* Title & Quick Actions */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-gov flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
            {instrument.instrument_type_name}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{instrument.instrument_name}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered Serial: <strong className="font-mono text-slate-800">{instrument.serial_number}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/applications/new?instrumentId=${instrument.id}`}>
            <Button variant="accent" size="md">
              Apply for Verification
            </Button>
          </Link>
        </div>
      </div>

      {/* Specifications Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Technical Metrological Parameters */}
        <Card title="Metrological Parameters" subtitle="Declared specifications under Legal Metrology Rules">
          <dl className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <dt className="text-slate-500">Max Capacity</dt>
              <dd className="font-bold text-slate-900 text-sm mt-0.5">
                {instrument.capacity} {instrument.capacity_unit}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Accuracy Class</dt>
              <dd className="font-bold text-slate-900 text-sm mt-0.5">
                {instrument.accuracy_class}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Manufacturer (OEM)</dt>
              <dd className="font-medium text-slate-800 mt-0.5">{instrument.manufacturer || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Model Name / No.</dt>
              <dd className="font-medium text-slate-800 mt-0.5">{instrument.model || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Registration Number</dt>
              <dd className="font-mono font-bold text-emerald-700 mt-0.5">
                {instrument.registration_number || 'Pending Final Stamping'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Initial Registration Date</dt>
              <dd className="font-medium text-slate-800 mt-0.5">{instrument.registration_date}</dd>
            </div>
          </dl>
        </Card>

        {/* Card 2: Operating Location & Owner */}
        <Card title="Deployment Location & Custody" subtitle="Physical site where instrument is inspected & used">
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500">Custodian / Owner:</span>
              <p className="font-semibold text-slate-900 mt-0.5">{instrument.owner_name || 'Registered Owner'}</p>
            </div>
            <div>
              <span className="text-slate-500">Physical Address:</span>
              <p className="font-medium text-slate-800 mt-0.5">{instrument.location_address}</p>
            </div>
            {(instrument.location_lat || instrument.location_lng) && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-4">
                <div>
                  <span className="text-[10px] text-slate-400">GPS Latitude</span>
                  <p className="font-mono text-slate-700">{instrument.location_lat?.toFixed(4)}° N</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">GPS Longitude</span>
                  <p className="font-mono text-slate-700">{instrument.location_lng?.toFixed(4)}° E</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Associated Workflows */}
      <Card title="Statutory Actions" subtitle="Available verification and compliance workflows for this asset">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <h4 className="font-semibold text-slate-900 text-xs">Annual Re-Verification</h4>
            <p className="text-[11px] text-slate-500">
              Submit request for annual calibration and lead seal renewal before expiry date.
            </p>
            <Link to={`/applications/new?instrumentId=${instrument.id}&type=RE_VERIFICATION`}>
              <Button variant="primary" size="sm" className="w-full mt-2">
                Apply Re-Verification
              </Button>
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <h4 className="font-semibold text-slate-900 text-xs">View Stamped Certificates</h4>
            <p className="text-[11px] text-slate-500">
              Access digital certificates issued for this instrument with legal QR tokens.
            </p>
            <Link to="/certificates">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Certificate Vault
              </Button>
            </Link>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
            <h4 className="font-semibold text-slate-900 text-xs">Inspection History</h4>
            <p className="text-[11px] text-slate-500">
              Review past load-point readings, test weight logs, and officer remarks.
            </p>
            <Link to="/verifications">
              <Button variant="outline" size="sm" className="w-full mt-2">
                Verification Logs
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
};
