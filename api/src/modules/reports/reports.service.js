// api/src/modules/reports/reports.service.js

const ApiError = require('../../utils/ApiError');
const { toCsv } = require('../../utils/csv');
const repo = require('./reports.repository');

// Brand-neutral palette for the category chart (cycled).
const CHART_FILLS = ['#1a3a5c', '#2e7d6b', '#c9822b', '#7a4f9a', '#b03a48', '#3b7ea1', '#6b7a2e'];

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return null;
  const days = Number(seconds) / 86400;
  if (days >= 1) return `${days.toFixed(1)} days`;
  const hours = Number(seconds) / 3600;
  return `${hours.toFixed(1)} hrs`;
}

// Shape expected by the web dashboard (DashboardOverviewStats) plus extras.
async function getDashboardStats(user) {
  const [counts, byStatus, activity] = await Promise.all([
    repo.dashboardCounts(user),
    repo.applicationsByStatus(user),
    repo.recentActivity(user, 10),
  ]);

  const { pass, total } = counts.results;
  return {
    totalInstruments: counts.instruments.n,
    activeCertificates: counts.activeCerts.n,
    pendingApplications: counts.pending.n,
    completedVerifications: counts.completed.n,
    passRatePercentage: total > 0 ? Math.round((pass / total) * 1000) / 10 : 0,
    avgTurnaround: formatDuration(counts.turnaround.seconds) || undefined,
    recentActivity: activity.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      description: a.description,
      timestamp: a.timestamp,
      status: a.status,
    })),
    // extras beyond the original contract
    expiringIn30Days: counts.expiring.n,
    overdueInstruments: counts.overdue.n,
    awaitingAssignment: counts.awaiting.n,
    applicationsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
  };
}

async function getCategoryWiseApprovals(user) {
  const rows = await repo.approvalsByInstrumentType(user);
  return rows.map((r, i) => ({
    category: r.label.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
    categoryLabel: r.label,
    approvals: r.approvals,
    fill: CHART_FILLS[i % CHART_FILLS.length],
  }));
}

async function getMonthlyTrends(user) {
  const rows = await repo.monthlyTrends(user, 6);
  return rows.map((r) => {
    const decided = r.approved + r.rejected;
    return {
      month: r.month,
      submitted: r.submitted,
      approved: r.approved,
      rejected: r.rejected,
      passRate: decided > 0 ? Math.round((r.approved / decided) * 1000) / 10 : 0,
    };
  });
}

// Management view: pendency, workload by officer, divisions, forecast.
async function getSummary(user) {
  const [pendency, divisions, workload, forecast, states, scans, byStatus] = await Promise.all([
    repo.pendencyBuckets(user),
    repo.byDivision(user),
    repo.officerWorkload(user),
    repo.expiryForecast(user, 12),
    repo.verificationStateCounts(user),
    repo.scanStats(user),
    repo.applicationsByStatus(user),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    applicationsByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
    pendency: {
      open: pendency.total,
      oldestOpenDays: pendency.oldest,
      ageBuckets: {
        '0-7 days': pendency['0-7 days'],
        '8-14 days': pendency['8-14 days'],
        '15-30 days': pendency['15-30 days'],
        'over 30 days': pendency['over 30 days'],
      },
    },
    byDivision: divisions,
    officerWorkload: workload,
    expiryForecast: forecast,
    instrumentStates: Object.fromEntries(states.map((r) => [r.state, r.count])),
    publicScans: scans,
  };
}

function parseDate(value, label) {
  if (value === undefined || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value)) || Number.isNaN(Date.parse(value))) {
    throw ApiError.badRequest(`${label} must be a date in YYYY-MM-DD format`);
  }
  return String(value);
}

async function exportCsv(user, dataset, query) {
  if (!repo.EXPORT_DATASETS.includes(dataset)) {
    throw ApiError.notFound(`Unknown export "${dataset}". Available: ${repo.EXPORT_DATASETS.join(', ')}`);
  }
  const from = parseDate(query.from, 'from');
  const to = parseDate(query.to, 'to');
  if (from && to && from > to) {
    throw ApiError.badRequest('from must not be after to');
  }
  const { columns, rows } = await repo.exportRows(user, dataset, { from, to });
  return {
    filename: `pramaan-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: toCsv(columns, rows),
    rowCount: rows.length,
  };
}

module.exports = {
  getDashboardStats,
  getCategoryWiseApprovals,
  getMonthlyTrends,
  getSummary,
  exportCsv,
};
