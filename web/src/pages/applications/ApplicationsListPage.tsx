import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { applicationsApi } from '../../api/applications.api';
import { VerificationApplication, ApplicationStatus } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { ErrorMessage } from '../../components/common/ErrorMessage';
import { EmptyState } from '../../components/common/EmptyState';

export const ApplicationsListPage: React.FC = () => {
  const [applications, setApplications] = useState<VerificationApplication[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, [selectedStatus, searchQuery]);

  const loadApplications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await applicationsApi.listApplications({
        status: (selectedStatus as ApplicationStatus) || undefined,
        search: searchQuery || undefined,
      });
      setApplications(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load applications.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Verification Applications</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track and process initial stamping and annual re-verification requests across legal zones.
          </p>
        </div>
        <Link to="/applications/new">
          <Button variant="accent" size="md">
            + New Verification Application
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Search Applications</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by app number (APP-LM-...), instrument name, serial..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Filter by Lifecycle Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ApplicationStatus | '')}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-pramaan-navy-800"
            >
              <option value="">All Applications</option>
              <option value="SUBMITTED">SUBMITTED (Pending Allocation)</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW (Assigned to Officer/Lab)</option>
              <option value="SCHEDULED">SCHEDULED (Field Date Fixed)</option>
              <option value="COMPLETED">COMPLETED (Certified)</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Applications Table */}
      {isLoading ? (
        <LoadingSpinner label="Fetching verification applications..." />
      ) : error ? (
        <ErrorMessage message={error} onRetry={loadApplications} />
      ) : applications.length === 0 ? (
        <EmptyState
          title="No Applications Found"
          description="There are currently no verification applications matching your filter criteria."
          actionText="Create New Application"
          onAction={() => window.location.href = '/applications/new'}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Application No.</th>
                  <th className="py-3.5 px-4">Instrument & Applicant</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Assigned Officer / Lab</th>
                  <th className="py-3.5 px-4">Schedule</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 font-mono font-medium text-slate-900">
                      <Link to={`/applications/${app.id}`} className="hover:underline text-pramaan-navy-900 font-bold">
                        {app.application_number}
                      </Link>
                      <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {new Date(app.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900">{app.instrument_name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{app.instrument_serial}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">{app.applicant_organization || app.applicant_name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {app.application_type === 'RE_VERIFICATION' ? 'Re-Verification' : 'Fresh Initial'}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {app.assignment?.assigned_to_name ? (
                        <div>
                          <p className="font-medium text-slate-800">{app.assignment.assigned_to_name}</p>
                          <Badge status={app.assignment.assigned_to_role} size="sm" className="mt-0.5" />
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {app.schedule?.scheduled_date ? (
                        <div className="text-slate-800">
                          <p className="font-semibold">{app.schedule.scheduled_date}</p>
                          <p className="text-[10px] text-slate-500">{app.schedule.time_slot || 'All Day'}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Not scheduled yet</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <Badge status={app.status} size="sm" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link to={`/applications/${app.id}`}>
                        <Button variant="outline" size="sm">
                          View Details →
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
