import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { instrumentsApi } from '../../api/instruments.api';
import { Instrument, InstrumentType, InstrumentStatus } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

export const InstrumentsListPage: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const isAuthorized = user?.role_id === 'INSTRUMENT_OWNER' || user?.role_id === 'ADMIN';

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [types, setTypes] = useState<InstrumentType[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<InstrumentStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && isAuthorized) {
      loadData();
    } else if (!isAuthLoading && !isAuthorized) {
      setIsLoading(false);
    }
  }, [isAuthLoading, isAuthorized, selectedType, selectedStatus, searchQuery]);

  const loadData = async () => {
    if (!isAuthorized) return;
    setIsLoading(true);
    setError(null);
    try {
      const [typeList, instList] = await Promise.all([
        instrumentsApi.getInstrumentTypes(),
        instrumentsApi.listInstruments({
          typeId: selectedType || undefined,
          status: (selectedStatus as InstrumentStatus) || undefined,
          search: searchQuery || undefined,
        }),
      ]);
      setTypes(typeList);
      setInstruments(instList);
    } catch (err: any) {
      setError(err?.message || 'Failed to load instruments list.');
    } finally {
      setIsLoading(false);
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
          description="Weighing & Measuring Instruments are managed exclusively by Instrument Owners and Directorate Administrators. Please visit your designated portal section."
          actionText="Return to Dashboard"
          onAction={() => navigate('/dashboard')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Weighing & Measuring Instruments</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered commercial instruments declared under Section 24 of the Legal Metrology Act, 2009.
          </p>
        </div>
        <Link to="/instruments/new">
          <Button variant="accent" size="md">
            + Register New Instrument
          </Button>
        </Link>
      </div>

      {/* Filters Card */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Instruments</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, serial no, manufacturer..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Instrument Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            >
              <option value="">All Categories & Types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as InstrumentStatus | '')}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE (Certified)</option>
              <option value="REGISTERED">REGISTERED (Pending 1st Verification)</option>
              <option value="INACTIVE">INACTIVE (Due for Renewal)</option>
              <option value="DECOMMISSIONED">DECOMMISSIONED</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      {isLoading ? (
        <LoadingSpinner label="Retrieving registered instruments database..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadData} />
      ) : instruments.length === 0 ? (
        <EmptyState
          title="No Instruments Found"
          description="No weighing or measuring instruments match your search filters. Click below to register your first instrument."
          actionText="Register New Instrument"
          onAction={() => window.location.href = '/instruments/new'}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Instrument Details</th>
                  <th className="py-3.5 px-4">Serial / Reg No.</th>
                  <th className="py-3.5 px-4">Capacity & Class</th>
                  <th className="py-3.5 px-4">Operating Location</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {instruments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{inst.instrument_name}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{inst.instrument_type_name}</div>
                      <div className="text-[10px] text-slate-400">OEM: {inst.manufacturer} ({inst.model})</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-mono font-medium text-slate-800">{inst.serial_number}</div>
                      <div className="font-mono text-[11px] text-emerald-700">
                        {inst.registration_number || 'Pending Assignment'}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">
                        {inst.capacity} {inst.capacity_unit}
                      </div>
                      <div className="text-[11px] text-slate-500">{inst.accuracy_class}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-slate-700 max-w-xs truncate" title={inst.location_address}>
                        {inst.location_address}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Badge status={inst.status} size="sm" />
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <Link to={`/instruments/${inst.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                      <Link to={`/applications/new?instrumentId=${inst.id}`}>
                        <Button variant="accent" size="sm">
                          Apply
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
